"use client";

import { Fragment } from "react";

const CHECK_SVG = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;


export function ApplicationStepper({
  labels,
  currentStep,
  maxUnlocked,
  onStepClick,
  resumeReady = true,
}: {
  labels: readonly string[];
  currentStep: StepIndex;
  maxUnlocked: number;
  onStepClick: (idx: StepIndex) => void;
  /** When false, only step 0 is clickable until a resume is uploaded. */
  resumeReady?: boolean;
}) {
  const effectiveMax = resumeReady ? maxUnlocked : 1;
  const furthest = resumeReady ? Math.max(currentStep, effectiveMax - 1) : 0;

  return (
    <nav
      className="mb-12 w-full overflow-x-auto rounded-2xl border border-[#e8e0f5]/80 bg-gradient-to-b from-[#faf8ff] to-white px-3 py-5 shadow-[0_4px_24px_rgba(124,58,237,0.07)] sm:px-5"
      aria-label="Application steps"
    >
      <div className="flex min-w-[min(100%,560px)] items-start sm:min-w-0">
        {labels.map((label, i) => {
          const idx = i as StepIndex;
          const completed = resumeReady && idx < furthest;
          const locked =
            (!resumeReady && idx > 0) || (idx >= 2 && idx >= maxUnlocked);
          const active = idx === currentStep && !locked;
          const segmentFilled =
            resumeReady && i > 0 && i - 1 < furthest;
          return (
            <Fragment key={label}>
              {i > 0 ? (
                <div
                  className={`mx-1 mt-[22px] h-[3px] min-w-[12px] flex-1 rounded-full sm:mx-1.5 sm:min-w-[18px] ${
                    segmentFilled
                      ? "bg-gradient-to-r from-[#c4b5fd] to-[#7c3aed] shadow-[0_0_8px_rgba(124,58,237,0.25)]"
                      : "bg-[#e9e3f5]"
                  }`}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-[68px] shrink-0 flex-col items-center sm:w-[80px]">
                <div className="relative flex h-11 w-11 items-center justify-center">
                  {active ? (
                    <span
                      className="pointer-events-none absolute -inset-[6px] rounded-full applyfy-step-active-ring"
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && onStepClick(idx)}
                    className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-all duration-200 active:scale-[0.96] disabled:cursor-not-allowed ${
                      completed
                        ? "bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-white shadow-[0_4px_14px_rgba(124,58,237,0.35)] ring-2 ring-white"
                        : active
                          ? "bg-[#7c3aed] text-white shadow-[0_6px_20px_rgba(124,58,237,0.4)] ring-2 ring-[#ede9fe]"
                          : locked
                            ? "border-2 border-[#ddd6fe] bg-gradient-to-b from-slate-50/90 to-violet-50/40 text-[#a5a0b8]"
                            : "border-2 border-[#e9e3f5] bg-white text-[#64748b] hover:border-[#c4b5fd] hover:text-[#7c3aed]"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {completed ? CHECK_SVG : <span>{i + 1}</span>}
                  </button>
                </div>
                <span
                  className={`mt-2.5 max-w-[72px] text-center text-[10px] font-semibold leading-tight tracking-wide sm:text-[11px] ${
                    completed
                      ? "text-[#6d28d9]"
                      : active
                        ? "font-bold text-[#7c3aed]"
                        : locked
                          ? "text-[#a8a3b8]"
                          : "text-[#94a3b8]"
                  }`}
                >
                  {label}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
