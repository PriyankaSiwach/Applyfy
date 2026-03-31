"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { CoverLetterPanel } from "@/components/applyfy/CoverLetterPanel";
import { InterviewPrepPanel } from "@/components/applyfy/InterviewPrepPanel";
import { ScoreArc } from "@/components/applyfy/ScoreArc";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { fetchMatchRescanScore } from "@/lib/fetchMatchRescanScore";
import {
  extractJobTitleAndCompany,
  sanitizeCompany,
  sanitizeJobTitle,
} from "@/lib/jobMetaFromPosting";
import type { InterviewPrep } from "@/lib/analysisTypes";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";
import { upsertTrackerApplication } from "@/lib/trackerStorage";

const steps = [
  "Input",
  "Analyze",
  "Match",
  "Cover letter",
  "Interview prep",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4;

function Spinner({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      <span>{label}</span>
    </div>
  );
}

function NextButton({
  onClick,
  label = "Next",
  disabled = false,
}: {
  onClick: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mt-8 flex justify-end">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onClick()}
        className="inline-flex items-center gap-2 rounded-lg bg-[#2E3E65] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3D5080] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label} <span aria-hidden>→</span>
      </button>
    </div>
  );
}

export default function MyApplicationPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copiedBulletIdx, setCopiedBulletIdx] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [maxUnlocked, setMaxUnlocked] = useState(1);
  const [rescannedMatch, setRescannedMatch] = useState<{
    matchScore: number;
    matchedSkills: string[];
    missingSkills: string[];
  } | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);
  const [trackerNotice, setTrackerNotice] = useState<string | null>(null);

  const {
    resume,
    setResume,
    jobLink,
    setJobLink,
    jobPosting,
    loadingAnalyze,
    analyzeError,
    analysis,
    runAnalyze,
    loadingCoverLetter,
    coverLetter,
    coverLetterError,
    resetSession,
  } = useApplyfy();

  useEffect(() => {
    setRescannedMatch(null);
    setRescanError(null);
  }, [analysis]);

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
    if (!jobLink.trim()) {
      setFileError("Enter the full URL of the job posting.");
      return;
    }
    const ok = await runAnalyze();
    if (!ok) return;
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

  async function handleRescanMatch() {
    setRescanError(null);
    const payload = resume;
    if (!payload.trim()) {
      setRescanError("Upload a resume file on Input first.");
      return;
    }
    if (!payload.trimStart().startsWith("data:") && payload.trim().length < 80) {
      setRescanError("Resume text must be at least 80 characters.");
      return;
    }
    if (!jobLink.trim()) {
      setRescanError("Job link is required.");
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

  const strengths = analysis?.matchedSkills.slice(0, 4) ?? [];
  const gaps = analysis?.missingSkills.slice(0, 4) ?? [];
  const improvements = analysis?.bulletSuggestions.slice(0, 4) ?? [];
  async function copyImprovement(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBulletIdx(idx);
      setTimeout(() => setCopiedBulletIdx((v) => (v === idx ? null : v)), 2000);
    } catch {
      setCopiedBulletIdx(null);
    }
  }

  const matchedKw = analysis?.atsMatched ?? [];
  const missingKw = analysis?.atsKeywords ?? [];
  const why = analysis?.matchExplanation.slice(0, 3) ?? [];

  const matchedSkillsSource = rescannedMatch?.matchedSkills ?? analysis?.matchedSkills ?? [];
  const missingSkillsSource = rescannedMatch?.missingSkills ?? analysis?.missingSkills ?? [];

  const matchedPills = useMemo(
    () =>
      matchedSkillsSource.slice(0, 12).map((s) => {
        const cleaned = s.split("—")[0]?.trim() || s;
        return cleaned.length > 40 ? `${cleaned.slice(0, 38)}…` : cleaned;
      }),
    [matchedSkillsSource],
  );

  const missingPills = useMemo(
    () =>
      missingSkillsSource.slice(0, 12).map((s) => {
        const cleaned = s.split("—")[0]?.trim() || s;
        return cleaned.length > 40 ? `${cleaned.slice(0, 38)}…` : cleaned;
      }),
    [missingSkillsSource],
  );

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
    <main className="bg-[#F8FAFC] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
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
              setCopiedBulletIdx(null);
              setRescannedMatch(null);
              setRescanError(null);
              setTrackerNotice(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
          >
            Completely reset all pages
          </button>
        </div>

        <ol className="mb-8 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
          {steps.map((label, i) => {
            const idx = i as StepIndex;
            const completed = idx < currentStep;
            const active = idx === currentStep;
            const locked = idx >= 2 && idx >= maxUnlocked;

            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 ? <span className="text-slate-400">→</span> : null}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setCurrentStep(idx)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                    active
                      ? "bg-[#2E3E65] text-white"
                      : completed
                        ? "bg-emerald-50 text-emerald-800"
                        : locked
                          ? "bg-slate-100 text-slate-400"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {completed ? <span aria-hidden>✓</span> : null}
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {currentStep === 0 ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Input</h2>
              <p className="mt-2 text-sm text-slate-600">
                Upload your resume and add the job listing URL.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
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
                  <div className="flex min-h-[190px] flex-col justify-center rounded-xl border border-dashed border-slate-300 bg-card p-6 text-center">
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
                    autoComplete="url"
                    placeholder="https://…"
                    value={jobLink}
                    onChange={(e) => setJobLink(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-card px-4 py-3 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Public page for the role (fetched server-side).
                  </p>
                </div>
              </div>

              {fileError ? (
                <p className="mt-4 text-sm text-red-600">{fileError}</p>
              ) : null}
              {analyzeError ? (
                <p className="mt-4 text-sm text-red-600">{analyzeError}</p>
              ) : null}
              {loadingAnalyze ? <Spinner label="Running analysis..." /> : null}

              <NextButton
                label={loadingAnalyze ? "Analyzing..." : "Run analysis"}
                onClick={handleInputNext}
                disabled={loadingAnalyze}
              />
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Analyze</h2>
              <p className="mt-2 text-sm text-slate-600">
                Strengths, gaps, ATS alignment, and resume improvement ideas.
              </p>
              {!analysis ? (
                <p className="mt-6 text-sm text-slate-600">
                  Run step 1 first to generate analysis.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  {(matchedKw.length > 0 || missingKw.length > 0) && (
                    <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                      <h3 className="mb-3 text-sm font-bold text-slate-900">
                        ATS keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {matchedKw.map((k) => (
                          <span
                            key={`m-${k}`}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                          >
                            {k}
                          </span>
                        ))}
                        {missingKw.map((k) => (
                          <span
                            key={`x-${k}`}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">
                      Strengths
                    </h3>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {strengths.map((s, i) => (
                        <li key={`st-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">Gaps</h3>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {gaps.map((s, i) => (
                        <li key={`gp-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">
                      Resume improvements
                    </h3>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                      {improvements.map((s, i) => (
                        <li key={`im-${i}`} className="flex items-start justify-between gap-3">
                          <span className="pr-2">{s}</span>
                          <button
                            type="button"
                            onClick={() => void copyImprovement(s, i)}
                            className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {copiedBulletIdx === i ? "Copied!" : "Copy"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
                    <p className="text-sm text-slate-800">
                      Copy these bullets one by one and paste them into your
                      resume file. Then re-upload for a fresh scan.
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          resetSession();
                          setCurrentStep(0);
                          setMaxUnlocked(1);
                          setFileLabel(null);
                          setFileError(null);
                          setCopiedBulletIdx(null);
                          setRescannedMatch(null);
                          setRescanError(null);
                          setTrackerNotice(null);
                        }}
                        className="rounded-lg bg-[#2E3E65] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3D5080]"
                      >
                        Start new scan
                      </button>
                    </div>
                  </section>

                </div>
              )}

              <NextButton
                onClick={() => {
                  if (!analysis) return;
                  setCurrentStep(2);
                  setMaxUnlocked(3);
                }}
                disabled={!analysis || loadingAnalyze}
              />
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Match</h2>
              {!analysis ? (
                <p className="mt-6 text-sm text-slate-600">
                  Run steps 1-2 first to view your match.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                    <h3 className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Match score
                    </h3>
                    {(() => {
                      const originalScore = analysis.matchScore;
                      const hasRescan = rescannedMatch !== null;
                      const currentScore =
                        hasRescan
                          ? rescannedMatch.matchScore
                          : originalScore;
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
                                    (
                                    {Math.round(originalScore)}% →{" "}
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
                          <div className="mt-6 flex flex-col items-center gap-2 border-t border-slate-100 pt-6">
                            <button
                              type="button"
                              disabled={rescanning || loadingAnalyze}
                              onClick={() => void handleRescanMatch()}
                              className="rounded-lg border border-[#4F8EF7] bg-[#4F8EF7]/10 px-4 py-2 text-sm font-semibold text-[#2E3E65] transition-colors hover:bg-[#4F8EF7]/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {rescanning ? "Rescanning…" : "Rescan with edits"}
                            </button>
                            {rescanError ? (
                              <p className="text-center text-xs text-red-600">
                                {rescanError}
                              </p>
                            ) : null}
                            <p className="max-w-md text-center text-xs text-slate-500">
                              Uses your original resume from the current session
                              and calls the same analyze endpoint to refresh match
                              results.
                            </p>
                          </div>
                        </>
                      );
                    })()}
                    {why.length > 0 ? (
                      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700">
                        {why.map((line, i) => (
                          <li key={`m-${i}`}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>

                  <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">
                      Matched vs missing skills
                    </h3>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {matchedPills.map((s) => (
                          <span
                            key={`mp-${s}`}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {missingPills.map((s) => (
                          <span
                            key={`xp-${s}`}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200/90 bg-card p-4 sm:p-6">
                    <h3 className="mb-4 text-sm font-bold text-slate-900">
                      Job requirements vs your resume
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="w-1/2 px-4 py-3 font-semibold text-slate-900">
                              What the job asks
                            </th>
                            <th className="w-1/2 px-4 py-3 font-semibold text-slate-900">
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
                </div>
              )}

              <NextButton
                onClick={() => {
                  if (!analysis) return;
                  setCurrentStep(3);
                  setMaxUnlocked(4);
                }}
                disabled={!analysis || loadingAnalyze}
              />
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              {analysis ? (
                <CoverLetterPanel />
              ) : (
                <p className="text-sm text-slate-600">
                  Run prior steps first to generate your cover letter.
                </p>
              )}
              {loadingCoverLetter ? (
                <Spinner label="Generating fresh cover letter..." />
              ) : null}
              {coverLetterError ? (
                <p className="mt-4 text-sm text-red-600">{coverLetterError}</p>
              ) : null}
              <NextButton
                onClick={() => {
                  if (!analysis || !coverLetter || loadingCoverLetter) return;
                  setCurrentStep(4);
                  setMaxUnlocked(5);
                }}
                disabled={!analysis || !coverLetter || loadingCoverLetter}
              />
            </>
          ) : null}

          {currentStep === 4 ? (
            <>
              {analysis ? (
                <InterviewPrepPanel prep={analysis.interviewPrep} />
              ) : (
                <p className="text-sm text-slate-600">
                  Run prior steps first to generate interview prep.
                </p>
              )}
              <div className="mt-8 rounded-xl border border-[#4F8EF7]/30 bg-[#4F8EF7]/10 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#2E3E65]">
                      Save this application
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      Store this role, score, cover letter, and interview prep in Tracker.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveToTracker}
                    disabled={!analysis || !coverLetter || !jobPosting.trim()}
                    className="rounded-lg bg-[#2E3E65] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3D5080] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save to Tracker
                  </button>
                </div>
                {trackerNotice ? (
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    {trackerNotice}
                  </p>
                ) : null}
              </div>
              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-bold text-slate-900">Save results</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Download everything in one file or send to your email.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={downloadResultsPdf}
                    disabled={!analysis || !coverLetter || loadingCoverLetter}
                    className="rounded-lg bg-[#2E3E65] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3D5080] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingEmail ? "Sending..." : "Email results"}
                  </button>
                </div>
                {sendingEmail ? <Spinner label="Sending results email..." /> : null}
                {saveError ? (
                  <p className="mt-3 text-sm text-red-600">{saveError}</p>
                ) : null}
                {saveSuccess ? (
                  <p className="mt-3 text-sm text-emerald-700">{saveSuccess}</p>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
