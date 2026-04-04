"use client";

import { useEffect, useRef, useState } from "react";
import { ScoreArc } from "./ScoreArc";
import type { Analysis } from "@/lib/analysisTypes";

function barFillClass(pct: number): string {
  if (pct < 40) return "bg-[#ef4444]";
  if (pct < 65) return "bg-[#f59e0b]";
  return "bg-[#10b981]";
}

function IconWrench({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconGrad({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0115.09 5.515m-15.09-5.515L12 3l7.74 7.147m0 0L21 15.57M12 3v9.22" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75v8.25m0-8.25L5.25 9.75M12 12.75l6.75-3" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function ScoreBreakdownBar({
  label,
  value,
  icon,
  delayMs,
  animate,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  delayMs: number;
  animate: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#64748b]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[#0f172a]">{label}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-[#0f172a]">
            {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
          <div
            className={`h-full rounded-full ${barFillClass(pct)}`}
            style={{
              width: animate ? `${pct}%` : "0%",
              transition: `width 1s ease-out ${delayMs}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Match ring + four progress bars (skills from analysis; keywords = ATS). */
export function MatchScoreArcAndBreakdown({ analysis }: { analysis: Analysis }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [barsOn, setBarsOn] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setBarsOn(true);
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={rootRef}>
      <div className="flex flex-col items-center">
        <ScoreArc score={analysis.matchScore} />
        <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-[#94a3b8]">
          Ring = average of the four scores below. &quot;Keywords alignment&quot; is
          your ATS score ({Math.round(analysis.atsScore)}).
        </p>
      </div>
      <div className="mt-8 space-y-5 border-t border-[#f1f5f9] pt-6">
        <h3 className="text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          Score breakdown
        </h3>
        <div className="mx-auto max-w-lg space-y-5">
          <ScoreBreakdownBar
            label="Skills match"
            value={analysis.skillsMatch}
            icon={<IconWrench className="h-4 w-4" />}
            delayMs={0}
            animate={barsOn}
          />
          <ScoreBreakdownBar
            label="Experience level"
            value={analysis.experienceMatch}
            icon={<IconClock className="h-4 w-4" />}
            delayMs={150}
            animate={barsOn}
          />
          <ScoreBreakdownBar
            label="Education fit"
            value={analysis.educationMatch}
            icon={<IconGrad className="h-4 w-4" />}
            delayMs={300}
            animate={barsOn}
          />
          <ScoreBreakdownBar
            label="Keywords alignment"
            value={analysis.atsScore}
            icon={<IconKey className="h-4 w-4" />}
            delayMs={450}
            animate={barsOn}
          />
        </div>
      </div>
    </div>
  );
}
