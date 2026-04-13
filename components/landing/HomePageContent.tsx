"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

const SECTION_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function useSectionInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function HeroStagger({
  index,
  children,
  className = "",
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        animation: `home-reveal 0.6s ${SECTION_EASE} ${index * 80}ms forwards`,
        opacity: 0,
      }}
    >
      {children}
    </div>
  );
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

const featureCards = [
  {
    title: "AI Resume Fixer",
    body: "Instant AI suggestions that rewrite your resume bullets to match any job posting.",
    accent: "#3b5bdb",
    Icon: IconDocument,
  },
  {
    title: "Cover Letter Generator",
    body: "A personalized draft in seconds — tuned to the exact role, not a generic template.",
    accent: "#7c3aed",
    Icon: IconEnvelope,
  },
  {
    title: "Job Matching Score",
    body: "See your % match against every requirement. Know your odds before you apply.",
    accent: "#8b5cf6",
    Icon: IconTarget,
  },
  {
    title: "Application Tracker",
    body: "One dashboard for every job. Status updates, deadlines, notes — all in one place.",
    accent: "#f59e0b",
    Icon: IconBarChart,
  },
  {
    title: "Quick Apply Automation",
    body: "Pre-filled applications with smart field detection. Apply to 10 jobs in the time it used to take for 1.",
    accent: "#ec4899",
    Icon: IconLightning,
  },
  {
    title: "Privacy First",
    body: "End-to-end encrypted. We never sell or share your data. Ever.",
    accent: "#06b6d4",
    Icon: IconShield,
  },
] as const;

const howSteps = [
  {
    n: "01",
    title: "Upload Your Resume",
    body: "Drop your PDF, Word doc, or paste plain text. We handle every format.",
    accent: "#3b5bdb",
    Icon: IconUpload,
    side: "left" as const,
  },
  {
    n: "02",
    title: "AI Optimization",
    body: "Our AI analyzes your resume against the job posting and highlights exactly what is missing and what shines.",
    accent: "#7c3aed",
    Icon: IconSparkle,
    side: "right" as const,
  },
  {
    n: "03",
    title: "Apply with Confidence",
    body: "Generate a custom cover letter, tailored to this specific role, in one click.",
    accent: "#7c3aed",
    Icon: IconSend,
    side: "left" as const,
  },
  {
    n: "04",
    title: "Land Interviews",
    body: "Track your applications, prep for interviews with predicted questions, and monitor your progress.",
    accent: "#f59e0b",
    Icon: IconTrending,
    side: "right" as const,
  },
] as const;

