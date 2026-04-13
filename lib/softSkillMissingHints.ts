/**
 * Actionable hints for missing soft-skill ATS keywords when the resume
 * already shows behavioral evidence but not the exact label.
 */

import { isKeywordLiterallyPresent } from "@/lib/atsDeterministicKeywords";
import { isUsableAtsKeywordLabel } from "@/lib/jobKeywordSanitize";

function normSkill(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function scoreAgainstPatterns(text: string, patterns: RegExp[]): number {
  let score = 0;
  for (const p of patterns) {
    const copy = new RegExp(p.source, p.flags);
    if (copy.test(text)) score += 1;
  }
  return score;
}

function pickBestEvidenceExcerpt(
  resumePlain: string,
  patterns: RegExp[],
): string | null {
  const text = resumePlain.replace(/\r\n/g, "\n");
  const candidates: string[] = [];

  for (const line of text.split("\n")) {
    const t = line.trim();
    if (
      t.startsWith("•") ||
      t.startsWith("–") ||
      t.startsWith("-") ||
      t.startsWith("*")
    ) {
      candidates.push(t);
    }
  }

  if (candidates.length === 0) {
    for (const para of text.split(/\n\n+/)) {
      const p = para.trim();
      if (p.length > 24 && p.length < 700) candidates.push(p);
    }
  }

  if (candidates.length === 0) {
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.length > 32 && t.length < 500) candidates.push(t);
    }
  }

  let best: { score: number; excerpt: string } | null = null;
  for (const c of candidates) {
    const sc = scoreAgainstPatterns(c, patterns);
    if (sc > 0 && (!best || sc > best.score)) {
      best = { score: sc, excerpt: collapseWs(c).slice(0, 300) };
    }
  }
  return best?.excerpt ?? null;
}

function targetDescriptionFor(evidence: string): string {
  const e = evidence.toLowerCase();
  if (/\bmentor/.test(e)) return "your mentoring bullet";
  if (/\bpresent|pitch|deck|stakeholder/.test(e))
    return "your stakeholder-facing bullet";
  if (/\bcollabor|cross-?functional|with\s+engineering|with\s+design/.test(e))
    return "your collaboration bullet";
  if (/\bdeadline|priorit|juggle|concurrent/.test(e))
    return "that planning bullet";
  if (/\bresolv|troubleshoot|root\s+cause|debug/.test(e))
    return "that problem-solving bullet";
  return "that bullet";
}

type SoftSkillDef = {
  patterns: RegExp[];
  /** Adding this phrase (in context) should satisfy deterministic keyword match. */
  quickFixPhrase: string;
};

