"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { jsPDF } from "jspdf";

type Analysis = {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  bulletSuggestions: string[];
  sectionSuggestions: string[];
  atsKeywords: string[];
};

function readFileAsResumeString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    const isPlainText =
      file.type.startsWith("text/") ||
      /\.(txt|md|csv)$/i.test(file.name);
    if (isPlainText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

export default function Home() {
  const [resume, setResume] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingCoverLetter, setLoadingCoverLetter] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAnalyze(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoadingAnalyze(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setCoverLetter(null);
    setCoverLetterError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobLink }),
      });
      const raw = await res.text();
      let data: Analysis & { error?: string };
      try {
        data = JSON.parse(raw) as Analysis & { error?: string };
      } catch {
        throw new Error(raw || res.statusText);
      }
      if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setAnalysis({
        matchScore: data.matchScore,
        matchedSkills: data.matchedSkills ?? [],
        missingSkills: data.missingSkills ?? [],
        bulletSuggestions: data.bulletSuggestions ?? [],
        sectionSuggestions: data.sectionSuggestions ?? [],
        atsKeywords: data.atsKeywords ?? [],
      });
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoadingAnalyze(false);
    }
  }

  async function handleCoverLetterClick() {
    setLoadingCoverLetter(true);
    setCoverLetter(null);
    setCoverLetterError(null);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobLink }),
      });
      const raw = await res.text();
      let data: { letter?: string; error?: string };
      try {
        data = JSON.parse(raw) as { letter?: string; error?: string };
      } catch {
        throw new Error(raw || res.statusText);
      }
      if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      setCoverLetter(data.letter ?? "");
    } catch (err) {
      setCoverLetterError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoadingCoverLetter(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await readFileAsResumeString(file);
      setResume(text);
    } catch {
      setResume("");
    }
  }

  function handleDownloadPdf() {
    if (!coverLetter || loadingCoverLetter) return;
    const doc = new jsPDF();
    const margin = 14;
    const maxWidth = 180;
    const lineHeight = 7;
    const lines = doc.splitTextToSize(coverLetter, maxWidth);
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin + 6;
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin + 6;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    doc.save("cover-letter.pdf");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Applyfy
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Upload your resume and a job link to analyze fit, then generate a cover
          letter.
        </p>

        <form
          onSubmit={handleAnalyze}
          className="mt-10 flex w-full max-w-lg mx-auto flex-col items-stretch gap-6 text-left"
        >
          <div>
            <p className="mb-2 block text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Resume
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,text/plain,application/pdf"
              className="sr-only"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleUploadClick}
                className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Upload resume
              </button>
              {resume ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  File loaded — ready to analyze
                </p>
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No file selected yet
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="job-link"
              className="mb-2 block text-center text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Job Link
            </label>
            <input
              id="job-link"
              name="jobLink"
              type="url"
              inputMode="url"
              value={jobLink}
              onChange={(e) => setJobLink(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/10"
            />
          </div>

          <div className="flex flex-col items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loadingAnalyze}
              className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-100"
            >
              Generate
            </button>
            {loadingAnalyze ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Analyzing…
              </p>
            ) : null}
          </div>
        </form>

        {analyzeError ? (
          <p className="mt-8 text-sm text-red-600 dark:text-red-400">
            {analyzeError}
          </p>
        ) : null}

        {analysis && !loadingAnalyze ? (
          <div className="mt-10 w-full text-left space-y-8">
            <section>
              <h2 className="mb-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                1. Match Score
              </h2>
              <p className="text-center text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {analysis.matchScore}%
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                2. Matched Skills
              </h2>
              <ul className="list-disc pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {analysis.matchedSkills.map((s, i) => (
                  <li key={`m-${i}-${s}`}>{s}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                3. Missing Skills
              </h2>
              <ul className="list-disc pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {analysis.missingSkills.map((s, i) => (
                  <li key={`x-${i}-${s}`}>{s}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                4. Resume Bullet Improvements
              </h2>
              <ul className="list-disc pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {analysis.bulletSuggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                5. Sections to Improve
              </h2>
              <ul className="list-disc pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {analysis.sectionSuggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                6. ATS keywords to add
              </h2>
              <ul className="list-disc pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {analysis.atsKeywords.map((s, i) => (
                  <li key={`a-${i}-${s}`}>{s}</li>
                ))}
              </ul>
            </section>

            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCoverLetterClick}
                disabled={loadingCoverLetter}
                className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-100"
              >
                Generate Cover Letter
              </button>
              {loadingCoverLetter ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Generating cover letter…
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {coverLetterError ? (
          <p className="mt-8 text-sm text-red-600 dark:text-red-400">
            {coverLetterError}
          </p>
        ) : null}

        {coverLetter !== null && !loadingCoverLetter ? (
          <div className="mt-10 w-full text-left">
            <h2 className="mb-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cover letter
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {coverLetter}
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Create cover letter PDF
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