const trustedCompanyMarks = [
  { name: "Google", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[19px] font-medium tracking-tight" },
  { name: "Microsoft", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[17px] font-semibold tracking-[-0.02em]" },
  { name: "Apple", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[20px] font-semibold tracking-wide" },
  { name: "Amazon", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[16px] font-bold uppercase tracking-[0.12em]" },
  { name: "Meta", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[22px] font-extrabold tracking-tight" },
  { name: "JPMorgan", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[15px] font-semibold tracking-tight" },
  { name: "Deloitte", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[16px] font-bold tracking-[0.08em]" },
  { name: "Adobe", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[18px] font-semibold italic" },
  { name: "Salesforce", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[14px] font-bold uppercase tracking-wider" },
  { name: "Netflix", fontClass: "font-[family-name:var(--font-plus-jakarta)] text-[19px] font-extrabold tracking-tight" },
] as const;

const footerLanguages = [
  { flag: "🇺🇸", label: "English" },
  { flag: "🇩🇪", label: "German" },
  { flag: "🇫🇷", label: "French" },
  { flag: "🇪🇸", label: "Spanish" },
  { flag: "🇵🇱", label: "Polish" },
] as const;

const testimonials = [
  {
    initials: "JS",
    gradient: "linear-gradient(135deg, #3b5bdb, #6b8cff)",
    name: "Jordan S.",
    role: "Software Engineer",
    quote:
      "I went from 40 applications with 3 interviews to 12 applications with 5 interviews. Applyfy completely changed my strategy.",
  },
  {
    initials: "MP",
    gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    name: "Maya P.",
    role: "Product Manager",
    quote:
      "The cover letter generator is scary good. Hiring managers actually commented on how well my letter matched the role.",
  },
  {
    initials: "AR",
    gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    name: "Alex R.",
    role: "UX Designer",
    quote:
      "The gap analysis alone is worth it. I finally understood why I was not getting callbacks — and fixed it in an afternoon.",
  },
] as const;

function IconDocument({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function IconEnvelope({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M3 12h2m14 0h2" />
    </svg>
  );
}
function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconLightning({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M13 3L4 14h7v7l9-11h-7V3z" />
    </svg>
  );
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
function IconSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
function IconTrending({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

export function HomePageContent() {
  const { ref: statsRef, visible: statsVisible } =
    useSectionInView<HTMLElement>(0.15);
  const { ref: featRef, visible: featVisible } =
    useSectionInView<HTMLElement>(0.15);
  const { ref: howRef, visible: howVisible } =
    useSectionInView<HTMLElement>(0.15);
  const { ref: demoRef, visible: demoVisible } =
    useSectionInView<HTMLElement>(0.15);
  const { ref: testRef, visible: testVisible } =
    useSectionInView<HTMLElement>(0.15);
  const { ref: ctaRef, visible: ctaVisible } =
    useSectionInView<HTMLElement>(0.15);

  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [s3, setS3] = useState(0);
  const [s4, setS4] = useState(0);
  const [atsWidth, setAtsWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAtsWidth(72));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!statsVisible) return;
    const start = performance.now();
    const dur = 1500;
    let raf = 0;
    function frame(now: number) {
      const t = Math.min(1, (now - start) / dur);
      const e = easeOutCubic(t);
      setS1(Math.round(500 * e));
      setS2(Math.round(2 * e));
      setS3(Math.round(6 * e));
      setS4(4.9 * e);
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [statsVisible]);

  const gradText = {
    backgroundImage: "var(--gradient-hero)",
    WebkitBackgroundClip: "text" as const,
    backgroundClip: "text" as const,
    color: "transparent",
  };

  return (
    <main className="min-w-0 bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Hero */}
      <section
        className="relative flex min-h-[92vh] flex-col items-center justify-center px-6 py-20 text-center"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% -5%, rgba(107, 140, 255, 0.12) 0%, transparent 70%),
            radial-gradient(circle, var(--text-muted) 1px, transparent 1px)`,
          backgroundSize: "auto, 32px 32px",
          backgroundColor: "var(--bg-base)",
          backgroundBlendMode: "normal, normal",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--text-muted) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-6">
          <HeroStagger index={0}>
            <h1 className="mt-8 font-[family-name:var(--font-plus-jakarta)] text-[clamp(44px,7vw,80px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--text-primary)]">
              Land Your Dream Job
            </h1>
          </HeroStagger>

          <HeroStagger index={1}>
            <h1
              className="mt-1 font-[family-name:var(--font-plus-jakarta)] text-[clamp(44px,7vw,80px)] font-extrabold leading-[1.1] tracking-[-0.03em]"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Faster Than Ever
            </h1>
          </HeroStagger>

          <HeroStagger index={2}>
            <p className="mt-2 font-[family-name:var(--font-plus-jakarta)] text-xl font-semibold text-[var(--brand-2)]">
              Stop guessing, start getting hired.
            </p>
          </HeroStagger>

          <HeroStagger index={3}>
            <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.75] text-[var(--text-secondary)]">
              Upload your resume, paste a job link — get your match score, gap
              analysis, a tailored cover letter, and interview prep cards in
              under 2 minutes.
            </p>
          </HeroStagger>

          <HeroStagger index={4}>
            <div className="mt-10 flex flex-col items-center justify-center gap-[14px] sm:flex-row">
              <Link
                href="/my-application"
                className="home-hero-float inline-flex rounded-xl px-8 py-[14px] text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "var(--gradient-hero)",
                  boxShadow: "0 4px 24px var(--brand-glow)",
                }}
              >
                Start For Free →
              </Link>
              <a
                href="#demo"
                className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-8 py-[14px] text-base font-bold text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
              >
                Watch Demo
              </a>
            </div>
          </HeroStagger>

          <HeroStagger index={5}>
            <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[13px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="text-[var(--brand)]">●</span> No credit card
                required, start free
              </span>
              <span aria-hidden className="text-[var(--text-muted)]">
                ·
              </span>
              <span>2 min setup</span>
            </p>
          </HeroStagger>

          <HeroStagger index={6}>
            <div
              className="relative mx-auto mt-12 h-[36px] w-6 rounded-xl border-2 border-[var(--text-muted)]"
              aria-hidden
            >
              <div
                className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--text-muted)]"
                style={{
                  animation: "home-scroll-dot 1.5s ease-in-out infinite",
                }}
              />
            </div>
          </HeroStagger>
        </div>
      </section>

      {/* Trusted companies — social proof */}
      <section
        className="relative overflow-hidden border-y border-[rgba(255,255,255,0.12)] py-14 transition-colors duration-300"
        style={{
          background:
            "linear-gradient(135deg, #5b21b6 0%, var(--brand) 42%, var(--brand-2) 100%)",
        }}
        aria-labelledby="trusted-companies-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-[1200px] px-6 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
            Social proof
          </p>
          <h2
            id="trusted-companies-heading"
            className="mt-2 font-[family-name:var(--font-plus-jakarta)] text-[clamp(26px,4vw,36px)] font-extrabold leading-tight text-white"
          >
            Trusted by thousands of job seekers
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-white/80">
            Candidates use Applyfy to prepare stronger applications for roles at leading companies worldwide.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:gap-4">
            {trustedCompanyMarks.map((c) => (
              <div
                key={c.name}
                className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] px-3 py-3 text-white shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.12]"
              >
                <span className={`select-none text-white ${c.fontClass}`}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats — #pricing */}
      <section
        id="pricing"
        ref={statsRef}
        className="border-y border-[var(--border)] bg-[var(--bg-surface)] py-10 transition-colors duration-300"
      >
        <div
          className={`mx-auto max-w-[1200px] px-6 ${statsVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
        >
          <div className="grid grid-cols-1 gap-8 divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0 lg:gap-0">
            {[
              {
                value: `${s1.toLocaleString("en-US")}+`,
                label: "Resumes Optimized",
              },
              { value: `${Math.round(s2)} min`, label: "Average Setup" },
              {
                value: `${s3}`,
                label: "AI-Powered Tools",
              },
              {
                value: `${s4.toFixed(1)}/5`,
                label: "Early Rating ★★★★★",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-col items-center px-4 py-4 text-center first:pt-0 sm:py-0 lg:first:pl-0"
              >
                <span
                  className="text-[40px] font-extrabold leading-none"
                  style={gradText}
                >
                  {row.value}
                </span>
                <span className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges — SSL & payments */}
      <section
        className="border-b border-[var(--border)] bg-[var(--bg-card)] py-8 transition-colors duration-300"
        aria-label="Security and payments"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-6 px-6 sm:flex-row sm:gap-12 md:gap-16">
          <div className="inline-flex items-center gap-3 text-[var(--text-primary)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <div className="text-left">
              <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">SSL Secure</p>
              <p className="text-[12px] text-[var(--text-muted)]">Encryption in transit</p>
            </div>
          </div>
          <div className="hidden h-8 w-px bg-[var(--border)] sm:block" aria-hidden />
          <div className="inline-flex items-center gap-3 text-[var(--text-primary)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tint)] text-[var(--brand)] ring-1 ring-[var(--border-hover)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <div className="text-left">
              <p className="text-[13px] font-bold text-[var(--text-primary)]">
                Secure Payments{" "}
                <span className="text-[var(--brand)]">· Powered by Stripe</span>
              </p>
              <p className="text-[12px] text-[var(--text-muted)]">Industry-standard checkout</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        ref={featRef}
        className="py-[100px] transition-colors duration-300"
      >
        <div className="mx-auto max-w-[1200px] px-6">
          <div
            className={`text-center ${featVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
          >
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">
              Features
            </p>
            <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[42px] font-extrabold text-[var(--text-primary)]">
              Everything You Need to Get Hired
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-[var(--text-secondary)]">
              Six powerful tools. One seamless flow. Zero confusion.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((f, i) => {
              const { Icon } = f;
              return (
                <article
                  key={f.title}
                  className={`home-stagger-item rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-7 transition-all duration-[250ms] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] ${
                    featVisible ? "is-visible" : ""
                  } dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]`}
                  style={{
                    animationDelay: featVisible ? `${i * 80}ms` : "0ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${f.accent}80`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.removeProperty("border-color");
                  }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                    style={{
                      backgroundColor: `${f.accent}1F`,
                      color: f.accent,
                    }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-[family-name:var(--font-plus-jakarta)] text-[17px] font-bold text-[var(--text-primary)]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-[1.65] text-[var(--text-secondary)]">
                    {f.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        ref={howRef}
        className="bg-[var(--bg-surface)] py-[100px] transition-colors duration-300"
      >
        <div className="relative mx-auto max-w-[1200px] px-6">
          <div
            className={`text-center ${howVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
          >
            <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[42px] font-extrabold text-[var(--text-primary)]">
              How Applyfy Works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-[var(--text-secondary)]">
              From resume to ready-to-send application in 4 simple steps.
            </p>
          </div>

          <div className="relative mx-auto mt-16 max-w-[900px]">
            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 hidden w-0 -translate-x-1/2 border-l-2 border-dashed border-[var(--border)] md:block"
              aria-hidden
            />
            <div className="space-y-16 md:space-y-24">
              {howSteps.map((step) => {
                const left = step.side === "left";
                const circle = (
                  <div
                    className={`flex flex-col items-center ${
                      left
                        ? "order-1 md:items-start md:text-left"
                        : "order-2 md:items-end md:text-right"
                    } ${
                      howVisible
                        ? left
                          ? "home-how-left is-visible opacity-0"
                          : "home-how-right is-visible opacity-0"
                        : "opacity-0"
                    }`}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{ color: step.accent }}
                    >
                      {step.n}
                    </span>
                    <div
                      className="mt-3 flex h-[100px] w-[100px] items-center justify-center rounded-full text-white"
                      style={{
                        background: `linear-gradient(135deg, ${step.accent}, ${step.accent}cc)`,
                        boxShadow: `0 0 40px ${step.accent}4d`,
                      }}
                    >
                      <step.Icon className="h-10 w-10 text-white" />
                    </div>
                  </div>
                );
                const copy = (
                  <div
                    className={`text-center ${
                      left
                        ? "order-2 md:text-left"
                        : "order-1 md:text-right"
                    } ${howVisible ? "home-section-reveal is-visible opacity-0" : "opacity-0"}`}
                  >
                    <h3 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[var(--text-primary)]">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-[1.7] text-[var(--text-secondary)]">
                      {step.body}
                    </p>
                  </div>
                );
                return (
                  <div
                    key={step.n}
                    className="relative grid items-center gap-8 md:grid-cols-2"
                  >
                    {left ? (
                      <>
                        {circle}
                        {copy}
                      </>
                    ) : (
                      <>
                        {copy}
                        {circle}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section
        id="demo"
        ref={demoRef}
        className="py-[100px] transition-colors duration-300"
      >
        <div className="mx-auto max-w-[1200px] px-6">
          <div
            className={`text-center ${demoVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
          >
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">
              See it in action
            </p>
            <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[42px] font-extrabold text-[var(--text-primary)]">
              Your entire application, handled.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[var(--text-secondary)]">
              This is what your dashboard looks like after uploading your resume.
            </p>
          </div>

          <div
            className={`relative mx-auto mt-12 max-w-[900px] ${demoVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
          >
            <div className="absolute -right-2 -top-3 z-10 rounded-full px-3 py-1 text-[12px] font-semibold text-white shadow-lg md:right-4 md:top-2" style={{ background: "var(--gradient-hero)" }}>
              Live preview ✦
            </div>
            <div
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
              style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px var(--border)" }}
            >
              <div className="flex h-11 items-center gap-2 rounded-t-2xl border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#a78bfa]" />
                <div className="mx-auto rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-1 text-[13px] text-[var(--text-muted)]">
                  applyfy.app/analyze
                </div>
              </div>
              <div className="grid gap-5 p-6 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    ATS Score
                  </p>
                  <p className="mt-1">
                    <span className="font-[family-name:var(--font-plus-jakarta)] text-[56px] font-extrabold text-[var(--brand)]">
                      72
                    </span>
                    <span className="ml-1 text-[24px] text-[var(--text-muted)]">
                      /100
                    </span>
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-[1.2s] ease-out"
                      style={{
                        width: `${atsWidth}%`,
                        background:
                          "linear-gradient(90deg, var(--brand), #a78bfa)",
                      }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#ddd6fe] bg-[rgba(124,58,237,0.1)] px-2 py-0.5 text-[11px] font-medium text-[#6d28d9]">
                      Algorithms ✓
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#ddd6fe] bg-[rgba(124,58,237,0.1)] px-2 py-0.5 text-[11px] font-medium text-[#6d28d9]">
                      Cloud Computing ✓
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#fecaca] bg-[rgba(239,68,68,0.08)] px-2 py-0.5 text-[11px] font-medium text-[var(--red)]">
                      SQL ✗
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-bold text-[var(--text-primary)]">
                    Quick wins
                  </p>
                  <div className="mt-2 space-y-2">
                    <div className="rounded-lg border border-[var(--border)] border-l-[3px] border-l-[var(--amber)] bg-[var(--bg-card)] p-2 text-[11px] text-[var(--text-secondary)]">
                      Mirror verbs from the job post in your top bullets.
                    </div>
                    <div className="rounded-lg border border-[var(--border)] border-l-[3px] border-l-[var(--amber)] bg-[var(--bg-card)] p-2 text-[11px] text-[var(--text-secondary)]">
                      Add one metric that matches the role&apos;s KPIs.
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-center text-sm font-semibold text-[var(--text-primary)]">
                    Match Score
                  </p>
                  <div className="relative mx-auto mt-2 h-[80px] w-[80px]">
                    <svg className="-rotate-90" width="80" height="80" viewBox="0 0 80 80" aria-hidden>
                      <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bg-surface)" strokeWidth="8" />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="8"
                        strokeDasharray={`${0.48 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-0.5">
                      <span className="text-lg font-extrabold text-[var(--red)]">48%</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      { label: "Skills", v: 25 },
                      { label: "Experience", v: 40 },
                      { label: "Education", v: 70 },
                      { label: "Keywords", v: 55 },
                    ].map((b) => (
                      <div key={b.label}>
                        <div className="mb-0.5 flex justify-between text-[11px] text-[var(--text-secondary)]">
                          <span>{b.label}</span>
                          <span>{b.v}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-1000 ease-out"
                            style={{ width: demoVisible ? `${b.v}%` : "0%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section
        ref={testRef}
        className="bg-[var(--bg-base)] py-[100px] transition-colors duration-300"
      >
        <div className="mx-auto max-w-[1200px] px-6">
          <div
            className={`text-center ${testVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
          >
            <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[38px] font-extrabold text-[var(--text-primary)]">
              Trusted by job seekers everywhere.
            </h2>
            <p className="mt-3 text-lg text-[var(--text-secondary)]">
              Real people. Real results. No fluff.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <blockquote
                key={t.name}
                className={`home-stagger-item rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-7 transition-all duration-200 hover:-translate-y-[3px] hover:border-[var(--border-hover)] ${
                  testVisible ? "is-visible" : ""
                }`}
                style={{ animationDelay: testVisible ? `${i * 80}ms` : "0ms" }}
              >
                <p className="text-[14px] text-[#f59e0b]" aria-hidden>
                  ★★★★★
                </p>
                <p className="mt-3 text-[15px] italic leading-[1.7] text-[var(--text-primary)]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="mt-4 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: t.gradient }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <cite className="not-italic text-[14px] font-semibold text-[var(--text-primary)]">
                      {t.name}
                    </cite>
                    <p className="text-[13px] text-[var(--text-muted)]">
                      {t.role}
                    </p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        ref={ctaRef}
        className="relative overflow-hidden py-[100px] text-white transition-colors duration-300"
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div
          className={`relative z-[1] mx-auto max-w-[1200px] px-6 text-center ${ctaVisible ? "home-section-reveal is-visible" : "home-section-reveal opacity-0"}`}
        >
          <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold leading-tight text-white">
            Stop Guessing. Start Getting Hired.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[rgba(255,255,255,0.8)]">
            Join thousands of job seekers who landed their dream roles with
            Applyfy.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/my-application"
              className="inline-flex rounded-xl bg-white px-9 py-[14px] text-base font-bold transition-all duration-200 hover:bg-[rgba(255,255,255,0.9)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
              style={{ color: "var(--brand)" }}
            >
              Get Started Free →
            </Link>
            <a
              href="#demo"
              className="inline-flex rounded-xl border-2 border-[rgba(255,255,255,0.4)] px-9 py-[14px] text-base font-bold text-white transition-all duration-200 hover:border-white hover:bg-[rgba(255,255,255,0.1)]"
            >
              Watch Demo
            </a>
          </div>
          <p className="mt-8 text-[13px] text-[rgba(255,255,255,0.6)]">
            No credit card required · 3 Free Trials · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] pb-10 pt-16 transition-colors duration-300">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-[family-name:var(--font-plus-jakarta)] text-xl font-extrabold">
                <span className="text-[var(--text-primary)]">Apply</span>
                <span className="text-[var(--brand-2)]">fy</span>
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                Transform your job search with AI-powered tools and land your
                dream career.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  aria-label="X / Twitter"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              </div>
              <div className="mt-8 border-t border-[var(--border)] pt-6">
                <p className="text-[13px] font-semibold uppercase tracking-widest text-[var(--text-primary)]">
                  Language
                </p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                  More locales coming soon.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {footerLanguages.map(({ flag, label }) => (
                    <button
                      key={label}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                      aria-label={label}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {flag}
                      </span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[var(--text-primary)]">
                Product
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  ["Features", "/features"],
                  ["Pricing", "/pricing"],
                  ["FAQ", "/faq"],
                  ["Roadmap", "/roadmap"],
                ].map(([l, h]) => (
                  <li key={l}>
                    <Link
                      href={h}
                      className="text-[14px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[var(--text-primary)]">
                Company
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  ["About Us", "/about"],
                  ["Contact", "/contact"],
                ].map(([l, h]) => (
                  <li key={l}>
                    <Link
                      href={h}
                      className="text-[14px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-[var(--text-primary)]">
                Legal
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  ["Privacy Policy", "/privacy"],
                  ["Terms of Service", "/terms"],
                ].map(([l, h]) => (
                  <li key={l}>
                    <Link
                      href={h}
                      className="text-[14px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-[13px] text-[var(--text-muted)] sm:flex-row">
            <p>© {new Date().getFullYear()} Applyfy. All rights reserved.</p>
            <p>Made with ♥ for job seekers</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
