/** 1-based indices: Free 1–5; Pro 1–14; Premium 1–18 */

export type PricingPageTier = "free" | "pro" | "premium";

export type MasterFeature = {
  label: string;
  freeSub?: string;
  proSub?: string;
};

export const MASTER_FEATURES: MasterFeature[] = [
  { label: "Resume & job analyses", freeSub: "3 total on Free" },
  { label: "ATS score (keyword & phrasing fit)" },
  { label: "Quick wins", freeSub: "Top 3" },
  { label: "ATS keywords (matched / missing)" },
  { label: "Matched strengths", freeSub: "2 visible" },
  { label: "ATS score history chart" },
  { label: "\"Ready to apply\" readiness panel" },
  { label: "Follow-up email draft (Analyze)" },
  { label: "Full gaps & fixes" },
  { label: "Resume Editor (AI rewrites)" },
  { label: "Match score + keyword table" },
  { label: "Cover letter (tones, lengths, PDF / DOCX / TXT)" },
  { label: "Interview prep (intro, Q&A, STAR, risks)" },
  { label: "Application tracker (unlimited, edit & delete)" },
  { label: "Interview Simulator (scored practice)" },
  { label: "Salary negotiation coach" },
  { label: "Generate more interview questions" },
  { label: "Follow-up email (Interview prep)" },
  { label: "Priority roadmap features", proSub: "Same as Premium for now" },
];

export function isFeatureUnlocked(
  tier: PricingPageTier,
  index: number,
): boolean {
  if (tier === "free") return index <= 5;
  if (tier === "pro") return index <= 14;
  return index <= 18;
}

export function lockedFeatureTooltip(
  tier: PricingPageTier,
  index: number,
): string | null {
  if (isFeatureUnlocked(tier, index)) return null;
  if (tier === "free") {
    if (index <= 14) return "Available on Pro";
    return "Available on Premium";
  }
  if (tier === "pro") return "Available on Premium";
  return null;
}

export function showUnlockDividerBefore(
  tier: PricingPageTier,
  index: number,
): boolean {
  if (tier === "premium") return false;
  if (tier === "free" && index === 6) return true;
  if (tier === "pro" && index === 15) return true;
  return false;
}

export function unlockDividerLabel(tier: PricingPageTier): string {
  if (tier === "free") return "Unlock with Pro";
  return "Unlock with Premium";
}
