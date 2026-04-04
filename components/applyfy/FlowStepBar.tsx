"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";

const steps = [
  { href: "/my-application", label: "Input" },
  { href: "/analyze", label: "Analyze" },
  { href: "/resume-editor", label: "Resume Editor" },
  { href: "/match", label: "Match" },
  { href: "/cover", label: "Cover letter" },
  { href: "/interview", label: "Interview prep" },
] as const;

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
  const current = steps.findIndex(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  );
  const currentIdx = current < 0 ? 0 : current;

  return (
    <nav
      className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 sm:px-8"
      aria-label="Application steps"
    >
      <div className="mx-auto flex max-w-3xl items-start justify-center overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const completed = i < currentIdx;
          const active = i === currentIdx;
          const segmentBeforeGreen = i > 0 && currentIdx > i - 1;

          return (
            <Fragment key={step.href}>
              {i > 0 ? (
                <div
                  className={`mx-0.5 mt-5 h-0.5 min-w-[12px] flex-1 rounded-full sm:mx-1 sm:min-w-[20px] ${segmentBeforeGreen ? "bg-[#10b981]" : "bg-[#e2e8f0]"}`}
                  aria-hidden
                />
              ) : null}
              <div className="flex w-[64px] shrink-0 flex-col items-center sm:w-[72px]">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  {active ? (
                    <span
                      className="pointer-events-none absolute -inset-1 rounded-full bg-[#1a56db]/20 animate-step-ring"
                      aria-hidden
                    />
                  ) : null}
                  <Link
                    href={step.href}
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-all duration-150 active:scale-[0.97] ${
                      completed
                        ? "bg-[#10b981] text-white"
                        : active
                          ? "bg-[#1a56db] text-white shadow-md"
                          : "border-2 border-[#e2e8f0] bg-white text-[#94a3b8] hover:border-[#cbd5e1]"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {completed ? CHECK_SVG : <span>{i + 1}</span>}
                  </Link>
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
