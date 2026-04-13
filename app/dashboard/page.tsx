"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import {
  loadTrackerApplications,
  type TrackerApplication,
  type TrackerStatus,
} from "@/lib/trackerStorage";

// ── helpers ───────────────────────────────────────────────────────────────────

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmt(ymd: string) {
  try {
    return new Date(ymd + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}

function atsColor(score: number) {
  if (score >= 75) {
    return {
      text: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/55 dark:ring-emerald-500/35",
    };
  }
  if (score >= 50) {
    return {
      text: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-500/35",
    };
  }
  return {
    text: "text-red-600 dark:text-red-300",
    bg: "bg-red-50 ring-red-200 dark:bg-red-950/50 dark:ring-red-500/35",
  };
}

const STATUS_PILL: Record<TrackerStatus, string> = {
  Saved:
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/55 dark:text-violet-200 dark:ring-violet-500/35",
  Applied:
    "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-500/35",
  Interview:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-500/35",
  Offer:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-500/35",
  Rejected:
    "bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-500/35",
};

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  icon,
  gradient,
  delay = 0,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm transition-all duration-300 hover:-translate-y-[2px] hover:shadow-md"
      style={{
        animation: `home-reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
        opacity: 0,
      }}
    >
      {/* Background accent blob */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{ background: gradient }}
        aria-hidden
      />
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <p className="mt-4 text-[28px] font-extrabold leading-none text-[var(--text-primary)]">
        {value}
      </p>
      <p className="mt-1 text-[13px] font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function AppRow({ app }: { app: TrackerApplication }) {
  const ats = atsColor(app.matchScore);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-all duration-150 hover:border-[#c4b5fd]/80 hover:bg-[#faf8ff] dark:hover:border-violet-500/30 dark:hover:bg-[#1c2034]">
      {/* Company initial */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
        }}
      >
        {(app.company || "?")[0]?.toUpperCase()}
      </div>

      {/* Job info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
          {app.jobTitle || "Untitled role"}
        </p>
        <p className="truncate text-[12px] text-[var(--text-muted)]">
          {app.company} · {fmt(app.date)}
        </p>
      </div>

      {/* Status + ATS score */}
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 sm:inline-flex ${STATUS_PILL[app.status]}`}
        >
          {app.status}
        </span>
        {app.matchScore > 0 ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${ats.bg} ${ats.text}`}
          >
            {Math.round(app.matchScore)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── icons ─────────────────────────────────────────────────────────────────────

function IconAnalyze() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function IconScore() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconLetter() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

// ── quick-link item ───────────────────────────────────────────────────────────

function QuickLink({
  href,
  label,
  sublabel,
  icon,
  accent,
}: {
  href: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 transition-all duration-150 hover:border-[#c4b5fd]/80 hover:shadow-sm dark:hover:border-violet-500/25 dark:hover:bg-[#1c2034]"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</p>
        {sublabel ? <p className="text-[11px] text-[var(--text-muted)]">{sublabel}</p> : null}
      </div>
      <IconArrow />
    </Link>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { tier } = useSubscription();
  const [apps, setApps] = useState<TrackerApplication[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setApps(loadTrackerApplications());
  }, []);

  const firstName = user?.firstName ?? user?.username ?? "there";
  const analysisScanCount =
    typeof user?.publicMetadata?.analysisScanCount === "number"
      ? (user.publicMetadata.analysisScanCount as number)
      : apps.length;

  const avgAts =
    apps.length > 0
      ? Math.round(apps.reduce((sum, a) => sum + (a.matchScore ?? 0), 0) / apps.length)
      : 0;

  const coverCount = apps.filter((a) => a.coverLetter && a.coverLetter.length > 20).length;

  const recentApps = apps.slice(0, 3);

  const tierLabel =
    tier === "premium" ? "Premium" : tier === "pro" ? "Pro" : "Free";
  const tierColors: Record<string, string> = {
    premium:
      "bg-amber-400/25 text-amber-50 ring-amber-200/50 backdrop-blur-sm dark:bg-amber-500/20 dark:text-amber-50 dark:ring-amber-300/40",
    pro: "bg-white/18 text-white ring-white/35 backdrop-blur-sm dark:bg-violet-400/15 dark:text-violet-50 dark:ring-violet-200/35",
    free: "bg-white/12 text-white/95 ring-white/25 backdrop-blur-sm dark:bg-slate-400/15 dark:text-slate-100 dark:ring-slate-300/30",
  };

  if (!isLoaded || !mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-4 py-8 transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Welcome banner ── */}
        <div
          className="relative overflow-hidden rounded-2xl p-7 text-white shadow-lg"
          style={{
            background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 45%, #a78bfa 100%)",
          }}
        >
          {/* Dot-grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            aria-hidden
          />
          {/* Glow blob */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
            aria-hidden
          />

          <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-white/70">{todayLabel()}</p>
              <h1 className="mt-1 font-[family-name:var(--font-plus-jakarta)] text-[28px] font-extrabold leading-tight sm:text-[34px]">
                Welcome back, {firstName}! 👋
              </h1>
              <p className="mt-1.5 text-[14px] text-white/80">
                Your job search command center — all in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-bold ring-1 ${tierColors[tier]}`}
              >
                {tierLabel} plan
              </span>
              {tier === "free" ? (
                <Link
                  href="/pricing"
                  className="rounded-full bg-white/20 px-3.5 py-1 text-[12px] font-bold text-white ring-1 ring-white/30 transition hover:bg-white/30"
                >
                  Upgrade ↑
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            value={analysisScanCount}
            label="Analyses run"
            gradient="linear-gradient(135deg, #7c3aed, #a78bfa)"
            icon={<IconAnalyze />}
            delay={60}
          />
          <StatCard
            value={avgAts > 0 ? `${avgAts}%` : "—"}
            label="Avg ATS score"
            gradient="linear-gradient(135deg, #3b82f6, #6366f1)"
            icon={<IconScore />}
            delay={120}
          />
          <StatCard
            value={coverCount}
            label="Cover letters"
            gradient="linear-gradient(135deg, #059669, #34d399)"
            icon={<IconLetter />}
            delay={180}
          />
        </div>

        {/* ── Main layout: 2/3 + 1/3 ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ── Left: CTA + Recent apps ── */}
          <div className="flex flex-col gap-6 lg:col-span-2">

            {/* New application CTA */}
            <div
              className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-[#f5f3ff] via-[#ede9fe] to-[#ddd6fe] p-6 shadow-sm dark:border-violet-500/20 dark:from-[#1a1530] dark:via-[#1e1a35] dark:to-[#231d42]"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#7c3aed]/10 blur-3xl dark:bg-violet-500/20"
                aria-hidden
              />
              <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed] text-white shadow-sm dark:bg-violet-500 dark:shadow-violet-900/40">
                      <IconSparkle />
                    </span>
                    <h2 className="font-[family-name:var(--font-plus-jakarta)] text-[18px] font-extrabold text-[#3b0764] dark:text-violet-100">
                      Start a New Application
                    </h2>
                  </div>
                  <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#5b21b6] dark:text-violet-200/85">
                    Upload your resume + paste a job posting. Get your match score, gaps, cover letter, and interview prep in under 2 minutes.
                  </p>
                </div>
                <Link
                  href="/my-application"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(124,58,237,0.5)]"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" }}
                >
                  Get started
                  <IconArrow />
                </Link>
              </div>
            </div>

            {/* Recent applications */}
            <div
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm"
              style={{
                animation: "home-reveal 0.55s cubic-bezier(0.16,1,0.3,1) 240ms forwards",
                opacity: 0,
              }}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-[15px] font-bold text-[var(--text-primary)]">
                  Recent Applications
                </h2>
                {apps.length > 0 ? (
                  <Link
                    href="/tracker"
                    className="text-[13px] font-semibold text-[#7c3aed] transition hover:underline"
                  >
                    View all →
                  </Link>
                ) : null}
              </div>

              <div className="p-4">
                {recentApps.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f3ff] dark:bg-violet-950/60 dark:ring-1 dark:ring-violet-500/25">
                      <svg className="h-7 w-7 text-[#a78bfa] dark:text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="mt-3 text-[14px] font-semibold text-[var(--text-primary)]">
                      No applications yet
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                      Start your first one and it&apos;ll show up here.
                    </p>
                    <Link
                      href="/my-application"
                      className="mt-4 inline-flex rounded-xl border border-[#c4b5fd] bg-[#faf8ff] px-5 py-2 text-[13px] font-semibold text-[#6d28d9] transition hover:bg-[#7c3aed] hover:text-white dark:border-violet-500/35 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-600 dark:hover:text-white"
                    >
                      Start first application →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentApps.map((app) => (
                      <AppRow key={app.id} app={app} />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Right: Sidebar ── */}
          <div className="flex flex-col gap-5">

            {/* Quick links */}
            <div
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm"
              style={{
                animation: "home-reveal 0.55s cubic-bezier(0.16,1,0.3,1) 300ms forwards",
                opacity: 0,
              }}
            >
              <h3 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Quick Links
              </h3>
              <div className="space-y-2.5">
                <QuickLink
                  href="/my-application"
                  label="My Application"
                  sublabel="Resume · Cover letter · Prep"
                  accent="linear-gradient(135deg,#7c3aed,#a78bfa)"
                  icon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/tracker"
                  label="Application Tracker"
                  sublabel={apps.length > 0 ? `${apps.length} saved` : "Track your pipeline"}
                  accent="linear-gradient(135deg,#3b82f6,#6366f1)"
                  icon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  }
                />
                <QuickLink
                  href="/pricing"
                  label="Plans & Pricing"
                  sublabel="Compare Free, Pro, Premium"
                  accent="linear-gradient(135deg,#f59e0b,#fbbf24)"
                  icon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
              </div>
            </div>

            {/* Upgrade nudge — only for free tier */}
            {tier === "free" ? (
              <div
                className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-[#fdf8f0] to-[#fef3e2] p-5 dark:border-amber-500/25 dark:from-[#2a2015] dark:to-[#1f1810]"
                style={{
                  animation: "home-reveal 0.55s cubic-bezier(0.16,1,0.3,1) 360ms forwards",
                  opacity: 0,
                }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl dark:bg-amber-500/15"
                  aria-hidden
                />
                <div className="relative">
                  <span className="text-lg text-amber-700 dark:text-amber-300" aria-hidden>✦</span>
                  <h4 className="mt-1 text-[14px] font-bold text-[#92400e] dark:text-amber-100">
                    Unlock the full suite
                  </h4>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#b45309] dark:text-amber-200/90">
                    Resume Editor, Cover Letters, Interview Simulator, Salary Coach, and unlimited analyses — starting at $12/mo.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f59e0b] py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(245,158,11,0.4)] transition-all duration-200 hover:bg-[#d97706]"
                  >
                    See Pro plans →
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Tips card */}
            <div
              className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm"
              style={{
                animation: "home-reveal 0.55s cubic-bezier(0.16,1,0.3,1) 420ms forwards",
                opacity: 0,
              }}
            >
              <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Pro Tips
              </h3>
              <ul className="space-y-2.5">
                {[
                  "Target an ATS score above 70% before applying.",
                  "Customize your cover letter tone per company culture.",
                  "Run 3+ practice answers before any real interview.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-[12px] leading-snug text-[var(--text-secondary)]">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-[#7c3aed] dark:bg-violet-500/25 dark:text-violet-200" aria-hidden>
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
