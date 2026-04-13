/**
 * After LLM rewrites, ensure literal keywords/tools from the original bullet
 * are not dropped — coverage can only stay the same or increase.
 */

import { isKeywordLiterallyPresent } from "@/lib/atsDeterministicKeywords";
import {
  applyRewrittenBulletLines,
  blocksToPlain,
  bulletJoined,
  parseResumeIntoBlocks,
  type BulletBlock,
  type ResumeBlock,
} from "@/lib/resumeEditorBlocks";
import { isUsableAtsKeywordLabel } from "@/lib/jobKeywordSanitize";

/** Common tools/languages often dropped by generic rewrites; only used if present in original. */
const EXTRA_TECH_FROM_ORIGINAL =
  /\b(?:Python|Java(?:Script)?|TypeScript|Ruby|PHP|Swift|Kotlin|Go|Rust|Scala|Perl|C\+\+|C#|SQL|HTML|CSS|MATLAB|Excel|Tableau|Power\s*BI|Salesforce|SAP|Oracle|MongoDB|PostgreSQL|MySQL|Redis|DynamoDB|Elasticsearch|AWS|GCP|Azure|Docker|Kubernetes|Terraform|Ansible|Jenkins|GitHub|GitLab|React\.?js|Vue\.?js|Angular|Node\.js|Django|Flask|Spring|\.NET|pandas|NumPy|PyTorch|TensorFlow|scikit-learn|Spark|Hadoop|Kafka|Airflow)\b/gi;

function uniquePreserveCase(
  originalLine: string,
  terms: string[],
): string[] {
  const lowerSeen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const k = t.trim();
    if (!k) continue;
    const lk = k.toLowerCase();
    if (lowerSeen.has(lk)) continue;
    lowerSeen.add(lk);
    const idx = originalLine.toLowerCase().indexOf(lk);
    if (idx >= 0) {
      out.push(originalLine.slice(idx, idx + k.length));
    } else {
      out.push(k);
    }
  }
  return out;
}

function collectTermsPresentInOriginal(
  originalBullet: string,
  jobAtsKeywords: string[],
): string[] {
  const out: string[] = [];
  for (const kw of jobAtsKeywords) {
    if (!isUsableAtsKeywordLabel(kw)) continue;
    if (isKeywordLiterallyPresent(kw, originalBullet)) {
      out.push(kw.trim());
    }
  }
  let m: RegExpExecArray | null;
  const re = new RegExp(EXTRA_TECH_FROM_ORIGINAL.source, EXTRA_TECH_FROM_ORIGINAL.flags);
  re.lastIndex = 0;
  while ((m = re.exec(originalBullet)) !== null) {
    const t = m[0].trim();
    if (t.length >= 2) out.push(t);
  }
  return uniquePreserveCase(originalBullet, out);
}

function termsMissingFromRewritten(
  originalBullet: string,
  rewrittenBullet: string,
  jobAtsKeywords: string[],
): string[] {
  const candidates = collectTermsPresentInOriginal(originalBullet, jobAtsKeywords);
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const term of candidates) {
    if (!isKeywordLiterallyPresent(term, originalBullet)) continue;
    if (isKeywordLiterallyPresent(term, rewrittenBullet)) continue;
    const lk = term.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    missing.push(term);
  }
  return missing;
}

/**
 * If the rewrite dropped any literal term that was in the original bullet,
 * append a short clause so ATS literal coverage does not decrease.
 */
export function preserveKeywordsInBulletText(
  originalBullet: string,
  rewrittenBullet: string,
  jobAtsKeywords: string[],
): string {
  const missing = termsMissingFromRewritten(
    originalBullet,
    rewrittenBullet,
    jobAtsKeywords,
  );
  if (missing.length === 0) return rewrittenBullet;

  const tail = missing.join(", ");
  const t = rewrittenBullet.trim();
  const punctMatch = /([.!?])(\s*)$/.exec(t);
  if (punctMatch) {
    const body = t.slice(0, -punctMatch[0].length).trimEnd();
    return `${body}, including ${tail}${punctMatch[1]}${punctMatch[2] ?? ""}`;
  }
  return `${t}, including ${tail}.`;
}

/**
 * Final safety pass: phase-2 structure can reorder wording — re-apply per-bullet
 * preservation so nothing present in the pre-optimize resume is lost literally.
 */
export function preserveKeywordsAcrossResume(
  originalPlain: string,
  finalPlain: string,
  jobAtsKeywords: string[],
): string {
  const origBlocks = parseResumeIntoBlocks(
    originalPlain.replace(/\r\n/g, "\n"),
  );
  const finBlocks = parseResumeIntoBlocks(finalPlain.replace(/\r\n/g, "\n"));
  const origBullets = origBlocks.filter(
    (b): b is BulletBlock => b.kind === "bullet",
  );
  let bulletIdx = 0;
  const next: ResumeBlock[] = finBlocks.map((b) => {
    if (b.kind !== "bullet") return b;
    const i = bulletIdx++;
    if (i >= origBullets.length) return b;
    const oJoin = bulletJoined(origBullets[i]!);
    const fJoin = bulletJoined(b);
    const merged = preserveKeywordsInBulletText(oJoin, fJoin, jobAtsKeywords);
    if (merged === fJoin) return b;
    return {
      ...b,
      lines: applyRewrittenBulletLines(b.lines, merged),
    };
  });
  return blocksToPlain(next);
}
