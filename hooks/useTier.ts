"use client";

import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import type { AppTier } from "@/lib/tier";

export type UseTierResult = {
  tier: AppTier;
  /** Has Pro or Premium subscription. */
  isPro: boolean;
  isPremium: boolean;
  /** Paid Pro tier only (not Premium). */
  isProOnly: boolean;
  isFree: boolean;
  mounted: boolean;
};

/**
 * Subscription tier for feature gating. Prefer this over ad-hoc checks.
 * `isPro` = paid Pro or Premium (unlocks Resume Editor, Match, full Analyze, etc.).
 */
export function useTier(): UseTierResult {
  const s = useSubscription();
  return {
    tier: s.tier,
    isPro: s.isPro,
    isPremium: s.isPremium,
    isProOnly: s.isProOnly,
    isFree: s.isFree,
    mounted: s.mounted,
  };
}
