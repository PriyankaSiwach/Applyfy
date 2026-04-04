"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { AtsScoreHistory } from "@/components/applyfy/AtsScoreHistory";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { PageShell } from "@/components/PageShell";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";

export default function AnalyzePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

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
            <p className="text-center text-sm text-gray-600">
              Analysis ready.{" "}
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
            </p>

            <section className="rounded-xl border border-[#2E3E65]/25 bg-gradient-to-br from-[#2E3E65]/8 to-[#4F8EF7]/10 p-5 sm:p-6">
              <p className="text-lg font-bold tracking-tight text-[#2E3E65]">
                ATS Alignment:{" "}
                {Math.min(
                  100,
                  Math.max(0, Math.round(analysis.atsScore)),
                )}
                /100
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Keyword and phrasing fit between your resume as written and this
                posting—separate from overall role fit.
              </p>
            </section>

            <AtsScoreHistory />

            <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-6">
              <h2 className="mb-4 text-sm font-bold text-slate-900">
                Quick wins
              </h2>
              <div className="grid gap-3">
                {analysis.quickWins.slice(0, 3).map((w, i) => (
                  <div
                    key={`qw-${i}`}
                    className="rounded-lg border border-emerald-200/90 bg-white/90 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm"
                  >
                    {w}
                  </div>
                ))}
              </div>
            </section>

            {analysis.keywords.length > 0 ? (
              <section className="rounded-xl border border-slate-200/90 bg-card p-6">
                <h2 className="mb-3 text-sm font-bold text-slate-900">
                  ATS keywords
                </h2>
                <div className="flex flex-wrap gap-2">
                  {analysis.keywords.map((k, i) => (
                    <span
                      key={`kw-${k.skill}-${i}`}
                      className={
                        k.found
                          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                          : "rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200"
                      }
                    >
                      {k.skill}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Green = clearly demonstrated; red = missing or only listed.
                </p>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200/90 bg-card p-6">
              <h2 className="mb-3 text-sm font-bold text-slate-900">
                Matched strengths
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
                {analysis.matchedStrengths.slice(0, 4).map((s, i) => (
                  <li key={`ms-${i}`}>{s}</li>
                ))}
              </ul>
            </section>

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

          </div>
        ) : null}
      </PageShell>
    </ApplyFlowChrome>
  );
}
