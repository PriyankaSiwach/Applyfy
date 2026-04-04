const STORAGE_PREFIX = "applyfy-analyses-";

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthlyAnalysisCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + monthKey());
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementMonthlyAnalysisCount(): void {
  try {
    const k = STORAGE_PREFIX + monthKey();
    const n = getMonthlyAnalysisCount() + 1;
    localStorage.setItem(k, String(n));
  } catch {
    /* ignore */
  }
}

export function canRunFreeAnalysis(): boolean {
  return getMonthlyAnalysisCount() < 2;
}
