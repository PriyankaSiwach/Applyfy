/**
 * Literal keyword presence only (case-insensitive).
 * Green = exact phrase or whole-token match in resume text — no synonyms, no semantic inference.
 */

import { isUsableAtsKeywordLabel } from "@/lib/jobKeywordSanitize";

function normKeywordKey(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True if the keyword appears literally in lowercased resume text:
 * - Multi-word / hyphenated phrases: contiguous substring match.
 * - Single alphanumeric token: word-boundary match (avoids "sql" inside "mysql", "go" in "ongoing").
 * - Tokens with punctuation (e.g. C++): substring match.
 */
export function directKeywordMatchInLowerText(
  textLower: string,
  keyword: string,
): boolean {
  const k = normKeywordKey(keyword);
  if (!k || !textLower) return false;

  if (k.includes(" ") || k.includes("-")) {
    return textLower.includes(k);
  }

  if (k.length <= 1) return false;

  if (!/^[a-z0-9]+$/i.test(k)) {
    return textLower.includes(k);
  }

  if (k.length === 2) {
    return new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(k)}([^a-z0-9]|$)`,
      "i",
    ).test(textLower);
  }

  return new RegExp(`\\b${escapeRegExp(k)}\\b`, "i").test(textLower);
}

/**
 * Strict literal presence: the exact keyword phrase/token must appear in the resume (case-insensitive).
 * Synonyms and implied skills do NOT count.
 */
export function isKeywordLiterallyPresent(
  keyword: string,
  resumeText: string,
): boolean {
  const text = resumeText.replace(/\r\n/g, "\n").toLowerCase();
  return directKeywordMatchInLowerText(text, keyword);
}

/** @deprecated Use isKeywordLiterallyPresent — synonyms are not used for ATS green. */
export function isKeywordPresent(
  keyword: string,
  resumeText: string,
  _synonymMap?: Record<string, string[]> | null,
): boolean {
  return isKeywordLiterallyPresent(keyword, resumeText);
}

export type DeterministicKeywordResult = {
  present: string[];
  missing: string[];
  matchedCount: number;
  totalCount: number;
  /** 0–75: (matched/total)*75 when total > 0, else 0 */
  score75: number;
};

/**
 * @param keywords - ordered labels; filtered with isUsableAtsKeywordLabel.
 * Literal text match only — synonymMap is ignored.
 */
export function computeDeterministicKeywordScore75(
  resumeText: string,
  keywords: string[],
  _synonymMap?: Record<string, string[]> | null,
): DeterministicKeywordResult {
  const labels = keywords.map((k) => k.trim()).filter(isUsableAtsKeywordLabel);
  const present: string[] = [];
  const missing: string[] = [];
  for (const label of labels) {
    if (isKeywordLiterallyPresent(label, resumeText)) present.push(label);
    else missing.push(label);
  }
  const totalCount = labels.length;
  const matchedCount = present.length;
  const score75 =
    totalCount > 0
      ? Math.round((75 * matchedCount) / totalCount)
      : 0;
  return {
    present,
    missing,
    matchedCount,
    totalCount,
    score75,
  };
}

/**
 * Code-only verification — same as computeDeterministicKeywordScore75 (literal only).
 */
export function verifyKeywordsAgainstResume(
  resumeText: string,
  keywordLabels: string[],
  _synonymMap?: Record<string, string[]> | null,
): DeterministicKeywordResult {
  return computeDeterministicKeywordScore75(resumeText, keywordLabels, null);
}
