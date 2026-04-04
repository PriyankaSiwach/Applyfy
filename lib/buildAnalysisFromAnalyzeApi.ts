import type {
  Analysis,
  GapInsight,
  InterviewPrep,
  KeywordHit,
  RequirementCheck,
  ResumeRewriteItem,
  StarStory,
} from "@/lib/analysisTypes";
import { stubInterviewPrepFromAnalysisContext } from "@/lib/stubInterviewPrep";

export type AnalyzeApiResponse = {
  keywords?: KeywordHit[];
  matchedStrengths?: string[];
  gaps?: GapInsight[];
  rewrites?: ResumeRewriteItem[];
  atsScore?: number;
  experienceMatch?: number;
  educationMatch?: number;
  quickWins?: string[];
  intro?: string;
  starStories?: unknown;
  error?: string;
  resolvedJobPosting?: string;
  jobLink?: string | null;
  jobTextPasteRequired?: boolean;
  jobTextPasteMessage?: string;
};

function parseKeywords(raw: unknown): KeywordHit[] {
  if (!Array.isArray(raw)) return [];
  const out: KeywordHit[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const skill = typeof o.skill === "string" ? o.skill.trim() : "";
    const evidence =
      typeof o.evidence === "string" ? o.evidence.replace(/\s+/g, " ").trim() : "";
    if (!skill) continue;
    out.push({ skill, found: o.found === true, evidence });
  }
  return out;
}

function parseGapInsights(raw: unknown): GapInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: GapInsight[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const skill = typeof o.skill === "string" ? o.skill.trim() : "";
    const reality = typeof o.reality === "string" ? o.reality.trim() : "";
    const fix = typeof o.fix === "string" ? o.fix.trim() : "";
    if (skill && reality && fix) out.push({ skill, reality, fix });
  }
  return out;
}

function parseRewrites(raw: unknown): ResumeRewriteItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ResumeRewriteItem[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const original = typeof o.original === "string" ? o.original.trim() : "";
    const rewritten = typeof o.rewritten === "string" ? o.rewritten.trim() : "";
    const section = typeof o.section === "string" ? o.section.trim() : "";
    const whyBetter =
      typeof o.whyBetter === "string" ? o.whyBetter.trim() : "";
    if (original && rewritten && section && whyBetter) {
      out.push({ original, rewritten, section, whyBetter });
    }
  }
  return out;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

function parseStarStoriesFromApi(raw: unknown): StarStory[] {
  if (!Array.isArray(raw)) return [];
  const out: StarStory[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const S = typeof o.S === "string" ? o.S.trim() : "";
    const T = typeof o.T === "string" ? o.T.trim() : "";
    const A = typeof o.A === "string" ? o.A.trim() : "";
    const R = typeof o.R === "string" ? o.R.trim() : "";
    if (title && S && T && A && R) out.push({ title, S, T, A, R });
  }
  return out.slice(0, 4);
}

function clampInt0to100(label: string, v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`Analysis response incomplete: ${label} missing.`);
  }
  return Math.min(100, Math.max(0, Math.round(v)));
}

function buildRequirementChecks(keywords: KeywordHit[]): RequirementCheck[] {
  const rows: RequirementCheck[] = keywords.slice(0, 12).map((k) => ({
    skill: k.skill,
    present: k.found,
    evidence: k.evidence,
  }));
  while (rows.length < 8) {
    const n = rows.length + 1;
    rows.push({
      skill: `Requirement ${n}`,
      present: false,
      evidence: `No keyword slot ${n} was returned for this job — the analysis may be incomplete.`,
    });
  }
  return rows.slice(0, 12);
}

/**
 * Validates and maps `/api/analyze` JSON into an `Analysis` object.
 */
