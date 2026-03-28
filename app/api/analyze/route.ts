import { NextResponse } from "next/server";
import { parseResumeJobBody } from "@/lib/parseResumeJobBody";
import { cleanResumeToPlainText } from "@/lib/resumeText";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

/** When true, skips OpenAI, job fetch, and strict resume length — for local testing only. */
function isMockAnalysisEnabled(): boolean {
  const raw =
    process.env.USE_MOCK_ANALYSIS ??
    process.env.usemockanalysis ??
    process.env.NEXT_PUBLIC_USE_MOCK_ANALYSIS;
  if (!raw) return false;
  const v = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function mockAnalysisResponse(resumePreview: string): {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  bulletSuggestions: string[];
  sectionSuggestions: string[];
  atsKeywords: string[];
} {
  const hint =
    resumePreview.length > 60
      ? `${resumePreview.slice(0, 60).trim()}…`
      : resumePreview.trim() || "(resume text)";
  return {
    matchScore: 68,
    matchedSkills: [
      `React / UI — mock: align bullets with job keywords (preview: ${hint})`,
      "TypeScript — mock: add 1–2 concrete file/area examples from your work",
      "Collaboration — mock: cite cross-functional or review/mentorship if true",
    ],
    missingSkills: [
      "System design depth — mock: job may expect distributed systems vocabulary",
      "Observability (metrics/tracing) — mock: add if you operated production services",
    ],
    bulletSuggestions: [
      "Mock bullet: Led migration of [component] to TypeScript, cutting production incidents by [X]% over [N] months; partnered with [team] on rollout and QA.",
      "Mock bullet: Shipped [feature] used by [users/events/day]; improved p95 latency from [A]ms to [B]ms by [technique].",
      "Mock bullet: Owned on-call for [service]; reduced MTTR from [X] to [Y] via runbooks and alerting on [signals].",
      "Mock bullet: Drove A/B test on [surface]; lifted [metric] by [X]% with zero regression on [guardrail].",
    ],
    sectionSuggestions: [
      "Mock: Tighten Summary to 3 lines: title + stack + one measurable win tied to this role.",
      "Mock: Reorder Experience so the most relevant role is first; mirror JD language where honest.",
      "Mock: Add a Skills line grouped by area (Frontend / Infra / Data) to match ATS scans.",
      "Mock: Projects: one line each on user impact and tech; drop stack-only blurbs.",
    ],
    atsKeywords: [
      "TypeScript",
      "React",
      "Next.js",
      "REST",
      "CI/CD",
      "observability",
      "A/B testing",
      "cross-functional",
    ],
  };
}

const MAX_RESUME_CHARS = 24_000;
const MAX_JOB_CHARS = 18_000;
const MIN_MEANINGFUL_CHARS = 80;

const JOB_SECTION_PATTERNS = [
  /(?:responsibilit(?:y|ies)|what you(?:'ll)?\s*(?:do|own)|key responsibilities)[^:]{0,40}:?\s*([\s\S]{0,8000}?)(?=(?:qualification|requirement|what we|who you|benefits|about (?:the )?role|nice to have|bonus|perks)\b|$)/gi,
  /(?:qualification|requirement)s?[^:]{0,40}:?\s*([\s\S]{0,8000}?)(?=(?:responsibilit|what you|benefits|nice to have|bonus|apply|about (?:the )?company)\b|$)/gi,
  /(?:what we (?:look|need|want) for|who you are|about you|your background|skills?(?:\s+you\s+have)?)[^:]{0,40}:?\s*([\s\S]{0,8000}?)(?=(?:responsibilit|benefits|apply|qualification)\b|$)/gi,
  /(?:nice to have|bonus|preferred)[^:]{0,40}:?\s*([\s\S]{0,4000}?)(?=(?:apply|benefits|responsibilit)\b|$)/gi,
];

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|br|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPrimaryContent(html: string): string {
  const lowered = html.toLowerCase();
  const candidates: string[] = [];

  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (article) candidates.push(article[1]);

  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (main) candidates.push(main[1]);

  const roleMain = html.match(
    /(?:id|class)=["'][^"']*(?:job|description|posting|detail)[^"']*["'][^>]*>([\s\S]{200,12000}?)<\/(?:div|section)>/i,
  );
  if (roleMain) candidates.push(roleMain[1]);

  if (candidates.length === 0) {
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    candidates.push(body ? body[1] : html);
  }

  return candidates.sort((a, b) => b.length - a.length)[0] ?? html;
}

function extractMeaningfulJobRequirements(cleanedPlain: string): string {
  const sections: string[] = [];
  for (const re of JOB_SECTION_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleanedPlain)) !== null) {
      const chunk = m[1]?.trim();
      if (chunk && chunk.length > 40) sections.push(chunk);
    }
  }

  const merged = sections.length
    ? [...new Set(sections)].join("\n\n---\n\n")
    : cleanedPlain;

  return merged.slice(0, MAX_JOB_CHARS);
}

async function fetchJobDescriptionText(jobLink: string): Promise<string> {
  const res = await fetch(jobLink, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Applyfy/1.0; +https://applyfy.app) AppleWebKit/537.36 (KHTML, like Gecko)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    throw new Error(`Could not fetch job page (HTTP ${res.status})`);
  }

  const html = await res.text();
  const primary = extractPrimaryContent(html);
  const plain = stripHtmlToText(primary);
  const meaningful = extractMeaningfulJobRequirements(plain);
  const fallback = plain.slice(0, MAX_JOB_CHARS);
  return meaningful.length > 200 ? meaningful : fallback;
}

const ANALYSIS_JSON_SCHEMA = `Return a single JSON object with exactly these keys (no markdown, no prose outside JSON):
{
  "matchScore": <integer 0-100, realistic based on overlap and must-have gaps>,
  "matchedSkills": <string[] — each item: skill/area + short evidence tied to THIS resume (not generic)>,
  "missingSkills": <string[] — each item: gap from the job + why it matters for this role>,
  "bulletSuggestions": <string[] — 4-6 FAANG-caliber resume bullets: strong verbs, metrics where plausible, scoped to THIS job; not generic filler>,
  "sectionSuggestions": <string[] — 4-6 concrete section-level fixes (Summary, Experience order, Projects, etc.) referencing this JD>,
  "atsKeywords": <string[] — 6-10 missing or underused keywords/phrases from the JD to add for ATS; short phrases only>
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

function asScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

async function runAnalysisWithOpenAI({
  resume,
  jobDescription,
}: {
  resume: string;
  jobDescription: string;
}) {
  const system = `You are a principal recruiter and ex-FAANG hiring manager. You compare ONE job description with ONE resume.

Rules:
- Ground every point in quoted facts from the job description text and resume text. No vague advice.
- Extract required skills, tools, domains, and seniority signals from the job description first.
- matchedSkills: only skills/areas where the resume shows credible evidence; phrase each as "Skill — evidence: …".
- missingSkills: gaps that matter for this specific posting (not random tech).
- matchScore: weighted by must-haves in the JD; penalize missing core requirements.
- bulletSuggestions: write bullets as if for a top-tier tech resume (action + scope + metric + tech); tailor wording to the JD keywords.
- sectionSuggestions: actionable edits (what to move, rename, quantify, cut).
- atsKeywords: terms from the JD that are absent or weak on the resume; prioritize nouns/phrases applicant tracking systems scan for.

${ANALYSIS_JSON_SCHEMA}`;

  const user = `Job description (scraped text; may include noise):
---
${jobDescription.slice(0, MAX_JOB_CHARS)}
---

Candidate resume (plain text):
---
${resume.slice(0, MAX_RESUME_CHARS)}
---`;

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
      max_tokens: 4096,
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

  return {
    matchScore: asScore(obj.matchScore),
    matchedSkills: asStringArray(obj.matchedSkills),
    missingSkills: asStringArray(obj.missingSkills),
    bulletSuggestions: asStringArray(obj.bulletSuggestions),
    sectionSuggestions: asStringArray(obj.sectionSuggestions),
    atsKeywords: asStringArray(obj.atsKeywords),
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseResumeJobBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  const mockMode = isMockAnalysisEnabled();

  if (!mockMode && !OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server" },
      { status: 503 },
    );
  }

  if (mockMode) {
    let preview = "";
    try {
      preview = await cleanResumeToPlainText(parsed.resume);
    } catch {
      preview = "";
    }
    if (preview.length < 20) {
      const raw = parsed.resume;
      if (raw.length > 0 && !raw.trimStart().toLowerCase().startsWith("data:")) {
        preview = raw.slice(0, 200);
      } else {
        preview =
          "(Mock mode — upload a text-based PDF/DOCX/TXT for a real preview; scans have no extractable text.)";
      }
    }
    return NextResponse.json(mockAnalysisResponse(preview));
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

  let jobDescription: string;
  try {
    jobDescription = await fetchJobDescriptionText(parsed.jobLink);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch job URL";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  if (jobDescription.length < MIN_MEANINGFUL_CHARS) {
    return NextResponse.json(
      {
        error:
          "Could not extract enough text from the job page. The site may block automated access, or the URL may not be a public posting.",
      },
      { status: 422 },
    );
  }

  try {
    const result = await runAnalysisWithOpenAI({ resume: resumeText, jobDescription });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    if (msg.includes("insufficient_quota") || msg.includes("billing")) {
      return NextResponse.json(
        {
          error:
            "OpenAI quota or billing issue. Add credits in your OpenAI account, or set USE_MOCK_ANALYSIS=true in .env.local to test without the API.",
        },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
