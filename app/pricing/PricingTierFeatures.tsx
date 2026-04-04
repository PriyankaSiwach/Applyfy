"use client";

import { Fragment } from "react";
import {
  MASTER_FEATURES,
  type PricingPageTier,
  isFeatureUnlocked,
  lockedFeatureTooltip,
  showUnlockDividerBefore,
  unlockDividerLabel,
} from "./pricing-features-data";

function checkRingClass(variant: "free" | "pro" | "proplus") {
  if (variant === "free") return "bg-[rgba(16,185,129,0.1)] text-[#10b981]";
  if (variant === "pro") return "bg-[rgba(107,140,255,0.12)] text-[var(--brand)]";
  return "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]";
}

function UnlockDividerRow({ label }: { label: string }) {
  return (
    <li className="relative my-3 list-none py-2" aria-hidden>
      <div className="h-px w-full bg-[var(--border)]" />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-2">
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
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
  variant: "free" | "pro" | "proplus";
  baseDelayMs?: number;
}) {
  const ring = checkRingClass(variant);

  return (
    <ul className="flex min-h-0 max-h-[min(72vh,920px)] flex-1 flex-col gap-3 overflow-y-auto [scrollbar-gutter:stable]">
      {MASTER_FEATURES.map((f, i) => {
        const index = i + 1;
        const unlocked = isFeatureUnlocked(tier, index);
        const delay = baseDelayMs + i * 30;

        if (unlocked) {
          const sub =
            tier === "free" && f.freeSub
              ? f.freeSub
              : (tier === "pro" || tier === "pro_plus") && f.proSub
                ? f.proSub
                : null;

          return (
            <li
              key={f.label}
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
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug text-[var(--text-primary)]">{f.label}</p>
                  {sub ? (
                    <span className="mt-px block pl-7 text-[12px] italic leading-snug text-[var(--text-muted)]">
                      {sub}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        }

        const tip = lockedFeatureTooltip(tier, index);

        return (
          <Fragment key={f.label}>
            {showUnlockDividerBefore(tier, index) ? (
              <UnlockDividerRow label={unlockDividerLabel(tier)} />
            ) : null}
            <li
              className="group relative list-none opacity-0 [animation:home-reveal_0.45s_ease-out_forwards]"
              style={{ animationDelay: `${delay}ms` }}
            >
              {tip ? (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 translate-y-1 opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 dark:shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
                >
                  <div className="whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
                    {tip}
                  </div>
                </div>
              ) : null}
              <div className="flex gap-2.5 opacity-45 transition-opacity duration-150 ease-out group-hover:opacity-60">
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
                <div className="min-w-0 flex-1 select-none blur-[2.5px] [color:var(--text-muted)]">
                  <p className="text-[14px] font-medium leading-snug">{f.label}</p>
                </div>
              </div>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
