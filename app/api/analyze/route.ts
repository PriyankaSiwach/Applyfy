import { NextResponse } from "next/server";
import {
  extractKeyRequirementsFromJob,
  fetchJobDescriptionText,
  MAX_JOB_CHARS,
} from "@/lib/jobDescription";
import type {
  InterviewPrep,
  InterviewRiskArea,
  PredictedQuestion,
  RequirementCheck,
} from "@/lib/analysisTypes";
import { parseAnalyzeBody } from "@/lib/parseAnalyzeBody";
import { cleanResumeToPlainText } from "@/lib/resumeText";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

function shortenSkillLabel(text: string, max = 100): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const MAX_RESUME_CHARS = 24_000;
const MIN_MEANINGFUL_CHARS = 80;

const ANALYSIS_JSON_SCHEMA = `Return a single JSON object with exactly these keys (no markdown, no prose outside JSON):
{
  "matchScore": <integer 0-100, realistic based on overlap and must-have gaps>,
  "matchExplanation": <string[] — exactly 3 bullets; each explains WHY the score; cite specific job requirements and resume evidence>,
  "matchedSkills": <string[] — 6-12 pill-friendly labels, each 1-4 words (examples: "React", "API Design", "System Design"); no punctuation-heavy phrases, no full sentences, no evidence text>,
  "missingSkills": <string[] — 4-10 pill-friendly labels, each 1-4 words representing missing/weak requirements; no full sentences>,
  "bulletSuggestions": <string[] — 4-6 FAANG-caliber resume bullets: strong verbs, metrics where plausible, scoped to THIS job; not generic filler>,
  "sectionSuggestions": <string[] — 4-6 concrete section-level fixes (Summary, Experience order, Projects, etc.) referencing this JD>,
  "atsMatched": <string[] — 4-12 short keyword phrases from the JD that ARE clearly evidenced on the resume (for ATS “matched” display)>,
  "atsKeywords": <string[] — 6-10 missing or underused keywords/phrases from the JD to add for ATS; short phrases only>,
  "requirementChecks": <array of 8 to 12 objects, each exactly: { "skill": string (short requirement label), "present": boolean, "evidence": string (quote or paraphrase from resume if present; say what's missing if false) }> — extract ONLY skills, responsibilities, and qualifications from the job text; omit salary, benefits-only lines, legal/EEO/privacy boilerplate, and irrelevant fluff>,
  "interviewPrep": {
    "intro": <string>,
    "behavioral": <array of 3 to 4 objects: { "question": string, "context": string, "fullAnswer": string, "tip": string }>,
    "technical": <array of 3 to 4 objects: { "question": string, "context": string, "fullAnswer": string, "tip": string }>,
    "starStories": <array of exactly 2 objects: { "title": string, "S": string, "T": string, "A": string, "R": string }>,
    "redFlags": <array of exactly 2 objects: { "issue": string, "howToFrame": string }>
  }
}`;

function extractJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* try fallback */
  }
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error("Could not parse JSON from model response");
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function toPillLabel(text: string): string {
  const cleaned = text
    .replace(/[–—:;,.(){}[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 4);
  return words.join(" ");
}

function asPillLabelArray(v: unknown, maxItems = 12): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const label = toPillLabel(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= maxItems) break;
  }
  return out;
}

function asScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function asRequirementChecks(v: unknown): RequirementCheck[] {
  if (!Array.isArray(v)) return [];
  const out: RequirementCheck[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const skill = typeof o.skill === "string" ? o.skill.trim() : "";
    const evidence = typeof o.evidence === "string" ? o.evidence.trim() : "";
    const present = o.present === true;
    if (!skill) continue;
    out.push({
      skill: shortenSkillLabel(skill, 120),
      present,
      evidence:
        evidence ||
        (present
          ? "Supported by resume content."
          : "Not clearly evidenced in resume."),
    });
  }
  return out.slice(0, 12);
}

