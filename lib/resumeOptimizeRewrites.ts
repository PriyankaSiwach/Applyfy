export type RewrittenBulletEntry = {
  original: string;
  rewritten: string;
  keyword?: string | null;
  improvement?: string | null;
};

/** True if text looks like a complete sentence (ends with . ! ? …). */
export function bulletEndsWithSentencePunctuation(text: string): boolean {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return false;
  return /[.!?…]["')\]]?\s*$/.test(t);
}

/** True if rewrite should be discarded (truncated / no sentence end). */
export function bulletRewriteMissingSentenceEnd(rw: string): boolean {
  const t = rw.replace(/\r\n/g, "\n").trim();
  if (!t) return true;
  return !bulletEndsWithSentencePunctuation(t);
}

/** Parse rewrittenBullets from model JSON. */
export function parseRewrittenBullets(
  parsed: Record<string, unknown>,
): RewrittenBulletEntry[] {
  const raw = parsed.rewrittenBullets;
  if (!Array.isArray(raw)) return [];
  const out: RewrittenBulletEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const original = typeof o.original === "string" ? o.original : "";
    const rewritten = typeof o.rewritten === "string" ? o.rewritten : "";
    const keyword =
      o.keyword === null || o.keyword === undefined
        ? null
        : typeof o.keyword === "string"
          ? o.keyword
          : null;
    const improvement =
      o.improvement === null || o.improvement === undefined
        ? null
        : typeof o.improvement === "string"
          ? o.improvement
          : null;
    out.push({ original, rewritten, keyword, improvement });
  }
  return out;
}

/** How many entries have identical original vs rewritten (trimmed). */
export function countUnchangedRewrites(rewrites: RewrittenBulletEntry[]): number {
  return rewrites.filter(
    (r) => r.original.trim() === r.rewritten.trim(),
  ).length;
}

export function optimizeResumeRetryUserMessage(unchangedCount: number): string {
  return `You left ${unchangedCount} bullet(s) in rewrittenBullets where "original" and "rewritten" are the same after trim. That violates the rules. Rewrite them now.

Return a complete new JSON object with the same schema: optimizedResume plus rewrittenBullets where EVERY bullet has rewritten text strictly different from original (trimmed). Each rewritten bullet must end with sentence punctuation (. ! or ?). Regenerate the full optimizedResume so it matches those rewrites.`;
}

/**
 * If a rewritten bullet lacks ending punctuation, swap it back to original in the resume text.
 */
export function revertIncompleteSentenceRewrites(
  optimizedResume: string,
  rewrites: RewrittenBulletEntry[],
): { resume: string; rewrites: RewrittenBulletEntry[] } {
  let resume = optimizedResume.replace(/\r\n/g, "\n");
  const next = rewrites.map((r) => ({ ...r }));
  const order = next
    .map((r, i) => ({ i, len: r.rewritten.replace(/\r\n/g, "\n").length }))
    .sort((a, b) => b.len - a.len);

  for (const { i } of order) {
    const r = next[i]!;
    const rew = r.rewritten.replace(/\r\n/g, "\n");
    const orig = r.original.replace(/\r\n/g, "\n");
    if (!rew.trim() || !orig.trim()) continue;
    if (bulletEndsWithSentencePunctuation(rew)) continue;
    const idx = resume.indexOf(rew);
    if (idx >= 0) {
      resume = resume.slice(0, idx) + orig + resume.slice(idx + rew.length);
    }
    r.rewritten = orig;
    r.improvement =
      `${r.improvement ?? ""} (reverted: incomplete sentence)`.trim();
  }
  return { resume, rewrites: next };
}