/** Canonical key → definition. Keys are normalized single labels. */
const SOFT_SKILL_DEFS: Record<string, SoftSkillDef> = {
  leadership: {
    patterns: [
      /\bmentor(ed|ing|ship|s)?\b/i,
      /\bled\b/i,
      /\bleading\b/i,
      /\bmanaged\b.*\bteam\b/i,
      /\bteam\s+of\b/i,
      /\bdirected\b/i,
      /\bguided\b/i,
      /\bsupervised\b/i,
      /\bpeople\s+manager\b/i,
    ],
    quickFixPhrase: "demonstrated leadership",
  },
  communication: {
    patterns: [
      /\bpresent(ed|ation|ing)?\b/i,
      /\bcollaborat/i,
      /\bstakeholder/i,
      /\bpitched\b/i,
      /\barticulat/i,
      /\bnegotiat/i,
      /\bliaison\b/i,
      /\bwritten\b.*\bverbal\b/i,
      /\bfacilitat/i,
    ],
    quickFixPhrase: "strong communication skills",
  },
  teamwork: {
    patterns: [
      /\bteam\s+player\b/i,
      /\bteam\s+dynamics\b/i,
      /\bcollaborat/i,
      /\bpaired\b/i,
      /\bworked\s+closely\b/i,
      /\bcross-?functional\b/i,
    ],
    quickFixPhrase: "teamwork in cross-functional settings",
  },
  collaboration: {
    patterns: [
      /\bcollaborat/i,
      /\bcross-?functional\b/i,
      /\bpartnered\b/i,
      /\bjointly\b/i,
    ],
    quickFixPhrase: "cross-functional collaboration",
  },
  "problem solving": {
    patterns: [
      /\bresolv(ed|ing)?\b/i,
      /\btroubleshoot/i,
      /\broot\s+cause\b/i,
      /\bdebug/i,
      /\bmitigat/i,
    ],
    quickFixPhrase: "problem-solving under pressure",
  },
  "time management": {
    patterns: [
      /\bdeadline/i,
      /\bpriorit/i,
      /\bconcurrent\b/i,
      /\bjuggle/i,
      /\btime-?boxed\b/i,
    ],
    quickFixPhrase: "time management across competing priorities",
  },
  adaptability: {
    patterns: [
      /\badapt(ed|ing)?\b/i,
      /\bfast-?paced\b/i,
      /\bambiguous\b/i,
      /\bpivot(ed)?\b/i,
      /\bshifting\s+priorities\b/i,
    ],
    quickFixPhrase: "adaptability in ambiguous environments",
  },
  initiative: {
    patterns: [
      /\bproactive\b/i,
      /\binitiated\b/i,
      /\bdrove\b/i,
      /\bchampioned\b/i,
      /\bvolunteered\b/i,
    ],
    quickFixPhrase: "taking initiative to drive outcomes",
  },
  "project management": {
    patterns: [
      /\bcoordinat/i,
      /\bdeliverable/i,
      /\bmilestone/i,
      /\broadmap\b/i,
      /\bscrum\b/i,
      /\bkanban\b/i,
      /\bsprint\b/i,
    ],
    quickFixPhrase: "project management end-to-end",
  },
  interpersonal: {
    patterns: [
      /\brelationships?\b/i,
      /\brapport\b/i,
      /\bempathy\b/i,
      /\binterpersonal\b/i,
    ],
    quickFixPhrase: "strong interpersonal skills",
  },
  negotiation: {
    patterns: [
      /\bnegotiat/i,
      /\bcontract(s)?\b/i,
      /\bvendor\b/i,
      /\bterms\b.*\bagreed\b/i,
    ],
    quickFixPhrase: "negotiation with vendors and partners",
  },
  coaching: {
    patterns: [
      /\bcoach(ed|ing)?\b/i,
      /\bon-?boarding\b/i,
      /\btrain(ed|ing)?\b/i,
    ],
    quickFixPhrase: "coaching and developing teammates",
  },
  "attention to detail": {
    patterns: [
      /\bmeticulous\b/i,
      /\baccuracy\b/i,
      /\bzero\s+defect/i,
      /\bthorough\b/i,
    ],
    quickFixPhrase: "attention to detail on deliverables",
  },
  "critical thinking": {
    patterns: [
      /\banalyz(ed|ing)\b/i,
      /\bevaluat/i,
      /\btrade-?offs?\b/i,
      /\bhypothesis\b/i,
    ],
    quickFixPhrase: "critical thinking in technical decisions",
  },
};

/** Map job keyword variants to a canonical soft-skill key in SOFT_SKILL_DEFS. */
const SKILL_ALIASES: Record<string, string> = {
  "team leadership": "leadership",
  "people leadership": "leadership",
  "people management": "leadership",
  "verbal communication": "communication",
  "written communication": "communication",
  "oral communication": "communication",
  "cross-functional collaboration": "collaboration",
  "team collaboration": "collaboration",
  "analytical problem solving": "problem solving",
};

export type SoftSkillMissingHint = {
  skillLabel: string;
  evidenceExcerpt: string;
  quickFixPhrase: string;
  targetDescription: string;
};

function resolveDefKey(skill: string): string | null {
  const n = normSkill(skill);
  if (SKILL_ALIASES[n]) return SKILL_ALIASES[n];
  if (SOFT_SKILL_DEFS[n]) return n;
  return null;
}

/**
 * If this keyword is a known soft skill, is missing from the resume (per
 * deterministic rules), and behavioral patterns match — return a hint.
 * Otherwise null (no hint: not soft skill, no evidence, or already matched).
 */
export function getSoftSkillMissingHint(
  skill: string,
  resumePlain: string,
  _synonymMapIgnored?: Record<string, string[]> | null,
): SoftSkillMissingHint | null {
  if (!isUsableAtsKeywordLabel(skill)) return null;
  const plain = resumePlain.replace(/\r\n/g, "\n").trim();
  if (plain.length < 12) return null;

  const defKey = resolveDefKey(skill);
  if (!defKey) return null;
  const def = SOFT_SKILL_DEFS[defKey];
  if (!def) return null;

  if (isKeywordLiterallyPresent(skill, plain)) return null;

  const excerpt = pickBestEvidenceExcerpt(plain, def.patterns);
  if (!excerpt) return null;

  const augmented = `${plain}\n${def.quickFixPhrase}`;
  if (!isKeywordLiterallyPresent(skill, augmented)) {
    const fallback = `demonstrated ${skill.trim()}`;
    if (!isKeywordLiterallyPresent(skill, `${plain}\n${fallback}`)) {
      return null;
    }
    return {
      skillLabel: skill.trim(),
      evidenceExcerpt: excerpt,
      quickFixPhrase: fallback,
      targetDescription: targetDescriptionFor(excerpt),
    };
  }

  return {
    skillLabel: skill.trim(),
    evidenceExcerpt: excerpt,
    quickFixPhrase: def.quickFixPhrase,
    targetDescription: targetDescriptionFor(excerpt),
  };
}
