"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useState } from "react";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { extractJobTitleFromPosting } from "@/lib/jobMetaFromPosting";
import type { SalaryCoachResult } from "@/lib/salaryCoachTypes";

function formatCopyAll(result: SalaryCoachResult): string {
  const head = `Estimated market rate: ${result.market_rate}\n${result.market_note}\nYour counteroffer: ${result.counteroffer}`;
  const body = result.sections
    .map((s) => `${s.title}\n\n${s.content}`)
    .join("\n\n---\n\n");
  return `${head}\n\n${body}`;
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin text-white"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ScriptSkeletonCards() {
  return (
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton-shimmer-animate rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
        >
          <div className="h-3 w-1/3 rounded bg-[var(--border)] opacity-60" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-[var(--border)] opacity-40" />
            <div className="h-3 w-[92%] rounded bg-[var(--border)] opacity-40" />
            <div className="h-3 w-[78%] rounded bg-[var(--border)] opacity-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

type FieldKey = "jobTitle" | "offeredSalary";

function ModalHeader({ titleId }: { titleId: string }) {
  return (
    <div className="pr-10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2
          id={titleId}
          className="text-[24px] font-extrabold leading-tight text-[var(--text-primary)]"
          style={{ fontWeight: 800 }}
        >
          Salary Negotiation Coach
        </h2>
        <span
          className="rounded-md border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-2 py-0.5 text-[11px] font-bold text-[#f59e0b]"
          style={{ padding: "2px 8px", borderRadius: 6 }}
        >
          Pro+
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Get a word-for-word negotiation script based on your offer.
      </p>
    </div>
  );
}

export function SalaryNegotiationCoachModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const uid = useId();
  const titleId = `${uid}-salary-coach-title`;
  const { isProPlus, mounted } = useSubscription();
  const { jobPosting, copyPlainText } = useApplyfy();

  const [jobTitle, setJobTitle] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [location, setLocation] = useState("");
  const [competingOffer, setCompetingOffer] = useState("");

  const [phase, setPhase] = useState<"form" | "results" | "error">("form");
  const [result, setResult] = useState<SalaryCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>(
    {},
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setResult(null);
    setLoading(false);
    setFieldErrors({});
    setCopiedKey(null);
    setErrorDetail(null);
    setJobTitle(extractJobTitleFromPosting(jobPosting));
    setOfferedSalary("");
    setLocation("");
    setCompetingOffer("");
  }, [open, jobPosting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const validate = useCallback((): boolean => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!jobTitle.trim()) next.jobTitle = "This field is required";
    if (!offeredSalary.trim()) next.offeredSalary = "This field is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }, [jobTitle, offeredSalary]);

  const generate = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/salary-coach", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          offeredSalary: offeredSalary.trim(),
          location: location.trim(),
          competingOffer: competingOffer.trim(),
        }),
      });
      const raw = await res.text();
      let data: { result?: SalaryCoachResult; error?: string };
      try {
        data = JSON.parse(raw) as { result?: SalaryCoachResult; error?: string };
      } catch {
        setErrorDetail(null);
        setPhase("error");
        return;
      }
      if (!res.ok || !data.result) {
        setErrorDetail(
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : null,
        );
        setPhase("error");
        return;
      }
      setResult(data.result);
      setPhase("results");
    } catch {
      setErrorDetail(null);
      setPhase("error");
    } finally {
      setLoading(false);
    }
  }, [jobTitle, offeredSalary, location, competingOffer, validate]);

  const startOver = useCallback(() => {
    setPhase("form");
    setResult(null);
    setErrorDetail(null);
    setFieldErrors({});
    setJobTitle(extractJobTitleFromPosting(jobPosting));
    setOfferedSalary("");
    setLocation("");
    setCompetingOffer("");
  }, [jobPosting]);

  async function copySection(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyAllScripts() {
    if (!result) return;
    await copyPlainText(formatCopyAll(result));
  }

  const inputBase =
    "w-full rounded-xl border bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--brand)]/25";

  if (!mounted || typeof document === "undefined" || !open) {
    return null;
  }

  const inner = !isProPlus ? (
    <div className="pr-10 text-center">
      <ModalHeader titleId={titleId} />
      <Link
        href="/pricing"
        className="mt-8 inline-flex rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
        style={{ background: "var(--gradient-hero)" }}
        onClick={onClose}
      >
        Upgrade to Pro+
      </Link>
    </div>
  ) : phase === "error" ? (
    <>
      <ModalHeader titleId={titleId} />
      <div
        className="mt-6 rounded-xl border p-4 text-sm"
        style={{
          background: "rgba(239,68,68,0.08)",
          borderColor: "rgba(239,68,68,0.2)",
          color: "var(--red)",
          fontSize: 14,
        }}
      >
        {errorDetail ??
          "Something went wrong generating your script. Please try again."}
      </div>
      <button
        type="button"
        onClick={() => {
          setPhase("form");
          setLoading(false);
          setErrorDetail(null);
        }}
        className="mt-6 rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
      >
        Try again
      </button>
    </>
  ) : phase === "results" && result ? (
    <>
      <ModalHeader titleId={titleId} />
      <div
        className="mt-6 rounded-xl border p-4 sm:p-5"
        style={{
          background: "rgba(16,185,129,0.08)",
          borderColor: "rgba(16,185,129,0.2)",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <p className="text-[15px] font-medium text-[var(--text-primary)]">
          💡 Estimated market rate: {result.market_rate}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {result.market_note}
        </p>
        <p className="mt-3 text-[15px] font-bold text-[var(--text-primary)]">
          Your counteroffer: {result.counteroffer}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {result.sections.map((s, i) => {
          const key = `sec-${i}`;
          return (
            <div
              key={key}
              className="relative mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 last:mb-0"
              style={{ borderRadius: 12 }}
            >
              <button
                type="button"
                onClick={() => void copySection(key, s.content)}
                className="absolute right-4 top-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-hover)]"
              >
                {copiedKey === key ? (
                  <span className="text-emerald-600">Copied ✓</span>
                ) : (
                  "Copy"
                )}
              </button>
              <p
                className="mb-2.5 pr-20 text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--brand)]"
                style={{ letterSpacing: "0.08em" }}
              >
                {s.title}
              </p>
              <div className="whitespace-pre-wrap text-[15px] leading-[1.7] text-[var(--text-primary)]">
                {s.content}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void copyAllScripts()}
          className="rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white"
          style={{
            background: "var(--gradient-hero)",
            padding: "10px 20px",
            fontSize: 14,
          }}
        >
          Copy all scripts
        </button>
        <button
          type="button"
          onClick={startOver}
          className="rounded-[10px] border border-[var(--border)] bg-transparent px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)]"
          style={{ padding: "10px 20px", fontSize: 14 }}
        >
          Start over
        </button>
      </div>
    </>
  ) : (
    <>
      <ModalHeader titleId={titleId} />
      <div className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Job title
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => {
              setJobTitle(e.target.value);
              if (fieldErrors.jobTitle) {
                setFieldErrors((f) => ({ ...f, jobTitle: undefined }));
              }
            }}
            disabled={loading}
            placeholder="e.g. Software Engineer"
            className={`${inputBase} ${
              fieldErrors.jobTitle ? "border-[var(--red)]" : "border-[var(--border)]"
            }`}
          />
          {fieldErrors.jobTitle ? (
            <p className="mt-1 text-sm" style={{ color: "var(--red)" }}>
              {fieldErrors.jobTitle}
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Offered salary
          </label>
          <input
            type="text"
            value={offeredSalary}
            onChange={(e) => {
              setOfferedSalary(e.target.value);
              if (fieldErrors.offeredSalary) {
                setFieldErrors((f) => ({ ...f, offeredSalary: undefined }));
              }
            }}
            disabled={loading}
            placeholder="$85,000"
            className={`${inputBase} ${
              fieldErrors.offeredSalary
                ? "border-[var(--red)]"
                : "border-[var(--border)]"
            }`}
          />
          {fieldErrors.offeredSalary ? (
            <p className="mt-1 text-sm" style={{ color: "var(--red)" }}>
              {fieldErrors.offeredSalary}
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Location / Remote
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
            placeholder="New York, NY or Remote"
            className={`${inputBase} border-[var(--border)]`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Competing offer (optional)
          </label>
          <input
            type="text"
            value={competingOffer}
            onChange={(e) => setCompetingOffer(e.target.value)}
            disabled={loading}
            placeholder="e.g. $92,000 from another company"
            className={`${inputBase} border-[var(--border)]`}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void generate()}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        style={{ background: "var(--gradient-hero)" }}
      >
        {loading ? (
          <>
            <Spinner />
            <span>Generating your script...</span>
          </>
        ) : (
          "Generate negotiation script"
        )}
      </button>

      {loading ? <ScriptSkeletonCards /> : null}
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-[4px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className="relative z-[1001] max-h-[90vh] w-[90%] max-w-[620px] overflow-y-auto rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition hover:bg-[var(--bg-card-hover)]"
          style={{ width: 32, height: 32 }}
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {inner}
      </div>
    </div>,
    document.body,
  );
}
