import type { Analysis } from "@/lib/analysisTypes";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type MatchSeg = {
  start: number;
  end: number;
  suggestion: string;
  replacement: string;
};

function collectRewriteMatches(plain: string, analysis: Analysis): MatchSeg[] {
  const raw: MatchSeg[] = [];
  for (const r of analysis.rewrites.slice(0, 12)) {
    const o = r.original.trim();
    if (o.length < 10) continue;
    let idx = plain.indexOf(o);
    if (idx === -1) {
      const pl = plain.toLowerCase();
      const ol = o.toLowerCase();
      idx = pl.indexOf(ol);
    }
    if (idx !== -1) {
      raw.push({
        start: idx,
        end: idx + o.length,
        suggestion:
          r.whyBetter || "Strengthen this line using the suggested rewrite.",
        replacement: r.rewritten,
      });
    }
  }
  raw.sort((a, b) => a.start - b.start || b.end - a.end - (b.start - a.start));
  const out: MatchSeg[] = [];
  let last = -1;
  for (const m of raw) {
    if (m.start >= last) {
      out.push(m);
      last = m.end;
    }
  }
  return out;
}

function classifyLine(line: string, index: number): "name" | "header" | "bullet" | "normal" {
  const t = line.trim();
  if (!t) return "normal";
  if (index === 0 && t.length <= 80 && !/^[•\-\*]/.test(t) && !/^[-–—]{3,}\s*$/.test(t)) {
    return "name";
  }
  if (/^[•\-\*]\s/.test(t) || /^[-–—*]\s/.test(t)) return "bullet";
  const upperRatio =
    t.replace(/[^A-Za-z]/g, "").length > 0
      ? (t.replace(/[^A-Z]/g, "").length || 0) /
        Math.max(1, t.replace(/[^A-Za-z]/g, "").length)
      : 0;
  if (upperRatio > 0.75 && t.length >= 3 && t.length <= 64) return "header";
  if (/^[-–—_=]{4,}$/.test(t)) return "header";
  return "normal";
}

/**
 * Build safe HTML for contenteditable: structure + optional gap highlights from rewrites.
 */
export function buildResumeEditorHtml(plain: string, analysis: Analysis | null): string {
  const lines = plain.replace(/\r\n/g, "\n").split("\n");
  const matches = analysis ? collectRewriteMatches(plain, analysis) : [];
  const parts: string[] = [];
  let offset = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const kind = classifyLine(line, li);
    const lineStart = offset;
    const lineEnd = offset + line.length;

    const lineMatches = matches.filter(
      (m) => m.start < lineEnd && m.end > lineStart,
    );

    let inner: string;
    if (lineMatches.length === 0) {
      inner = escapeHtml(line);
    } else {
      const rel: MatchSeg[] = lineMatches.map((m) => ({
        start: Math.max(0, m.start - lineStart),
        end: Math.min(line.length, m.end - lineStart),
        suggestion: m.suggestion,
        replacement: m.replacement,
      }));
      rel.sort((a, b) => a.start - b.start);
      let i = 0;
      inner = "";
      for (const m of rel) {
        if (m.end <= m.start) continue;
        inner += escapeHtml(line.slice(i, m.start));
        const seg = line.slice(m.start, m.end);
        inner += `<span class="resume-editor-hl" data-replacement="${escapeHtml(m.replacement)}" data-suggestion="${escapeHtml(m.suggestion)}">${escapeHtml(seg)}</span>`;
        i = m.end;
      }
      inner += escapeHtml(line.slice(i));
    }

    let wrap: string;
    if (kind === "name") {
      wrap = `<div class="resume-editor-line resume-editor-name">${inner || "&nbsp;"}</div>`;
    } else if (kind === "header") {
      wrap = `<div class="resume-editor-line resume-editor-header">${inner || "&nbsp;"}</div>`;
    } else if (kind === "bullet") {
      wrap = `<div class="resume-editor-line resume-editor-bullet">${inner || "&nbsp;"}</div>`;
    } else {
      wrap = `<div class="resume-editor-line">${inner || "&nbsp;"}</div>`;
    }
    parts.push(wrap);
    offset += line.length + 1;
  }

  return parts.join("") || '<div class="resume-editor-line">&nbsp;</div>';
}

/** Plain text from editor DOM (contenteditable). */
export function getPlainTextFromEditor(el: HTMLElement): string {
  return el.innerText.replace(/\r\n/g, "\n").trimEnd();
}
