"use client";

import Link from "next/link";
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
  "Rejected",
  "Offer",
];

function formatDisplayDate(ymd: string) {
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

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysSinceYmd(ymd: string): number {
  const d = new Date(ymd + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function interviewUrgency(
  interviewDate: string | null,
): "today" | "tomorrow" | null {
  if (!interviewDate) return null;
  const target = new Date(interviewDate + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t0 = new Date(target);
  t0.setHours(0, 0, 0, 0);
  const diff = (t0.getTime() - today.getTime()) / 86400000;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return null;
}

function mailtoFollowUp(params: {
  jobTitle: string;
  company: string;
  appliedDateYmd: string;
  reminderDateYmd: string;
}) {
  const subject = `Follow up — ${params.jobTitle} at ${params.company}`;
  const body = `Hi,

I wanted to follow up on my application for ${params.jobTitle} submitted on ${formatDisplayDate(params.appliedDateYmd)}. I remain very interested in this opportunity and would welcome the chance to discuss how I can contribute.

I plan to check in again around ${formatDisplayDate(params.reminderDateYmd)}.

Thank you for your time.`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function TrackerPage() {
  const { isPro, mounted: subMounted } = useSubscription();
  const [apps, setApps] = useState<TrackerApplication[]>([]);
  const [viewApp, setViewApp] = useState<TrackerApplication | null>(null);
  const [prepApp, setPrepApp] = useState<TrackerApplication | null>(null);
  const [reminderApp, setReminderApp] = useState<TrackerApplication | null>(null);
  const [reminderDate, setReminderDate] = useState("");

  const refresh = useCallback(() => {
    setApps(loadTrackerApplications());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const totalApplied = apps.filter((a) => a.status === "Applied").length;
    const interviews = apps.filter((a) => a.status === "Interview").length;
    const offers = apps.filter((a) => a.status === "Offer").length;
    const avg =
      apps.length === 0
        ? 0
        : Math.round(
            apps.reduce((s, a) => s + a.matchScore, 0) / apps.length,
          );
    return { totalApplied, interviews, offers, avg };
  }, [apps]);

  const aiNudges = useMemo(() => {
    const lines: string[] = [];
    for (const a of apps) {
      const title = sanitizeJobTitle(a.jobTitle) || "Role";
      const company = sanitizeCompany(a.company) || "Company";
      if (a.status === "Applied") {
        const days = daysSinceYmd(a.date);
        if (days >= 7) {
          lines.push(
            `Follow-up window: ${title} at ${company} — it’s been ${days} days since you applied.`,
          );
        } else if (days >= 3 && days < 7) {
          lines.push(
            `Soon: consider a short check-in for ${title} at ${company} (${days} days since applied).`,
          );
        }
      }
      if (a.status === "Interview") {
        const u = interviewUrgency(a.interviewDate);
        if (u) {
          lines.push(
            `Interview ${u}: ${title} — prep notes and questions are saved on this card.`,
          );
        }
      }
      if (a.status === "Saved") {
        lines.push(
          `Finish strong: ${title} at ${company} is still marked Saved — submit when ready.`,
        );
      }
    }
    return lines.slice(0, 5);
  }, [apps]);

  function patchApp(id: string, patch: Partial<Omit<TrackerApplication, "id">>) {
    updateTrackerApplication(id, patch);
    refresh();
  }

  function handleStatusChange(id: string, status: TrackerStatus) {
    const patch: Partial<Omit<TrackerApplication, "id">> = { status };
    if (status !== "Interview") {
      patch.interviewDate = null;
    }
    patchApp(id, patch);
  }

  function openReminder(app: TrackerApplication) {
    setReminderApp(app);
    setReminderDate(addDaysYmd(app.date, 14));
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Application tracker
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Saved automatically when you reach Interview prep in My application.
        </p>

        {subMounted && isPro && aiNudges.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-[#c7d2fe] bg-gradient-to-r from-[#eef2ff] to-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#312e81]">
                  AI nudges
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Smart reminders based on where each application is in your
                  pipeline.
                </p>
              </div>
              <Link
                href="/pricing"
                className="shrink-0 text-xs font-semibold text-[#4f46e5] underline-offset-2 hover:underline"
              >
                Pro
              </Link>
            </div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {aiNudges.map((line, i) => (
                <li key={`nudge-${i}-${line.slice(0, 24)}`}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total applied
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2E3E65]">
              {stats.totalApplied}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Interviews
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2E3E65]">
              {stats.interviews}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Offers
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2E3E65]">{stats.offers}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Avg match score
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2E3E65]">
              {apps.length ? `${stats.avg}%` : "—"}
            </p>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-900">Company</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Role</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Match %</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No saved applications yet. Complete a flow through Interview
                    prep in My application to add one.
                  </td>
                </tr>
              ) : (
                apps.map((app) => {
                  const company = sanitizeCompany(app.company) || "Company";
                  const role = sanitizeJobTitle(app.jobTitle) || "Role";
                  const urgent = interviewUrgency(app.interviewDate);
                  return (
                    <Fragment key={app.id}>
                      <tr className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 align-top font-medium text-slate-900">
                          <div className="flex flex-wrap items-center gap-2">
                            {company}
                            {urgent ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800">
                                {urgent === "today"
                                  ? "Interview today!"
                                  : "Interview tomorrow!"}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-slate-700">
                          {role}
                        </td>
                        <td className="px-4 py-3 align-top text-slate-600">
                          {formatDisplayDate(app.date)}
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums text-slate-800">
                          {app.matchScore}%
                        </td>
                        <td className="px-4 py-3 align-top">
                          <select
                            value={app.status}
                            onChange={(e) =>
                              handleStatusChange(
                                app.id,
                                e.target.value as TrackerStatus,
                              )
                            }
                            className="max-w-[140px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#4F8EF7] focus:ring-2 focus:ring-[#4F8EF7]/25"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {app.status === "Interview" ? (
                            <div className="mt-2">
                              <label className="block text-[10px] font-semibold uppercase text-slate-500">
                                Interview date
                              </label>
                              <input
                                type="date"
                                value={app.interviewDate ?? ""}
                                onChange={(e) =>
                                  patchApp(app.id, {
                                    interviewDate: e.target.value || null,
                                  })
                                }
                                className="mt-1 w-full min-w-[130px] rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#4F8EF7]"
                              />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setViewApp(app)}
                                className="rounded-lg bg-[#2E3E65] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3D5080]"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteTrackerApplication(app.id);
                                  refresh();
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                Delete
                              </button>
                            </div>
                            {app.status === "Applied" ? (
                              <button
                                type="button"
                                onClick={() => openReminder(app)}
                                className="text-left text-xs font-semibold text-[#4F8EF7] hover:underline"
                              >
                                Set reminder
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {app.status === "Interview" ? (
                        <tr className="bg-[#4F8EF7]/10">
                          <td colSpan={6} className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setPrepApp(app)}
                              className="w-full rounded-lg border border-[#4F8EF7]/40 bg-white px-4 py-2 text-left text-sm font-semibold text-[#2E3E65] shadow-sm transition-colors hover:bg-[#4F8EF7]/5"
                            >
                              Interview scheduled? View your prep →
                            </button>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewApp ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setViewApp(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-lg font-bold text-slate-900">
                {sanitizeJobTitle(viewApp.jobTitle) || "Role"} —{" "}
                {sanitizeCompany(viewApp.company) || "Company"}
              </h2>
              <button
                type="button"
                onClick={() => setViewApp(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[calc(90vh-52px)] space-y-4 overflow-y-auto p-5">
              {viewApp.analysisSnapshot ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                    Analysis snapshot
                  </h3>
                  {viewApp.analysisSnapshot.matchExplanation.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {viewApp.analysisSnapshot.matchExplanation
                        .slice(0, 3)
                        .map((line, i) => (
                          <li key={`mx-${i}`}>{line}</li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No analysis snapshot saved for this entry.
                    </p>
                  )}
                </div>
              ) : null}
              <div>
                <h3 className="mb-1 text-xs font-bold uppercase text-slate-500">
                  Cover letter
                </h3>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  {viewApp.coverLetter}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                  Interview prep
                </h3>
                <StoredInterviewPrepView prep={viewApp.interviewPrep} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {prepApp ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setPrepApp(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h2 className="text-lg font-bold text-slate-900">
                Interview prep — {sanitizeJobTitle(prepApp.jobTitle) || "Role"}
              </h2>
              <button
                type="button"
                onClick={() => setPrepApp(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <StoredInterviewPrepView prep={prepApp.interviewPrep} />
            </div>
          </div>
        </div>
      ) : null}

      {reminderApp ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setReminderApp(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900">Follow-up reminder</h2>
            <p className="mt-2 text-sm text-slate-600">
              Pick a date to follow up. We&apos;ll open your email with a draft
              you can send.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700">
              Reminder date
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4F8EF7]"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReminderApp(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <a
                href={mailtoFollowUp({
                  jobTitle: sanitizeJobTitle(reminderApp.jobTitle) || "Role",
                  company: sanitizeCompany(reminderApp.company) || "Company",
                  appliedDateYmd: reminderApp.date,
                  reminderDateYmd: reminderDate,
                })}
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
