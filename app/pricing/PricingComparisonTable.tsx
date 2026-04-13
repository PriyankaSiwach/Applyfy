"use client";

import { useEffect, useRef, useState } from "react";

type Cell =
  | { type: "check"; tier: "free" | "pro" | "premium" }
  | { type: "x" }
  | { type: "text"; value: string };

const ROWS: { feature: string; free: Cell; pro: Cell; premium: Cell }[] = [
  {
    feature: "Analyses",
    free: { type: "text", value: "3 total" },
    pro: { type: "text", value: "Unlimited" },
    premium: { type: "text", value: "Unlimited" },
  },
  {
    feature: "ATS score + quick wins",
    free: { type: "text", value: "Score + top 3" },
    pro: { type: "text", value: "Full" },
    premium: { type: "text", value: "Full" },
  },
  {
    feature: "Keywords & matched strengths",
    free: { type: "text", value: "Keywords + 2 strengths" },
    pro: { type: "text", value: "Full" },
    premium: { type: "text", value: "Full" },
  },
  {
    feature: "Score history & readiness",
    free: { type: "x" },
    pro: { type: "check", tier: "pro" },
    premium: { type: "check", tier: "premium" },
  },
  {
    feature: "Gaps detail (Analyze)",
    free: { type: "x" },
    pro: { type: "check", tier: "pro" },
    premium: { type: "check", tier: "premium" },
  },
  {
    feature: "Resume Editor · Match · Cover",
    free: { type: "x" },
    pro: { type: "check", tier: "pro" },
    premium: { type: "check", tier: "premium" },
  },
  {
    feature: "Interview prep (core)",
    free: { type: "x" },
    pro: { type: "check", tier: "pro" },
    premium: { type: "check", tier: "premium" },
  },
  {
    feature: "Tracker (edit / unlimited)",
    free: { type: "x" },
    pro: { type: "check", tier: "pro" },
    premium: { type: "check", tier: "premium" },
  },
  {
    feature: "Interview Simulator",
    free: { type: "x" },
    pro: { type: "x" },
    premium: { type: "check", tier: "premium" },
  },
  {
    feature: "Salary coach · more questions · follow-up email",
    free: { type: "x" },
    pro: { type: "x" },
    premium: { type: "check", tier: "premium" },
  },
];

function cellRingClass(tier: "free" | "pro" | "premium") {
  if (tier === "free") return "bg-[rgba(124,58,237,0.12)] text-[#6d28d9]";
  if (tier === "pro") return "bg-[rgba(107,140,255,0.12)] text-[var(--brand)]";
  return "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]";
}

function RenderCell({ cell }: { cell: Cell }) {
  if (cell.type === "text") {
    return (
      <span className="text-[14px] font-medium text-[var(--text-primary)]">
        {cell.value}
      </span>
    );
  }
  if (cell.type === "x") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]"
        aria-label="Not included"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cellRingClass(cell.tier)}`}
      aria-label="Included"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

export function PricingComparisonTable() {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = tbodyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setActive(true);
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div id="compare" className="mx-auto mt-20 w-full max-w-[900px] scroll-mt-24 overflow-x-auto">
      <h2 className="mb-10 text-center font-[family-name:var(--font-plus-jakarta)] text-[32px] font-extrabold text-[var(--text-primary)]">
        See exactly what you get
      </h2>
      <table
        className="w-full border-separate border-spacing-0 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)]"
        style={{ borderCollapse: "separate" }}
      >
        <thead>
          <tr className="bg-[var(--bg-surface)]">
            <th className="border-b border-[var(--border)] px-5 py-4 text-left text-[12px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Feature
            </th>
            <th className="border-b border-[var(--border)] px-5 py-4 text-center text-[13px] text-[var(--text-muted)]">
              Free
            </th>
            <th className="border-b border-[var(--border)] px-5 py-4 text-center text-[13px] font-bold text-[var(--brand)]">
              Pro
            </th>
            <th className="border-b border-[var(--border)] px-5 py-4 text-center text-[13px] font-bold text-[#f59e0b]">
              Premium
            </th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {ROWS.map((row, i) => (
            <tr
              key={row.feature}
              className={`h-[52px] transition-colors duration-200 ease-out hover:bg-[var(--bg-card-hover)] ${
                i % 2 === 1 ? "bg-[color-mix(in_srgb,var(--bg-surface)_50%,transparent)]" : ""
              }`}
              style={{
                opacity: active ? 1 : 0,
                transition: `opacity 0.35s ease ${active ? i * 20 : 0}ms`,
              }}
            >
              <td
                className={`px-5 py-3 text-left text-[14px] text-[var(--text-primary)] ${
                  i < ROWS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {row.feature}
              </td>
              <td
                className={`px-5 py-3 text-center align-middle ${
                  i < ROWS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <RenderCell cell={row.free} />
              </td>
              <td
                className={`px-5 py-3 text-center align-middle ${
                  i < ROWS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <RenderCell cell={row.pro} />
              </td>
              <td
                className={`px-5 py-3 text-center align-middle ${
                  i < ROWS.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <RenderCell cell={row.premium} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