function asRiskAreas(v: unknown): InterviewRiskArea[] {
  if (!Array.isArray(v)) return [];
  const out: InterviewRiskArea[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const gap = typeof o.gap === "string" ? o.gap.trim() : "";
    let script = typeof o.script === "string" ? o.script.trim() : "";
    if (!script && typeof o.howToExplain === "string") {
      script = o.howToExplain.trim();
    }
    if (gap && script) out.push({ gap, script });
  }
  return out.slice(0, 6);
}

function asPredictedQuestionsRaw(v: unknown): PredictedQuestion[] {
  if (!Array.isArray(v)) return [];
  const out: PredictedQuestion[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const question = typeof o.question === "string" ? o.question.trim() : "";
    const context = typeof o.context === "string" ? o.context.trim() : "";
    const fullAnswer =
      typeof o.fullAnswer === "string" ? o.fullAnswer.trim() : "";
    const tip = typeof o.tip === "string" ? o.tip.trim() : "";
    const kind: PredictedQuestion["kind"] =
      o.kind === "technical" ? "technical" : "behavioral";
    if (question && context && fullAnswer && tip) {
      out.push({ question, context, fullAnswer, tip, kind });
    }
  }
  return out.slice(0, 12);
}

function normalizeInterviewPrep(
  raw: unknown,
): InterviewPrep {
  let introPitch = "";
  let behavioral: PredictedQuestion[] = [];
  let technical: PredictedQuestion[] = [];
  let starStories: {
    title: string;
    S: string;
    T: string;
    A: string;
    R: string;
  }[] = [];
  let redFlags: InterviewRiskArea[] = [];

  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    introPitch =
      typeof o.intro === "string"
        ? o.intro.trim()
        : typeof o.introPitch === "string"
          ? o.introPitch.trim()
          : "";
    behavioral = asPredictedQuestionsRaw(o.behavioral).map((q) => ({
      ...q,
      kind: "behavioral" as const,
    }));
    technical = asPredictedQuestionsRaw(o.technical).map((q) => ({
      ...q,
      kind: "technical" as const,
    }));
    if (Array.isArray(o.starStories)) {
      starStories = o.starStories
        .filter(
          (s): s is { title: string; S: string; T: string; A: string; R: string } =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as { title?: unknown }).title === "string" &&
            typeof (s as { S?: unknown }).S === "string" &&
            typeof (s as { T?: unknown }).T === "string" &&
            typeof (s as { A?: unknown }).A === "string" &&
            typeof (s as { R?: unknown }).R === "string",
        )
        .map((s) => ({
          title: s.title.trim(),
          S: s.S.trim(),
          T: s.T.trim(),
          A: s.A.trim(),
          R: s.R.trim(),
        }))
        .slice(0, 2);
    }
    if (Array.isArray(o.redFlags)) {
      redFlags = o.redFlags
        .filter(
          (r): r is { issue: string; howToFrame: string } =>
            typeof r === "object" &&
            r !== null &&
            typeof (r as { issue?: unknown }).issue === "string" &&
            typeof (r as { howToFrame?: unknown }).howToFrame === "string",
        )
        .map((r) => ({
          gap: r.issue.trim(),
          script: r.howToFrame.trim(),
        }))
        .slice(0, 2);
    }
  }

  behavioral = behavioral.slice(0, 4);
  technical = technical.slice(0, 4);
  const predictedQuestions = [...behavioral, ...technical].slice(0, 8);
  const likelyQuestions = predictedQuestions.map((q) => q.question);
  const keyStories = starStories.map(
    (s) => `${s.title}: S) ${s.S} T) ${s.T} A) ${s.A} R) ${s.R}`,
  );

  return {
    introPitch,
    behavioral,
    technical,
    redFlags,
    starStories,
    likelyQuestions,
    keyStories,
    riskAreas: redFlags,
    predictedQuestions,
  };
}

