"use client";

import { useUser } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AppTier } from "@/lib/tier";
import { isAdminBypassEmail, normalizeTierFromMetadata } from "@/lib/tier";

const LEGACY_STORAGE_KEY = "applyfy-subscription-tier";

export type { AppTier as SubscriptionTier };

type Ctx = {
  tier: AppTier;
  /** True when user has Pro or Premium (paid “Pro” product access). */
  isPro: boolean;
  /** Premium-only features (simulator, salary coach, etc.). */
  isPremium: boolean;
  /** @deprecated Use `isPremium`. */
  isProPlus: boolean;
  isFree: boolean;
  /** Exact Pro tier (not Premium) — for “upgrade to Premium” messaging. */
  isProOnly: boolean;
  /** Dev / fallback: set tier in localStorage (does not update Clerk). */
  setTier: (t: AppTier) => void;
  mounted: boolean;
};

const SubscriptionContext = createContext<Ctx | null>(null);

function readLegacyLocalStorageTier(): AppTier | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (s === "pro_plus") return "premium";
    if (s === "pro") return "pro";
    if (s === "free") return "free";
  } catch {
    /* ignore */
  }
  return null;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [devOverride, setDevOverride] = useState<AppTier | null>(null);
  const [mounted, setMounted] = useState(false);
  /** Set after mount so SSR + first client paint match; then real hostname enables admin bypass. */
  const [clientHostname, setClientHostname] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setClientHostname(window.location.hostname);
  }, []);

  const tierFromClerk = useMemo(() => {
    if (!isLoaded) return "free" as AppTier;
    if (!user) return "free" as AppTier;
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    if (isAdminBypassEmail(email, clientHostname)) return "premium" as AppTier;
    return normalizeTierFromMetadata(user.publicMetadata?.subscriptionTier);
  }, [isLoaded, user, user?.publicMetadata?.subscriptionTier, clientHostname]);

  const tier = useMemo<AppTier>(() => {
    if (devOverride) return devOverride;
    if (!isLoaded) return "free";
    if (!user) {
      const legacy = readLegacyLocalStorageTier();
      return legacy ?? "free";
    }
    return tierFromClerk;
  }, [devOverride, isLoaded, user, tierFromClerk]);

  const setTier = useCallback((t: AppTier) => {
    setDevOverride(t);
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      tier,
      isPro: tier === "pro" || tier === "premium",
      isPremium: tier === "premium",
      isProPlus: tier === "premium",
      isFree: tier === "free",
      isProOnly: tier === "pro",
      setTier,
      mounted: mounted && isLoaded,
    }),
    [tier, setTier, mounted, isLoaded],
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
