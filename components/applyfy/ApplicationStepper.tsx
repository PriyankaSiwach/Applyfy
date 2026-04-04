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
}: {
  labels: readonly string[];
  currentStep: StepIndex;
  maxUnlocked: number;
  onStepClick: (idx: StepIndex) => void;
}) {
  return (
    <nav className="mb-10 w-full overflow-x-auto pb-1" aria-label="Application steps">
      <div className="flex min-w-[min(100%,560px)] items-start sm:min-w-0">
        {labels.map((label, i) => {
          const idx = i as StepIndex;
          const completed = idx < currentStep;
          const active = idx === currentStep;
          const locked = idx >= 2 && idx >= maxUnlocked;
          const segmentBeforeGreen = i > 0 && currentStep > i - 1;

          return (
            <Fragment key={label}>
              {i > 0 ? (
                <div
                  className={`mx-0.5 mt-5 h-0.5 min-w-[10px] flex-1 rounded-full sm:mx-1 sm:min-w-[16px] ${segmentBeforeGreen ? "bg-[#10b981]" : "bg-[#e2e8f0]"}`}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-[64px] shrink-0 flex-col items-center sm:w-[76px]">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  {active ? (
                    <span
                      className="pointer-events-none absolute -inset-1 rounded-full bg-[#1a56db]/20 animate-step-ring"
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && onStepClick(idx)}
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed ${
                      completed
                        ? "bg-[#10b981] text-white shadow-sm"
                        : active
                          ? "bg-[#1a56db] text-white shadow-md"
                          : locked
                            ? "border-2 border-[#e2e8f0] bg-white text-[#94a3b8]"
                            : "border-2 border-[#e2e8f0] bg-white text-[#94a3b8] hover:border-[#cbd5e1]"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {completed ? CHECK_SVG : <span>{i + 1}</span>}
                  </button>
                </div>
                <span
                  className={`mt-2 text-center text-[10px] font-semibold leading-tight sm:text-xs ${
                    completed
                      ? "text-[#10b981]"
                      : active
                        ? "font-bold text-[#1a56db]"
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
