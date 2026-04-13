/**
 * Parse resume plain text into blocks: • starts a bullet in any section; "- "/"* "/"1."
 * style lines are bullets under experience, projects, or **other** (e.g. before a header).
 * Hyphen lines in SKILLS, EDUCATION, CERTIFICATIONS stay plain (not bullet blocks).
 */

export type ResumeSection =
  | "experience"
  | "projects"
  | "education"
  | "skills"
  | "certifications"
  | "other";

export type PlainBlock = {
  id: string;
  kind: "plain";
  lines: string[];
};

export type BulletBlock = {
  id: string;
  kind: "bullet";
  lines: string[];
  section: ResumeSection;
};

export type ResumeBlock = PlainBlock | BulletBlock;

let blockIdSeq = 0;
function nextBlockId(): string {
  blockIdSeq += 1;
  return `rb-${blockIdSeq}`;
}

/** True if trimmed line starts a • bullet. */
export function isBulletStart(trimmed: string): boolean {
  return trimmed.length > 0 && trimmed.startsWith("•");
}

/**
 * Hyphen / asterisk / en-dash bullets (common under roles; not used in SUMMARY
 * parsing — only • breaks summary body there).
 */
export function isHyphenBulletStart(trimmed: string): boolean {
  return /^[-*–—]\s+\S/.test(trimmed);
}

/** Numbered bullet like "1. Delivered" or "2) Built" under a role. */
export function isNumberedBulletStart(trimmed: string): boolean {
  return /^\d{1,2}[\.)]\s+\S/.test(trimmed);
}

/**
 * Starts a bullet block for parsing. • in any section; "- "/"* "/"1." bullets in
 * experience, projects, or **other** (covers resumes with no ALL-CAPS header yet, or
 * title-case headers we do not detect). Skipped in skills / education / certifications
 * so comma lists and coursework stay plain.
 */
export function isExperienceBulletStart(
  trimmed: string,
  section: ResumeSection,
): boolean {
  if (isBulletStart(trimmed)) return true;
  if (
    section === "skills" ||
    section === "education" ||
    section === "certifications"
  ) {
    return false;
  }
  if (isHyphenBulletStart(trimmed)) return true;
  if (isNumberedBulletStart(trimmed)) return true;
  return false;
}

