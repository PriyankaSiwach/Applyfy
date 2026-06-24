"use client";

import { useUser } from "@clerk/nextjs";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { AppTier } from "@/lib/tier";
import { isAdminBypassEmail, normalizeTierFromMetadata } from "@/lib/tier";

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
  mounted: boolean;
};

const SubscriptionContext = createContext<Ctx | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [mounted, setMounted] = useState(false);
  const [clientHostname, setClientHostname] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setClientHostname(window.location.hostname);
  }, []);

  const tier = useMemo<AppTier>(() => {
    if (!isLoaded) return "free";
    if (!user) return "free";
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    if (isAdminBypassEmail(email, clientHostname)) return "premium";
    return normalizeTierFromMetadata(user.publicMetadata?.subscriptionTier);
  }, [isLoaded, user, user?.publicMetadata?.subscriptionTier, clientHostname]);

  const value = useMemo(
    () => ({
      tier,
      isPro: tier === "pro" || tier === "premium",
      isPremium: tier === "premium",
      isProPlus: tier === "premium",
      isFree: tier === "free",
      isProOnly: tier === "pro",
      mounted: mounted && isLoaded,
    }),
    [tier, mounted, isLoaded],
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
