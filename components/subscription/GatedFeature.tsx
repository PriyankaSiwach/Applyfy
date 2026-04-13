"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useTier } from "@/hooks/useTier";
import type { AppTier } from "@/lib/tier";

export type GatedRequiredTier = "pro" | "premium";

function meetsTier(tier: AppTier, required: GatedRequiredTier): boolean {
  if (required === "premium") return tier === "premium";
  return tier === "pro" || tier === "premium";
}

const PUNCHY: Record<GatedRequiredTier, string> = {
  pro: "Unlock with Pro — see your full match",
  premium: "Unlock with Premium",
};

export function GatedFeature({
  requiredTier,
  children,
  title,
  description,
  className = "",
  hidePlaceholder = false,
}: {
  requiredTier: GatedRequiredTier;
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  hidePlaceholder?: boolean;
}) {
  const { tier, mounted } = useTier();

  if (!mounted) {
    if (requiredTier === "premium") {
      return (
        <div
          className={`skeleton-shimmer-animate rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#faf8ff] via-white to-[#f5f3ff] p-6 shadow-sm sm:p-7 ${className}`}
          aria-busy
          aria-label="Loading"
        >
          <div className="h-5 w-52 max-w-full rounded-md bg-[#e9e3f5]/90" />
          <div className="mt-3 h-3 w-full max-w-lg rounded-md bg-[#f1f5f9]" />
          <div className="mt-2 h-3 w-[88%] max-w-md rounded-md bg-[#f1f5f9]" />
          <div className="mt-6 h-10 w-44 rounded-xl bg-[#ede9fe]" />
        </div>
      );
    }
    return <div className={className}>{children}</div>;
  }

  if (meetsTier(tier, requiredTier)) {
    return <div className={className}>{children}</div>;
  }

  const cta = requiredTier === "premium" ? "Upgrade to Premium" : "Upgrade to Pro";
  const tagline = PUNCHY[requiredTier];
  const tooltipLabel =
    description ??
    (requiredTier === "premium"
      ? "Unlock this feature with Premium."
      : "Upgrade to Pro to unlock this.");

  void title;

  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      title={tooltipLabel}
    >
      {/* Blurred placeholder */}
      {!hidePlaceholder ? (
        <div
          className="pointer-events-none min-h-[120px] select-none [filter:blur(4px)] opacity-60 [user-select:none] [&_*]:pointer-events-none [&_*]:select-none"
          aria-hidden
        >
          {children}
        </div>
      ) : (
        <div className="min-h-[80px]" aria-hidden />
      )}

      {/* Gradient fade at the bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 rounded-b-[inherit]"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--bg-card, #fff) 90%, transparent) 0%, transparent 100%)",
        }}
        aria-hidden
      />

      {/* Always-visible CTA badge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-end justify-center">
        <Link
          href="/pricing"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#7c3aed] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45)] transition-all duration-150 hover:bg-[#6d28d9]"
          title={tooltipLabel}
        >
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {tagline} · {cta}
        </Link>
      </div>
    </div>
  );
}
