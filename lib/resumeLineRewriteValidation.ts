import { lineMatchesFabricationPattern } from "@/lib/resumeFabricationPurge";

/** Sentence count for one bullet (avoids splitting decimals like 3.5). */
export function countSentencesRough(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z"(])/).filter((s) => s.trim().length > 0);
  return parts.length;
}

/**
 * Server-side checks for optimize flow: sentences, length ratio, fabrication patterns.
 */
export function validateOptimizedBullet(
  originalBullet: string,
  rewritten: string,
  _fullResumePlain: string,
): { ok: true } | { ok: false; error: string } {
  const orig = originalBullet.trim();
  const rew = rewritten.trim();
  if (!orig) return { ok: false, error: "Empty original." };
  if (!rew) return { ok: false, error: "Empty rewrite." };

  if (countSentencesRough(rew) > 2) {
    return { ok: false, error: "More than two sentences." };
  }

  if (rew.length > orig.length * 2.75) {
    return { ok: false, error: "Output too long vs input." };
  }

  if (lineMatchesFabricationPattern(rew)) {
    return { ok: false, error: "Fabricated inventory-style line." };
  }

  return { ok: true };
}
