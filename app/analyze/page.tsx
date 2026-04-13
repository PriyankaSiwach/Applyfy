"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { StrengthEmDashLine } from "@/components/applyfy/StrengthEmDashLine";
import { AtsScoreHistory } from "@/components/applyfy/AtsScoreHistory";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { PageShell } from "@/components/PageShell";
import {
  keywordChipsFromResumeLiteral,
  resumePlainForKeywordMatching,
} from "@/lib/alignedJobKeywords";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";
import {
  getSoftSkillMissingHint,
  type SoftSkillMissingHint,
} from "@/lib/softSkillMissingHints";

export default function AnalyzePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    resume,
    setResume,
    jobLink,
    setJobLink,
    jobPosting,
    loadingAnalyze,
    analyzeError,
    analysis,
    baselineAnalysis,
    runAnalyze,
    hydrateOriginalResumePlain,
    invalidateAnalysisForNewResume,
    originalResumePlain,
    jobKeywordLabels,
    resumeSourceOfTruth,
    optimizationAppliedAt,
    undoResumeOptimization,
    reanalyzeAfterOptimizeNeeded,
    committedHybridAtsScore,
  } = useApplyfy();

  const { isPro, isFree } = useSubscription();

  const resumePlainForKw = useMemo(
    () => resumePlainForKeywordMatching(resume, originalResumePlain),
    [resume, originalResumePlain],
  );

  const displayAtsScore = useMemo(() => {
    const raw =
      committedHybridAtsScore !== null
        ? committedHybridAtsScore
        : (baselineAnalysis?.atsScore ?? analysis?.atsScore ?? 0);
    return Math.min(100, Math.max(0, Math.round(raw)));
  }, [committedHybridAtsScore, baselineAnalysis?.atsScore, analysis?.atsScore]);

  const analyzeKeywordChips = useMemo(() => {
    if (!baselineAnalysis) return [];
    return keywordChipsFromResumeLiteral(
      resumePlainForKw,
      jobKeywordLabels,
      baselineAnalysis.keywords.map((k) => k.skill.trim()),
    );
  }, [baselineAnalysis, jobKeywordLabels, resumePlainForKw]);

  const missingKeywordCount = useMemo(
    () => analyzeKeywordChips.filter((c) => !c.found).length,
    [analyzeKeywordChips],
  );

  const softSkillHintsBySkill = useMemo(() => {
    const plain = resumePlainForKw.trim();
    const map = new Map<string, SoftSkillMissingHint>();
    if (plain.length < 12) return map;
    for (const chip of analyzeKeywordChips) {
      if (chip.found) continue;
      const hint = getSoftSkillMissingHint(chip.skill, plain);
      if (hint) map.set(chip.skill, hint);
    }
    return map;
  }, [analyzeKeywordChips, resumePlainForKw]);

  const strongerBulletsCount = baselineAnalysis?.rewrites.length ?? 0;

  useEffect(() => {
    if (!reanalyzeAfterOptimizeNeeded || loadingAnalyze) return;
    if (!resume.trim()) return;
    void runAnalyze();
  }, [reanalyzeAfterOptimizeNeeded, loadingAnalyze, resume, runAnalyze]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFileError(null);
    if (!resume.trim()) {
      setFileError("Upload a resume file (.pdf, .docx, .txt, or .md).");
      return;
    }
    if (!jobLink.trim()) {
      setFileError("Enter the full URL of the job posting.");
      return;
    }
    await runAnalyze();
  }

  async function onFileChange(files: FileList | null) {
    setFileError(null);
    const file = files?.[0];
    if (!file) {
      invalidateAnalysisForNewResume();
      setFileLabel(null);
      setResume("");
      void hydrateOriginalResumePlain("");
      return;
    }
    try {
      invalidateAnalysisForNewResume();
      const payload = await resumeFileToPayload(file);
      setResume(payload);
      setFileLabel(file.name);
      void hydrateOriginalResumePlain(payload);
    } catch {
      invalidateAnalysisForNewResume();
      setFileError("Could not read that file. Try another format.");
      setFileLabel(null);
      setResume("");
      void hydrateOriginalResumePlain("");
    }
  }

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Analyze
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-gray-600">
          Upload your resume and paste the job listing URL. We&apos;ll fetch the
          posting, score fit, and prepare match, cover letter, and interview
          prep.
        </p>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mx-auto mt-8 w-full max-w-5xl"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="resume-file"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Resume file
              </label>
              <input
                ref={inputRef}
                id="resume-file"
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="sr-only"
                onChange={(e) => void onFileChange(e.target.files)}
              />
              <div className="flex min-h-[200px] flex-col justify-center rounded-xl border border-dashed border-slate-300 bg-card p-6 text-center">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mx-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Choose file
                </button>
                <p className="mt-3 text-xs text-gray-500">
                  PDF, Word (.docx), or plain text (.txt / .md)
                </p>
                {fileLabel ? (
                  <p className="mt-4 text-sm font-medium text-slate-800">
                    Selected: {fileLabel}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">No file selected</p>
                )}
              </div>
            </div>
            <div>
              <label
                htmlFor="job-link"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Job posting link
              </label>
              <input
                id="job-link"
                type="url"
                name="jobLink"
                autoComplete="url"
                placeholder="https://…"
                value={jobLink}
                onChange={(e) => setJobLink(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-card px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <p className="mt-2 text-xs text-gray-500">
                Public page for the role (we fetch the description server-side).
              </p>
            </div>
          </div>
          {fileError ? (
            <p className="mt-4 text-center text-sm text-red-600">{fileError}</p>
          ) : null}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="submit"
              disabled={loadingAnalyze}
              className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Run analysis
            </button>
            {loadingAnalyze ? (
              <p className="text-sm text-gray-600">Analyzing…</p>
            ) : null}
          </div>
        </form>

        {analyzeError ? (
          <p className="mt-6 text-center text-sm text-red-600">{analyzeError}</p>
        ) : null}

        {analysis && !loadingAnalyze ? (
          <div className="mx-auto mt-10 max-w-3xl space-y-6 text-left">
            {resumeSourceOfTruth === "optimized" && optimizationAppliedAt ? (
              <div className="flex flex-col gap-2 rounded-xl border border-violet-200/90 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/50 px-4 py-3 text-sm text-violet-950 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing analysis of your optimized resume · Last updated{" "}
                  {new Date(optimizationAppliedAt).toLocaleString()}
                  {reanalyzeAfterOptimizeNeeded && loadingAnalyze
                    ? " · Updating scores…"
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => undoResumeOptimization()}
                  className="shrink-0 text-left font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:text-primary-hover"
                >
                  Undo optimization
                </button>
              </div>
            ) : null}

            <p className="text-center text-sm text-gray-600">
              Analysis ready.{" "}
              {isPro ? (
                <>
                  <Link
                    href="/resume-editor"
                    className="font-semibold text-accent hover:text-primary-hover"
                  >
                    Resume editor
                  </Link>
                  {" · "}
                  <Link
                    href="/match"
                    className="font-semibold text-accent hover:text-primary-hover"
                  >
                    View match
                  </Link>
                  {" · "}
                  <Link
                    href="/cover"
                    className="font-semibold text-accent hover:text-primary-hover"
                  >
                    Cover letter
                  </Link>
                  {" · "}
                  <Link
                    href="/interview"
                    className="font-semibold text-accent hover:text-primary-hover"
                  >
                    Interview prep
                  </Link>
                </>
              ) : (
                <Link
                  href="/pricing"
                  className="font-semibold text-accent hover:text-primary-hover"
                >
                  Upgrade to unlock Resume editor, Match, Cover letter &amp;
                  Interview prep
                </Link>
              )}
            </p>

            <section className="rounded-xl border border-[#2E3E65]/25 bg-gradient-to-br from-[#2E3E65]/8 to-[#4F8EF7]/10 p-5 sm:p-6">
              <p className="text-lg font-bold tracking-tight text-[#2E3E65]">
                ATS Alignment: {displayAtsScore}/100
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Keyword and phrasing fit between your resume as written and this
                posting—separate from overall role fit.
              </p>
            </section>

            {isPro ? <AtsScoreHistory /> : null}

            <section className="rounded-xl border border-violet-200/80 bg-gradient-to-b from-violet-50/50 to-white p-6">
              <h2 className="mb-4 text-sm font-bold text-slate-900">
                Quick wins
              </h2>
              <div className="grid gap-3">
                {(isPro ? analysis.quickWins : analysis.quickWins.slice(0, 3)).map(
                  (w, i) => (
                    <div
                      key={`qw-${i}`}
                      className="rounded-lg border border-violet-200/90 bg-white/95 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm"
                    >
                      {w}
                    </div>
                  ),
                )}
              </div>
              {!isPro && analysis.quickWins.length > 3 ? (
                <p className="mt-3 text-center text-sm text-slate-600">
                  +{analysis.quickWins.length - 3} more on Pro —{" "}
                  <Link href="/pricing" className="font-semibold text-accent">
                    View plans
                  </Link>
                </p>
              ) : null}
            </section>

            {analyzeKeywordChips.length > 0 ? (
              <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                <h2 className="mb-3 text-sm font-bold text-slate-900">
                  ATS keywords
                </h2>
                <div className="flex flex-col gap-4">
                  {analyzeKeywordChips.map((k, i) => {
                    const hint = !k.found
                      ? softSkillHintsBySkill.get(k.skill)
                      : undefined;
                    return (
                      <div
                        key={`kw-${k.skill}-${i}`}
                        className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              k.found
                                ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                                : "rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200"
                            }
                          >
                            {k.skill}
                          </span>
                        </div>
                        {hint ? (
                          <div className="mt-3 rounded-lg border border-amber-200/90 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-slate-800">
                            <p className="font-semibold text-slate-900">
                              {hint.skillLabel}{" "}
                              <span className="text-red-700" aria-hidden>
                                ✗
                              </span>
                            </p>
                            <p className="mt-2">
                              <span className="font-semibold text-slate-900">
                                Evidence found:{" "}
                              </span>
                              {hint.evidenceExcerpt}
                              <span className="text-slate-600">
                                {" "}
                                — but the word &apos;{hint.skillLabel}&apos;
                                never appears explicitly on your resume.
                              </span>
                            </p>
                            <p className="mt-2">
                              <span className="font-semibold text-emerald-800">
                                Quick fix:{" "}
                              </span>
                              Add &apos;{hint.quickFixPhrase}&apos; to{" "}
                              {hint.targetDescription}. That wording includes
                              the exact keyword text so it will count as a match
                              (we never add it for you — edit only if it&apos;s
                              accurate).
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {softSkillHintsBySkill.size > 0 ? (
                  <p className="mt-2 text-xs text-amber-900/80">
                    Soft-skill tips only appear when we see related behavior in
                    your text but not the exact keyword — they&apos;re
                    suggestions, not auto-edits.
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200/90 bg-card p-6">
              <h2 className="mb-3 text-sm font-bold text-slate-900">
                Matched strengths
              </h2>
              <p className="mb-3 text-xs leading-relaxed text-slate-600">
                One line per ATS-green keyword only (exact phrase found in your
                resume). No extra labels beyond those keywords.
              </p>
              {analysis.matchedStrengths.length > 0 ? (
                <>
                  <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                    {(isPro
                      ? analysis.matchedStrengths
                      : analysis.matchedStrengths.slice(0, 2)
                    ).map((s, i) => (
                      <li key={`ms-${i}`}>
                        <StrengthEmDashLine text={s} />
                      </li>
                    ))}
                  </ul>
                  {!isPro && analysis.matchedStrengths.length > 2 ? (
                    <p className="mt-3 text-center text-sm text-slate-600">
                      +{analysis.matchedStrengths.length - 2} more on Pro —{" "}
                      <Link href="/pricing" className="font-semibold text-accent">
                        View plans
                      </Link>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm leading-relaxed text-slate-600">
                  No job keywords from this analysis appear literally on your
                  resume yet.
                </p>
              )}
            </section>

            {isFree ? (
              <section className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
                <p className="text-base font-semibold text-slate-900">
                  {analysis.resumeGaps.length} gap
                  {analysis.resumeGaps.length === 1 ? "" : "s"} found — upgrade
                  to see details
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  View plans
                </Link>
              </section>
            ) : (
              <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                <h2 className="mb-4 text-sm font-bold text-slate-900">Gaps</h2>
                <div className="space-y-4">
                  {analysis.resumeGaps.map((g, i) => (
                    <div
                      key={`gap-${g.skill}-${i}`}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-900">
                        {g.skill}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        <span className="font-medium text-slate-600">
                          Reality:{" "}
                        </span>
                        {g.reality}
                      </p>
                      <p className="mt-2 text-sm text-slate-800">
                        <span className="font-medium text-slate-700">Fix: </span>
                        {g.fix}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="relative overflow-hidden rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-md">
              <p className="text-lg font-bold text-slate-900">
                ✨ Ready to fix these gaps?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Your resume has{" "}
                <span className="font-semibold text-slate-900">
                  {missingKeywordCount}
                </span>{" "}
                keyword{missingKeywordCount === 1 ? "" : "s"} missing and{" "}
                <span className="font-semibold text-slate-900">
                  {strongerBulletsCount}
                </span>{" "}
                bullet{strongerBulletsCount === 1 ? "" : "s"} that can be
                stronger. The Resume Editor will rewrite them in one click.
              </p>
              {isPro ? (
                <Link
                  href="/resume-editor"
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow transition-colors hover:bg-primary-hover"
                >
                  Open Resume Editor
                  <span aria-hidden>→</span>
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow transition-colors hover:bg-primary-hover"
                >
                  Upgrade for Resume Editor
                  <span aria-hidden>→</span>
                </Link>
              )}
            </section>
          </div>
        ) : null}
      </PageShell>
    </ApplyFlowChrome>
  );
}
