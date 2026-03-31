import type { Analysis, InterviewPrep } from "@/lib/analysisTypes";

const KEY = "applyfy-tracker-v1";

export type TrackerStatus =
  | "Saved"
  | "Applied"
  | "Interview"
  | "Rejected"
  | "Offer";

export type TrackerApplication = {
  id: string;
  company: string;
  jobTitle: string;
  date: string;
  matchScore: number;
  status: TrackerStatus;
  resumeSnapshot: string;
  coverLetter: string;
  interviewPrep: InterviewPrep;
  analysisSnapshot?: Pick<
    Analysis,
    "matchExplanation" | "matchedSkills" | "missingSkills" | "atsMatched" | "atsKeywords"
  >;
  interviewDate: string | null;
};

function read(): TrackerApplication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is TrackerApplication =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as TrackerApplication).id === "string" &&
          typeof (v as TrackerApplication).company === "string",
      )
      .map((v) => ({
        ...v,
        interviewDate:
          v.interviewDate === undefined || v.interviewDate === ""
            ? null
            : v.interviewDate,
      }));
  } catch {
    return [];
  }
}

function write(list: TrackerApplication[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function loadTrackerApplications(): TrackerApplication[] {
  return read();
}

export function upsertTrackerApplication(app: TrackerApplication) {
  const list = read().filter((a) => a.id !== app.id);
  list.unshift(app);
  write(list);
}

export function updateTrackerApplication(
  id: string,
  patch: Partial<Omit<TrackerApplication, "id">>,
) {
  const list = read();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...patch };
  write(list);
}

export function deleteTrackerApplication(id: string) {
  write(read().filter((a) => a.id !== id));
}
