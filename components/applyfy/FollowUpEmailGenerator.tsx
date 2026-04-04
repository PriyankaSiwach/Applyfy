"use client";

import { useCallback, useState } from "react";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { FeatureLock } from "@/components/subscription/FeatureLock";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";

function EmailSkeleton() {
  return (
    <div
      className="skeleton-shimmer-animate min-h-[240px] overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-6"
      aria-hidden
    >
      <div className="h-3 w-[42%] animate-pulse rounded-md bg-slate-200" />
      <div className="mt-8 space-y-2.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-md bg-slate-200/90"
            style={{
              width: `${72 + ((i * 7) % 28)}%`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function FollowUpEmailGenerator() {
  const { isPro } = useSubscription();
  const { resume, jobPosting, jobLink, copyPlainText } = useApplyfy();

  const [daysSince, setDaysSince] = useState(7);
  const [hiringName, setHiringName] = useState("");
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setError(null);
    if (!resume.trim()) {
      setError("Add a resume and run analysis first.");
      return;
    }
    if (jobPosting.trim().length < 40) {
      setError("Job description is too short. Run analysis with a full posting.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/follow-up-email", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jobPosting,
          jobLink: jobLink.trim() || undefined,
          daysSinceApplied: daysSince,
          hiringManagerName: hiringName.trim() || undefined,
        }),
      });
      const raw = await res.text();
      let data: { email?: string; error?: string };
      try {
        data = JSON.parse(raw) as { email?: string; error?: string };
      } catch {
        setError("Couldn't generate — try again");
        return;
      }
      if (!res.ok || !data.email?.trim()) {
        setError("Couldn't generate — try again");
        return;
      }
      setEmailText(data.email.trim());
    } catch {
      setError("Couldn't generate — try again");
    } finally {
      setLoading(false);
    }
  }, [resume, jobPosting, jobLink, daysSince, hiringName]);

  const inner = (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 sm:p-6">
      <h3 className="text-lg font-bold text-[#0f172a]">Follow-up email generator</h3>
      <p className="mt-1 text-sm text-[#64748b]">
        Send this 5–7 days after applying if you haven&apos;t heard back.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="followup-days"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#94a3b8]"
          >
            Days since you applied
          </label>
          <input
            id="followup-days"
            type="number"
            min={1}
            max={30}
            value={daysSince}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(v)) {
                setDaysSince(7);
                return;
              }
              setDaysSince(Math.min(30, Math.max(1, v)));
            }}
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#1a56db] focus:ring-2 focus:ring-[#1a56db]/20"
          />
        </div>
        <div>
          <label
            htmlFor="followup-hm"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#94a3b8]"
          >
            Hiring manager name (optional)
          </label>
          <input
            id="followup-hm"
            type="text"
            placeholder="e.g. Sarah"
            value={hiringName}
            onChange={(e) => setHiringName(e.target.value)}
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#1a56db] focus:ring-2 focus:ring-[#1a56db]/20"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void generate()}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {loading ? "Generating…" : "Generate follow-up email"}
      </button>

      {error ? (
        <p className="mt-4 text-sm text-[#ef4444]">{error}</p>
      ) : null}

      {loading && !emailText ? (
        <div className="mt-6">
          <EmailSkeleton />
        </div>
      ) : null}

      {loading && emailText ? (
        <p className="mt-4 text-center text-xs font-medium text-[#0ea5e9]">
          Regenerating…
        </p>
      ) : null}

      {emailText ? (
        <>
          <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-white p-6 transition-shadow focus-within:border-[#1a56db] focus-within:shadow-[0_0_0_3px_rgba(26,86,219,0.1)]">
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              className={`cover-letter-editor box-border min-h-[240px] w-full min-w-0 max-w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-[1.8] text-[#0f172a] outline-none whitespace-pre-wrap ${
                loading ? "opacity-60" : ""
              }`}
              rows={14}
              aria-label="Follow-up email"
            />
          </div>
          <p className="mt-2 text-center text-xs text-[#94a3b8]">Click to edit</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void copyPlainText(emailText)}
              className="rounded-lg border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-medium text-[#64748b] transition-all hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void generate()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1a56db] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <FeatureLock
      locked={!isPro}
      tier="pro"
      description="Generate a tailored follow-up email for this role—upgrade to Pro."
      className="w-full"
    >
      {inner}
    </FeatureLock>
  );
}
