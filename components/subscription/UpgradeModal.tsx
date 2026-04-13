"use client";

import Link from "next/link";

export function UpgradeModal({
  open,
  onClose,
  title = "Unlock more with Applyfy Pro",
  subtitle = "Resume Editor, Match, full gap analysis, unlimited scans, and more.",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2
          id="upgrade-modal-title"
          className="pr-10 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-[var(--text-primary)]"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
        <ul className="mt-5 space-y-2 text-sm text-[var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="text-emerald-600" aria-hidden>✓</span>
            Pro — $12/mo: full Analyze, Resume Editor, Match, Cover Letter
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-600" aria-hidden>✓</span>
            Premium — $24/mo: interview simulator, salary coach, unlimited extras
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-105"
            onClick={onClose}
          >
            Upgrade now
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
