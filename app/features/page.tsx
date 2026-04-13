import Link from "next/link";

export const metadata = {
  title: "Features — Applyfy",
  description: "Explore every AI-powered tool inside Applyfy.",
};

const features = [
  {
    title: "ATS Resume Analyzer",
    description:
      "Upload your resume and paste a job posting. Applyfy instantly shows your ATS score, missing keywords, matched phrases, and a readiness checklist — in under 2 minutes.",
    accent: "#3b5bdb",
    badge: "Free",
    badgeColor: "#ede9fe",
    badgeText: "#6d28d9",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "Match Score Breakdown",
    description:
      "See a percentage match between your background and the job — broken down into skills, experience, education, and keyword alignment. Know your odds before applying.",
    accent: "#8b5cf6",
    badge: "Pro",
    badgeColor: "#ede9fe",
    badgeText: "#6d28d9",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "AI Resume Editor",
    description:
      "Rewrite individual bullet points with AI to hit missing keywords — without fabricating experience. Every suggestion is grounded in what's already on your resume.",
    accent: "#7c3aed",
    badge: "Pro",
    badgeColor: "#ede9fe",
    badgeText: "#6d28d9",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    title: "Cover Letter Generator",
    description:
      "A personalized cover letter in seconds — not a generic template. Choose the tone and length, then download as PDF, DOCX, or plain text.",
    accent: "#7c3aed",
    badge: "Pro",
    badgeColor: "#ede9fe",
    badgeText: "#6d28d9",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Interview Prep",
    description:
      "Get predicted behavioral and technical questions for your specific role, STAR-method answer guides, and risk-area coaching based on the gaps in your resume.",
    accent: "#059669",
    badge: "Pro",
    badgeColor: "#ede9fe",
    badgeText: "#6d28d9",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Interview Simulator",
    description:
      "Practice answering questions in your own words. Get AI scores for clarity, specificity, and STAR structure — plus concrete improvement notes after each answer.",
    accent: "#d97706",
    badge: "Premium",
    badgeColor: "#fef3c7",
    badgeText: "#b45309",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Salary Negotiation Coach",
    description:
      "Paste your offer details and get a word-for-word negotiation script tailored to your role, experience, and market. Backed by data, not guesswork.",
    accent: "#f59e0b",
    badge: "Premium",
    badgeColor: "#fef3c7",
    badgeText: "#b45309",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Application Tracker",
    description:
      "One dashboard for every application. Log status, deadlines, and notes. Filter and sort across all your jobs so nothing slips through the cracks.",
    accent: "#ec4899",
    badge: "Free",
    badgeColor: "#ede9fe",
    badgeText: "#6d28d9",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
] as const;

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
            Features
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[48px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            Everything you need to land the job.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-[var(--text-secondary)]">
            Six AI-powered tools that work together from resume upload to offer negotiation.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:border-[var(--border-hover)] hover:shadow-md"
            >
              {/* Tier badge */}
              <span
                className="absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: f.badgeColor, color: f.badgeText }}
              >
                {f.badge}
              </span>

              {/* Icon */}
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${f.accent}14`, color: f.accent }}
              >
                {f.icon}
              </div>

              <h2 className="mt-4 text-[16px] font-bold text-[var(--text-primary)]">{f.title}</h2>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {f.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl p-10 text-center text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)" }}
        >
          <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[32px] font-extrabold">
            Ready to start?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[rgba(255,255,255,0.85)]">
            The first 3 analyses are free. No credit card required.
          </p>
          <Link
            href="/my-application"
            className="mt-7 inline-flex rounded-xl bg-white px-8 py-3.5 text-base font-bold transition-all duration-200 hover:opacity-90"
            style={{ color: "#7c3aed" }}
          >
            Try for free →
          </Link>
        </div>

      </div>
    </main>
  );
}
