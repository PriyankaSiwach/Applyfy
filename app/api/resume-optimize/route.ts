import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { extractJobTitleFromPosting } from "@/lib/jobMetaFromPosting";
import { filterKeywordLabelsToJobPosting } from "@/lib/jobKeywordInPosting";
import { filterAtsKeywordLabels } from "@/lib/jobKeywordSanitize";
import {
  blocksToPlain,
  countBulletsChangedBetweenPlain,
  pairBulletRewritesAligned,
  parseResumeIntoBlocks,
} from "@/lib/resumeEditorBlocks";
import type { RewrittenBulletEntry } from "@/lib/resumeOptimizeRewrites";
import { revertIncompleteSentenceRewrites } from "@/lib/resumeOptimizeRewrites";
import { preserveKeywordsAcrossResume } from "@/lib/resumeOptimizePreserveKeywords";
import {
  generateCompetitiveAssessment,
  phaseOneRewriteAllBullets,
  phaseSkillsReorder,
  phaseThreePolish,
  phaseTwoStructureResume,
  zipRewrittenBulletsForClient,
  type CompetitiveAssessment,
} from "@/lib/resumeOptimizeTwoPhase";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 120;

const MAX_RESUME = 48_000;
const MAX_JOB = 60_000;

function sanitizeKeywordStringArray(
  v: unknown,
  jobDescription: string,
): string[] {
  if (!Array.isArray(v)) return [];
  const raw = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  let out = filterAtsKeywordLabels(raw);
  if (jobDescription.length >= 40) {
    out = filterKeywordLabelsToJobPosting(jobDescription, out);
  }
  return out;
}

