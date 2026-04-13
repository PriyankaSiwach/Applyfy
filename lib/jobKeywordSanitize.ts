/** Form-template noise from structured job postings (ATS forms, numbered fields). */
const REQUIREMENT_NUM_RE = /requirement\s+\d+/i;
const JOB_COMPETENCY_NUM_RE = /job\s+competency\s+\d+/i;
/** e.g. "Competency 9", "Requirement #3" */
const NUMBERED_LABEL_RE =
  /^(?:job\s+)?competency\s*#?\s*\d+|^requirement\s*#?\s*\d+/i;
/** Internal padding rows — never treat as job keywords. */
const OPEN_SLOT_RE = /^open analysis slot\s+\d+$/i;

export function isUsableAtsKeywordLabel(skill: string): boolean {
  const t = skill.trim();
  if (!t) return false;
  if (REQUIREMENT_NUM_RE.test(t)) return false;
  if (JOB_COMPETENCY_NUM_RE.test(t)) return false;
  if (NUMBERED_LABEL_RE.test(t)) return false;
  if (OPEN_SLOT_RE.test(t)) return false;
  return true;
}

export function filterAtsKeywordLabels(skills: string[]): string[] {
  return skills.map((s) => s.trim()).filter(isUsableAtsKeywordLabel);
}
