"use client";

import Link from "next/link";
import { type ReactNode } from "react";

export type FeatureLockTier = "pro" | "pro_plus";

export function FeatureLock({
  locked,
  tier = "pro",
  featureTitle,
  description,
  children,
  className = "",
}: {
  locked: boolean;
  /** Which upgrade unlocks this feature. */
  tier?: FeatureLockTier;
  /** Overrides default "Pro feature" / "Pro+ feature". */
  featureTitle?: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  if (!locked) {
    return <div className={className}>{children}</div>;
  }

  const title =
    featureTitle ??
    (tier === "pro_plus" ? "Pro+ feature" : "Pro feature");

  const cta =
    tier === "pro_plus" ? "Upgrade to Pro+" : "Upgrade to Pro";

  return (
    <div className={`relative ${className}`}>
      <div
        className="select-none blur-[5px] [user-select:none] [&_*]:pointer-events-none [&_*]:select-none"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 [animation:fade-in-up_0.3s_ease-out_forwards]">
        <div
          className="max-w-[280px] rounded-2xl border border-[var(--border)] px-8 py-7 text-center shadow-lg backdrop-blur-[8px]"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--bg-card) 96%, transparent)",
          }}
        >
          <svg
            className="mx-auto mb-3 h-7 w-7 text-[var(--brand)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-base font-bold text-[var(--text-primary)]">
            {title}
          </p>
          <p className="mt-1.5 text-sm leading-[1.5] text-[var(--text-secondary)]">
            {description}
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-[10px] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out hover:opacity-90"
            style={{ background: "var(--gradient-hero)" }}
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