export function buildAnalysisFromAnalyzeApi(
  data: AnalyzeApiResponse,
): { analysis: Analysis; resolvedJobPosting?: string } {
  let keywords = parseKeywords(data.keywords ?? []);
  while (keywords.length < 12) {
    const n = keywords.length + 1;
    keywords.push({
      skill: `Requirement ${n}`,
      found: false,
      evidence: `No keyword slot ${n} was returned for this job — the analysis may be incomplete.`,
    });
  }
  keywords = keywords.slice(0, 12);
  for (const k of keywords) {
    if (!k.evidence) {
      throw new Error(
        `Analysis response incomplete: keyword "${k.skill}" is missing evidence.`,
      );
    }
  }

  const matchedStrengths = asStringArray(data.matchedStrengths);
  if (matchedStrengths.length < 4) {
    throw new Error("Analysis response incomplete: matchedStrengths missing.");
  }

  const resumeGaps = parseGapInsights(data.gaps);
  if (resumeGaps.length < 5) {
    throw new Error("Analysis response incomplete: gaps missing.");
  }

  const rewrites = parseRewrites(data.rewrites);
  if (rewrites.length < 6) {
    throw new Error("Analysis response incomplete: rewrites missing.");
  }

  const atsScore =
    typeof data.atsScore === "number" && Number.isFinite(data.atsScore)
      ? Math.min(100, Math.max(0, Math.round(data.atsScore)))
      : NaN;
  if (!Number.isFinite(atsScore)) {
    throw new Error("Analysis response incomplete: atsScore missing.");
  }

  const experienceMatch = clampInt0to100(
    "experienceMatch",
    data.experienceMatch,
  );
  const educationMatch = clampInt0to100("educationMatch", data.educationMatch);

  const quickWins = asStringArray(data.quickWins);
  if (quickWins.length < 3) {
    throw new Error("Analysis response incomplete: quickWins missing.");
  }

  const matchedSkills = keywords.filter((k) => k.found).map((k) => k.skill);
  const missingSkills = keywords.filter((k) => !k.found).map((k) => k.skill);
  const atsMatched = matchedSkills;
  const atsKeywords = missingSkills;

  const totalRequiredSkills = keywords.length;
  const matchedCount = keywords.filter((k) => k.found).length;
  const skillsMatch =
    totalRequiredSkills > 0
      ? Math.round((100 * matchedCount) / totalRequiredSkills)
      : 0;

  const matchScore = Math.round(
    (skillsMatch + experienceMatch + educationMatch + atsScore) / 4,
  );

  const matchExplanation = quickWins.slice(0, 3);
  const baseInterviewPrep = stubInterviewPrepFromAnalysisContext(
    quickWins,
    matchedStrengths,
    resumeGaps,
  );
  const introTrim =
    typeof data.intro === "string" ? data.intro.trim() : "";
  const starStoriesParsed = parseStarStoriesFromApi(data.starStories);
  const interviewPrep: InterviewPrep = {
    ...baseInterviewPrep,
    ...(introTrim
      ? { intro: introTrim, introPitch: introTrim }
      : {}),
    starStories:
      starStoriesParsed.length >= 4
        ? starStoriesParsed.slice(0, 4)
        : baseInterviewPrep.starStories,
  };

  const analysis: Analysis = {
    atsScore,
    quickWins: quickWins.slice(0, 3),
    keywords,
    matchedStrengths: matchedStrengths.slice(0, 4),
    resumeGaps: resumeGaps.slice(0, 8),
    rewrites: rewrites.slice(0, 6),
    matchScore,
    skillsMatch,
    experienceMatch,
    educationMatch,
    matchExplanation,
    matchedSkills,
    missingSkills,
    sectionSuggestions: quickWins,
    atsKeywords,
    atsMatched,
    requirementChecks: buildRequirementChecks(keywords),
    interviewPrep,
  };

  const resolvedJobPosting =
    typeof data.resolvedJobPosting === "string" && data.resolvedJobPosting
      ? data.resolvedJobPosting
      : undefined;

  return { analysis, resolvedJobPosting };
}
