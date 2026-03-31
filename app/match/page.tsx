"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { ScoreArc } from "@/components/applyfy/ScoreArc";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { PageShell } from "@/components/PageShell";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { fetchMatchRescanScore } from "@/lib/fetchMatchRescanScore";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";

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
      className={`inline-block max-w-full truncate rounded-full px-3 py-1 text-xs font-medium ring-1 ${base}`}
      title={text}
    >
      {shown}
    </span>
  );
}

export default function MatchPage() {
  const compareFileRef = useRef<HTMLInputElement>(null);
  const { analysis, resume, jobLink } = useApplyfy();
  const [rescannedMatch, setRescannedMatch] = useState<{
    matchScore: number;
    matchedSkills: string[];
    missingSkills: string[];
  } | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  useEffect(() => {
    setRescannedMatch(null);
    setRescanError(null);
  }, [analysis]);

  async function handleRescanMatch() {
    setRescanError(null);
    const payload = resume;
    if (!payload.trim()) {
      setRescanError("Upload a resume on Analyze first.");
      return;
    }
    if (!payload.trimStart().startsWith("data:") && payload.trim().length < 80) {
      setRescanError("Resume text must be at least 80 characters.");
      return;
    }
    if (!jobLink.trim()) {
      setRescanError("Add a job posting URL on Analyze.");
      return;
    }
    setRescanning(true);
    try {
      const next = await fetchMatchRescanScore({
        resumePayload: payload,
        jobLink: jobLink.trim(),
      });
      setRescannedMatch(next);
    } catch (e) {
      setRescanError(e instanceof Error ? e.message : "Rescan failed.");
    } finally {
      setRescanning(false);
    }
  }

  async function handleCompareFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setRescanError(null);
    setRescanning(true);
    try {
      const payload = await resumeFileToPayload(file);
      const next = await fetchMatchRescanScore({
        resumePayload: payload,
        jobLink: jobLink.trim(),
      });
      setRescannedMatch(next);
    } catch (e) {
      setRescanError(
        e instanceof Error ? e.message : "Could not compare this resume.",
      );
    } finally {
      setRescanning(false);
      if (compareFileRef.current) compareFileRef.current.value = "";
    }
  }

  if (!analysis) {
    return (
      <ApplyFlowChrome>
        <PageShell narrow={false}>
          <NeedAnalysis />
        </PageShell>
      </ApplyFlowChrome>
    );
  }

  const why = analysis.matchExplanation.slice(0, 3);
  const matchedSource = rescannedMatch?.matchedSkills ?? analysis.matchedSkills;
  const missingSource = rescannedMatch?.missingSkills ?? analysis.missingSkills;
  const presentSkills = matchedSource
    .map((s) => s.split("—")[0]?.trim() || s)
    .slice(0, 12);
  const absentSkills = missingSource
    .map((s) => s.split("—")[0]?.trim() || s)
    .slice(0, 12);

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        <div className="space-y-8">
          <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            Match
          </h1>

          <section className="rounded-xl border border-slate-200/90 bg-card p-6 sm:p-8">
            <h2 className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
              Match score
            </h2>
            {(() => {
              const originalScore = analysis.matchScore;
              const hasRescan = rescannedMatch !== null;
              const currentScore =
                hasRescan ? rescannedMatch.matchScore : originalScore;
              const diffPct =
                hasRescan
                  ? Math.round(rescannedMatch.matchScore - originalScore)
                  : null;
              return (
                <>
                  <div
                    className={
                      hasRescan
                        ? "grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6"
                        : ""
                    }
                  >
                    <div>
                      <p className="mb-3 text-center text-xs font-semibold text-slate-600">
                        {hasRescan ? "Original score" : "Match score"}
                      </p>
                      <ScoreArc score={originalScore} />
                    </div>
                    {hasRescan ? (
                      <div>
                        <p className="mb-3 text-center text-xs font-semibold text-slate-600">
                          Current score
                        </p>
                        <ScoreArc score={currentScore} />
                      {diffPct !== null && diffPct > 0 ? (
                        <p className="mt-3 text-center text-sm font-semibold text-emerald-600">
                          ↑ +{diffPct}%
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            ({Math.round(originalScore)}% →{" "}
                            {Math.round(currentScore)}%)
                          </span>
                        </p>
                      ) : diffPct !== null && diffPct < 0 ? (
                        <p className="mt-3 text-center text-sm text-slate-600">
                          {Math.round(originalScore)}% →{" "}
                          {Math.round(currentScore)}% ({diffPct}%)
                        </p>
                      ) : diffPct === 0 && rescannedMatch !== null ? (
                        <p className="mt-3 text-center text-xs text-slate-500">
                          No change vs original scan.
                        </p>
                      ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                    <input
                      ref={compareFileRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="sr-only"
                      onChange={(e) => void handleCompareFile(e.target.files)}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={rescanning}
                          onClick={() => void handleRescanMatch()}
                          className="rounded-lg border border-[#4F8EF7] bg-[#4F8EF7]/10 px-4 py-2 text-sm font-semibold text-[#2E3E65] transition-colors hover:bg-[#4F8EF7]/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {rescanning
                            ? "Rescanning…"
                            : "Keep resume + job posting (rescan)"}
                        </button>
                        <button
                          type="button"
                          disabled={rescanning}
                          onClick={() => compareFileRef.current?.click()}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add another resume to compare
                        </button>
                      </div>
                      {rescanError ? (
                        <p className="text-center text-xs text-red-600">
                          {rescanError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              );
            })()}
            {why.length > 0 ? (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Why this score?
                </h3>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
                  {why.map((line, i) => (
                    <li key={`me-${i}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(presentSkills.length > 0 || absentSkills.length > 0) ? (
              <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
                {presentSkills.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      Matched skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presentSkills.map((s) => (
                        <SkillPill key={s} text={s} variant="match" />
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
                        <SkillPill key={s} text={s} variant="miss" />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {analysis.requirementChecks.length > 0 ? (
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
                    {analysis.requirementChecks.map((row, i) => (
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
            </section>
          ) : null}

          <p className="text-center text-xs text-gray-600">
            More resume ideas on the{" "}
            <Link
              href="/analyze"
              className="font-semibold text-accent hover:text-primary-hover"
            >
              Analyze
            </Link>{" "}
            page.
          </p>
        </div>
      </PageShell>
    </ApplyFlowChrome>
  );
}
