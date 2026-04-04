export type SubscriptionTier = "free" | "pro" | "pro_plus";

const STORAGE_KEY = "applyfy-subscription-tier";

export function readSubscriptionTier(): SubscriptionTier {
  if (typeof window === "undefined") return "free";
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "pro_plus") return "pro_plus";
    if (s === "pro") return "pro";
    return "free";
  } catch {
    return "free";
  }
}

/** Pro or Pro+ — unlocks all Pro-tier product features. */
export function hasProAccess(tier: SubscriptionTier): boolean {
  return tier === "pro" || tier === "pro_plus";
}

export function hasProPlusAccess(tier: SubscriptionTier): boolean {
  return tier === "pro_plus";
}
