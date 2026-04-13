import type { Analysis } from "@/lib/analysisTypes";

/**
 * Match / breakdown UI: use hybrid ATS from analyze + resume editor when set,
 * and recompute composite matchScore so the ring matches the four pillars.
 */
export function analysisForMatchDisplay(
  baseline: Analysis | null,
  committedHybridAtsScore: number | null,
): Analysis | null {
  if (!baseline) return null;
  const raw =
    committedHybridAtsScore !== null
      ? committedHybridAtsScore
      : baseline.atsScore;
  const displayAts = Math.min(100, Math.max(0, Math.round(raw)));
  const matchScore = Math.round(
    (baseline.skillsMatch +
      baseline.experienceMatch +
      baseline.educationMatch +
      displayAts) /
      4,
  );
  return {
    ...baseline,
    atsScore: displayAts,
    matchScore,
  };
}
