"use client";

import { FeatureLock } from "@/components/subscription/FeatureLock";

export function SalaryNegotiationCoachTeaser({ locked }: { locked: boolean }) {
  return (
    <FeatureLock
      locked={locked}
      tier="pro_plus"
      description="Paste your offer. Get a word-for-word negotiation script."
    >
      <section className="rounded-2xl border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#0f172a]">Salary Negotiation Coach</h3>
        <p className="mt-2 text-sm text-[#64748b]">
          Paste your offer. Get a word-for-word negotiation script.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-xs text-[#94a3b8]">
            Offer details…
          </div>
          <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-xs text-[#94a3b8]">
            Job context…
          </div>
        </div>
        <div className="mt-4 h-10 rounded-lg bg-[#f59e0b]/15" />
      </section>
    </FeatureLock>
  );
}
