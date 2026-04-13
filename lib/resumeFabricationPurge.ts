/**
 * Strip known fabricated ATS/skill-inventory lines from resume plain text.
 * When `referencePlain` is provided, lines like "Soft Skills:" are kept only
 * if they appear verbatim (normalized whitespace) in the reference.
 */

function normLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const RE_OPS_LOG = /^\s*operations\s*&\s*logistics\s*:/i;
const RE_DOMAIN_KNOWLEDGE = /^\s*domain\s+knowledge\s*:/i;
const RE_DATA_ANALYTICS = /^\s*data\s*&\s*analytics\s*:/i;
const RE_SOFT_SKILLS = /^\s*soft\s*skills\s*:/i;
const RE_TOOLS = /^\s*tools?\s*:/i;
const RE_FAKE_TOOLS = /\b(netsuite|sap|oracle|\berp\b)\b/i;

export function lineMatchesFabricationPattern(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (RE_OPS_LOG.test(t)) return true;
  if (RE_DOMAIN_KNOWLEDGE.test(t)) return true;
  if (RE_DATA_ANALYTICS.test(t)) return true;
  if (RE_SOFT_SKILLS.test(t)) return true;
  if (RE_TOOLS.test(t) && RE_FAKE_TOOLS.test(t)) return true;
  return false;
}

/** True if normalized line exists anywhere in reference (verbatim line match). */
function lineExistsInReference(line: string, referencePlain: string): boolean {
  const n = normLine(line);
  if (!n) return false;
  for (const L of referencePlain.replace(/\r\n/g, "\n").split("\n")) {
    if (normLine(L) === n) return true;
  }
  return false;
}

/**
 * Drop fabricated inventory lines. Soft Skills / suspect Tools lines are kept
 * only when the same line text exists in `referencePlain` (e.g. truly from the upload).
 */
export function purgeFabricatedResumeLines(
  plain: string,
  referencePlain?: string,
): string {
  const ref = referencePlain ?? plain;
  const out: string[] = [];
  for (const line of plain.replace(/\r\n/g, "\n").split("\n")) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    if (RE_OPS_LOG.test(t) || RE_DOMAIN_KNOWLEDGE.test(t) || RE_DATA_ANALYTICS.test(t)) {
      continue;
    }
    if (RE_SOFT_SKILLS.test(t)) {
      if (lineExistsInReference(line, ref)) out.push(line);
      continue;
    }
    if (RE_TOOLS.test(t) && RE_FAKE_TOOLS.test(t)) {
      if (lineExistsInReference(line, ref)) out.push(line);
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function purgeResumeEditorBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("resumeText");
    localStorage.removeItem("applyfy-resume-versions-v1");
  } catch {
    /* ignore */
  }
}
