import { extractJobTitleAndCompany } from "@/lib/jobMetaFromPosting";

/** localStorage key — array of { score, date, jobTitle } */
export const ATS_HISTORY_KEY = "ats_history";

const LEGACY_KEY = "applyfy-ats-history";

export type AtsHistoryEntry = {
  score: number;
  date: string;
  jobTitle: string;
};

type LegacyPoint = { t: number; score: number };

function parseLegacy(raw: string): LegacyPoint[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is LegacyPoint =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as LegacyPoint).t === "number" &&
        typeof (x as LegacyPoint).score === "number",
    );
  } catch {
    return [];
  }
}

function migrateLegacyToNew(): AtsHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const legacy = parseLegacy(raw);
    if (legacy.length === 0) return [];
    const next: AtsHistoryEntry[] = legacy.map((p, i) => ({
      score: Math.round(p.score),
      date: new Date(p.t).toISOString(),
      jobTitle: `Analysis #${i + 1}`,
    }));
    localStorage.setItem(ATS_HISTORY_KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_KEY);
    return next;
  } catch {
    return [];
  }
}

export function readAtsHistory(): AtsHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ATS_HISTORY_KEY);
    if (!raw) {
      return migrateLegacyToNew();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return migrateLegacyToNew();
    if (parsed.length === 0) {
      const migrated = migrateLegacyToNew();
      if (migrated.length > 0) return migrated;
    }
    const out: AtsHistoryEntry[] = [];
    for (const x of parsed) {
      if (
        typeof x === "object" &&
        x !== null &&
        typeof (x as AtsHistoryEntry).score === "number" &&
        typeof (x as AtsHistoryEntry).date === "string" &&
        typeof (x as AtsHistoryEntry).jobTitle === "string"
      ) {
        out.push({
          score: Math.min(100, Math.max(0, Math.round((x as AtsHistoryEntry).score))),
          date: (x as AtsHistoryEntry).date,
          jobTitle: (x as AtsHistoryEntry).jobTitle,
        });
      }
    }
    if (out.length === 0 && typeof localStorage.getItem(LEGACY_KEY) === "string") {
      return migrateLegacyToNew();
    }
    return out;
  } catch {
    return [];
  }
}

export function clearAtsHistory(): void {
  try {
    localStorage.removeItem(ATS_HISTORY_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Call when an analysis completes successfully.
 * Derives job title from posting text when possible; otherwise "Analysis #N".
 */
export function appendAtsScore(
  score: number,
  options: { jobPosting: string; jobLink: string },
): void {
  try {
    const prev = readAtsHistory();
    const n = prev.length + 1;
    const { title } = extractJobTitleAndCompany(
      options.jobPosting || "",
      options.jobLink || "",
    );
    const jobTitle = title.trim() ? title : `Analysis #${n}`;
    const next: AtsHistoryEntry[] = [
      ...prev,
      {
        score: Math.min(100, Math.max(0, Math.round(score))),
        date: new Date().toISOString(),
        jobTitle,
      },
    ].slice(-60);
    localStorage.setItem(ATS_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
