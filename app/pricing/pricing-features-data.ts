/** 1-based indices: Free unlocks 1–8; Pro 1–19; Pro+ 1–28 */

export type PricingPageTier = "free" | "pro" | "pro_plus";

export type MasterFeature = {
  label: string;
  /** Shown under label on Free tier only, when that row is unlocked. */
  freeSub?: string;
  /** Shown when row is unlocked on Pro or Pro+ (e.g. item 14). */
  proSub?: string;
};

export const MASTER_FEATURES: MasterFeature[] = [
  { label: "ATS score (out of 100)" },
  { label: "Quick wins suggestions", freeSub: "Top 3 only" },
  { label: "Keyword pills (present/missing)", freeSub: "Up to 6 shown" },
  { label: "Matched strengths", freeSub: "Up to 2 shown" },
  { label: "Match score ring + breakdown bars" },
  { label: "30-second intro script" },
  { label: "Cover letter generation", freeSub: "1 generation · Confident tone · Copy only" },
  { label: "Interview prep questions", freeSub: "3 questions · No tips" },
  { label: "Full gaps & fixes analysis" },
  { label: "All drop-in resume rewrites" },
  { label: "Keyword match table" },
  { label: "All tones & lengths (cover letter)" },
  { label: "Download cover letter (PDF & DOCX)" },
  { label: "Unlimited analyses", proSub: "Unlimited" },
  { label: "ATS score history graph" },
  { label: "\"Ready to apply?\" readiness checker" },
  { label: "Follow-up email generator" },
  { label: "Job tracker with AI nudges" },
  { label: "Priority AI processing" },
  { label: "Interview simulator with AI scoring" },
  { label: "Salary negotiation coach" },
  { label: "LinkedIn profile optimizer" },
  { label: "A/B resume testing" },
  { label: "Career coach chat (AI)" },
  { label: "Bulk apply mode (5 jobs at once)" },
  { label: "Weekly job market fit report" },
  { label: "Custom cover letter memory" },
  { label: "Application streak + gamification" },
];

export function isFeatureUnlocked(
  tier: PricingPageTier,
  /** 1-based index */
  index: number,
): boolean {
  if (tier === "free") return index <= 8;
  if (tier === "pro") return index <= 19;
  return index <= 28;
}

/** Tooltip when hovering a locked row. */
export function lockedFeatureTooltip(
  tier: PricingPageTier,
  /** 1-based index */
  index: number,
): string | null {
  if (isFeatureUnlocked(tier, index)) return null;
  if (tier === "free") {
    if (index >= 9 && index <= 19) return "Available in Pro";
    return "Available in Pro+";
  }
  if (tier === "pro") return "Available in Pro+";
  return null;
}

export function showUnlockDividerBefore(
  tier: PricingPageTier,
  /** 1-based index */
  index: number,
): boolean {
  if (tier === "pro_plus") return false;
  if (tier === "free" && index === 9) return true;
  if (tier === "pro" && index === 20) return true;
  return false;
}

export function unlockDividerLabel(tier: PricingPageTier): string {
  if (tier === "free") return "Unlock with Pro";
  return "Unlock with Pro+";
}