/** Section title: visually all-caps line (e.g. EXPERIENCE, WORK HISTORY). */
export function isSectionHeader(trimmed: string): boolean {
  if (trimmed.length < 3 || trimmed.length > 72) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  return trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

/** Section headers like SUMMARY / PROFESSIONAL SUMMARY: body must merge into same block as the header. */
export function isSummaryStyleSectionHeader(trimmed: string): boolean {
  if (!isSectionHeader(trimmed)) return false;
  const u = trimmed.toUpperCase();
  if (/\bEXPERIENCE\s+SUMMARY\b/.test(u)) return false;
  return (
    u === "SUMMARY" ||
    u === "OBJECTIVE" ||
    u === "PROFILE" ||
    /\bPROFESSIONAL\s+SUMMARY\b/.test(u) ||
    /\bCAREER\s+OBJECTIVE\b/.test(u) ||
    /\bEXECUTIVE\s+SUMMARY\b/.test(u)
  );
}

function capitalizeFirstAlphabeticCharOfFirstSummaryBodyLine(lines: string[]): void {
  for (let j = 1; j < lines.length; j++) {
    const line = lines[j]!;
    const t = line.trim();
    if (!t) continue;
    const leadLen = line.length - line.trimStart().length;
    const ch = line.charAt(leadLen);
    if (/[a-z]/.test(ch)) {
      lines[j] =
        line.slice(0, leadLen) +
        ch.toUpperCase() +
        line.slice(leadLen + 1);
    }
    break;
  }
}

export function mapHeaderToSection(trimmed: string): ResumeSection {
  const u = trimmed.toUpperCase();
  if (
    /\bEXPERIENCE\b/.test(u) ||
    /\bEMPLOYMENT\b/.test(u) ||
    /\bWORK\s+HISTORY\b/.test(u) ||
    /\bPROFESSIONAL\s+HISTORY\b/.test(u) ||
    /\bRELATED\s+EXPERIENCE\b/.test(u) ||
    /\bINTERNSHIP(S)?\b/.test(u) ||
    /\bVOLUNTEER(ING)?\b/.test(u) ||
    /\bLEADERSHIP\s+EXPERIENCE\b/.test(u)
  ) {
    return "experience";
  }
  if (/\bPROJECTS?\b/.test(u)) return "projects";
  if (/\bEDUCATION\b/.test(u) || /\bACADEMIC\b/.test(u)) return "education";
  if (/\bCERTIFICATIONS?\b/.test(u) || /\bLICENSES?\b/.test(u)) {
    return "certifications";
  }
  if (
    /\bSKILLS?\b/.test(u) ||
    /\bTECHNICAL\b/.test(u) ||
    /\bCORE\s+COMPETENCIES\b/.test(u) ||
    /\bCOMPETENCIES\b/.test(u)
  ) {
    return "skills";
  }
  return "other";
}

/** Patterns that mark a line as factual / non-narrative — never send to bullet rewrite. */
const BULLET_SKIP_PATTERNS: RegExp[] = [
  /coursework/i,
  /\bGPA\b/i,
  /dean'?s?\s+list/i,
  /\bcertified\b/i,
  /\bcertification\b/i,
  /\bissued\b/i,
  /languages?\s*:/i,
  /databases?\s*:/i,
  /libraries?\s*:/i,
  /\bskills?\s*:/i,
];

/** Long comma-heavy inventory (tools, courses, facts) — not a narrative bullet. */
export function looksLikeFactualCommaInventory(joined: string): boolean {
  const oneLine = joined
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
  const body = oneLine
    .replace(/^•\s*/, "")
    .replace(/^[-*–—]\s+/, "")
    .replace(/^\d{1,2}[\.)]\s+/, "")
    .trim();
  if (body.length < 36) return false;
  const commas = (body.match(/,/g) ?? []).length;
  if (commas < 4) return false;
  const segments = body
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 5) return false;
  const avg =
    segments.reduce((a, s) => a + s.length, 0) / Math.max(1, segments.length);
  return avg <= 42;
}

export function shouldRewriteBulletForOptimize(block: BulletBlock): boolean {
  if (
    block.section !== "experience" &&
    block.section !== "projects" &&
    block.section !== "other"
  ) {
    return false;
  }
  const joined = bulletJoined(block);
  if (BULLET_SKIP_PATTERNS.some((p) => p.test(joined))) return false;
  if (looksLikeFactualCommaInventory(joined)) return false;
  return true;
}

export function parseResumeIntoBlocks(plain: string): ResumeBlock[] {
  blockIdSeq = 0;
  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const blocks: ResumeBlock[] = [];
  let section: ResumeSection = "other";
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i]!;
    const t = raw.trim();

    if (isSectionHeader(t)) {
      section = mapHeaderToSection(t);
      if (isSummaryStyleSectionHeader(t)) {
        const parts: string[] = [raw];
        i++;
        while (i < lines.length) {
          const L = lines[i]!;
          const lt = L.trim();
          if (isSectionHeader(lt)) break;
          if (isBulletStart(lt)) break;
          parts.push(L);
          i++;
        }
        capitalizeFirstAlphabeticCharOfFirstSummaryBodyLine(parts);
        blocks.push({ id: nextBlockId(), kind: "plain", lines: parts });
        continue;
      }
      blocks.push({ id: nextBlockId(), kind: "plain", lines: [raw] });
      i++;
      continue;
    }

    if (isExperienceBulletStart(t, section)) {
      const parts: string[] = [raw];
      i++;
      while (i < lines.length) {
        const L = lines[i]!;
        const lt = L.trim();
        if (isSectionHeader(lt)) break;
        if (isExperienceBulletStart(lt, section)) break;
        parts.push(L);
        i++;
      }
      blocks.push({
        id: nextBlockId(),
        kind: "bullet",
        lines: parts,
        section,
      });
      continue;
    }

    const parts: string[] = [raw];
    i++;
    while (i < lines.length) {
      const L = lines[i]!;
      const lt = L.trim();
      if (isSectionHeader(lt)) break;
      if (isExperienceBulletStart(lt, section)) break;
      parts.push(L);
      i++;
    }
    blocks.push({ id: nextBlockId(), kind: "plain", lines: parts });
  }

  return blocks;
}

