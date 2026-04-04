"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { SubscriptionTier } from "@/lib/subscriptionTier";

const STORAGE_KEY = "applyfy-subscription-tier";

export type { SubscriptionTier };

type Ctx = {
  tier: SubscriptionTier;
  /** True for Pro or Pro+ (paid Pro features). */
  isPro: boolean;
  /** True only for Pro+. */
  isProPlus: boolean;
  setTier: (t: SubscriptionTier) => void;
  mounted: boolean;
};

const SubscriptionContext = createContext<Ctx | null>(null);

function parseStoredTier(s: string | null): SubscriptionTier {
  if (s === "pro_plus" || s === "pro" || s === "free") return s;
  return "free";
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTierState] = useState<SubscriptionTier>("free");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setTierState(parseStoredTier(localStorage.getItem(STORAGE_KEY)));
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  const setTier = useCallback((t: SubscriptionTier) => {
    setTierState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      tier,
      isPro: tier === "pro" || tier === "pro_plus",
      isProPlus: tier === "pro_plus",
      setTier,
      mounted,
    }),
    [tier, setTier, mounted],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
