"use client";

import { useMemo } from "react";
import type { Analysis } from "@/lib/analysisTypes";
import { FeatureLock } from "@/components/subscription/FeatureLock";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";

type RowTone = "green" | "amber" | "red";

type ReadinessRow = {
  key: string;
  tone: RowTone;
  title: string;
  sub: string;
};

function StatusIcon({ tone }: { tone: RowTone }) {
  const ring =
    tone === "green"
      ? "bg-emerald-500/12 text-emerald-600 ring-emerald-500/35"
      : tone === "amber"
        ? "bg-amber-500/12 text-amber-600 ring-amber-500/35"
        : "bg-red-500/12 text-red-600 ring-red-500/35";

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${ring}`}
      aria-hidden
    >
      {tone === "green" ? "✓" : tone === "amber" ? "⚠" : "✗"}
    </span>
  );
}

function trafficFromGreenCount(n: number): RowTone {
  if (n >= 4) return "green";
  if (n >= 2) return "amber";
  return "red";
}

function verdictFromGreenCount(n: number): {
  tone: RowTone;
  text: string;
} {
  if (n >= 4) {
    return {
      tone: "green",
      text: "You're ready! Go apply with confidence.",
    };
  }
  if (n >= 2) {
    return {
      tone: "amber",
      text: "Almost there. Fix the amber items first.",
    };
  }
  return {
    tone: "red",
    text: "Not ready yet. Work through the gaps first.",
  };
}

function badgeClass(tone: RowTone): string {
  if (tone === "green") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (tone === "amber") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  return "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100";
}

function trafficDotClass(tone: RowTone): string {
  if (tone === "green") return "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]";
  if (tone === "amber") return "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]";
  return "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]";
}

export function MatchReadinessChecker({
  analysis,
  coverLetter,
  loadingCoverLetter = false,
}: {
  analysis: Analysis;
  coverLetter: string | null;
  loadingCoverLetter?: boolean;
}) {
  const { isPro } = useSubscription();

  const rows = useMemo((): ReadinessRow[] => {
    const ats = Math.round(analysis.atsScore);
    const gapCount = analysis.resumeGaps.length;
    const match = Math.round(analysis.matchScore);
    const ip = analysis.interviewPrep;
    const interviewLoaded =
      (ip.behavioral?.length ?? 0) + (ip.technical?.length ?? 0) > 0 ||
      (ip.predictedQuestions?.length ?? 0) > 0 ||
      (ip.likelyQuestions?.length ?? 0) > 0;

    const atsRow: ReadinessRow =
      ats >= 70
        ? {
            key: "ats",
            tone: "green",
            title: "ATS score is strong",
            sub: "Keyword and phrasing fit this posting well—keep wording tight in your resume.",
          }
        : ats >= 50
          ? {
              key: "ats",
              tone: "amber",
              title: "ATS score needs work",
              sub: "Tighten bullets and weave in missing keywords from the job description.",
            }
          : {
              key: "ats",
              tone: "red",
              title: "ATS score too low",
              sub: "Revise your resume for this posting before you apply—ATS fit is a gate.",
            };

    const gapsRow: ReadinessRow =
      gapCount === 0
        ? {
            key: "gaps",
            tone: "green",
            title: "No critical gaps found",
            sub: "No major posting gaps flagged—still polish any weak bullets.",
          }
        : gapCount <= 3
          ? {
              key: "gaps",
              tone: "amber",
              title: "Minor gaps to address",
              sub: "Close a few gaps with evidence or reframed experience where honest.",
            }
          : {
              key: "gaps",
              tone: "red",
              title: "Too many gaps — fix before applying",
              sub: "Prioritize the highest-impact gaps so your story matches the role.",
            };

    const matchRow: ReadinessRow =
      match >= 60
        ? {
            key: "match",
            tone: "green",
            title: "Good overall match",
            sub: "Your profile aligns with the role’s core asks on balance.",
          }
        : {
            key: "match",
            tone: "amber",
            title: "Match score below recommended",
            sub: "Strengthen proof for the biggest gaps before you submit.",
          };

    let coverRow: ReadinessRow;
    if (loadingCoverLetter) {
      coverRow = {
        key: "cover",
        tone: "amber",
        title: "Cover letter not yet created",
        sub: "Your cover letter is generating—check back in a moment.",
      };
    } else if (coverLetter && coverLetter.trim().length > 0) {
      coverRow = {
        key: "cover",
        tone: "green",
        title: "Cover letter ready",
        sub: "You have a tailored letter for this application.",
      };
    } else {
      coverRow = {
        key: "cover",
        tone: "amber",
        title: "Cover letter not yet created",
        sub: "Generate a cover letter on the Cover letter step before you apply.",
      };
    }

    const interviewRow: ReadinessRow = interviewLoaded
      ? {
          key: "interview",
          tone: "green",
          title: "Interview prep done",
          sub: "Practice questions and stories are loaded for this role.",
        }
      : {
          key: "interview",
          tone: "amber",
          title: "Complete interview prep first",
          sub: "Review questions and your intro before you submit.",
        };

    return [atsRow, gapsRow, matchRow, coverRow, interviewRow];
  }, [analysis, coverLetter, loadingCoverLetter]);

  const greenCount = useMemo(
    () => rows.filter((r) => r.tone === "green").length,
    [rows],
  );

  const traffic = trafficFromGreenCount(greenCount);
  const verdict = verdictFromGreenCount(greenCount);

  const inner = (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${trafficDotClass(traffic)}`}
          title="Readiness signal"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-[var(--text-primary)]">
            Ready to apply?
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Snapshot from your current analysis, cover letter, and prep.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-4">
        {rows.map((row, i) => (
          <li
            key={row.key}
            className="flex gap-3 opacity-0 [animation:home-reveal_0.45s_ease-out_forwards]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <StatusIcon tone={row.tone} />
            <div className="min-w-0">
              <p className="text-[14px] font-medium leading-snug text-[var(--text-primary)]">
                {row.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
                {row.sub}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div
        className="mt-6 border-t border-[var(--border)] pt-4 opacity-0 [animation:home-reveal_0.45s_ease-out_forwards]"
        style={{ animationDelay: `${rows.length * 80}ms` }}
      >
        <span
          className={`inline-block rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClass(verdict.tone)}`}
        >
          {verdict.text}
        </span>
      </div>
    </div>
  );

  return (
    <FeatureLock
      locked={!isPro}
      description="Upgrade to Pro to unlock the full readiness checklist and apply with confidence."
      className="w-full"
    >
      {inner}
    </FeatureLock>
  );
}
