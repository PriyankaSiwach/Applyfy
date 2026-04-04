/** Free tier: 1 cover letter generation per calendar month. */
const PREFIX = "applyfy-cover-gen-";

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getCoverGenCountThisMonth(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(PREFIX + monthKey());
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementCoverGenCount(): void {
  try {
    localStorage.setItem(PREFIX + monthKey(), String(getCoverGenCountThisMonth() + 1));
  } catch {
    /* ignore */
  }
}

export function canFreeRegenerateCoverLetter(): boolean {
  return getCoverGenCountThisMonth() < 1;
}
