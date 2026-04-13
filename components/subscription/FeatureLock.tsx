"use client";

import Link from "next/link";
import { type ReactNode } from "react";

export type FeatureLockTier = "pro" | "premium";

const PUNCHY: Record<FeatureLockTier, string> = {
  pro: "Unlock with Pro — see your full analysis",
  premium: "Unlock with Premium",
};

export function FeatureLock({
  locked,
  tier = "pro",
  featureTitle,
  description,
  children,
  className = "",
}: {
  locked: boolean;
  tier?: FeatureLockTier;
  featureTitle?: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  if (!locked) {
    return <div className={className}>{children}</div>;
  }

  const cta = tier === "premium" ? "Upgrade to Premium" : "Upgrade to Pro";
  const tagline = PUNCHY[tier];
  void featureTitle; // kept in props for external callers

  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      title={tier === "premium" ? description : undefined}
    >
      {/* Blurred content */}
      <div
        className="pointer-events-none select-none [filter:blur(4px)] [user-select:none] [&_*]:pointer-events-none [&_*]:select-none"
        aria-hidden
      >
        {children}
      </div>

      {/* Gradient fade at the bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-[inherit]"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--bg-card, #fff) 92%, transparent) 0%, transparent 100%)",
        }}
        aria-hidden
      />

      {/* Always-visible CTA badge — sits at the bottom center */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-end justify-center">
        <Link
          href="/pricing"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#7c3aed] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45)] transition-all duration-150 hover:bg-[#6d28d9]"
          title={description}
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
