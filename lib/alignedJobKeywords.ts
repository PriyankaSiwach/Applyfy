import { isKeywordLiterallyPresent } from "@/lib/atsDeterministicKeywords";
import { isUsableAtsKeywordLabel } from "@/lib/jobKeywordSanitize";

/** Stable key for "same job" so keyword labels are captured once per posting/link pair. */
export function stableJobKey(jobPosting: string, jobLink: string): string {
  const p = jobPosting.trim().slice(0, 8000);
  const l = jobLink.trim().slice(0, 2000);
  let h = 5381;
  const s = `${l}\n${p}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return `${l.length}-${p.length}-${(h >>> 0).toString(16)}`;
}

/** Plain resume text for keyword matching (upload payload is often a data URL). */
export function resumePlainForKeywordMatching(
  resume: string,
  originalResumePlain: string,
): string {
  const r = resume.trim();
  if (r.toLowerCase().startsWith("data:") && originalResumePlain.trim()) {
    return originalResumePlain.trim();
  }
  return r;
}

/**
 * Green/red from literal substring / whole-token match only (case-insensitive).
 * No semantic or synonym matching. If it is not written in the resume, it is not green.
 */
export function keywordChipsFromResumeLiteral(
  resumePlain: string,
  jobKeywordLabels: string[],
  baselineKeywordSkills: string[],
): { skill: string; found: boolean }[] {
  const labels =
    jobKeywordLabels.filter(isUsableAtsKeywordLabel).length > 0
      ? jobKeywordLabels.filter(isUsableAtsKeywordLabel)
      : baselineKeywordSkills.map((s) => s.trim()).filter(Boolean);
  if (!labels.length) return [];
  const plain = resumePlain.replace(/\r\n/g, "\n");
  if (plain.trim().length < 10) {
    return labels.map((skill) => ({ skill, found: false }));
  }
  return labels.map((skill) => ({
    skill,
    found: isKeywordLiterallyPresent(skill, plain),
  }));
}

/** @deprecated Use keywordChipsFromResumeLiteral. */
export function keywordChipsFromSharedList(
  resumePlain: string,
  _jobPosting: string,
  jobKeywordLabels: string[],
): { skill: string; found: boolean }[] {
  const labels = jobKeywordLabels.filter(isUsableAtsKeywordLabel);
  return keywordChipsFromResumeLiteral(resumePlain, labels, []);
}

/** @deprecated Alias for keywordChipsFromResumeLiteral (committed hybrid lists are no longer used for chip color). */
export function keywordChipsFromHybridState(
  resumePlain: string,
  jobKeywordLabels: string[],
  baselineKeywordSkills: string[],
  _committedPresent?: string[],
): { skill: string; found: boolean }[] {
  return keywordChipsFromResumeLiteral(
    resumePlain,
    jobKeywordLabels,
    baselineKeywordSkills,
  );
}
