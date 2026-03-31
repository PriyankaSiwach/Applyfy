"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const steps = [
  { href: "/analyze", label: "Analyze" },
  { href: "/match", label: "Match" },
  { href: "/cover", label: "Cover letter" },
  { href: "/interview", label: "Interview prep" },
] as const;

export function FlowStepBar() {
  const pathname = usePathname();
  const current = steps.findIndex(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  );

  return (
    <nav
      className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 sm:px-8"
      aria-label="Application steps"
    >
      <ol className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, i) => {
          const active = i === current;
          const done = current > i;
          return (
            <li key={step.href} className="flex items-center gap-2 sm:gap-4">
              {i > 0 ? (
                <span className="hidden text-[#64748B] sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
              <Link
                href={step.href}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  active
                    ? "bg-[#2E3E65] text-white"
                    : done
                      ? "text-[#22A05B] hover:underline"
                      : "text-[#64748B] hover:text-[#2E3E65]"
                }`}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
