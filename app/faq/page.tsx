"use client";

import { useState } from "react";

export default function FaqPage() {
  const faqs = [
    {
      q: "What file formats does Applyfy support?",
      a: "Applyfy accepts PDF, DOCX (Microsoft Word), and plain TXT files. You can also paste your resume text directly into the text field — no upload required. For best results, paste as plain text to avoid formatting issues.",
    },
    {
      q: "Is my resume data safe?",
      a: "Yes. Your resume and job description are sent to our AI for analysis during your session and are not stored permanently on our servers. We do not log, sell, or share your personal information. Once you close your session or clear your data, it is gone. See our Privacy Policy for full details.",
    },
    {
      q: "How does the ATS score work?",
      a: "The ATS (Applicant Tracking System) score measures how closely your resume text matches the exact keywords and phrases in a job posting — the same way automated hiring systems filter candidates. A higher score means more of the key phrases from the job description appear verbatim in your resume. Synonyms and paraphrases do not count unless we can confirm the original phrasing is present, which is why we flag gaps explicitly.",
    },
    {
      q: "Can I use Applyfy for free?",
      a: "Yes! The Free plan includes 3 full resume analyses, your ATS score, top 3 quick wins, all keyword chips (matched and missing), and 2 matched strengths. No credit card is required to get started. Pro and Premium plans unlock unlimited analyses, the Resume Editor, Match score, Cover Letter generator, Interview Prep, the Interview Simulator, and the Salary Negotiation Coach.",
    },
    {
      q: "How do I cancel my subscription?",
      a: "You can cancel anytime through the Stripe Customer Portal — just click \"Manage subscription\" in the top navigation when you are signed in. Your access continues until the end of your current billing period. We do not charge cancellation fees.",
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
            FAQ
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[40px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-lg text-[var(--text-secondary)]">
            Can&apos;t find what you&apos;re looking for?{" "}
            <a href="/contact" className="font-medium text-[#7c3aed] underline underline-offset-2">
              Contact us
            </a>
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-semibold text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-card-hover)] rounded-[14px]"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <svg
                    className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ease-out ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
