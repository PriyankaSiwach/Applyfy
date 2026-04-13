/**
 * Normalize AI-returned synonym map for deterministic resume matching.
 * Keys are lowercase trimmed ATS labels; values are lowercase phrases for substring checks.
 */

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function sanitizeSynonymStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    if (typeof x !== "string") continue;
    const t = normKey(x);
    if (t.length < 2 || t.length > 72) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Build lookup map keyed by normalized keyword label. */
export function normalizeSynonymMapFromApi(
  raw: unknown,
  canonicalKeywords: string[],
): Record<string, string[]> {
  const rawObj =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const fromAi = new Map<string, string[]>();
  for (const [k, v] of Object.entries(rawObj)) {
    const nk = normKey(k);
    if (!nk) continue;
    fromAi.set(nk, sanitizeSynonymStrings(v));
  }

  const out: Record<string, string[]> = {};
  for (const label of canonicalKeywords) {
    const nk = normKey(label);
    if (!nk) continue;
    out[nk] = [...(fromAi.get(nk) ?? [])];
  }
  return out;
}
