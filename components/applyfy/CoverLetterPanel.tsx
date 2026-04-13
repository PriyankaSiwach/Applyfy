"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";

const MISSING_META_ERROR = "MISSING_JOB_META";

export function CoverLetterPanel() {
  const { isPro } = useSubscription();
  const {
    coverTone,
    setCoverTone,
    coverLength,
    setCoverLength,
    loadingCoverLetter,
    coverLetter,
    coverLetterError,
    copyCoverLetter,
    regenerateCoverLetter,
    regenerateCoverLetterWithMeta,
    setCoverLetterDraft,
  } = useApplyfy();

  const [regenSpin, setRegenSpin] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaCompany, setMetaCompany] = useState("");


  const [metaError, setMetaError] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    const t = coverLetter?.trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [coverLetter]);

  useEffect(() => {
    if (!isPro) {
      setCoverTone("confident");
      setCoverLength("standard");
    }
  }, [isPro, setCoverTone, setCoverLength]);

  function handleRegenerate() {
    setRegenSpin(true);
    window.setTimeout(() => setRegenSpin(false), 600);
    void regenerateCoverLetter();
  }

  const toneOptions = [
    ["concise", "Concise"],
    ["confident", "Confident"],
    ["storytelling", "Storytelling"],
  ] as const;

  const lengthOptions = [
    ["short", "Short"],
    ["standard", "Standard"],
    ["detailed", "Detailed"],
  ] as const;

  async function downloadPdf() {
    if (!coverLetter) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = 50;
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(coverLetter, maxWidth);
    for (const line of lines) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      doc.text(line, margin, y);
      y += 14;
    }
    doc.save("cover-letter.pdf");
  }

  async function downloadDocx() {
    if (!coverLetter) return;
    const paragraphs = coverLetter.split(/\n/).map(
      (line) =>
        new Paragraph({
          children: [new TextRun(line || " ")],
        }),
    );
    const doc = new Document({
      sections: [{ children: paragraphs }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="w-full min-w-0">
      <h2 className="mb-1 text-center text-2xl font-bold tracking-tight text-[#0f172a]">
        Cover letter
      </h2>
      <p className="mb-6 text-center text-sm text-[#64748b]">
        Generated from your resume and the job posting. Adjust tone or length,
        then click Regenerate.
      </p>

      <div className="mb-6 flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:justify-center">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
            Tone
          </legend>
          <div
            className={`inline-flex rounded-[10px] p-[3px] ${
              isPro ? "bg-[#f1f5f9]" : "bg-[#f1f5f9] opacity-80"
            }`}
            role="group"
            aria-label="Tone"
          >
            {toneOptions.map(([value, label]) => (
              <label
                key={value}
                className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all ${
                  !isPro && value !== "confident"
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer"
                } ${
                  coverTone === value
                    ? "bg-[#ede9fe] font-bold text-[#7c3aed] shadow-none"
                    : "bg-transparent text-[#64748b]"
                }`}
              >
                <input
                  type="radio"
                  name="cover-tone"
                  value={value}
                  checked={coverTone === value}
                  onChange={() => isPro && setCoverTone(value)}
                  disabled={!isPro && value !== "confident"}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          {!isPro ? (
            <p className="mt-2 text-center text-[11px] text-[#94a3b8] sm:text-left">
              Free plan: Confident tone only. Upgrade for all tones.
            </p>
          ) : null}
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
            Length
          </legend>
          <div
            className="inline-flex rounded-[10px] bg-[#f1f5f9] p-[3px]"
            role="group"
            aria-label="Length"
          >
            {lengthOptions.map(([value, label]) => (
              <label
                key={value}
                className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-all ${
                  !isPro && value !== "standard"
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer"
                } ${
                  coverLength === value
                    ? "bg-white font-bold text-[#0f172a] shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    : "bg-transparent text-[#64748b]"
                }`}
              >
                <input
                  type="radio"
                  name="cover-length"
                  value={value}
                  checked={coverLength === value}
                  onChange={() => isPro && setCoverLength(value)}
                  disabled={!isPro && value !== "standard"}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          {!isPro ? (
            <p className="mt-2 text-center text-[11px] text-[#94a3b8] sm:text-left">
              Free plan: Standard length. Upgrade for Short / Detailed.
            </p>
          ) : null}
        </fieldset>
      </div>

      <div className="mb-6 flex flex-wrap justify-center">
        <button
          type="button"
          disabled={loadingCoverLetter}
          onClick={handleRegenerate}
          className="applyfy-btn-primary inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-6 py-2.5 text-sm font-medium text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)] transition-all hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            className={`h-4 w-4 shrink-0 ${regenSpin ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Regenerate
        </button>
      </div>

      {loadingCoverLetter && !coverLetter ? (
        <p className="mb-4 text-center text-sm text-[#64748b]">
          Generating cover letter…
        </p>
      ) : null}
      {loadingCoverLetter && coverLetter ? (
        <p className="mb-3 text-center text-xs font-medium text-[#0ea5e9]">
          Updating letter…
        </p>
      ) : null}

      {coverLetterError === MISSING_META_ERROR ? (
        <div className="mb-6 mx-auto max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-[#0f172a]">
            What job are you applying for?
          </p>
          <p className="mb-4 text-xs text-[#64748b]">
            We couldn&apos;t find the job title in the posting. Fill in the
            details below and we&apos;ll generate your letter.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#64748b]">
                Job title <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => {
                  setMetaTitle(e.target.value);
                  setMetaError(null);
                }}
                placeholder="e.g. Software Engineer"
                className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b]">
                Company name{" "}
                <span className="font-normal text-[#94a3b8]">(optional)</span>
              </label>
              <input
                type="text"
                value={metaCompany}
                onChange={(e) => setMetaCompany(e.target.value)}
                placeholder="e.g. Google, Stripe"
                className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
              />
            </div>
            {metaError ? (
              <p className="text-xs text-[#ef4444]">{metaError}</p>
            ) : null}
            <button
              type="button"
              disabled={loadingCoverLetter}
              onClick={() => {
                if (!metaTitle.trim()) {
                  setMetaError("Job title is required.");
                  return;
                }
                void regenerateCoverLetterWithMeta(
                  metaTitle.trim(),
                  metaCompany.trim(),
                );
              }}
              className="applyfy-btn-primary w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingCoverLetter ? "Generating…" : "Generate cover letter"}
            </button>
          </div>
        </div>
      ) : coverLetterError ? (
        <p className="mb-4 text-center text-sm text-[#ef4444]">
          {coverLetterError}
        </p>
      ) : null}

      {coverLetter ? (
        <>
          <div className="relative overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow focus-within:border-[#7c3aed] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]">
            <div className="h-2.5 w-full bg-[#ede9fe]" aria-hidden />
            <div className="relative p-6 pb-12">
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetterDraft(e.target.value)}
                className={`cover-letter-editor box-border min-h-[320px] w-full min-w-0 max-w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-[1.8] text-[#0f172a] outline-none whitespace-pre-wrap ${
                  loadingCoverLetter ? "opacity-60" : ""
                }`}
                rows={16}
                aria-label="Cover letter body"
              />
              <span className="pointer-events-none absolute bottom-3 right-4 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#64748b]">
                {wordCount} words
              </span>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-[#94a3b8]">
            Click to edit
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={loadingCoverLetter}
              onClick={() => void copyCoverLetter()}
              className="rounded-lg border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-medium text-[#64748b] transition-all hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Copy
            </button>
            {isPro ? (
              <>
                <button
                  type="button"
                  disabled={loadingCoverLetter}
                  onClick={() => void downloadPdf()}
                  className="applyfy-btn-primary rounded-lg bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)] transition-all hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={loadingCoverLetter}
                  onClick={() => void downloadDocx()}
                  className="applyfy-btn-primary rounded-lg bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)] transition-all hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download DOCX
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  title="Upgrade to Pro to download as PDF or DOCX"
                  className="cursor-not-allowed rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-5 py-2.5 text-sm font-medium text-[#94a3b8]"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled
                  title="Upgrade to Pro to download as PDF or DOCX"
                  className="cursor-not-allowed rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-5 py-2.5 text-sm font-medium text-[#94a3b8]"
                >
                  Download DOCX
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
