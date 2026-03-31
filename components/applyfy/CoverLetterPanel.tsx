"use client";

import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

export function CoverLetterPanel() {
  const {
    coverTone,
    setCoverTone,
    coverLength,
    setCoverLength,
    loadingCoverLetter,
    coverLetter,
    coverLetterError,
    copyCoverLetter,
    downloadCoverLetterTxt,
    regenerateCoverLetter,
    setCoverLetterDraft,
  } = useApplyfy();

  const pillActive =
    "border-primary bg-primary text-white shadow-sm";
  const pillIdle =
    "border-slate-200 bg-card text-slate-700 hover:border-slate-300 hover:bg-slate-50";

  return (
    <section className="w-full min-w-0 rounded-xl border border-slate-200/90 bg-card p-6 shadow-md sm:p-8">
      <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-slate-900">
        Cover letter
      </h1>
      <p className="mb-6 text-center text-sm text-gray-600">
        Generated from your resume and the job posting. Adjust tone or length,
        then click Regenerate.
      </p>

      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-center">
        <fieldset className="min-w-0 sm:min-w-[200px]">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Tone
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["concise", "Concise"],
                ["confident", "Confident"],
                ["storytelling", "Storytelling"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  coverTone === value ? pillActive : pillIdle
                }`}
              >
                <input
                  type="radio"
                  name="cover-tone"
                  value={value}
                  checked={coverTone === value}
                  onChange={() => setCoverTone(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0 sm:min-w-[200px]">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Length
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["short", "Short"],
                ["standard", "Standard"],
                ["detailed", "Detailed"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  coverLength === value ? pillActive : pillIdle
                }`}
              >
                <input
                  type="radio"
                  name="cover-length"
                  value={value}
                  checked={coverLength === value}
                  onChange={() => setCoverLength(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={loadingCoverLetter}
          onClick={() => void regenerateCoverLetter()}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      {loadingCoverLetter && !coverLetter ? (
        <p className="mb-4 text-center text-sm text-gray-600">
          Generating cover letter…
        </p>
      ) : null}
      {loadingCoverLetter && coverLetter ? (
        <p className="mb-3 text-center text-xs font-medium text-accent">
          Updating letter…
        </p>
      ) : null}

      {coverLetterError ? (
        <p className="mb-4 text-center text-sm text-red-600">{coverLetterError}</p>
      ) : null}

      {coverLetter ? (
        <>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetterDraft(e.target.value)}
            className={`box-border w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 transition-opacity ${
              loadingCoverLetter ? "opacity-60" : ""
            }`}
            rows={16}
          />
          <p className="mt-2 text-center text-xs text-gray-500">Click to edit</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={loadingCoverLetter}
              onClick={() => void copyCoverLetter()}
              className="rounded-lg border border-slate-300 bg-card px-5 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={loadingCoverLetter}
              onClick={downloadCoverLetterTxt}
              className="rounded-lg border border-slate-300 bg-card px-5 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download (.txt)
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
