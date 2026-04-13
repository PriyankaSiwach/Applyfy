/**
 * Client-side semantic keyword coverage for the resume editor.
 * Used so headline ATS score, keyword %, and missing tags stay consistent and update live.
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resumeBlob(r: string): string {
  return norm(r).replace(/\s/g, "");
}

/** Significant tokens (drop stopwords). */
function tokens(phrase: string): string[] {
  const STOP = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "of",
    "to",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "is",
    "are",
    "be",
    "etc",
  ]);
  return norm(phrase)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Substrings / stems checked anywhere in normalized resume text. */
const SEMANTIC_PROXIES: { test: (kw: string) => boolean; hints: string[] }[] = [
  {
    test: (kw) =>
      /problem\s*solv|analytical\s*think|structured\s*problem|critical\s*think/.test(
        kw,
      ),
    hints: [
      "productivity",
      "efficiency",
      "streamlin",
      "optimiz",
      "reduced",
      "improved",
      "increased",
      "decreased",
      "cost",
      "time",
      "debug",
      "root",
      "cause",
      "bottleneck",
      "issue",
      "resolved",
      "hypothesis",
      "framework",
      "analysis",
      "analyz",
      "metric",
      "kpi",
      "outcome",
    ],
  },
  {
    test: (kw) =>
      /executive\s*comm|stakeholder\s*comm|verbal\s*comm|written\s*comm|communication/.test(
        kw,
      ),
    hints: [
      "director",
      "vp",
      "vice",
      "president",
      "executive",
      "c-level",
      "c suite",
      "senior leadership",
      "presented",
      "presentation",
      "briefed",
      "stakeholder",
      "cross-functional",
      "crossfunctional",
      "liaison",
      "board",
      "mentored",
      "trained",
      "80 ",
      "team of",
    ],
  },
  {
    test: (kw) =>
      /project\s*management|program\s*management|delivery\s*lead|scrum\s*master/.test(
        kw,
      ),
    hints: [
      "deliverable",
      "timeline",
      "milestone",
      "sprint",
      "roadmap",
      "backlog",
      "coordinated",
      "coordination",
      "managed",
      "planning",
      "schedule",
      "deadline",
      "release",
      "launch",
      "agile",
      "scrum",
      "kanban",
    ],
  },
  {
    test: (kw) =>
      /leadership|team\s*lead|people\s*management|mentor/.test(kw),
    hints: [
      "led",
      "lead",
      "managed",
      "supervis",
      "mentor",
      "coach",
      "headed",
      "chair",
      "founder",
      "initiated",
      "owned",
      "drove",
    ],
  },
  {
    test: (kw) => /cross\s*-?functional|collaborat|teamwork/.test(kw),
    hints: [
      "cross-functional",
      "crossfunctional",
      "collaborat",
      "partnered",
      "together",
      "joint",
      "interdisciplinary",
      "multidisciplinary",
    ],
  },
  {
    test: (kw) => /six\s*sigma|lean\s*six|dmaic/.test(kw),
    hints: ["six sigma", "sixsigma", "dmaic", "lean", "5s", "kaizen"],
  },
  {
    test: (kw) =>
      /predictive|forecast|statistical\s*model|machine\s*learning|\bml\b/.test(
        kw,
      ),
    hints: [
      "predict",
      "forecast",
      "model",
      "regression",
      "classification",
      "machine learning",
      "ml ",
      "numpy",
      "pandas",
      "scikit",
      "tensorflow",
      "pytorch",
      "algorithm",
      "inference",
      "failure",
      "reliability",
      "risk",
      "monte",
      "simulation",
    ],
  },
];

function containsHint(resumeN: string, hints: string[]): boolean {
  for (const h of hints) {
    if (resumeN.includes(h.replace(/\s+/g, ""))) return true;
    const compact = h.replace(/\s/g, "");
    if (compact.length >= 4 && resumeN.includes(compact)) return true;
    if (resumeN.includes(norm(h).replace(/\s/g, ""))) return true;
  }
  return false;
}

function literalOrTokenMatch(resumeN: string, keyword: string): boolean {
  const kn = norm(keyword);
  if (!kn) return false;
  if (resumeN.includes(kn.replace(/\s/g, ""))) return true;
  if (resumeN.includes(kn)) return true;
  const toks = tokens(keyword);
  if (toks.length === 0) return false;
  const hits = toks.filter((t) => {
    if (t.length <= 2) return resumeN.includes(t);
    return resumeN.includes(t) || resumeN.includes(t.replace(/s$/, ""));
  });
  return hits.length >= Math.ceil(toks.length * 0.6);
}

function semanticClusterMatch(resumeN: string, keyword: string): boolean {
  const kn = norm(keyword);
  for (const cluster of SEMANTIC_PROXIES) {
    if (!cluster.test(kn)) continue;
    if (containsHint(resumeN, cluster.hints)) return true;
  }
  return false;
}

export type EditorCoverageResult = {
  present: string[];
  missing: string[];
  /** 0–100: matched / total job keyword slots */
  percent: number;
};

/**
 * @param jobPosting - full job text (improves acronym / phrase context)
 * @param keywordSkills - ordered list from analysis (e.g. 12 skills)
 */
export function computeSemanticKeywordCoverage(
  resumePlain: string,
  jobPosting: string,
  keywordSkills: string[],
): EditorCoverageResult {
  const resumeN = resumeBlob(resumePlain);
  const jobN = norm(jobPosting);

  if (!keywordSkills.length || resumeN.length < 20) {
    return { present: [], missing: [...keywordSkills], percent: 0 };
  }

  const present: string[] = [];
  const missing: string[] = [];

  for (const skill of keywordSkills) {
    const label = skill.trim();
    if (!label) continue;

    const skillNorm = norm(label).replace(/\s/g, "");
    const inResume =
      literalOrTokenMatch(resumeN, label) ||
      semanticClusterMatch(resumeN, label) ||
      (skillNorm.length > 3 && jobN.includes(skillNorm) && resumeN.includes(skillNorm));

    if (inResume) present.push(label);
    else missing.push(label);
  }

  const total = keywordSkills.filter((s) => s.trim()).length;
  const percent =
    total > 0 ? Math.round((100 * present.length) / total) : 0;

  return { present, missing, percent };
}

/**
 * Merge model/API keyword lists with semantic pass so nothing is marked missing
 * if the resume still shows equivalent evidence.
 */
export function mergePresentKeywordsWithSemantics(
  resumePlain: string,
  jobPosting: string,
  allSkills: string[],
  apiPresent: string[],
): { present: string[]; missing: string[]; percent: number } {
  const resumeN = resumeBlob(resumePlain);
  const presentSet = new Set(
    apiPresent.map((s) => s.trim()).filter(Boolean),
  );

  for (const skill of allSkills) {
    const label = skill.trim();
    if (!label) continue;
    if (presentSet.has(label)) continue;
    if (
      literalOrTokenMatch(resumeN, label) ||
      semanticClusterMatch(resumeN, label)
    ) {
      presentSet.add(label);
    }
  }

  const present = allSkills.filter((s) => presentSet.has(s.trim()));
  const missing = allSkills.filter((s) => !presentSet.has(s.trim()));
  const total = allSkills.filter((s) => s.trim()).length;
  const percent =
    total > 0 ? Math.round((100 * present.length) / total) : 0;

  return { present, missing, percent };
}
