import Link from "next/link";

export const metadata = {
  title: "Roadmap — Applyfy",
  description: "What we've built and what's coming next.",
};

const shipped = [
  { label: "ATS keyword scorer & gap analysis" },
  { label: "AI resume bullet rewriter (honesty-first)" },
  { label: "Match score with skills / experience / education breakdown" },
  { label: "Cover letter generator (tones, lengths, PDF / DOCX / TXT)" },
  { label: "Interview prep: behavioral, technical, STAR guides, risk areas" },
  { label: "Interview Simulator with scored practice answers" },
  { label: "Salary Negotiation Coach" },
  { label: "Application Tracker with unlimited jobs (Pro/Premium)" },
  { label: "Follow-up email generator for interview prep" },
  { label: "ATS score history chart" },
];

const coming = [
  {
    title: "LinkedIn Profile Import",
    description:
      "Paste your LinkedIn URL and we'll pull your work history automatically — no manual resume typing needed.",
    status: "In progress",
    statusColor: "#7c3aed",
    statusBg: "#ede9fe",
  },
  {
    title: "Chrome Extension",
    description:
      "Analyze any job posting on LinkedIn, Indeed, or company career pages with one click — directly in your browser.",
    status: "Coming soon",
    statusColor: "#b45309",
    statusBg: "#fef3c7",
  },
  {
    title: "Salary Insights & Benchmarks",
    description:
      "Real-time salary data for your role, city, and experience level — pulled from public datasets and integrated into the negotiation coach.",
    status: "Coming soon",
    statusColor: "#b45309",
    statusBg: "#fef3c7",
  },
  {
    title: "Multi-resume Profiles",
    description:
      "Save multiple resume versions and switch between them — useful for people applying across different roles or industries.",
    status: "Planned",
    statusColor: "#64748b",
    statusBg: "#f1f5f9",
  },
  {
    title: "Team / Recruiter View",
    description:
      "A shared workspace for career coaches or bootcamp teams to review and give feedback on student applications.",
    status: "Planned",
    statusColor: "#64748b",
    statusBg: "#f1f5f9",
  },
  {
    title: "Mobile App",
    description:
      "A native iOS / Android app so you can check your match score and prep for interviews on the go.",
    status: "Researching",
    statusColor: "#64748b",
    statusBg: "#f1f5f9",
  },
];

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
            Roadmap
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[44px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            What we&apos;re building.
          </h1>
          <p className="mt-3 text-lg text-[var(--text-secondary)]">
            Shipped, in progress, and coming soon.
          </p>
        </div>

        {/* Shipped */}
        <section>
          <h2 className="mb-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Shipped
          </h2>
          <ul className="space-y-2">
            {shipped.map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-5 py-3.5"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600" aria-hidden>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-[14px] text-[var(--text-primary)]">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Coming soon */}
        <section className="mt-12">
          <h2 className="mb-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#7c3aed]" aria-hidden />
            What&apos;s next
          </h2>
          <div className="space-y-4">
            {coming.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{item.title}</h3>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                    style={{ backgroundColor: item.statusBg, color: item.statusColor }}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback nudge */}
        <div className="mt-12 rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#f5f3ff] to-white p-7 text-center">
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
            Have a feature request?
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            We read every message. Your feedback shapes what we build next.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-flex rounded-xl border-2 border-[#7c3aed] px-6 py-2.5 text-sm font-bold text-[#7c3aed] transition-all duration-200 hover:bg-[#7c3aed] hover:text-white"
          >
            Send us your idea →
          </Link>
        </div>

      </div>
    </main>
  );
}
