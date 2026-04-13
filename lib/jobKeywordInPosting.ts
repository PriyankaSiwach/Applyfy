/**
 * ATS keyword labels must be grounded in the job posting text.
 * Prevents the model from returning unrelated domains (e.g. "cloud computing" for an accounting role).
 */

/** Collapse whitespace; normalize hyphens so "cross-functional" matches "cross functional". */
function normalizePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\r\n/g, "\n")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True if `keyword` appears in the job description as a real phrase or word token.
 * - Multi-word: substring match after normalization (hyphens/spaces).
 * - Single token: word-boundary match so "Excel" does not match inside "Excellent".
 */
export function keywordAppearsInJobPosting(
  jobDescription: string,
  keyword: string,
): boolean {
  const kw = keyword.trim();
  if (!kw || !jobDescription.trim()) return false;

  const jobNorm = normalizePhrase(jobDescription);
  const kwNorm = normalizePhrase(kw);
  if (!kwNorm) return false;

  if (/\s/.test(kwNorm)) {
    return jobNorm.includes(kwNorm);
  }

  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    return re.test(jobDescription);
  } catch {
    return jobNorm.includes(kwNorm);
  }
}

/** Keep only labels that literally appear in the job posting (case-insensitive, phrase rules above). */
export function filterKeywordLabelsToJobPosting(
  jobDescription: string,
  labels: string[],
): string[] {
  const jd = jobDescription.replace(/\r\n/g, "\n").trim();
  if (jd.length < 20) return labels;
  return labels.filter((label) => keywordAppearsInJobPosting(jd, label));
}
