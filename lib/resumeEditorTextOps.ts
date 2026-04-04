/** Find phrase in plain resume text (exact, then flexible whitespace / case). */
/** Prefer occurrence closest to `hintIndex` (for undo after edits). */
export function findPhraseRangeNear(
  plain: string,
  phrase: string,
  hintIndex: number,
): { start: number; end: number } | null {
  const t = phrase.trim();
  if (!t) return null;
  let best: { start: number; end: number; d: number } | null = null;
  let i = 0;
  while (i <= plain.length) {
    const j = plain.indexOf(t, i);
    if (j < 0) break;
    const d = Math.abs(j - hintIndex);
    if (!best || d < best.d) {
      best = { start: j, end: j + t.length, d };
    }
    i = j + 1;
  }
  if (best) return { start: best.start, end: best.end };
  return findPhraseRange(plain, phrase);
}

export function findPhraseRange(
  plain: string,
  phrase: string,
): { start: number; end: number } | null {
  const t = phrase.trim();
  if (!t) return null;
  const i = plain.indexOf(t);
  if (i >= 0) return { start: i, end: i + t.length };
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const pattern = parts
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const re = new RegExp(pattern, "i");
  const m = plain.match(re);
  if (!m || m.index === undefined) return null;
  return { start: m.index, end: m.index + m[0].length };
}

export function replacePhraseInPlain(
  plain: string,
  phrase: string,
  replacement: string,
): { next: string; range: { start: number; end: number } } | null {
  const r = findPhraseRange(plain, phrase);
  if (!r) return null;
  const next =
    plain.slice(0, r.start) + replacement + plain.slice(r.end);
  return { next, range: r };
}

export function replaceSubstring(
  plain: string,
  start: number,
  end: number,
  replacement: string,
): string {
  return plain.slice(0, start) + replacement + plain.slice(end);
}

export type ResumeSectionTarget =
  | "skills"
  | "latest_role"
  | "education"
  | "manual";

const SKILLS_RE = /\b(skills|technical skills|core competencies|expertise)\b/i;
const EDU_RE = /\b(education|academic|university|degree)\b/i;
const EXP_RE = /\b(experience|employment|work history|professional experience)\b/i;

export function detectSectionInsertionPoints(plain: string): {
  skills: number | null;
  latestRole: number | null;
  education: number | null;
} {
  const lines = plain.split("\n");
  let skills: number | null = null;
  let education: number | null = null;
  let experienceLine = -1;
  let offset = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] ?? "";
    const trimmed = line.trim();
    if (SKILLS_RE.test(trimmed) && skills === null) {
      skills = offset + line.length + (li < lines.length - 1 ? 1 : 0);
    }
    if (EDU_RE.test(trimmed) && education === null) {
      education = offset + line.length + (li < lines.length - 1 ? 1 : 0);
    }
    if (EXP_RE.test(trimmed)) {
      experienceLine = li;
    }
    offset += line.length + 1;
  }

  let latestRole: number | null = null;
  if (experienceLine >= 0) {
    offset = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li] ?? "";
      if (li > experienceLine) {
        const t = line.trim();
        if (
          t.length > 0 &&
          (/^[•\-\*]/.test(t) || /^[-–—]\s/.test(t)) &&
          latestRole === null
        ) {
          latestRole = offset + line.length + 1;
          break;
        }
        if (
          t.length > 40 &&
          !SKILLS_RE.test(t) &&
          !EDU_RE.test(t) &&
          latestRole === null
        ) {
          latestRole = offset + line.length + 1;
          break;
        }
      }
      offset += line.length + 1;
    }
    if (latestRole === null && experienceLine < lines.length - 1) {
      offset = 0;
      for (let li = 0; li <= experienceLine; li++) {
        offset += (lines[li] ?? "").length + 1;
      }
      latestRole = offset;
    }
  }

  if (latestRole === null) {
    latestRole = plain.length;
  }
  return { skills, latestRole, education };
}

export function insertKeywordAtTarget(
  plain: string,
  keyword: string,
  target: ResumeSectionTarget,
): { next: string; insertAt: number } {
  const k = keyword.trim();
  const line = `\n${k} `;
  const pts = detectSectionInsertionPoints(plain);
  if (target === "skills" && pts.skills !== null) {
    return { next: insertAt(plain, pts.skills, line), insertAt: pts.skills };
  }
  if (target === "education" && pts.education !== null) {
    return {
      next: insertAt(plain, pts.education, line),
      insertAt: pts.education,
    };
  }
  if (target === "latest_role") {
    const pos = pts.latestRole ?? plain.length;
    return { next: insertAt(plain, pos, line), insertAt: pos };
  }
  const pos = plain.length;
  return { next: plain + (plain.endsWith("\n") ? "" : "\n") + `${k} `, insertAt: pos };
}

function insertAt(plain: string, index: number, chunk: string): string {
  const i = Math.max(0, Math.min(plain.length, index));
  return plain.slice(0, i) + chunk + plain.slice(i);
}

/** Append a bullet sentence after Skills header, or after latest role / end. */
export function appendSentenceToResume(plain: string, sentence: string): string {
  const s = sentence.trim();
  if (!s) return plain;
  const line = `\n• ${s}`;
  const pts = detectSectionInsertionPoints(plain);
  if (pts.skills !== null) {
    return insertAt(plain, pts.skills, line);
  }
  const pos = pts.latestRole ?? plain.length;
  return insertAt(plain, pos, line);
}
