"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import { ApplicationStepper } from "@/components/applyfy/ApplicationStepper";
import { CoverLetterPanel } from "@/components/applyfy/CoverLetterPanel";
import { InterviewPrepPanel } from "@/components/applyfy/InterviewPrepPanel";
import { MatchScoreArcAndBreakdown } from "@/components/applyfy/MatchScoreArcAndBreakdown";
import { TrustDataBar } from "@/components/applyfy/TrustDataBar";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import {
  extractJobTitleAndCompany,
  sanitizeCompany,
  sanitizeJobTitle,
} from "@/lib/jobMetaFromPosting";
import type { InterviewPrep } from "@/lib/analysisTypes";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";
import { MIN_JOB_POSTING_CHARS } from "@/lib/parseAnalyzeBody";
import { upsertTrackerApplication } from "@/lib/trackerStorage";
import { FeatureLock } from "@/components/subscription/FeatureLock";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { AtsScoreHistory } from "@/components/applyfy/AtsScoreHistory";
import { ReadinessChecklist } from "@/components/applyfy/ReadinessChecklist";
import { FollowUpEmailCta } from "@/components/applyfy/FollowUpEmailCta";
import {
  canRunFreeAnalysis,
  incrementMonthlyAnalysisCount,
} from "@/lib/analysisQuota";
import { LiveResumeEditorExperience } from "@/components/applyfy/LiveResumeEditorExperience";

const steps = [
  "Input",
  "Analyze",
  "Resume Editor",
  "Match",
  "Cover letter",
  "Interview prep",
] as const;

