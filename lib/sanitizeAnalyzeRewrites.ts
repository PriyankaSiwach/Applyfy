/**
 * Server-side guards so analyze `rewrites` never ship fabricated skill/tool lists
 * or extra lines that are not supported by the original resume text.
 */

function normBlob(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export function lineCountNonEmpty(s: string): number {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
}

/** Verbatim or whitespace-flexible occurrence in resume. */
export function originalLineInResume(
  resumePlain: string,
  original: string,
): boolean {
  const t = original.trim();
  if (t.length < 4) return false;
  if (resumePlain.includes(t)) return true;
  const a = normBlob(resumePlain);
  const b = normBlob(t);
  return b.length >= 6 && a.includes(b);
}

const FABRICATED_LIST_PREFIX =
  /^\s*(tools?|soft\s*skills?|domain\s*knowledge|operations\s*&\s*logistics|operations|logistics|data\s*&\s*analytics|data\s+and\s+analytics|technical\s*skills?|core\s*competencies|expertise|skills?|erp(?:\s*systems?)?|netsuite|\bsap\b|\boracle\b|compliance(?:\s+frameworks?)?|regulatory\s+requirements?|inventory\s+accounting|supply\s+chain|customer\s+experience)\s*:/i;

/** "Operations & logistics: a, b" style lines that were not on the original resume. */
function rewrittenIntroducesAmpersandCategoryDump(
  original: string,
  rewritten: string,
): boolean {
  const origLines = original.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rewLines = rewritten.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const origHasSameShape = origLines.some(
    (l) => /\s&\s/.test(l) && l.includes(":") && l.includes(","),
  );
  if (origHasSameShape) return false;
  return rewLines.some((l) => {
    if (!/\s&\s/.test(l) || !l.includes(":") || !l.includes(",")) return false;
    const before = l.slice(0, l.indexOf(":")).trim();
    if (before.length < 5 || before.length > 56) return false;
    if (/^\d/.test(before)) return false;
    const after = l.slice(l.indexOf(":") + 1).trim();
    return after.split(",").filter((p) => p.trim().length > 2).length >= 2;
  });
}

function rewrittenIntroducesLabeledList(
  original: string,
  rewritten: string,
): boolean {
  const origLines = original.split(/\r?\n/).map((l) => l.trim());
  const rewLines = rewritten.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of rewLines) {
    if (!FABRICATED_LIST_PREFIX.test(line)) continue;
    const matchedInOriginal = origLines.some((ol) =>
      FABRICATED_LIST_PREFIX.test(ol),
    );
    if (!matchedInOriginal) return true;
  }
  return false;
}

/**
 * Keep first line (the rewrite). Drop following lines unless they appear in the resume.
 */
export function stripTrailingLinesNotInResume(
  rewritten: string,
  resumePlain: string,
): { text: string; dropped: number } {
  const lines = rewritten.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length <= 1) {
    return { text: nonEmpty[0] ?? rewritten.trim(), dropped: 0 };
  }
  const blob = normBlob(resumePlain);
  const kept = [nonEmpty[0]!];
  let dropped = 0;
  for (let i = 1; i < nonEmpty.length; i++) {
    const line = nonEmpty[i]!;
    const seg = normBlob(line);
    if (seg.length >= 8 && blob.includes(seg)) {
      kept.push(line);
    } else {
      dropped += 1;
    }
  }
  return { text: kept.join(" "), dropped };
}

export type SanitizedRewriteRow = {
  original: string;
  rewritten: string;
  section: string;
  whyBetter: string;
  alreadyCoversSkill?: boolean;
};

export type SanitizeRewritesResult = {
  rewrites: SanitizedRewriteRow[];
  needsRetry: boolean;
  notes: string[];
};

function parseBool(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "string" && v.toLowerCase() === "true") return true;
  return false;
}

/**
 * Validates and sanitizes model `rewrites` array. Sets `needsRetry` if output
 * was severely bad (so caller can retry OpenAI once).
 */
