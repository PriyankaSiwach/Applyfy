"use client";

import confetti from "canvas-confetti";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { StoredInterviewPrepView } from "@/components/tracker/StoredInterviewPrepView";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { sanitizeCompany, sanitizeJobTitle } from "@/lib/jobMetaFromPosting";
import {
  deleteTrackerApplication,
  loadTrackerApplications,
  type TrackerApplication,
  type TrackerStatus,
  updateTrackerApplication,
} from "@/lib/trackerStorage";

const STATUS_OPTIONS: TrackerStatus[] = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

const STATUS_STRIPE: Record<TrackerStatus, string> = {
  Saved: "bg-[#7c3aed]",
  Applied: "bg-blue-500",
  Interview: "bg-amber-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-red-400",
};

const STATUS_PILL: Record<TrackerStatus, string> = {
  Saved: "bg-violet-50 text-violet-800 ring-violet-200",
  Applied: "bg-blue-50 text-blue-800 ring-blue-200",
  Interview: "bg-amber-50 text-amber-800 ring-amber-200",
  Offer: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Rejected: "bg-red-50 text-red-600 ring-red-200",
};

function formatDate(ymd: string) {
  try {
    return new Date(ymd + "T12:00:00").toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return ymd;
  }
}

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysSince(ymd: string): number {
  const d = new Date(ymd + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function interviewUrgency(date: string | null): "today" | "tomorrow" | null {
  if (!date) return null;
  const t = new Date(date + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  t.setHours(0, 0, 0, 0);
  const diff = (t.getTime() - today.getTime()) / 86400000;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return null;
}

function mailtoFollowUp(jobTitle: string, company: string, appliedDate: string, reminderDate: string) {
  const subject = `Follow up — ${jobTitle} at ${company}`;
  const body = `Hi,\n\nI wanted to follow up on my application for ${jobTitle} submitted on ${formatDate(appliedDate)}. I remain very interested and would welcome the chance to discuss how I can contribute.\n\nI plan to check in again around ${formatDate(reminderDate)}.\n\nThank you for your time.`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function isBadMeta(value: string, field: "company" | "role"): boolean {
  const placeholder = field === "company" ? "Company" : "Role";
  if (!value || value === placeholder) return true;
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length > (field === "company" ? 5 : 10)) return true;
  if (value.length > 120) return true;
  if (/[.!?]/.test(value) && words.length > 4) return true;
  if (/^(we are|we're|our |the team|join us|looking for|seeking|about the role|you will)/i.test(value)) return true;
  return false;
}

function cleanCompany(app: TrackerApplication): string {
  return isBadMeta(app.company, "company") ? "" : (sanitizeCompany(app.company) || "");
}

function cleanRole(app: TrackerApplication): string {
  return isBadMeta(app.jobTitle, "role") ? "" : (sanitizeJobTitle(app.jobTitle) || "");
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : score >= 50
        ? "bg-blue-50 text-blue-800 ring-blue-200"
        : "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold ring-1 tabular-nums ${cls}`}>
      {score}%
    </span>
  );
}

function StatusPill({ status }: { status: TrackerStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_PILL[status]}`}>
      {status}
    </span>
  );
}

export default function TrackerPage() {
  const { isPro, isFree, mounted: subMounted } = useSubscription();
  const [apps, setApps] = useState<TrackerApplication[]>([]);

  // Modals
  const [viewApp, setViewApp] = useState<TrackerApplication | null>(null);
  const [editApp, setEditApp] = useState<TrackerApplication | null>(null);
  const [reminderApp, setReminderApp] = useState<TrackerApplication | null>(null);
  const [reminderDate, setReminderDate] = useState("");

  // Edit modal fields
  const [editCompany, setEditCompany] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState<TrackerStatus>("Saved");
  const [editDateApplied, setEditDateApplied] = useState("");
  const [editInterviewDate, setEditInterviewDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Search / filter / sort
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TrackerStatus | "All">("All");
  const [sortField, setSortField] = useState<"date" | "matchScore">("date");

  const refresh = useCallback(() => setApps(loadTrackerApplications()), []);

  useEffect(() => { refresh(); }, [refresh]);

  const appsForStats = useMemo(() => {
    if (!subMounted || !isFree) return apps;
    const sorted = [...apps].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, 3);
  }, [apps, subMounted, isFree]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    saved: appsForStats.filter((a) => a.status === "Saved").length,
    applied: appsForStats.filter((a) => a.status === "Applied").length,
    interviews: appsForStats.filter((a) => a.status === "Interview").length,
    offers: appsForStats.filter((a) => a.status === "Offer").length,
    avg: appsForStats.length
      ? Math.round(
          appsForStats.reduce((s, a) => s + a.matchScore, 0) /
            appsForStats.length,
        )
      : 0,
  }), [appsForStats]);

  // ── Next actions ──────────────────────────────────────────────────────────
  const nextActions = useMemo<string[]>(() => {
    const items: string[] = [];
    const pool = subMounted && isFree ? appsForStats : apps;

    const saved = pool.filter((a) => a.status === "Saved");
    if (saved.length) {
      items.push(`${saved.length} saved job${saved.length > 1 ? "s" : ""} not yet applied — mark as Applied when ready`);
    }

    const followUp = pool.filter(
      (a) => a.status === "Applied" && daysSince(a.dateApplied ?? a.date) >= 7,
    );
    for (const a of followUp.slice(0, 2)) {
      const d = daysSince(a.dateApplied ?? a.date);
      items.push(`Follow up on ${cleanRole(a) || "role"} at ${cleanCompany(a) || "company"} — ${d} day${d !== 1 ? "s" : ""} since applied`);
    }

    for (const a of pool.filter((x) => x.status === "Interview")) {
      const u = interviewUrgency(a.interviewDate);
      if (u) items.push(`Interview ${u}: ${cleanRole(a) || "role"} at ${cleanCompany(a) || "company"}`);
    }

    const missing = pool.filter(
      (a) => isBadMeta(a.company, "company") || isBadMeta(a.jobTitle, "role"),
    );
    if (missing.length) {
      items.push(`${missing.length} application${missing.length > 1 ? "s are" : " is"} missing company or role — click Edit to fix`);
    }

    return items.slice(0, 4);
  }, [apps, appsForStats, isFree, subMounted]);

  // ── Duplicate detection: track which company+role keys appear >1 time ───────
  const duplicateKeys = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of apps) {
      const co = cleanCompany(a).toLowerCase().trim();
      const ro = cleanRole(a).toLowerCase().trim();
      if (!co || !ro) continue;
      const k = `${co}||${ro}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([k]) => k));
  }, [apps]);

  function isDuplicate(app: TrackerApplication): boolean {
    const co = cleanCompany(app).toLowerCase().trim();
    const ro = cleanRole(app).toLowerCase().trim();
    if (!co || !ro) return false;
    return duplicateKeys.has(`${co}||${ro}`);
  }

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...apps];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const co = cleanCompany(a).toLowerCase();
        const ro = cleanRole(a).toLowerCase();
        return co.includes(q) || ro.includes(q);
      });
    }
    if (filterStatus !== "All") list = list.filter((a) => a.status === filterStatus);
    list.sort((a, b) => {
      if (sortField === "matchScore") return b.matchScore - a.matchScore;
      return b.date.localeCompare(a.date);
    });
    return list;
  }, [apps, searchQuery, filterStatus, sortField]);

  const visibleApps = useMemo(
    () => (subMounted && isFree ? filtered.slice(0, 3) : filtered),
    [subMounted, isFree, filtered],
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  function patch(id: string, p: Partial<Omit<TrackerApplication, "id">>) {
    updateTrackerApplication(id, p);
    refresh();
  }

  function openEdit(app: TrackerApplication) {
    if (!isPro) return;
    setEditApp(app);
    setEditCompany(isBadMeta(app.company, "company") ? "" : (sanitizeCompany(app.company) || ""));
    setEditRole(isBadMeta(app.jobTitle, "role") ? "" : (sanitizeJobTitle(app.jobTitle) || ""));
    setEditStatus(app.status);
    setEditDateApplied(app.dateApplied ?? "");
    setEditInterviewDate(app.interviewDate ?? "");
    setEditNotes(app.notes ?? "");
    setEditError(null);
  }

  function saveEdit() {
    if (!editApp) return;
    const c = editCompany.trim();
    const r = editRole.trim();
    if (!c) { setEditError("Company name is required."); return; }
    if (!r) { setEditError("Job title is required."); return; }
    const becameApplied =
      editStatus === "Applied" && editApp.status !== "Applied";
    patch(editApp.id, {
      company: c,
      jobTitle: r,
      status: editStatus,
      dateApplied: editDateApplied.trim() || null,
      interviewDate: editStatus === "Interview" ? (editInterviewDate.trim() || null) : null,
      notes: editNotes.trim(),
    });
    setEditApp(null);
    if (becameApplied && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        void confetti({
          particleCount: 120,
          spread: 72,
          origin: { y: 0.72 },
          colors: ["#7c3aed", "#a78bfa", "#3b82f6", "#10b981", "#fbbf24"],
        });
      });
    }
  }

  function openReminder(app: TrackerApplication) {
    setReminderApp(app);
    setReminderDate(addDays(app.dateApplied ?? app.date, 14));
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-6xl">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Application tracker
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Saved from My application · {apps.length} total
          {subMounted && isFree && apps.length > 3 ? (
            <span className="ml-1 text-amber-700">
              (Free plan shows your latest 3 — upgrade to Pro for the full list)
            </span>
          ) : null}
        </p>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { label: "Saved", value: stats.saved, bar: "border-l-[#7c3aed]" },
              { label: "Applied", value: stats.applied, bar: "border-l-blue-500" },
              { label: "Interviews", value: stats.interviews, bar: "border-l-amber-500" },
              { label: "Offers", value: stats.offers, bar: "border-l-emerald-500" },
            ] as const
          ).map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border border-slate-200/90 border-l-4 ${s.bar} bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Next actions ──────────────────────────────────────────────── */}
        {subMounted && isPro && nextActions.length > 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
              Next actions
            </p>
            <ul className="space-y-1.5">
              {nextActions.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ── Controls ──────────────────────────────────────────────────── */}
        {apps.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[180px] flex-1 max-w-xs">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search company or role…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TrackerStatus | "All")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#4F8EF7]"
            >
              <option value="All">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as "date" | "matchScore")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#4F8EF7]"
            >
              <option value="date">Sort: Date saved</option>
            </select>

            {(searchQuery || filterStatus !== "All") ? (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setFilterStatus("All"); }}
                className="text-xs font-semibold text-[#4F8EF7] underline-offset-2 hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {/* ── Cards ─────────────────────────────────────────────────────── */}
        {apps.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <p className="text-base font-semibold text-slate-400">No saved applications yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Complete a flow through Interview prep in My application to add one.
            </p>
          </div>
        ) : visibleApps.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-100 bg-white py-12 text-center">
            <p className="text-sm text-slate-400">No applications match your search or filter.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setFilterStatus("All"); }}
              className="mt-3 text-xs font-semibold text-[#4F8EF7] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleApps.map((app) => {
              const company = cleanCompany(app);
              const role = cleanRole(app);
              const urgent = interviewUrgency(app.interviewDate);
              const dup = isDuplicate(app);
              return (
                <div
                  key={app.id}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${dup ? "border-amber-300" : "border-slate-200"}`}
                >
                  {/* Coloured status stripe */}
                  <div className={`h-1 shrink-0 ${STATUS_STRIPE[app.status]}`} />

                  {/* Card body */}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    {/* Duplicate warning */}
                    {dup ? (
                      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        Duplicate entry — same role saved more than once. Scores may differ. Delete the older one to keep things clean.
                      </div>
                    ) : null}

                    {/* Company + role */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {company || <span className="italic text-slate-400">Unknown company</span>}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {role || <span className="italic text-slate-400">Unknown role</span>}
                        </p>
                      </div>
                    </div>

                    {/* Status + date row */}
                    <div className="flex items-center justify-between">
                      <StatusPill status={app.status} />
                      <span className="text-xs text-slate-400">
                        {formatDate(app.date)}
                      </span>
                    </div>

                    {/* Interview urgency banner */}
                    {urgent ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        Interview {urgent}
                        {app.interviewDate ? ` · ${formatDate(app.interviewDate)}` : ""}
                      </div>
                    ) : null}

                    {/* Notes preview */}
                    {app.notes ? (
                      <p className="line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                        {app.notes}
                      </p>
                    ) : null}
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setViewApp(app)}
                      className="rounded-lg bg-[#2E3E65] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3D5080]"
                    >
                      View
                    </button>
                    {subMounted && isPro ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(app)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteTrackerApplication(app.id);
                            refresh();
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          Delete
                        </button>
                        {app.status === "Applied" ? (
                          <button
                            type="button"
                            onClick={() => openReminder(app)}
                            className="ml-auto text-[11px] font-semibold text-[#4F8EF7] hover:underline"
                          >
                            Remind →
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(searchQuery || filterStatus !== "All") && visibleApps.length > 0 ? (
          <p className="mt-3 text-xs text-slate-400">
            Showing {visibleApps.length} of {filtered.length} matching
            {isFree && filtered.length > visibleApps.length
              ? " (Free plan shows up to 3)"
              : ""}
          </p>
        ) : null}
      </div>

      {/* ── View modal ────────────────────────────────────────────────────── */}
      {viewApp ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setViewApp(null)}
        >
          <div
            role="dialog" aria-modal
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-1.5 ${STATUS_STRIPE[viewApp.status]}`} />
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {cleanRole(viewApp) || "Role"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {cleanCompany(viewApp) || "Company"} · <StatusPill status={viewApp.status} />
                </p>
              </div>
              <button
                type="button" onClick={() => setViewApp(null)}
                className="mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[calc(90vh-100px)] space-y-5 overflow-y-auto px-6 pb-6">
              {/* Meta */}
              <div className="flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Saved</span>
                  <p className="text-slate-700">{formatDate(viewApp.date)}</p>
                </div>
                {viewApp.dateApplied ? (
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-slate-400">Applied</span>
                    <p className="text-slate-700">{formatDate(viewApp.dateApplied)}</p>
                  </div>
                ) : null}
                {viewApp.interviewDate ? (
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-slate-400">Interview</span>
                    <p className="text-slate-700">{formatDate(viewApp.interviewDate)}</p>
                  </div>
                ) : null}
              </div>

              {/* Notes */}
              {viewApp.notes ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">Notes</p>
                  <p className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {viewApp.notes}
                  </p>
                </div>
              ) : null}

              {/* Analysis snapshot */}
              {viewApp.analysisSnapshot?.matchExplanation?.length ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase text-slate-400">Analysis</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {viewApp.analysisSnapshot.matchExplanation.slice(0, 3).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Cover letter */}
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">Cover letter</p>
                <p className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {viewApp.coverLetter}
                </p>
              </div>

              {/* Interview prep */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase text-slate-400">Interview prep</p>
                <StoredInterviewPrepView prep={viewApp.interviewPrep} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editApp ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setEditApp(null)}
        >
          <div
            role="dialog" aria-modal
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Edit application</h2>
              <button
                type="button" onClick={() => setEditApp(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >✕</button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600">Company name</label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => { setEditCompany(e.target.value); setEditError(null); }}
                  placeholder="e.g. Google, Stripe"
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600">Job title</label>
                <input
                  type="text"
                  value={editRole}
                  onChange={(e) => { setEditRole(e.target.value); setEditError(null); }}
                  placeholder="e.g. Software Engineer"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TrackerStatus)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4F8EF7]"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600">Date applied</label>
                  <input
                    type="date"
                    value={editDateApplied}
                    onChange={(e) => setEditDateApplied(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4F8EF7]"
                  />
                </div>
              </div>

              {editStatus === "Interview" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600">Interview date</label>
                  <input
                    type="date"
                    value={editInterviewDate}
                    onChange={(e) => setEditInterviewDate(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4F8EF7]"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-600">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Recruiter contact, next steps, anything useful…"
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/20"
                />
              </div>

              {editError ? (
                <p className="text-sm text-red-600">{editError}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button" onClick={() => setEditApp(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button" onClick={saveEdit}
                className="rounded-lg bg-[#2E3E65] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3D5080]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Interview prep modal ──────────────────────────────────────────── */}
      {/* (opened from View → interview row; kept for legacy Interview card shortcut) */}

      {/* ── Reminder modal ────────────────────────────────────────────────── */}
      {reminderApp ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setReminderApp(null)}
        >
          <div
            role="dialog" aria-modal
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900">Set follow-up reminder</h2>
            <p className="mt-1 text-sm text-slate-500">
              We'll open a pre-filled follow-up email draft for you.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-600">
              Reminder date
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4F8EF7]"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button" onClick={() => setReminderApp(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <a
                href={mailtoFollowUp(
                  cleanRole(reminderApp) || "Role",
                  cleanCompany(reminderApp) || "Company",
                  reminderApp.dateApplied ?? reminderApp.date,
                  reminderDate,
                )}
                className="inline-flex items-center rounded-lg bg-[#2E3E65] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3D5080]"
              >
                Open email draft
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
