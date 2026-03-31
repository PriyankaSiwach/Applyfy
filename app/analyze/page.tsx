"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { PageShell } from "@/components/PageShell";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";

export default function AnalyzePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const {
    resume,
    setResume,
    jobLink,
    setJobLink,
    loadingAnalyze,
    analyzeError,
    analysis,
    runAnalyze,
  } = useApplyfy();


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

  const strengths = analysis?.matchedSkills.slice(0, 4) ?? [];
  const gaps = analysis?.missingSkills.slice(0, 4) ?? [];
  const improvements = analysis?.bulletSuggestions.slice(0, 4) ?? [];
  async function copyImprovement(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 2000);
    } catch {
      setCopiedIdx(null);
    }
  }

  const matchedKw = analysis?.atsMatched ?? [];
  const missingKw = analysis?.atsKeywords ?? [];

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
          <div className="mt-10 space-y-8 text-left">
            <p className="text-center text-sm text-gray-600">
              Analysis ready.{" "}
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
            </p>

            {(matchedKw.length > 0 || missingKw.length > 0) ? (
              <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                <h2 className="mb-3 text-sm font-bold text-slate-900">
                  ATS keywords
                </h2>
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
                <p className="mt-2 text-xs text-gray-500">
                  Green = surfaced on your resume; red = add or strengthen.
                </p>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200/90 bg-card p-6">
              <h2 className="mb-3 text-sm font-bold text-slate-900">
                Strengths (top signals)
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                {strengths.map((s, i) => (
                  <li key={`st-${i}`}>{s}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200/90 bg-card p-6">
              <h2 className="mb-3 text-sm font-bold text-slate-900">Gaps</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                {gaps.map((s, i) => (
                  <li key={`gp-${i}`}>{s}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200/90 bg-card p-6">
              <h2 className="mb-3 text-sm font-bold text-slate-900">
                Resume improvements
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                {improvements.map((s, i) => (
                  <li key={`im-${i}`} className="flex items-start justify-between gap-3">
                    <span className="pr-2">{s}</span>
                    <button
                      type="button"
                      onClick={() => void copyImprovement(s, i)}
                      className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {copiedIdx === i ? "Copied!" : "Copy"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
              <p className="text-sm text-slate-800">
                Copy these bullets one by one and paste them into your resume
                file. Then re-upload for a fresh scan.
              </p>
            </section>
          </div>
        ) : null}
      </PageShell>
    </ApplyFlowChrome>
  );
}
