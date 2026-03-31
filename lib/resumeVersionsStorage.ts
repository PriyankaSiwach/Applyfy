const KEY = "applyfy-resume-versions-v1";

export type ResumeVersion = {
  id: string;
  label: string;
  resumeText: string;
  jobTitle: string;
  bullets: string[];
  savedAt: string;
};

function read(): ResumeVersion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is ResumeVersion =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as ResumeVersion).id === "string" &&
        typeof (v as ResumeVersion).resumeText === "string",
    );
  } catch {
    return [];
  }
}

function write(list: ResumeVersion[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function loadResumeVersions(): ResumeVersion[] {
  return read();
}

export function saveResumeVersion(entry: Omit<ResumeVersion, "id" | "savedAt">) {
  const list = read();
  const next: ResumeVersion = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    savedAt: new Date().toISOString(),
  };
  list.unshift(next);
  write(list);
  return next;
}
