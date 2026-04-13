import Link from "next/link";

export const metadata = {
  title: "About — Applyfy",
  description: "Meet the founder and learn why Applyfy was built.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
            About Applyfy
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[44px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            Built for students who are tired of guessing.
          </h1>
        </div>

        {/* Founder card */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-sm">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}
              aria-hidden
            >
              PS
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Priyanka Siwach</h2>
              <p className="mt-0.5 text-sm font-medium text-[#7c3aed]">Founder · CS Student, NYC</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Built Applyfy in April 2026</p>
            </div>
          </div>

          {/* Founder story */}
          <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            <p>
              I built Applyfy because I kept watching my friends send the same resume to dozens of jobs and wonder why no one called back. The advice online was vague — "tailor your resume," "add keywords" — but nobody explained <em>how</em> or <em>which ones</em>. I was frustrated by that gap, and I figured AI could close it.
            </p>
            <p>
              As a CS student in New York City, I had access to the tools — OpenAI APIs, modern frameworks, enough late nights — so I started building in April 2026. Applyfy went from a rough prototype to a real product in a matter of weeks. Every feature — the ATS scorer, the cover letter generator, the interview simulator — came from a real problem I saw classmates or friends face. The goal is simple: stop guessing, start getting hired.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="mt-8 rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#f5f3ff] to-white p-8 shadow-sm">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Our Mission</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Give every job seeker — regardless of connections, coaching, or budget — the same AI-powered advantage that used to be reserved for expensive career consultants. Applyfy processes your resume and a job posting in under two minutes and hands you a concrete action plan: gaps to fix, keywords to add, a cover letter that fits, and interview questions tailored to that role.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            We don't store your resume permanently. We don't sell your data. We're just here to help you get the job.
          </p>
        </section>

        {/* Stats row */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { value: "April 2026", label: "Founded" },
            { value: "6", label: "AI-powered tools" },
            { value: "NYC", label: "Based in" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center"
            >
              <p className="text-2xl font-extrabold text-[#7c3aed]">{s.value}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/my-application"
            className="inline-flex rounded-xl px-8 py-4 text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
          >
            Try Applyfy free →
          </Link>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Questions?{" "}
            <Link href="/contact" className="font-medium text-[#7c3aed] underline underline-offset-2">
              Reach out
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
}
