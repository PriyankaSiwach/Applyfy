"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { MatchReadinessChecker } from "@/components/applyfy/MatchReadinessChecker";
import { MatchScoreArcAndBreakdown } from "@/components/applyfy/MatchScoreArcAndBreakdown";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { PageShell } from "@/components/PageShell";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { GatedFeature } from "@/components/subscription/GatedFeature";
import { analysisForMatchDisplay } from "@/lib/matchDisplayAnalysis";

function SkillPill({
  text,
  variant,
}: {
  text: string;
  variant: "match" | "miss";
}) {
  const base =
    variant === "match"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : "bg-red-50 text-red-900 ring-red-200";
  const shown = text.length > 72 ? `${text.slice(0, 70)}…` : text;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-3 py-1 text-xs font-medium ring-1 ${base}`}
      title={text}
    >
      {variant === "match" ? (
        <svg
          className="h-3 w-3 shrink-0 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : null}
      <span className="min-w-0 truncate">{shown}</span>
    </span>
  );
}

export default function MatchPage() {
  const {
    baselineAnalysis,
    committedHybridAtsScore,
    coverLetter,
    loadingCoverLetter,
  } = useApplyfy();

  const matchDisplayAnalysis = useMemo(() => {
    if (!baselineAnalysis) return null;
    return analysisForMatchDisplay(baselineAnalysis, committedHybridAtsScore);
  }, [baselineAnalysis, committedHybridAtsScore]);

  const presentSkills = useMemo(
    () =>
      (baselineAnalysis?.matchedSkills ?? []).slice(0, 12).map((s) => {
        const cleaned = s.split("—")[0]?.trim() || s;
        return cleaned.length > 40 ? `${cleaned.slice(0, 38)}…` : cleaned;
      }),
    [baselineAnalysis?.matchedSkills],
  );

  const absentSkills = useMemo(
    () =>
      (baselineAnalysis?.missingSkills ?? []).slice(0, 12).map((s) => {
        const cleaned = s.split("—")[0]?.trim() || s;
        return cleaned.length > 40 ? `${cleaned.slice(0, 38)}…` : cleaned;
      }),
    [baselineAnalysis?.missingSkills],
  );

  const why = baselineAnalysis?.matchExplanation.slice(0, 3) ?? [];

  if (!baselineAnalysis || !matchDisplayAnalysis) {
    return (
      <ApplyFlowChrome>
        <PageShell narrow={false}>
          <NeedAnalysis />
        </PageShell>
      </ApplyFlowChrome>
    );
  }

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        <GatedFeature
          requiredTier="pro"
          hidePlaceholder
          className="min-h-[320px] space-y-8"
          title="Match"
          description="Upgrade to Pro for your match score, breakdown, readiness view, and keyword table."
        >
        <div className="space-y-8">
          <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Match
          </h1>

          <section className="rounded-xl border border-slate-200/90 bg-card p-6 sm:p-8">
            <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
              Match score
            </h2>
            <MatchScoreArcAndBreakdown analysis={matchDisplayAnalysis} />
            <div className="mt-8 border-t border-slate-100 pt-6">
              <MatchReadinessChecker
                analysis={matchDisplayAnalysis}
                coverLetter={coverLetter}
                loadingCoverLetter={loadingCoverLetter}
              />
            </div>
            {why.length > 0 ? (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Quick wins
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
                  {why.map((line, i) => (
                    <li key={`w-${i}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200/90 bg-card p-6 sm:p-8">
            <h2 className="mb-4 text-sm font-bold text-slate-900">
              Matched vs missing skills
            </h2>
            {presentSkills.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Matched skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {presentSkills.map((s) => (
                    <SkillPill key={`p-${s}`} text={s} variant="match" />
                  ))}
                </div>
              </div>
            ) : null}
            {absentSkills.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">
                  Missing / weak
                </p>
                <div className="flex flex-wrap gap-2">
                  {absentSkills.map((s) => (
                    <SkillPill key={`a-${s}`} text={s} variant="miss" />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {baselineAnalysis.requirementChecks.length > 0 ? (
            <section className="rounded-xl border border-slate-200/90 bg-card p-4 sm:p-8">
              <h2 className="mb-4 text-sm font-bold text-slate-900">
                Job requirements vs your resume
              </h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th
                        scope="col"
                        className="w-1/2 px-4 py-3 font-semibold text-slate-900"
                      >
                        What the job asks
                      </th>
                      <th
                        scope="col"
                        className="w-1/2 px-4 py-3 font-semibold text-slate-900"
                      >
                        Your resume
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselineAnalysis.requirementChecks.map((row, i) => (
                      <tr
                        key={`rq-${i}-${row.skill}`}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="align-top border-r border-slate-100 px-4 py-3 font-medium text-slate-900">
                          {row.skill}
                        </td>
                        <td className="align-top px-4 py-3">
                          <div className="flex gap-3">
                            <span
                              role="img"
                              aria-label={
                                row.present
                                  ? "Present on resume"
                                  : "Missing on resume"
                              }
                              className={`shrink-0 text-xl font-bold leading-none ${
                                row.present ? "text-[#22A05B]" : "text-red-500"
                              }`}
                            >
                              {row.present ? "✓" : "✗"}
                            </span>
                            <p className="text-xs leading-relaxed text-gray-600">
                              {row.evidence}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                Matches use semantic evidence (tools, outcomes, behaviors)—not
                only exact keyword phrases.
              </p>
            </section>
          ) : null}

          <p className="text-center text-xs text-gray-600">
            Tune your resume in the{" "}
            <Link
              href="/resume-editor"
              className="font-semibold text-accent hover:text-primary-hover"
            >
              Resume editor
            </Link>{" "}
            or revisit{" "}
            <Link
              href="/analyze"
              className="font-semibold text-accent hover:text-primary-hover"
            >
              Analyze
            </Link>
            .
          </p>
        </div>
        </GatedFeature>
      </PageShell>
    </ApplyFlowChrome>
  );
}
