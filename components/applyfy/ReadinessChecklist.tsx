"use client";

import type { Analysis } from "@/lib/analysisTypes";

export function ReadinessChecklist({ analysis }: { analysis: Analysis }) {
  const ats = Math.round(analysis.atsScore);
  const match = Math.round(analysis.matchScore);
  const gaps = analysis.resumeGaps.length;

  const items: { label: string; status: "green" | "yellow" | "red"; detail: string }[] = [
    {
      label: "ATS alignment",
      status: ats >= 70 ? "green" : ats >= 45 ? "yellow" : "red",
      detail: `${ats}/100`,
    },
    {
      label: "Role match",
      status: match >= 65 ? "green" : match >= 40 ? "yellow" : "red",
      detail: `${match}%`,
    },
    {
      label: "Gap coverage",
      status: gaps <= 2 ? "green" : gaps <= 5 ? "yellow" : "red",
      detail: `${gaps} gap${gaps === 1 ? "" : "s"} flagged`,
    },
  ];

  const ring = {
    green: "bg-[var(--green)]/15 text-[var(--green)] border-[var(--green)]/40",
    yellow: "bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/40",
    red: "bg-[var(--red)]/15 text-[var(--red)] border-[var(--red)]/40",
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <p className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-[var(--text-primary)]">
        Ready to apply?
      </p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Quick readiness signals before you hit submit.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((it) => (
          <li
            key={it.label}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${ring[it.status]}`}
          >
            <span className="font-medium">{it.label}</span>
            <span className="tabular-nums opacity-90">{it.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