async function runAnalysisWithOpenAI({
  resume,
  jobDescription,
}: {
  resume: string;
  jobDescription: string;
}) {
  const system = `You are a senior technical recruiter and resume strategist with 15 years of experience at top tech companies.

ANALYZE PROMPT:
You are a senior technical recruiter and resume strategist with 15 years of experience at top tech companies. Analyze this resume against this job posting with brutal honesty and precision.

Resume: {resumeText}
Job Posting: {jobText}

Return a JSON object with exactly these keys:

"keywords": array of 12 objects {skill, found}
- Extract the most critical technical and soft skills from the job posting
- found: true if clearly evidenced in resume, false if absent
- Short names only: "React", "Docker", "Team leadership"
- Order by importance to the role

"strengths": array of exactly 4 strings
- Each must name a SPECIFIC skill or experience from THIS resume that matches THIS job
- Format: "[Skill] — [what the resume shows] — [why it matters for this role]"
- Example: "React expertise — 3 projects using React with measurable outcomes — directly matches the posting's emphasis on frontend ownership"
- Never generic. Never repeat the same structure twice.

"gaps": array of exactly 3 strings
- Real gaps between THIS resume and THIS job only
- Format: "[Missing area] — [what the job requires] — [how to address it in 1 line]"
- Be specific and actionable, not discouraging

"bullets": array of 3 improved resume bullet strings
- Rewrite weak bullets from the resume to be stronger for THIS specific role
- Use metrics where possible
- Start each with a strong action verb
- Tailor language to match the job posting's vocabulary

MATCH PROMPT:
You are an ATS system and senior hiring manager combined. Score this candidate with precision.

Resume: {resumeText}
Job Posting: {jobText}

Return a JSON object with exactly these keys:

"score": integer between 0-100
- Calculate genuinely based on: skills overlap (40%), experience level fit (30%), domain knowledge match (20%), culture/soft skills fit (10%)
- Be honest — a junior resume against a senior role should score 40-55, not 70+
- Never return the same score twice unless the inputs are identical

"matched": array of 4 short skill labels (1-3 words each)
- Only skills CLEARLY present in both resume and job posting

"missing": array of 3 short skill labels (1-3 words each)
- Only the most critical gaps that would concern a recruiter

"scoreLabel": one of "Needs work", "Partial fit", "Good fit", "Strong match" based on score range

"reasons": array of exactly 3 strings
- Honest, specific explanations for why the score is what it is
- Reference actual content from both documents
- No filler sentences

INTERVIEW PREP PROMPT:
You are a senior hiring manager and interview coach. Generate deeply personalized interview prep for this exact candidate and role.

Resume: {resumeText}
Job Posting: {jobText}

Return JSON with these keys:

'intro': A confident 5-6 sentence spoken introduction.
- Sentence 1: Name + degree/background + top 2 skills relevant to THIS job
- Sentence 2: Reference a SPECIFIC project from the resume with a real result or metric
- Sentence 3: Connect that experience to what THIS job needs
- Sentence 4: Why THIS company specifically excites them
- Sound natural, warm, and confident — not robotic
- Max 150 words

'behavioral': array of 4 objects {question, context, fullAnswer, tip}
- question: specific to THIS job posting's responsibilities
- context: one sentence on why interviewers ask this
- fullAnswer: a complete 4-5 sentence model answer written in first person using ACTUAL projects/experience from the resume. Include a metric or outcome. End with a lesson learned.
- tip: one tactical sentence on delivery

'technical': array of 4 objects {question, context, fullAnswer, tip}
- question: tests a skill explicitly listed in THIS job
- context: what the interviewer is really evaluating
- fullAnswer: a complete answer that walks through the concept AND ties it to something in the candidate's resume. 4-5 sentences.
- tip: what to emphasize or avoid

'starStories': array of 2 objects {title, S, T, A, R}
- Built from REAL experiences in the resume
- Each field is 2 sentences minimum
- R must include a specific outcome or metric

'redFlags': array of 2 objects {issue, howToFrame}
- issue: a real weakness this resume has for this role
- howToFrame: a complete 2-3 sentence script the candidate can actually say in the interview

Return only valid JSON. No markdown, no explanation text outside the JSON.

Now transform these outputs into this required API schema exactly:
${ANALYSIS_JSON_SCHEMA}`;

  const user = `resumeText:
${resume.slice(0, MAX_RESUME_CHARS)}

jobText:
${jobDescription.slice(0, MAX_JOB_CHARS)}`;

  const completion = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 6144,
      temperature: 0.35,
    }),
  });

  if (!completion.ok) {
    const err = await completion.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = (await completion.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const obj = extractJsonObject(content);

  const finalScore = asScore(obj.matchScore);

  const requirementChecks = asRequirementChecks(obj.requirementChecks);
  if (requirementChecks.length < 8) {
    throw new Error("Analysis response incomplete: requirement checks missing.");
  }

  const matchExplanation = asStringArray(obj.matchExplanation).slice(0, 3);
  if (matchExplanation.length < 3) {
    throw new Error("Analysis response incomplete: match explanation missing.");
  }

  const missingSkills = asStringArray(obj.missingSkills);
  if (missingSkills.length === 0) {
    throw new Error("Analysis response incomplete: missing skills missing.");
  }

  const interviewPrep = normalizeInterviewPrep(obj.interviewPrep);
  if (
    !interviewPrep.introPitch ||
    interviewPrep.behavioral.length < 3 ||
    interviewPrep.technical.length < 3 ||
    interviewPrep.starStories.length < 2 ||
    interviewPrep.redFlags.length < 2
  ) {
    throw new Error("Analysis response incomplete: interview prep missing.");
  }

  return {
    matchScore: finalScore,
    matchExplanation,
    matchedSkills: asPillLabelArray(obj.matchedSkills, 12),
    missingSkills: asPillLabelArray(missingSkills, 10),
    bulletSuggestions: asStringArray(obj.bulletSuggestions),
    sectionSuggestions: asStringArray(obj.sectionSuggestions),
    atsKeywords: asStringArray(obj.atsKeywords),
    atsMatched: asStringArray(obj.atsMatched),
    requirementChecks,
    interviewPrep,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnalyzeBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server" },
      { status: 503 },
    );
  }

  async function resolveJobDescription(): Promise<{
    text: string;
    jobLink: string | null;
  }> {
    if ("jobLink" in parsed && parsed.jobLink) {
      try {
        let text = await fetchJobDescriptionText(parsed.jobLink);
        text = text.replace(/\s+/g, " ").trim();
        if (text.length < 80) {
          throw new Error(
            `Job page returned too little text (${text.length} characters).`,
          );
        }
        return {
          text: text.slice(0, MAX_JOB_CHARS),
          jobLink: parsed.jobLink,
        };
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not fetch job posting from URL";
        throw new Error(msg);
      }
    }
    return {
      text: (parsed as { jobPosting: string }).jobPosting,
      jobLink: null,
    };
  }

  let jobDescription: string;
  let resolvedJobLink: string | null = null;
  try {
    const resolved = await resolveJobDescription();
    jobDescription = resolved.text;
    resolvedJobLink = resolved.jobLink;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load job posting";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const resumeText = await cleanResumeToPlainText(parsed.resume);

  if (resumeText.length < MIN_MEANINGFUL_CHARS) {
    return NextResponse.json(
      {
        error:
          "Could not extract enough readable text from your resume. Try: a .txt/.md file; a PDF with selectable text (not a scan); or .docx. Legacy .doc is not supported.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await runAnalysisWithOpenAI({
      resume: resumeText,
      jobDescription,
    });
    return NextResponse.json({
      ...result,
      resolvedJobPosting: jobDescription,
      jobLink: resolvedJobLink,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    if (msg.includes("insufficient_quota") || msg.includes("billing")) {
      return NextResponse.json(
        {
          error: "OpenAI quota or billing issue. Add credits in your OpenAI account.",
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
