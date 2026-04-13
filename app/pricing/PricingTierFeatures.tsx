"use client";

import { Fragment } from "react";
import {
  MASTER_FEATURES,
  type PricingPageTier,
  isFeatureUnlocked,
  showUnlockDividerBefore,
  unlockDividerLabel,
} from "./pricing-features-data";

function checkRingClass(variant: "free" | "pro" | "premium") {
  if (variant === "free") return "bg-[rgba(124,58,237,0.1)] text-[#6d28d9]";
  if (variant === "pro") return "bg-[rgba(107,140,255,0.12)] text-[var(--brand)]";
  return "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]";
}

function GradientDividerRow({ label }: { label: string }) {
  return (
    <li className="relative my-4 list-none" aria-hidden>
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.25) 20%, rgba(124,58,237,0.5) 50%, rgba(124,58,237,0.25) 80%, transparent 100%)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3">
        <span className="whitespace-nowrap bg-[var(--bg-card)] px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
          {label}
        </span>
      </div>
    </li>
  );
}

export function PricingTierFeatures({
  tier,
  variant,
  baseDelayMs = 0,
}: {
  tier: PricingPageTier;
  variant: "free" | "pro" | "premium";
  baseDelayMs?: number;
}) {
  const ring = checkRingClass(variant);

  return (
    <ul className="flex min-h-0 max-h-[min(72vh,920px)] flex-1 flex-col gap-3 overflow-y-auto [scrollbar-gutter:stable]">
      {MASTER_FEATURES.map((f, i) => {
        const index = i + 1;
        const unlocked = isFeatureUnlocked(tier, index);
        const delay = baseDelayMs + i * 30;

        // Premium card: always show every feature as checked
        if (variant === "premium") {
          return (
            <Fragment key={f.label}>
              {showUnlockDividerBefore(tier, index) ? (
                <GradientDividerRow label={unlockDividerLabel(tier)} />
              ) : null}
              <li
                className="list-none opacity-0 [animation:home-reveal_0.45s_ease-out_forwards]"
                style={{ animationDelay: `${delay}ms` }}
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ring}`}
                    aria-hidden
                  >
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-[14px] font-medium leading-snug text-[var(--text-primary)]">{f.label}</p>
                </div>
              </li>
            </Fragment>
          );
        }

        if (unlocked) {
          return (
            <Fragment key={f.label}>
              {showUnlockDividerBefore(tier, index) ? (
                <GradientDividerRow label={unlockDividerLabel(tier)} />
              ) : null}
              <li
                className="list-none opacity-0 [animation:home-reveal_0.45s_ease-out_forwards]"
                style={{ animationDelay: `${delay}ms` }}
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ring}`}
                    aria-hidden
                  >
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-[14px] font-medium leading-snug text-[var(--text-primary)]">{f.label}</p>
                </div>
              </li>
            </Fragment>
          );
        }

        return (
          <Fragment key={f.label}>
            {showUnlockDividerBefore(tier, index) ? (
              <GradientDividerRow label={unlockDividerLabel(tier)} />
            ) : null}
            <li
              className="list-none opacity-0 [animation:home-reveal_0.45s_ease-out_forwards]"
              style={{ animationDelay: `${delay}ms` }}
            >
              <div className="flex gap-2.5 opacity-40">
                <span
                  className="mt-0.5 flex w-3 shrink-0 items-start justify-center pt-px text-[var(--text-muted)]"
                  aria-hidden
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </span>
                <p className="select-none text-[14px] font-medium leading-snug text-[var(--text-muted)] blur-[2.5px]">
                  {f.label}
                </p>
              </div>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
