"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

const steps = [
  { href: "/my-application", label: "Input" },
  { href: "/analyze", label: "Analyze" },
  { href: "/match", label: "Match" },
  { href: "/resume-editor", label: "Resume Editor" },
  { href: "/cover", label: "Cover letter" },
  { href: "/interview", label: "Interview prep" },
] as const;

const VISITED_KEY = "applyfy-max-visited-step-v1";

function readMaxVisited(): number {
  try {
    return parseInt(sessionStorage.getItem(VISITED_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function writeMaxVisited(v: number) {
  try {
    sessionStorage.setItem(VISITED_KEY, String(v));
  } catch {
    /* ignore */
  }
}

function clearMaxVisited() {
  try {
    sessionStorage.removeItem(VISITED_KEY);
  } catch {
    /* ignore */
  }
}

const CHECK_SVG = (
  <svg
    className="h-4 w-4 text-white"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2.5}
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export function FlowStepBar() {
  const pathname = usePathname();
  const { resume } = useApplyfy();
  const resumeReady = resume.trim().length > 0;
  const current = steps.findIndex(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  );
  const currentIdx = current < 0 ? 0 : current;

  const [maxVisited, setMaxVisited] = useState(0);

  useEffect(() => {
    if (!resumeReady) {
      clearMaxVisited();
      setMaxVisited(0);
      return;
    }
    const stored = readMaxVisited();
    const next = Math.max(stored, currentIdx);
    if (next !== stored) writeMaxVisited(next);
    setMaxVisited(next);
  }, [resumeReady, currentIdx]);

  return (
    <nav
      className="border-b border-[#e8e0f5] bg-gradient-to-b from-[#faf8ff] to-[#f5f3ff] px-4 py-5 sm:px-8"
      aria-label="Application steps"
    >
      <div className="mx-auto flex max-w-3xl items-start justify-center overflow-x-auto pb-1">
        {steps.map((step, i) => {
          // "completed" = visited at some point AND not the current active step
          const completed = resumeReady && i <= maxVisited && i !== currentIdx;
          const active = i === currentIdx && (i === 0 || resumeReady);
          // segment filled if the user has reached or passed step i
          const segmentFilled = resumeReady && i > 0 && maxVisited >= i;

          return (
            <Fragment key={step.href}>
              {i > 0 ? (
                <div
                  className={`mx-1 mt-[22px] h-[3px] min-w-[12px] flex-1 rounded-full sm:min-w-[18px] ${
                    segmentFilled
                      ? "bg-gradient-to-r from-[#c4b5fd] to-[#7c3aed]"
                      : "bg-[#e9e3f5]"
                  }`}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-[64px] shrink-0 flex-col items-center sm:w-[72px]">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  {active ? (
                    <span
                      className="pointer-events-none absolute -inset-[5px] rounded-full applyfy-step-active-ring"
                      aria-hidden
                    />
                  ) : null}
                  {i === 0 || resumeReady ? (
                    <Link
                      href={step.href}
                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-all duration-200 active:scale-[0.96] ${
                        completed
                          ? "bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-white ring-2 ring-white"
                          : active
                            ? "bg-[#7c3aed] text-white shadow-md ring-2 ring-[#ede9fe]"
                            : "border-2 border-[#e9e3f5] bg-white text-[#94a3b8] hover:border-[#c4b5fd] hover:text-[#7c3aed]"
                      }`}
                      aria-current={active ? "step" : undefined}
                    >
                      {completed ? CHECK_SVG : <span>{i + 1}</span>}
                    </Link>
                  ) : (
                    <span
                      className="relative z-10 flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full border-2 border-[#ddd6fe] bg-gradient-to-b from-slate-50/90 to-violet-50/40 text-sm font-bold text-[#a5a0b8] shadow-sm"
                      title="Upload a resume in My application to open these steps"
                      aria-label={`${step.label}, locked until you upload a resume`}
                    >
                      <span>{i + 1}</span>
                    </span>
                  )}
                </div>
                <span
                  className={`mt-2 text-center text-[10px] font-semibold leading-tight sm:text-xs ${
                    !resumeReady && i > 0
                      ? "text-[#a8a3b8]"
                      : completed
                        ? "text-[#6d28d9]"
                        : active
                          ? "font-bold text-[#7c3aed]"
                          : "text-[#94a3b8]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
