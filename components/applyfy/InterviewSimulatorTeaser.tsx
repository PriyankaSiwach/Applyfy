"use client";

import { FeatureLock } from "@/components/subscription/FeatureLock";

export function InterviewSimulatorTeaser({ locked }: { locked: boolean }) {
  return (
    <FeatureLock
      locked={locked}
      tier="pro_plus"
      description="Practice your answers and get AI scores on clarity, specificity, and STAR method."
    >
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-[#0f172a]">Interview Simulator</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
          Practice your answers and get AI scores on clarity, specificity, and STAR
          method.
        </p>
        <div className="mt-5 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Your answer
          </p>
          <div className="mt-3 space-y-2">
            <div className="h-2.5 w-full rounded bg-[#e2e8f0]" />
            <div className="h-2.5 w-[92%] rounded bg-[#e2e8f0]" />
            <div className="h-2.5 w-[78%] rounded bg-[#e2e8f0]" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="h-9 min-w-[120px] flex-1 rounded-lg bg-[#1a56db]/15" />
            <div className="flex h-9 w-24 items-center justify-center rounded-lg bg-[#10b981]/25 text-xs font-bold text-[#047857]">
              8.5/10
            </div>
          </div>
        </div>
      </div>
    </FeatureLock>
  );
}
