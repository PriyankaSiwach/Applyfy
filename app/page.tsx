import Link from "next/link";

function IconMatch() {
  return (
    <svg className="h-5 w-5 text-[#4F8EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconGap() {
  return (
    <svg className="h-5 w-5 text-[#22A05B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconLetter() {
  return (
    <svg className="h-5 w-5 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconInterview() {
  return (
    <svg className="h-5 w-5 text-[#6366F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="bg-[#F8FAFC]">
      {/* Hero */}
      <section className="px-10 pb-14 pt-[72px]">
        <div className="mx-auto max-w-[1200px] text-center">
          <p
            className="mx-auto inline-flex rounded-[99px] border border-[#C7D0E8] bg-[#EEF1F8] px-4 py-1.5 text-sm font-medium text-[#2E3E65]"
          >
            AI-powered job application suite
          </p>
          <h1 className="mt-6 text-[32px] font-bold leading-[1.15] tracking-[-0.5px] text-[#1A2A4A] sm:text-[40px]">
            Apply{" "}
            <span className="text-[#4F8EF7]">smarter.</span>
            <br />
            Land more interviews.
          </h1>
          <p className="mx-auto mt-5 max-w-[480px] text-base leading-relaxed text-[#64748B]">
            Upload your resume and add a job listing URL. Get a match score, gap analysis, a tailored cover letter, and interview prep — in one flow.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/my-application"
              className="inline-flex rounded-lg bg-[#2E3E65] px-6 py-[11px] text-sm font-semibold text-white transition-colors hover:bg-[#3D5080]"
            >
              Start with your resume
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex rounded-lg border-[1.5px] border-[#2E3E65] bg-white px-6 py-[11px] text-sm font-semibold text-[#2E3E65] transition-colors hover:bg-[#EEF1F8]"
            >
              See how it works
            </a>
          </div>

          <div className="mx-auto mt-12 max-w-[720px] border-t border-[#E2E8F0] pt-10">
            <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center sm:gap-8 md:gap-8">
              <div className="text-center">
                <p className="text-[22px] font-bold text-[#2E3E65]">2 min</p>
                <p className="mt-1 text-xs text-[#64748B]">to full analysis</p>
              </div>
              <div className="text-center">
                <p className="text-[22px] font-bold text-[#2E3E65]">4-in-1</p>
                <p className="mt-1 text-xs text-[#64748B]">tools in one flow</p>
              </div>
              <div className="text-center">
                <p className="text-[22px] font-bold text-[#2E3E65]">Free</p>
                <p className="mt-1 text-xs text-[#64748B]">to get started</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white px-10 py-14">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4F8EF7]">
            How it works
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold text-[#1A2A4A]">
            Three steps. One complete application.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            <div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E3E65] text-[13px] font-bold text-white">
                1
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#1A2A4A]">
                Upload your resume + job link
              </h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-[#64748B]">
                PDF, Word, or text resume and the public URL to the role. We pull the posting for you.
              </p>
            </div>
            <div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E3E65] text-[13px] font-bold text-white">
                2
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#1A2A4A]">
                Get your match score and gaps
              </h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-[#64748B]">
                See exactly where you fit, what&apos;s missing, and which requirements you exceed.
              </p>
            </div>
            <div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2E3E65] text-[13px] font-bold text-white">
                3
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[#1A2A4A]">
                Generate and ship
              </h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-[#64748B]">
                One-click cover letter and interview prep cards tailored to that specific role.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#F8FAFC] px-10 py-14">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4F8EF7]">
            What you get
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold text-[#1A2A4A]">
            Everything a hiring manager looks for.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            <article className="rounded-r-xl rounded-l-none border border-[0.5px] border-[#E2E8F0] border-l-[3px] border-l-[#4F8EF7] bg-white p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#EBF2FF]">
                <IconMatch />
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[#1A2A4A]">
                  Resume match score
                </h3>
                <span className="rounded-full bg-[#EEF1F8] px-2 py-0.5 text-xs font-medium text-[#2E3E65]">
                  Core feature
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                Instant % match against every requirement in the job posting. Know before you apply.
              </p>
            </article>
            <article className="rounded-xl border border-[0.5px] border-[#E2E8F0] bg-white p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#E6F7EE]">
                <IconGap />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-[#1A2A4A]">
                Gap analysis
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                Line-by-line breakdown of what you have, what&apos;s missing, and what you exceed.
              </p>
            </article>
            <article className="rounded-xl border border-[0.5px] border-[#E2E8F0] bg-white p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#FEF3C7]">
                <IconLetter />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-[#1A2A4A]">
                Cover letter generator
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                A tailored draft in seconds — tuned to the role, not a generic template.
              </p>
            </article>
            <article className="rounded-xl border border-[0.5px] border-[#E2E8F0] bg-white p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEEDFE]">
                <IconInterview />
              </div>
              <h3 className="mb-2 text-sm font-semibold text-[#1A2A4A]">
                Interview prep cards
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                Predicted questions with answer frameworks, based on the actual job description.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="bg-[#2E3E65] px-10 py-12">
        <blockquote className="mx-auto max-w-[520px] text-center">
          <p className="text-lg font-medium italic leading-relaxed text-white">
            &ldquo;I applied to 40 jobs in a month and got 3 interviews. With Applyfy I applied to 12 and got 5.&rdquo;
          </p>
          <footer className="mt-4 text-[13px] text-white/60">
            — Early beta user, Software Engineer
          </footer>
        </blockquote>
      </section>

      {/* Final CTA */}
      <section className="bg-[#F8FAFC] px-10 py-14">
        <div className="mx-auto max-w-[1200px] text-center">
          <h2 className="text-[26px] font-bold text-[#1A2A4A]">
            Stop guessing. Start matching.
          </h2>
          <p className="mt-3 text-sm text-[#64748B]">
            Your next interview is one good application.
          </p>
          <Link
            href="/my-application"
            className="mt-8 inline-flex rounded-lg bg-[#2E3E65] px-8 py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-[#3D5080]"
          >
            Start with your resume — it&apos;s free
          </Link>
        </div>
      </section>
    </main>
  );
}
