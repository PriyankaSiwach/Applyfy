import type {
  Analysis,
  GapInsight,
  InterviewPrep,
  KeywordHit,
  RequirementCheck,
  ResumeRewriteItem,
  StarStory,
} from "@/lib/analysisTypes";
import { isKeywordLiterallyPresent } from "@/lib/atsDeterministicKeywords";
import { keywordAppearsInJobPosting } from "@/lib/jobKeywordInPosting";
import { isUsableAtsKeywordLabel } from "@/lib/jobKeywordSanitize";
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
    if (!isUsableAtsKeywordLabel(skill)) continue;
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
    const acsRaw = o.alreadyCoversSkill ?? o.already_covers_skill;
    const alreadyCoversSkill =
      acsRaw === true ||
      (typeof acsRaw === "string" && acsRaw.toLowerCase() === "true");
    if (original && rewritten && section && whyBetter) {
      out.push({
        original,
        rewritten,
        section,
        whyBetter,
        ...(alreadyCoversSkill ? { alreadyCoversSkill: true } : {}),
      });
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
      skill: `Open analysis slot ${n}`,
      present: false,
      evidence: `The model returned fewer than eight requirement rows for this job — re-run analyze for a full list.`,
    });
  }
  return rows.slice(0, 12);
}

function normSkillKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Note: the "This exact keyword phrase is not on your resume yet" tail was
// previously appended to every gap's fix text. It is now shown once as a
// section-level note in the UI (InterviewPrepPanel risk areas header) so it
// doesn't repeat on every card. Keep the constant for any remaining usages.

/** Tail when a green keyword line has only two segments (experience + implied match). */
const FOUND_KW_STRENGTH_TAIL_FALLBACK =
  "Exact wording from your resume matches this job keyword.";

const STRENGTH_DASH_SPLIT = /\s*[—–]\s*/;

function parseStrengthLineParts(line: string): { skill: string; parts: string[] } | null {
  const trimmed = line.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(STRENGTH_DASH_SPLIT).map((p) => p.trim());
  if (parts.length < 2) return null;
  const skill = parts[0];
  if (!skill) return null;
  return { skill, parts };
}

/**
 * First raw strength line per normalized skill label: middle segment + optional tail segments.
 */
function strengthSegmentsBySkillLabel(
  strengthLines: string[],
): Map<string, { middle: string; tailParts: string[] }> {
  const map = new Map<string, { middle: string; tailParts: string[] }>();
  for (const line of strengthLines) {
    const parsed = parseStrengthLineParts(line);
    if (!parsed) continue;
    const key = normSkillKey(parsed.skill);
    if (map.has(key)) continue;
    map.set(key, {
      middle: parsed.parts[1],
      tailParts: parsed.parts.slice(2),
    });
  }
  return map;
}

/**
 * Matched strengths = only ATS-green (literal found) keywords, in keyword list order.
 * No extra model-only strength lines. Optional reuse of API text when the lead label matches.
 */
function buildMatchedStrengthsLiteralGreenOnly(
  keywords: KeywordHit[],
  rawMatchedStrengths: string[],
): string[] {
  const segments = strengthSegmentsBySkillLabel(rawMatchedStrengths);
  const out: string[] = [];
  for (const k of keywords) {
    if (!k.found) continue;
    const key = normSkillKey(k.skill);
    const seg = segments.get(key);
    if (seg) {
      const tail =
        seg.tailParts.length > 0
          ? seg.tailParts.join(" — ")
          : FOUND_KW_STRENGTH_TAIL_FALLBACK;
      out.push(`${k.skill} — ${seg.middle} — ${tail}`);
    } else {
      out.push(
        `${k.skill} — ${k.evidence} — ${FOUND_KW_STRENGTH_TAIL_FALLBACK}`,
      );
    }
  }
  return out;
}

/**
 * Gaps for the UI: literal-red keywords only, same rules as former “Suggested improvements”.
 * Reality = strength middle or API gap reality; Fix = API gap fix plus tail (job fit or literal reminder).
 */
function buildResumeGapsFromRedKeywords(
  keywords: KeywordHit[],
  apiGaps: GapInsight[],
  rawMatchedStrengths: string[],
): GapInsight[] {
  const segments = strengthSegmentsBySkillLabel(rawMatchedStrengths);
  const out: GapInsight[] = [];

  for (const k of keywords) {
    if (k.found) continue;

    const key = normSkillKey(k.skill);
    const gap = apiGaps.find((g) => normSkillKey(g.skill) === key);
    const seg = segments.get(key);
    if (!gap && !seg) continue;

    const reality = seg ? seg.middle : gap!.reality;

    // Use only the model-generated fix text (no appended tail — the global
    // "not on your resume yet" note is shown once in the UI section header).
    const fix = gap?.fix?.trim()
      ? gap.fix.trim()
      : seg?.tailParts.join(" — ") ?? reality;

    out.push({ skill: k.skill, reality, fix });
  }

  return out;
}

export type BuildAnalysisOptions = {
  /** When set, keyword `found` is overridden using literal text match only (no AI semantics). */
  resumePlainForLiteralKeywords?: string;
};

/**
 * Validates and maps `/api/analyze` JSON into an `Analysis` object.
 */
export function buildAnalysisFromAnalyzeApi(
  data: AnalyzeApiResponse,
  options?: BuildAnalysisOptions,
): { analysis: Analysis; resolvedJobPosting?: string } {
  let keywords = parseKeywords(data.keywords ?? []);
  const jobTextForKeywordGrounding =
    typeof data.resolvedJobPosting === "string"
      ? data.resolvedJobPosting.replace(/\r\n/g, "\n").trim()
      : "";
  if (jobTextForKeywordGrounding.length >= 40) {
    keywords = keywords.filter((k) =>
      keywordAppearsInJobPosting(jobTextForKeywordGrounding, k.skill),
    );
  }
  while (keywords.length < 12) {
    const n = keywords.length + 1;
    keywords.push({
      skill: `Open analysis slot ${n}`,
      found: false,
      evidence: `The model returned fewer than twelve keywords — paste a fuller job description or re-run analyze.`,
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

  let resumeGaps = parseGapInsights(data.gaps);
  while (resumeGaps.length < 5) {
    const n = resumeGaps.length + 1;
    resumeGaps.push({
      skill: `Follow-up area ${n}`,
      reality:
        "The model returned fewer than five gap rows; this slot was not separately scored.",
      fix: "Re-read the job posting and your resume side by side for any remaining requirements you can honestly support.",
    });
  }

  const rawStrengthStrings = asStringArray(data.matchedStrengths);

  const plainOpt = options?.resumePlainForLiteralKeywords?.trim();
  if (plainOpt && plainOpt.length >= 10) {
    const corpus = plainOpt.replace(/\r\n/g, "\n");
    keywords = keywords.map((k) => ({
      ...k,
      found: isKeywordLiterallyPresent(k.skill, corpus),
    }));
  }

  resumeGaps = buildResumeGapsFromRedKeywords(
    keywords,
    resumeGaps,
    rawStrengthStrings,
  );

  const matchedStrengths = buildMatchedStrengthsLiteralGreenOnly(
    keywords,
    rawStrengthStrings,
  );
  const nFoundKw = keywords.filter((k) => k.found).length;
  if (nFoundKw > 0 && matchedStrengths.length === 0) {
    throw new Error(
      "Analysis response incomplete: matchedStrengths missing for matched keywords.",
    );
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
    matchedStrengths,
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
