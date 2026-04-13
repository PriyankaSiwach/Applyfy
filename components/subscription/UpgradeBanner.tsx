"use client";

import Link from "next/link";

import { useTier } from "@/hooks/useTier";

/** Persistent upgrade prompt for signed-in (or anonymous) free users. */
export function UpgradeBanner() {
  const { isFree, mounted } = useTier();
  if (!mounted || !isFree) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[90] border-t border-violet-200/80 bg-gradient-to-r from-[#faf8ff] to-[#ede9fe] px-4 py-3 shadow-[0_-8px_32px_rgba(124,58,237,0.12)]"
      role="region"
      aria-label="Upgrade prompt"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-center text-sm font-medium text-[#4c1d95] sm:text-left">
          You&apos;re on the Free plan — unlock Resume Editor, Match, Cover Letter &amp; more.
        </p>
        <Link
          href="/pricing"
          className="shrink-0 rounded-full bg-[#7c3aed] px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
        >
          View plans
        </Link>
      </div>
    </div>
  );
}