export function sanitizeAnalyzeRewrites(
  raw: unknown,
  resumePlain: string,
): SanitizeRewritesResult {
  const notes: string[] = [];
  let needsRetry = false;
  if (!Array.isArray(raw)) {
    return { rewrites: [], needsRetry: true, notes: ["rewrites not an array"] };
  }

  const out: SanitizedRewriteRow[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    let original = typeof o.original === "string" ? o.original.trim() : "";
    let rewritten = typeof o.rewritten === "string" ? o.rewritten.trim() : "";
    const section = typeof o.section === "string" ? o.section.trim() : "";
    let whyBetter =
      typeof o.whyBetter === "string" ? o.whyBetter.trim() : "";
    const alreadyCoversSkill = parseBool(
      o.alreadyCoversSkill ?? o.already_covers_skill,
    );

    if (!original || !rewritten || !section || !whyBetter) continue;

    if (!originalLineInResume(resumePlain, original)) {
      notes.push("dropped rewrite: original not found in resume");
      needsRetry = true;
      continue;
    }

    const lo = lineCountNonEmpty(original);
    let lr = lineCountNonEmpty(rewritten);

    if (lr > lo + 2) {
      notes.push("line budget exceeded");
      needsRetry = true;
      const firstLine = rewritten.split(/\r?\n/).map((l) => l.trim())[0];
      rewritten = (firstLine ?? rewritten).trim();
      lr = lineCountNonEmpty(rewritten);
    }

    if (rewrittenIntroducesAmpersandCategoryDump(original, rewritten)) {
      notes.push("fake category row (e.g. Operations & logistics: …) removed");
      needsRetry = true;
      rewritten = original;
      whyBetter =
        "Suggested text looked like a fake category/skill row; your original line was kept.";
    } else if (rewrittenIntroducesLabeledList(original, rewritten)) {
      notes.push("labeled list fabrication removed");
      needsRetry = true;
      const { text, dropped } = stripTrailingLinesNotInResume(
        rewritten,
        resumePlain,
      );
      rewritten = text;
      if (dropped > 0) notes.push(`dropped ${dropped} unsupported line(s)`);
      const first = rewritten.split(/\r?\n/).map((l) => l.trim())[0] ?? "";
      if (
        FABRICATED_LIST_PREFIX.test(first) &&
        !FABRICATED_LIST_PREFIX.test(
          original.split(/\r?\n/).map((l) => l.trim())[0] ?? "",
        )
      ) {
        rewritten = original;
        whyBetter =
          "Suggested text looked like a fabricated skill list; your original line was kept.";
      }
    }

    const strip = stripTrailingLinesNotInResume(rewritten, resumePlain);
    if (strip.dropped > 0) {
      needsRetry = true;
      notes.push(`stripped ${strip.dropped} line(s) not present in resume`);
    }
    rewritten = strip.text;

    if (lineCountNonEmpty(rewritten) > lo + 2) {
      rewritten = rewritten.split(/\r?\n/).map((l) => l.trim())[0] ?? original;
      needsRetry = true;
    }

    if (!rewritten.trim()) {
      rewritten = original;
    }

    out.push({
      original,
      rewritten,
      section,
      whyBetter,
      ...(alreadyCoversSkill ? { alreadyCoversSkill: true } : {}),
    });
  }

  return { rewrites: out, needsRetry, notes };
}

/** Pad with identity pairs from real resume lines so downstream always has 6 slots. */
export function padRewritesToSix(
  rows: SanitizedRewriteRow[],
  resumePlain: string,
): SanitizedRewriteRow[] {
  const out = [...rows];
  if (out.length >= 6) return out.slice(0, 6);
  const used = new Set(out.map((r) => normBlob(r.original)));
  const lines = resumePlain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 12);

  for (const t of lines) {
    if (/^https?:\/\//i.test(t)) continue;
    const key = normBlob(t);
    if (key.length < 12 || used.has(key)) continue;
    used.add(key);
    out.push({
      original: t.slice(0, 700),
      rewritten: t.slice(0, 700),
      section: "Resume",
      whyBetter:
        "Kept unchanged — no automated rewrite needed for this line after safety checks.",
    });
    if (out.length >= 6) break;
  }

  return out.slice(0, 6);
}
