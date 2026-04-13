/**
 * @deprecated Import from `@/lib/tier` instead. Kept for a few legacy imports.
 */
export type {
  AppTier as SubscriptionTier,
} from "@/lib/tier";

export {
  FREE_ANALYSIS_SCAN_LIMIT,
  hasPremiumPlan as hasProPlusAccess,
  hasProPlan as hasProAccess,
  isFreeTier,
  normalizeTierFromMetadata,
  tierFromPublicMetadata,
} from "@/lib/tier";