export function blocksToPlain(blocks: ResumeBlock[]): string {
  return blocks.map((b) => b.lines.join("\n")).join("\n");
}

/** Join bullet physical lines (preserve newlines for undo / editor). */
export function bulletJoined(block: BulletBlock): string {
  return block.lines.join("\n");
}

/** One logical line for the model: merge wrapped bullet lines with spaces. */
export function bulletCollapsedToOneLine(block: BulletBlock): string {
  return block.lines
    .map((l) => l.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strict: AI meaningfully changed the bullet. */
export function bulletTextChanged(beforeJoined: string, afterJoined: string): boolean {
  const a = beforeJoined.replace(/\r\n/g, "\n").trimEnd();
  const b = afterJoined.replace(/\r\n/g, "\n").trimEnd();
  if (a === b) return false;
  const norm = (s: string) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) !== norm(b);
}

/** Bullet blocks only, in document order (ignores plain / header blocks between bullets). */
function extractBulletBlocksOrdered(plain: string): BulletBlock[] {
  return parseResumeIntoBlocks(plain.replace(/\r\n/g, "\n")).filter(
    (b): b is BulletBlock => b.kind === "bullet",
  );
}

/**
 * How many bullets differ between two resume plain texts: pairwise compare the Nth bullet
 * to the Nth (using the same normalization as bulletTextChanged), plus any extra/missing
 * bullets as additional changes. `beforePlain` must be the snapshot taken before optimize.
 */
export function countBulletsChangedBetweenPlain(
  beforePlain: string,
  afterPlain: string,
): number {
  const ob = extractBulletBlocksOrdered(beforePlain);
  const fb = extractBulletBlocksOrdered(afterPlain);
  const n = Math.min(ob.length, fb.length);
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (bulletTextChanged(bulletJoined(ob[i]!), bulletJoined(fb[i]!))) c++;
  }
  c += Math.abs(ob.length - fb.length);
  return c;
}

/**
 * Pair pre/post bullets by reading order (bullet blocks only). Interleaved plain blocks no
 * longer desynchronize pairing — the main fix for empty diff lists and "0 bullets rewritten".
 */
export function pairBulletRewritesAligned(
  originalPlain: string,
  finalPlain: string,
): { original: string; rewritten: string }[] {
  const ob = extractBulletBlocksOrdered(originalPlain.replace(/\r\n/g, "\n"));
  const fb = extractBulletBlocksOrdered(finalPlain.replace(/\r\n/g, "\n"));
  const pairs: { original: string; rewritten: string }[] = [];
  const n = Math.min(ob.length, fb.length);
  for (let i = 0; i < n; i++) {
    const oj = bulletJoined(ob[i]!);
    const fj = bulletJoined(fb[i]!);
    if (bulletTextChanged(oj, fj)) {
      pairs.push({ original: oj, rewritten: fj });
    }
  }
  return pairs;
}

/** Inline AI chrome only for bullets that are eligible for optimize rewrite. */
export function shouldSendBulletToAi(block: BulletBlock): boolean {
  return shouldRewriteBulletForOptimize(block);
}

/** Leading bullet / number marker on the first physical line (preserve after rewrite). */
function originalListPrefix(firstLine: string): string | null {
  const m = firstLine.match(
    /^(\s*)((?:•)|[-*–—]|\d{1,2}[\.)])(\s+)/,
  );
  if (!m) return null;
  return `${m[1] ?? ""}${m[2] ?? ""}${m[3] ?? ""}`;
}

export function applyRewrittenBulletLines(
  originalLines: string[],
  rewrittenJoined: string,
): string[] {
  const first = originalLines[0] ?? "";
  const rw = rewrittenJoined.replace(/\r\n/g, "\n").trim();
  if (!rw) return originalLines;
  const parts = rw.split("\n");
  if (parts.length === 0) return originalLines;
  const head = parts[0]!.trimStart();
  if (
    isBulletStart(head) ||
    isHyphenBulletStart(head) ||
    isNumberedBulletStart(head)
  ) {
    return parts;
  }
  const prefix = originalListPrefix(first);
  if (prefix) {
    parts[0] = `${prefix}${parts[0]!.trimStart()}`;
    return parts;
  }
  return parts;
}
