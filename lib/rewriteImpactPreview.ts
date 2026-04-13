/**
 * Heuristic "impact" tags for rewrite hover — no extra API calls.
 */

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "has",
  "was",
  "were",
  "been",
  "being",
  "their",
  "they",
  "using",
  "used",
  "also",
  "into",
  "over",
  "such",
  "through",
]);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

export function inferRewriteImpactTags(
  original: string,
  rewritten: string,
): string[] {
  const o = new Set(words(original));
  const rw = words(rewritten);
  const novel = rw.filter((w) => !o.has(w));
  const tags: string[] = [];

  const rwLower = rewritten.toLowerCase();
  const origLower = original.toLowerCase();

  if (
    /cross[- ]?functional|stakeholder|interdisciplinary/.test(rwLower) &&
    !/cross[- ]?functional|stakeholder/.test(origLower)
  ) {
    tags.push("Cross-functional");
  }
  if (
    /\bled\b|leadership|managed|mentored|directed|oversaw/.test(rwLower) &&
    !/\bled\b|managed|mentored/.test(origLower)
  ) {
    tags.push("Leadership signal");
  }
  if (
    /deliverable|timeline|milestone|sprint|roadmap|coordinated/.test(rwLower) &&
    !/deliverable|timeline|sprint/.test(origLower)
  ) {
    tags.push("Project delivery");
  }
  if (
    /\d+%|\$\d|million|thousand|x faster|reduced|increased|improved/.test(
      rwLower,
    ) &&
    !/\d+%/.test(origLower)
  ) {
    tags.push("Measurable impact");
  }

  for (const w of novel.slice(0, 4)) {
    if (tags.length >= 4) break;
    const cap = w.charAt(0).toUpperCase() + w.slice(1);
    if (!tags.some((t) => t.toLowerCase() === w)) tags.push(cap);
  }

  return tags.slice(0, 4);
}