export async function POST(request: Request) {
  const keyCheck = requireOpenAiApiKey();
  if (!keyCheck.ok) {
    return jsonNoStore({ error: keyCheck.error }, { status: 503 });
  }
  const openaiKey = keyCheck.key;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const resumeText =
    typeof o.resumeText === "string"
      ? o.resumeText.replace(/\r\n/g, "\n").trim().slice(0, MAX_RESUME)
      : "";
  const jobDescription =
    typeof o.jobDescription === "string"
      ? o.jobDescription.replace(/\r\n/g, "\n").trim().slice(0, MAX_JOB)
      : "";

  const kwRaw = o.atsKeywords;
  let atsKeywords = filterAtsKeywordLabels(
    Array.isArray(kwRaw)
      ? kwRaw
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean)
      : [],
  );
  if (jobDescription.length >= 40) {
    atsKeywords = filterKeywordLabelsToJobPosting(jobDescription, atsKeywords);
  }
  const atsKeywordsCsv =
    atsKeywords.length > 0 ? atsKeywords.join(", ") : "(see job description)";

  const jobTitleFromClient =
    typeof o.jobTitle === "string" ? o.jobTitle.replace(/\r\n/g, "\n").trim() : "";
  const jobTitle =
    jobTitleFromClient || extractJobTitleFromPosting(jobDescription);

  if (!resumeText || resumeText.length < 10) {
    return jsonNoStore(
      { error: "resumeText is required (at least 10 characters)." },
      { status: 400 },
    );
  }

  try {
    const blocks = parseResumeIntoBlocks(resumeText);

    const phase1 = await phaseOneRewriteAllBullets(
      openaiKey,
      blocks,
      atsKeywordsCsv,
      jobDescription,
      atsKeywords,
      jobTitle,
    );
    const intermediate = blocksToPlain(phase1.blocks);

    const phase2 = await phaseTwoStructureResume(
      openaiKey,
      intermediate,
      jobDescription,
      atsKeywordsCsv,
      jobTitle,
    );

    let optimizedResume = phase2.optimizedResume;

    const zipped = zipRewrittenBulletsForClient(resumeText, optimizedResume);
    let rewrites: RewrittenBulletEntry[] = zipped.map((r) => ({
      original: r.original,
      rewritten: r.rewritten,
      keyword: null,
      improvement: null,
    }));

    const reverted = revertIncompleteSentenceRewrites(optimizedResume, rewrites);
    optimizedResume = reverted.resume;
    rewrites = reverted.rewrites;

    optimizedResume = preserveKeywordsAcrossResume(
      resumeText,
      optimizedResume,
      atsKeywords,
    );
    const zippedAfterPreserve = zipRewrittenBulletsForClient(
      resumeText,
      optimizedResume,
    );
    rewrites = zippedAfterPreserve.map((r) => ({
      original: r.original,
      rewritten: r.rewritten,
      keyword: null,
      improvement: null,
    }));
    const reverted2 = revertIncompleteSentenceRewrites(optimizedResume, rewrites);
    optimizedResume = reverted2.resume;
    rewrites = reverted2.rewrites;

    // Phase 3 (quantification + verb diversity) and competitive assessment run concurrently.
    const [phase3Result, competitiveResult] = await Promise.allSettled([
      phaseThreePolish(openaiKey, optimizedResume, jobDescription),
      generateCompetitiveAssessment(openaiKey, optimizedResume, jobDescription),
    ]);

    if (
      phase3Result.status === "fulfilled" &&
      typeof phase3Result.value === "string" &&
      phase3Result.value.length > 100
    ) {
      const p3 = phase3Result.value;
      const zippedP3 = zipRewrittenBulletsForClient(resumeText, p3);
      const rewritesP3: RewrittenBulletEntry[] = zippedP3.map((r) => ({
        original: r.original,
        rewritten: r.rewritten,
        keyword: null,
        improvement: null,
      }));
      const revertedP3 = revertIncompleteSentenceRewrites(p3, rewritesP3);
      if (revertedP3.resume && revertedP3.resume.length > 100) {
        optimizedResume = revertedP3.resume;
        rewrites = revertedP3.rewrites;
      }
    } else if (phase3Result.status === "rejected") {
      console.error("[resume-optimize phase3]", phase3Result.reason);
    }

    const competitiveAssessment: CompetitiveAssessment | null =
      competitiveResult.status === "fulfilled" ? competitiveResult.value : null;
    if (competitiveResult.status === "rejected") {
      console.error("[resume-optimize competitive]", competitiveResult.reason);
    }

    // Phase 4: skills section reordering (sequential after phase 3, fast single-section call)
    try {
      const reordered = await phaseSkillsReorder(
        openaiKey,
        optimizedResume,
        jobDescription,
      );
      if (reordered && reordered.length > 100) optimizedResume = reordered;
    } catch (e) {
      console.error("[resume-optimize skills-reorder]", e);
    }

    // Strip "Tailored for: …" from the resume body — render it as a UI badge only.
    const tailoredLineRe = /^[ \t]*Tailored for:.*\r?\n?/im;
    const tailoredLineMatch = optimizedResume.match(tailoredLineRe);
    const extractedTailoredTitle = tailoredLineMatch
      ? tailoredLineMatch[0].replace(/^[ \t]*Tailored for:\s*/i, "").replace(/\r?\n$/, "").trim()
      : null;
    if (tailoredLineMatch) {
      optimizedResume = optimizedResume
        .replace(tailoredLineRe, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    const sanitizedMissedKw = sanitizeKeywordStringArray(
      phase2.missedKeywords,
      jobDescription,
    );
    const biggestGap = sanitizedMissedKw.length > 0 ? sanitizedMissedKw[0] : null;

    // Count + client diff: prefer block-aligned walk; fall back to index zip if empty.
    const mapRw = (
      rows: { original: string; rewritten: string }[],
    ): RewrittenBulletEntry[] =>
      rows.map((r) => ({
        original: r.original,
        rewritten: r.rewritten,
        keyword: null,
        improvement: null,
      }));

    const alignedPairs = pairBulletRewritesAligned(resumeText, optimizedResume);
    const zipPairs = zipRewrittenBulletsForClient(
      resumeText,
      optimizedResume,
    ).filter((r) => r.original.trim() !== r.rewritten.trim());

    const rewrittenBulletsOut =
      alignedPairs.length > 0 ? mapRw(alignedPairs) : mapRw(zipPairs);
    const bulletPlainDiffCount = countBulletsChangedBetweenPlain(
      resumeText,
      optimizedResume,
    );

    return jsonNoStore({
      optimizedResume,
      tailoredForTitle: extractedTailoredTitle || jobTitle || null,
      rewrittenBullets: rewrittenBulletsOut,
      bulletsRewrittenCount: Math.max(
        rewrittenBulletsOut.length,
        bulletPlainDiffCount,
      ),
      summaryAdded: phase2.summaryAdded,
      atsKeywordsInjected: sanitizeKeywordStringArray(
        phase2.atsKeywordsInjected,
        jobDescription,
      ),
      missedKeywords: sanitizedMissedKw,
      competitiveAssessment,
      biggestGap,
    });
  } catch (e) {
    console.error("[resume-optimize]", e);
    const msg = e instanceof Error ? e.message : "Request failed";
    return jsonNoStore({ error: msg }, { status: 502 });
  }
}