const ANALYZE_STATUS_MESSAGES = [
  "Reading your resume...",
  "Scanning job requirements...",
  "Identifying keyword gaps...",
  "Building your analysis...",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

function StrengthLine({ text }: { text: string }) {
  const parts = text.split(/\s*[—–]\s*/);
  const head = parts[0]?.trim() ?? text;
  const tail = parts.slice(1).join(" — ");
  if (!tail) {
    return <span className="text-[#0f172a]">{text}</span>;
  }
  return (
    <>
      <span className="font-bold text-[#0f172a]">{head}</span>
      <span className="text-[#0f172a]"> — {tail}</span>
    </>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-[#64748b]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e2e8f0] border-t-[#1a56db]" />
      <span>{label}</span>
    </div>
  );
}

function PrimaryNextButton({
  onClick,
  label = "Next",
  disabled = false,
  loading = false,
}: {
  onClick: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isBusy = loading;
  return (
    <button
      type="button"
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      onClick={() => void onClick()}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#1a56db] px-6 text-sm font-medium text-white shadow-[0_2px_8px_rgba(26,86,219,0.3)] transition-all duration-150 hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
    >
      {isBusy ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
      {!isBusy ? <span aria-hidden>→</span> : null}
    </button>
  );
}

function StepFooterNav({
  onBack,
  next,
}: {
  onBack: () => void;
  /** Primary action on the right (e.g. Next). Omit on the last step if there is no Next. */
  next?: ReactNode;
}) {
  const backBtn = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-transparent px-6 text-sm font-medium text-[#64748b] transition-all duration-150 hover:bg-[#f8fafc] active:scale-[0.98]"
    >
      <span aria-hidden>←</span>
      Back
    </button>
  );
  if (next == null) {
    return <div className="mt-8 flex justify-start">{backBtn}</div>;
  }
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      {backBtn}
      <div className="flex shrink-0 justify-end">{next}</div>
    </div>
  );
}

export default function MyApplicationPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copiedRewriteIdx, setCopiedRewriteIdx] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [maxUnlocked, setMaxUnlocked] = useState(1);
  const [trackerNotice, setTrackerNotice] = useState<string | null>(null);
  const [analyzeStatusIdx, setAnalyzeStatusIdx] = useState(0);
  const [analyzeSlowHint, setAnalyzeSlowHint] = useState(false);
  const [atsProgress, setAtsProgress] = useState(0);

  const { isPro } = useSubscription();
  const {

    resume,
    setResume,
    jobLink,
    setJobLink,
    jobPosting,
    setJobPosting,
    jobPasteFallback,
    loadingAnalyze,
    analyzeError,
    analysis,
    baselineAnalysis,
    runAnalyze,
    loadingCoverLetter,
    coverLetter,
    coverLetterError,
    resetSession,
  } = useApplyfy();

  function goBackOneStep() {
    setCurrentStep((s) => (s > 0 ? ((s - 1) as StepIndex) : s));
  }

  useEffect(() => {
    if (currentStep !== 1 || !baselineAnalysis) {
      setAtsProgress(0);
      return;
    }
    setAtsProgress(0);
    const t = window.setTimeout(() => {
      setAtsProgress(
        Math.min(100, Math.max(0, Math.round(baselineAnalysis.atsScore))),
      );
    }, 80);
    return () => clearTimeout(t);
  }, [currentStep, baselineAnalysis]);

  useEffect(() => {
    if (!loadingAnalyze) {
      setAnalyzeStatusIdx(0);
      setAnalyzeSlowHint(false);
      return;
    }
    setAnalyzeStatusIdx(0);
    const interval = setInterval(() => {
      setAnalyzeStatusIdx((i) => (i + 1) % ANALYZE_STATUS_MESSAGES.length);
    }, 3000);
    const slowT = window.setTimeout(() => setAnalyzeSlowHint(true), 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(slowT);
    };
  }, [loadingAnalyze]);

  async function onFileChange(files: FileList | null) {
    setFileError(null);
    const file = files?.[0];
    if (!file) {
      setFileLabel(null);
      setResume("");
      return;
    }
    try {
      const payload = await resumeFileToPayload(file);
      setResume(payload);
      setFileLabel(file.name);
    } catch {
      setFileError("Could not read that file. Try another format.");
      setFileLabel(null);
      setResume("");
    }
  }

  async function handleInputNext() {
    setFileError(null);
    if (!resume.trim()) {
      setFileError("Upload a resume file (.pdf, .docx, .txt, or .md).");
      return;
    }
    const primary = jobLink.trim();
    const secondary = jobPosting.trim();
    const isHttp = /^https?:\/\//i.test(primary);
    if (!primary) {
      setFileError("Add a job URL or paste the job description.");
      return;
    }
    if (jobPasteFallback.active) {
      if (secondary.length < MIN_JOB_POSTING_CHARS) {
        setFileError(
          `Paste the job description below (at least ${MIN_JOB_POSTING_CHARS} characters).`,
        );
        return;
      }
    } else if (!isHttp && primary.length < MIN_JOB_POSTING_CHARS) {
      setFileError(
        `Paste a job URL or at least ${MIN_JOB_POSTING_CHARS} characters of the job description.`,
      );
      return;
    }
    if (!isPro && !canRunFreeAnalysis()) {
      setFileError(
        "You've used your 2 free analyses this month. Upgrade to Pro for unlimited analyses.",
      );
      return;
    }
    const ok = await runAnalyze();
    if (!ok) return;
    if (!isPro) incrementMonthlyAnalysisCount();
    setCurrentStep(1);
    setMaxUnlocked(2);
  }

  function saveToTracker() {
    if (!analysis || !coverLetter || !jobPosting.trim()) return;
    const { company, title } = extractJobTitleAndCompany(jobPosting, jobLink);
    upsertTrackerApplication({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      company: sanitizeCompany(company) || "Company",
      jobTitle: sanitizeJobTitle(title) || "Role",
      date: new Date().toISOString().slice(0, 10),
      matchScore: Math.round(analysis.matchScore),
      status: "Saved",
      resumeSnapshot: resume.length > 200_000 ? resume.slice(0, 200_000) : resume,
      coverLetter,
      interviewPrep: JSON.parse(JSON.stringify(analysis.interviewPrep)) as InterviewPrep,
      analysisSnapshot: {
        matchExplanation: [...analysis.matchExplanation],
        matchedSkills: [...analysis.matchedSkills],
        missingSkills: [...analysis.missingSkills],
        atsMatched: [...analysis.atsMatched],
        atsKeywords: [...analysis.atsKeywords],
      },
      interviewDate: null,
    });
    setTrackerNotice("Saved to your tracker");
  }

  async function copyRewriteLine(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRewriteIdx(idx);
      setTimeout(
        () => setCopiedRewriteIdx((v) => (v === idx ? null : v)),
        1500,
      );
    } catch {
      setCopiedRewriteIdx(null);
    }
  }

  const whyLines = baselineAnalysis?.matchExplanation.slice(0, 3) ?? [];

  const jobMeta = useMemo(
    () => extractJobTitleAndCompany(jobPosting, jobLink),
    [jobPosting, jobLink],
  );

  const skillMatchTableRows = useMemo(() => {
    if (!baselineAnalysis) return [];
    const checks = baselineAnalysis.requirementChecks;
    if (checks.length > 0) return checks;
    return baselineAnalysis.keywords.map((k) => ({
      skill: k.skill,
      present: k.found,
      evidence: k.evidence,
    }));
  }, [baselineAnalysis]);

  function buildResultsPayload() {
    if (!analysis || !coverLetter) return null;
    return {
      keywords: [...analysis.atsMatched, ...analysis.atsKeywords].slice(0, 20),
      matchScore: analysis.matchScore,
      coverLetter,
      interviewQuestions: analysis.interviewPrep.predictedQuestions.map(
        (q) => q.question,
      ),
    };
  }

  function downloadResultsPdf() {
    setSaveError(null);
    setSaveSuccess(null);
    const payload = buildResultsPayload();
    if (!payload) {
      setSaveError("Results are incomplete. Generate all sections first.");
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const margin = 40;
    const maxWidth = width - margin * 2;
    let y = 50;

    function section(title: string, bodyLines: string[]) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title, margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (const line of bodyLines) {
        const wrapped = doc.splitTextToSize(line, maxWidth);
        for (const w of wrapped) {
          if (y > 790) {
            doc.addPage();
            y = 50;
          }
          doc.text(w, margin, y);
          y += 14;
        }
      }
      y += 10;
    }

    section("Keywords", [
      payload.keywords.length
        ? payload.keywords.join(", ")
        : "No keywords available.",
    ]);
    section("Match score", [`${Math.round(payload.matchScore)}%`]);
    section("Cover letter", payload.coverLetter.split("\n"));
    section(
      "Interview questions",
      payload.interviewQuestions.map((q, i) => `${i + 1}. ${q}`),
    );
    doc.save("applyfy-results.pdf");
    setSaveSuccess("PDF downloaded.");
  }

  async function emailResults() {
    setSaveError(null);
    setSaveSuccess(null);
    const payload = buildResultsPayload();
    if (!payload) {
      setSaveError("Results are incomplete. Generate all sections first.");
      return;
    }
    if (!emailTo.trim()) {
      setSaveError("Enter an email address.");
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/results-email", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          ...payload,
        }),
      });
      const raw = await res.text();
      let data: { error?: string };
      try {
        data = JSON.parse(raw) as { error?: string };
      } catch {
        throw new Error(raw || "Email API error.");
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Email send failed.");
      }
      setSaveSuccess("Results emailed successfully.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Email send failed.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-[#0f172a]">
            My application
          </h1>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                "Start over? This will clear your current session.",
              );
              if (!ok) return;
              resetSession();
              setCurrentStep(0);
              setMaxUnlocked(1);
              setFileLabel(null);
              setFileError(null);
              setCopiedRewriteIdx(null);
              setTrackerNotice(null);
            }}
            className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748b] transition-all duration-150 hover:bg-[#f8fafc] active:scale-[0.97]"
          >
            Completely reset all pages
          </button>
        </div>

        <ApplicationStepper
          labels={steps}
          currentStep={currentStep}
          maxUnlocked={maxUnlocked}
          onStepClick={(idx) => setCurrentStep(idx)}
        />

        <section className="app-card animate-section-in">
          {currentStep === 0 ? (
            <>
              <h2 className="text-2xl font-bold text-[#0f172a]">Input</h2>
              <p className="mt-2 text-sm text-[#64748b]">
                Upload your resume and add a job URL or paste the job description.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="resume-file"
                    className="mb-2 block text-sm font-semibold text-[#0f172a]"
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
                  <div className="flex min-h-[190px] flex-col justify-center rounded-2xl border border-dashed border-[#e2e8f0] bg-[#fafafa] p-6 text-center transition-colors hover:border-[#cbd5e1]">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="mx-auto rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#0f172a] shadow-sm transition-all duration-150 hover:bg-[#f8fafc] active:scale-[0.97]"
                    >
                      Choose file
                    </button>
                    <p className="mt-3 text-xs text-[#94a3b8]">
                      PDF, Word (.docx), or plain text (.txt / .md)
                    </p>
                    {fileLabel ? (
                      <p className="mt-4 text-sm font-medium text-[#0f172a]">
                        Selected: {fileLabel}
                      </p>
                    ) : (
                      <p className="mt-4 text-sm text-[#94a3b8]">No file selected</p>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="job-link"
                    className="mb-2 block text-sm font-semibold text-[#0f172a]"
                  >
                    Job URL or description
                  </label>
                  <input
                    id="job-link"
                    type="text"
                    autoComplete="off"
                    placeholder="https://…"
                    value={jobLink}
                    onChange={(e) => setJobLink(e.target.value)}
                    className="w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition-shadow focus:border-[#1a56db] focus:ring-[3px] focus:ring-[rgba(26,86,219,0.1)]"
                  />
                  <p className="mt-2 text-xs text-[#94a3b8]">
                    Paste a job URL — or paste the job description text directly
                    if the link doesn&apos;t work
                  </p>
                  {jobPasteFallback.active ? (
                    <div className="mt-4 rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-4">
                      <p className="text-sm text-[#0f172a]">
                        {jobPasteFallback.message}
                      </p>
                      <label
                        htmlFor="job-posting-paste"
                        className="mt-3 block text-xs font-semibold text-[#64748b]"
                      >
                        Job description
                      </label>
                      <textarea
                        id="job-posting-paste"
                        value={jobPosting}
                        onChange={(e) => setJobPosting(e.target.value)}
                        rows={10}
                        placeholder="Paste the full job description here…"
                        className="mt-2 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#1a56db] focus:ring-[3px] focus:ring-[rgba(26,86,219,0.1)]"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {fileError ? (
                <p className="mt-4 text-sm text-[#ef4444]">{fileError}</p>
              ) : null}
              {analyzeError ? (
                <div
                  className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4"
                  role="alert"
                >
                  <p className="text-sm font-medium text-[#b91c1c]">
                    {analyzeError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleInputNext()}
                    className="mt-3 inline-flex items-center rounded-[10px] border border-[#fecaca] bg-white px-4 py-2 text-sm font-medium text-[#b91c1c] transition-all hover:bg-[#fef2f2] active:scale-[0.97]"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {loadingAnalyze ? (
                <div
                  className="mt-4 space-y-2"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="text-sm text-[#0f172a]">
                    {ANALYZE_STATUS_MESSAGES[analyzeStatusIdx]}
                  </p>
                  {analyzeSlowHint ? (
                    <p className="text-sm text-[#64748b]">
                      Still working — this can take up to 45 seconds for detailed
                      analysis...
                    </p>
                  ) : null}
                </div>
              ) : null}

              <TrustDataBar />
              <div className="mt-6 flex justify-end">
                <PrimaryNextButton
                  label={loadingAnalyze ? "Analyzing..." : "Run analysis"}
                  onClick={handleInputNext}
                  loading={loadingAnalyze}
                />
              </div>
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-[#0f172a]">Analyze</h2>
                  <p className="mt-2 text-sm text-[#64748b]">
                    ATS alignment, quick wins, keywords, strengths, gaps, and
                    drop-in rewrites for this job.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#1a56db]">
                  <svg
                    className="h-3.5 w-3.5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    <path d="M10 2l1.09 3.26L14 6l-2.91 1.74L10 11 8.91 7.74 6 6l2.91-1.74L10 2zm0 9l1.09 3.26L14 15l-2.91 1.74L10 20l-1.09-3.26L6 15l2.91-1.74L10 11z" />
                  </svg>
                  AI-powered · Instant analysis
                </span>
              </div>
              {!baselineAnalysis ? (
                <p className="mt-6 text-sm text-[#64748b]">
                  Run step 1 first to generate analysis.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  <section
                    className="animate-section-in rounded-2xl border border-[#e2e8f0] border-l-4 border-l-[#1a56db] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    style={{ animationDelay: "0ms" }}
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <span className="text-[48px] font-bold leading-none tracking-tight text-[#1a56db]">
                        {Math.min(
                          100,
                          Math.max(0, Math.round(baselineAnalysis.atsScore)),
                        )}
                      </span>
                      <svg
                        className="mb-2 h-6 w-6 text-[#10b981]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <p className="mt-1 text-sm text-[#94a3b8]">
                      out of 100 · Keyword &amp; phrasing fit
                    </p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
                      <div
                        className="h-full rounded-full transition-[width] duration-[1200ms] ease-out"
                        style={{
                          width: `${atsProgress}%`,
                          background:
                            "linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)",
                        }}
                      />
                    </div>
                  </section>

                  <section
                    className="animate-section-in rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-6"
                    style={{ animationDelay: "80ms" }}
                  >
                    <h3 className="mb-4 text-sm font-bold text-[#0f172a]">
                      Quick wins
                    </h3>
                    <div className="grid gap-3">
                      {(isPro
                        ? baselineAnalysis.quickWins
                        : baselineAnalysis.quickWins.slice(0, 3)
                      ).map((w, i) => (
                        <div
                          key={`qw-${i}`}
                          className="rounded-xl border border-[#fde68a] border-l-[3px] border-l-[#f59e0b] bg-white px-4 py-3 text-sm leading-relaxed text-[#0f172a] shadow-sm transition-all duration-150 hover:-translate-y-px hover:border-[#fcd34d]"
                        >
                          <span className="mr-2 inline-flex align-middle text-[#f59e0b]">
                            <svg
                              className="inline h-4 w-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path d="M13 3L4 14h7v7l9-11h-7V3z" />
                            </svg>
                          </span>
                          {w}
                        </div>
                      ))}
                    </div>
                  </section>

                  {(baselineAnalysis.keywords?.length ?? 0) > 0 ? (
                    <section
                      className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-6"
                      style={{ animationDelay: "160ms" }}
                    >
                      <h3 className="mb-3 text-sm font-bold text-[#0f172a]">
                        ATS keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {(isPro
                          ? baselineAnalysis.keywords
                          : baselineAnalysis.keywords.slice(0, 6)
                        ).map((k, i) => (
                          <span
                            key={`kw-${k.skill}-${i}`}
                            className={`animate-pill-in inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-transform duration-150 hover:scale-[1.03] hover:shadow-sm ${
                              k.found
                                ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]"
                                : "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]"
                            }`}
                            style={{
                              animationDelay: `${50 * i}ms`,
                            }}
                          >
                            {k.found ? (
                              <svg
                                className="h-3 w-3 shrink-0"
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
                            ) : (
                              <svg
                                className="h-3 w-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                            {k.skill}
                          </span>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section
                    className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-6"
                    style={{ animationDelay: "240ms" }}
                  >
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0f172a]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981] text-white">
                        <svg
                          className="h-3.5 w-3.5"
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
                      </span>
                      Matched strengths
                    </h3>
                    <ul className="space-y-2">
                      {(isPro
                        ? baselineAnalysis.matchedStrengths
                        : baselineAnalysis.matchedStrengths.slice(0, 2)
                      ).map((s, i) => (
                          <li
                            key={`ms-${i}`}
                            className="list-none rounded-xl border border-[#e2e8f0] border-l-[3px] border-l-[#10b981] bg-white py-3 pl-4 pr-4 text-sm leading-relaxed"
                          >
                            <StrengthLine text={s} />
                          </li>
                        ))}
                    </ul>
                  </section>

                  {isPro ? (
                    <div className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <AtsScoreHistory />
                        <ReadinessChecklist analysis={baselineAnalysis} />
                      </div>
                      <FollowUpEmailCta
                        jobTitle={
                          sanitizeJobTitle(jobMeta.title) || "Role"
                        }
                        company={
                          sanitizeCompany(jobMeta.company) || "Company"
                        }
                      />
                    </div>
                  ) : null}

                  <FeatureLock
                    locked={!isPro}
                    tier="pro"
                    description="See exactly what's missing and how to fix each gap."
                  >
                    <section
                      className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-6"
                      style={{ animationDelay: "320ms" }}
                    >
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0f172a]">
                        <svg
                          className="h-5 w-5 shrink-0 text-[#ef4444]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                        </svg>
                        Gaps
                      </h3>
                      <div className="space-y-4">
                        {baselineAnalysis.resumeGaps.map((g, i) => (
                          <div
                            key={`gap-${g.skill}-${i}`}
                            className="rounded-xl border border-[#e2e8f0] border-l-[3px] border-l-[#ef4444] bg-white p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                          >
                            <h4 className="text-sm font-semibold text-[#0f172a]">
                              {g.skill}
                            </h4>
                            <p className="mt-2 text-sm text-[#64748b]">
                              <span className="font-bold text-[#ef4444]">
                                Reality:{" "}
                              </span>
                              {g.reality}
                            </p>
                            <p className="mt-2 text-sm text-[#0f172a]">
                              <span className="font-bold text-[#1a56db]">
                                Fix:{" "}
                              </span>
                              {g.fix}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </FeatureLock>

                  <section
                    className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-6"
                    style={{ animationDelay: "400ms" }}
                  >
                    <h3 className="mb-1 text-sm font-bold text-[#0f172a]">
                      Drop-in resume rewrites — copy and replace in your resume
                    </h3>
                    <p className="mb-4 text-xs text-[#64748b]">
                      Strengthen wording you already have—no new roles or
                      invented experience.
                    </p>
                    <ul className="space-y-8 text-sm">
                      {baselineAnalysis.rewrites.map((r, i) => {
                        const inner = (
                          <>
                            <p className="border-l-2 border-[#e2e8f0] pl-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                              {r.section}
                            </p>
                            <p className="mt-2 rounded-md bg-[#fafafa] px-3 py-2 text-[13px] italic leading-relaxed text-[#94a3b8] line-through">
                              {r.original}
                            </p>
                            <div className="mt-3 flex flex-wrap items-start justify-end gap-3">
                              <p className="min-w-0 flex-1 rounded-xl border border-[#e2e8f0] border-l-[3px] border-l-[#1a56db] py-3 pl-4 pr-4 text-sm font-bold text-[#0f172a]">
                                {r.rewritten}
                              </p>
                              {isPro || i === 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyRewriteLine(r.rewritten, i)
                                  }
                                  className="shrink-0 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:bg-[#f1f5f9]"
                                >
                                  {copiedRewriteIdx === i ? (
                                    <span className="text-[#10b981]">
                                      Copied ✓
                                    </span>
                                  ) : (
                                    "Copy"
                                  )}
                                </button>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs italic leading-relaxed text-[#64748b]">
                              {r.whyBetter}
                            </p>
                          </>
                        );
                        return (
                          <li key={`rw-${i}`} className="list-none">
                            {i === 0 || isPro ? (
                              inner
                            ) : (
                              <FeatureLock
                                locked
                                tier="pro"
                                description="Unlock all rewritten bullet points — copy and paste directly into your resume."
                              >
                                <div>{inner}</div>
                              </FeatureLock>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>
              )}

              <TrustDataBar />
              <StepFooterNav
                onBack={goBackOneStep}
                next={
                  <PrimaryNextButton
                    onClick={() => {
                      if (!baselineAnalysis) return;
                      setCurrentStep(2);
                      setMaxUnlocked(3);
                    }}
                    disabled={!baselineAnalysis || loadingAnalyze}
                  />
                }
              />
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <div className="-mx-6 max-w-none sm:-mx-8">
                <LiveResumeEditorExperience
                  variant="embedded"
                  onEmbeddedBack={goBackOneStep}
                  onEmbeddedContinue={() => {
                    setCurrentStep(3);
                    setMaxUnlocked(4);
                  }}
                />
              </div>
              <TrustDataBar />
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <h2 className="text-2xl font-bold text-[#0f172a]">Match</h2>
              {!baselineAnalysis ? (
                <p className="mt-6 text-sm text-[#64748b]">
                  Run steps 1–3 first to view your match.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  <section
                    className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-6 sm:p-8"
                    style={{ animationDelay: "0ms" }}
                  >
                    <MatchScoreArcAndBreakdown analysis={baselineAnalysis} />
                    {whyLines.length > 0 ? (
                      <div className="mt-8 border-t border-[#f1f5f9] pt-6">
                        <h4 className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                          Quick context
                        </h4>
                        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#64748b]">
                          {whyLines.map((line, i) => (
                            <li key={`w-${i}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  {skillMatchTableRows.length > 0 ? (
                    <FeatureLock
                      locked={!isPro}
                      tier="pro"
                      description="See every keyword the job requires and whether your resume covers it."
                    >
                      <section
                        className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-6"
                        style={{ animationDelay: "80ms" }}
                      >
                        <h3 className="mb-4 text-sm font-bold text-[#0f172a]">
                          Keyword match
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b-2 border-[#e2e8f0]">
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                                Skill
                              </th>
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                                Status &amp; reason
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {skillMatchTableRows.map((row, i) => (
                              <tr
                                key={`rq-${i}-${row.skill}`}
                                className={`border-b border-[#f1f5f9] transition-colors last:border-b-0 hover:bg-[#f8fafc] ${
                                  row.present ? "bg-[#f0fdf4]" : "bg-white"
                                }`}
                              >
                                <td className="align-top px-4 py-3">
                                  <div className="flex items-start gap-2">
                                    {row.present ? (
                                      <span
                                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-white"
                                        aria-hidden
                                      >
                                        <svg
                                          className="h-3 w-3"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={3}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      </span>
                                    ) : (
                                      <span
                                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#ef4444] text-[#ef4444]"
                                        aria-hidden
                                      >
                                        <svg
                                          className="h-2.5 w-2.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={3}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                        </svg>
                                      </span>
                                    )}
                                    <span
                                      className={`font-semibold ${row.present ? "text-[#0f172a]" : "text-[#0f172a]"}`}
                                    >
                                      {row.skill}
                                    </span>
                                  </div>
                                </td>
                                <td className="align-top px-4 py-3 text-sm leading-relaxed text-[#64748b]">
                                  {row.evidence ||
                                    (row.present
                                      ? "Present on your resume."
                                      : "Not clearly shown on your resume.")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </section>
                    </FeatureLock>
                  ) : null}
                </div>
              )}

              <TrustDataBar />
              <StepFooterNav
                onBack={goBackOneStep}
                next={
                  <PrimaryNextButton
                    onClick={() => {
                      if (!baselineAnalysis) return;
                      setCurrentStep(4);
                      setMaxUnlocked(5);
                    }}
                    disabled={!baselineAnalysis || loadingAnalyze}
                  />
                }
              />
            </>
          ) : null}

          {currentStep === 4 ? (
            <>
              {analysis ? (
                <CoverLetterPanel />
              ) : (
                <p className="text-sm text-[#64748b]">
                  Run prior steps first to generate your cover letter.
                </p>
              )}
              {loadingCoverLetter ? (
                <Spinner label="Generating fresh cover letter..." />
              ) : null}
              {coverLetterError ? (
                <p className="mt-4 text-sm text-[#ef4444]">{coverLetterError}</p>
              ) : null}
              <TrustDataBar />
              <StepFooterNav
                onBack={goBackOneStep}
                next={
                  <PrimaryNextButton
                    onClick={() => {
                      if (!analysis || !coverLetter || loadingCoverLetter)
                        return;
                      setCurrentStep(5);
                      setMaxUnlocked(6);
                    }}
                    disabled={!analysis || !coverLetter || loadingCoverLetter}
                  />
                }
              />
            </>
          ) : null}

          {currentStep === 5 ? (
            <>
              {analysis ? (
                <InterviewPrepPanel prep={analysis.interviewPrep} />
              ) : (
                <p className="text-sm text-[#64748b]">
                  Run prior steps first to generate interview prep.
                </p>
              )}
              <div className="mt-8 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#1a56db]">
                      Save this application
                    </h3>
                    <p className="mt-1 text-sm text-[#64748b]">
                      Store this role, score, cover letter, and interview prep in Tracker.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveToTracker}
                    disabled={!analysis || !coverLetter || !jobPosting.trim()}
                    className="rounded-lg bg-[#1a56db] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(26,86,219,0.25)] transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save to Tracker
                  </button>
                </div>
                {trackerNotice ? (
                  <p className="mt-3 text-sm font-medium text-[#10b981]">
                    {trackerNotice}
                  </p>
                ) : null}
              </div>
              <div className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <h3 className="text-base font-bold text-[#0f172a]">Save results</h3>
                <p className="mt-1 text-sm text-[#64748b]">
                  Download everything in one file or send to your email.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={downloadResultsPdf}
                    disabled={!analysis || !coverLetter || loadingCoverLetter}
                    className="rounded-[10px] bg-[#1a56db] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(26,86,219,0.25)] transition-all hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-[220px] rounded-[10px] border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#1a56db] focus:ring-[3px] focus:ring-[rgba(26,86,219,0.1)]"
                  />
                  <button
                    type="button"
                    onClick={() => void emailResults()}
                    disabled={
                      sendingEmail ||
                      !analysis ||
                      !coverLetter ||
                      loadingCoverLetter
                    }
                    className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748b] transition-all hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingEmail ? "Sending..." : "Email results"}
                  </button>
                </div>
                {sendingEmail ? <Spinner label="Sending results email..." /> : null}
                {saveError ? (
                  <p className="mt-3 text-sm text-[#ef4444]">{saveError}</p>
                ) : null}
                {saveSuccess ? (
                  <p className="mt-3 text-sm text-[#10b981]">{saveSuccess}</p>
                ) : null}
              </div>
              <TrustDataBar />
              <StepFooterNav onBack={goBackOneStep} />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
