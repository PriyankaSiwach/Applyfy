export type RequirementCheck = {
  skill: string;
  present: boolean;
  evidence: string;
};

export type InterviewRiskArea = {
  gap: string;
  script: string;
};

export type PredictedQuestion = {
  question: string;
  context: string;
  fullAnswer: string;
  tip: string;
  kind: "behavioral" | "technical";
};

export type StarStory = {
  title: string;
  S: string;
  T: string;
  A: string;
  R: string;
};

export type InterviewPrep = {
  introPitch: string;
  behavioral: PredictedQuestion[];
  technical: PredictedQuestion[];
  redFlags: InterviewRiskArea[];
  starStories: StarStory[];
  /** Combined convenience list used by copy/export. */
  likelyQuestions: string[];
  /** Back-compat alias for existing UI surfaces. */
  keyStories: string[];
  riskAreas: InterviewRiskArea[];
  predictedQuestions: PredictedQuestion[];
};

export type Analysis = {
  matchScore: number;
  matchExplanation: string[];
  matchedSkills: string[];
  missingSkills: string[];
  bulletSuggestions: string[];
  sectionSuggestions: string[];
  atsKeywords: string[];
  /** JD keywords evidenced on resume (green pills) */
  atsMatched: string[];
  requirementChecks: RequirementCheck[];
  interviewPrep: InterviewPrep;
};

function asPredictedQuestions(raw: unknown): PredictedQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PredictedQuestion[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const question =
      typeof o.question === "string" ? o.question.trim() : "";
    const context =
      typeof o.context === "string" ? o.context.trim() : "";
    const fullAnswer =
      typeof o.fullAnswer === "string" ? o.fullAnswer.trim() : "";
    const tip = typeof o.tip === "string" ? o.tip.trim() : "";
    const kindRaw = typeof o.kind === "string" ? o.kind.trim().toLowerCase() : "";
    const kind: PredictedQuestion["kind"] =
      kindRaw === "technical" ? "technical" : "behavioral";
    if (question && context && fullAnswer && tip) {
      out.push({ question, context, fullAnswer, tip, kind });
    }
  }
  return out.slice(0, 12);
}

function asStarStories(raw: unknown): StarStory[] {
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
  return out.slice(0, 2);
}

export function parseInterviewPrepFromApi(rawPrep: unknown): InterviewPrep {
  const p = rawPrep as Record<string, unknown> | null | undefined;
  const behavioral = asPredictedQuestions(
    p && typeof p === "object" && p !== null && "behavioral" in p
      ? (p as { behavioral?: unknown }).behavioral
      : undefined,
  )
    .map((q) => ({ ...q, kind: "behavioral" as const }))
    .slice(0, 4);
  const technical = asPredictedQuestions(
    p && typeof p === "object" && p !== null && "technical" in p
      ? (p as { technical?: unknown }).technical
      : undefined,
  )
    .map((q) => ({ ...q, kind: "technical" as const }))
    .slice(0, 4);
  const predictedQuestions = [...behavioral, ...technical].slice(0, 8);
  const starStories = asStarStories(
    p && typeof p === "object" && p !== null && "starStories" in p
      ? (p as { starStories?: unknown }).starStories
      : undefined,
  );

  const likelyQuestions = Array.isArray(p?.likelyQuestions)
    ? p.likelyQuestions.filter(
        (q): q is string => typeof q === "string" && q.trim().length > 0,
      )
    : [];

  return {
    introPitch:
      p && typeof p.introPitch === "string"
        ? p.introPitch
        : p && typeof p.intro === "string"
          ? p.intro
          : "",
    behavioral,
    technical,
    starStories,
    likelyQuestions:
      likelyQuestions.length > 0
        ? likelyQuestions
        : predictedQuestions.map((q) => q.question),
    keyStories:
      starStories.length > 0
        ? starStories.map(
            (s) => `${s.title}: S) ${s.S} T) ${s.T} A) ${s.A} R) ${s.R}`,
          )
        : Array.isArray(p?.keyStories)
          ? p.keyStories.filter(
              (s): s is string => typeof s === "string" && s.trim().length > 0,
            )
          : [],
    redFlags: Array.isArray(p?.redFlags)
      ? (p.redFlags
          .filter((r): r is { issue: string; howToFrame: string } => {
            return (
              typeof r === "object" &&
              r !== null &&
              typeof (r as { issue?: unknown }).issue === "string" &&
              typeof (r as { howToFrame?: unknown }).howToFrame === "string"
            );
          })
          .map((r) => ({
            gap: r.issue.trim(),
            script: r.howToFrame.trim(),
          }))
          .slice(0, 2))
      : [],
    riskAreas: Array.isArray(p?.riskAreas)
      ? p.riskAreas
          .filter(
            (r): r is InterviewRiskArea =>
              typeof r === "object" &&
              r !== null &&
              typeof (r as InterviewRiskArea).gap === "string" &&
              typeof (r as InterviewRiskArea).script === "string",
          )
          .map((r) => ({
            gap: r.gap.trim(),
            script: r.script.trim(),
          }))
      : [],
    predictedQuestions,
  };
}
