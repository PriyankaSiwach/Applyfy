import {
  fetchJobDescriptionFromUrlWithDetails,
  JOB_FETCH_MIN_MEANINGFUL_CHARS,
  JOB_PAGE_FETCH_TIMEOUT_MS,
  JOB_PASTE_FALLBACK_USER_MESSAGE,
  MAX_JOB_CHARS,
} from "@/lib/jobDescription";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { parseAnalyzeBody } from "@/lib/parseAnalyzeBody";
import { resumeTextFingerprint } from "@/lib/resumeFingerprint";
import { cleanResumeToPlainText } from "@/lib/resumeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
/** Vercel / Next.js: allow long OpenAI + scrape (see vercel.json too). */
export const maxDuration = 60;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
/** Abort OpenAI request after this many ms (matches maxDuration budget). */
const OPENAI_FETCH_TIMEOUT_MS = 60_000;

/** Trim prompt size for smaller / faster models (character caps, not tokens). */
const ANALYZE_MAX_RESUME_CHARS = 12_000;
const ANALYZE_MAX_JOB_CHARS = 10_000;
const MIN_MEANINGFUL_CHARS = 80;

function summarizeOpenAIResult(result: Record<string, unknown>) {
  const kw = result.keywords;
  const kArr = Array.isArray(kw) ? kw : [];
  let kwEmptyEvidence = 0;
  for (const row of kArr) {
    if (typeof row !== "object" || row === null) {
      kwEmptyEvidence += 1;
      continue;
    }
    const ev = (row as { evidence?: unknown }).evidence;
    if (typeof ev !== "string" || !ev.trim()) kwEmptyEvidence += 1;
  }
  return {
    nKeywords: kArr.length,
    kwEmptyEvidence,
    nStrengths: Array.isArray(result.matchedStrengths)
      ? result.matchedStrengths.length
      : -1,
    nGaps: Array.isArray(result.gaps) ? result.gaps.length : -1,
    nRewrites: Array.isArray(result.rewrites) ? result.rewrites.length : -1,
    nQuickWins: Array.isArray(result.quickWins) ? result.quickWins.length : -1,
    hasAts: typeof result.atsScore === "number",
    hasExp: typeof result.experienceMatch === "number",
    hasEdu: typeof result.educationMatch === "number",
  };
}

const ANALYZE_SYSTEM = `You are a brutally honest ATS expert and resume writer with 15 years of FAANG recruiting experience. Analyze this resume against this job posting.

Resume: {resumeText}
Job Posting: {jobText}

Return JSON with exactly these keys:

'keywords': array of 12 objects {skill, found, evidence}
- Extract the most critical skills from the job (short labels only, 1-3 words)
- found: true only if clearly demonstrated in resume, not just listed as a keyword
- evidence: exactly ONE sentence for the requirements table "Your resume" column for THIS row only. Must be unique across all 12 rows — never reuse the same wording.
  - If found is true: cite concrete proof from the resume (project name, metric, company/role, or bullet) that shows this requirement.
  - If found is false: name the closest thing on the resume toward this requirement, OR one honest sentence on why the resume falls short for this specific skill — still tied to this resume, not generic advice.
- Forbidden: vague boilerplate, repeated phrases across rows, or the exact text "Not clearly demonstrated in the resume text" (or close paraphrases of that phrase).

'matchedStrengths': array of 4 strings
- Each string MUST follow this format exactly (use em dashes — as separators, three parts only):
  "[Skill] — [specific project or experience from the resume that proves it] — [why this is relevant to this specific job posting]"
- Example: "AWS serverless — Built a zero-cost URL shortener using Lambda, API Gateway, and DynamoDB — directly matches the job's emphasis on scalable cloud infrastructure"
- Never output a skill name alone; every line must name a concrete resume item (project, role, metric, or bullet) AND tie relevance to a specific requirement or theme from the job posting text.

'gaps': array of 5-6 objects {skill, reality, fix}
- skill: the missing requirement
- reality: one honest sentence on what the resume currently shows for this skill (never say 'no mention' — find the closest thing)
- fix: one sentence on how to address it using what already exists in the resume

'rewrites': array of 6 objects {
  original, rewritten, section, whyBetter}
- Find 6 existing bullet points or lines from the resume that can be improved
- original: the exact current text from resume
- rewritten: stronger version of the SAME experience — do NOT invent new experiences, do NOT add new job roles, do NOT fabricate skills. Only paraphrase and strengthen what is already there. Add metrics if implied. Weave in ATS keywords naturally where they genuinely fit the existing experience.
- section: where this line currently lives in the resume (e.g. 'MoMA Experience', 'AWS Project', 'Skills section')
- whyBetter: one sentence explaining what the rewrite improves

'atsScore': integer 0-100
- Score only the keyword and phrasing alignment of the resume as-is against the job posting
- Separate from match score — this is purely about language and ATS optimization
- Also used in the UI as "Keywords alignment" in the match breakdown

'experienceMatch': integer 0-100
- Alignment of years of experience, seniority, and relevance of past roles vs this posting's expectations

'educationMatch': integer 0-100
- How well degrees, fields of study, and certifications match what the job asks for (including reasonable equivalents)

'quickWins': array of 3 strings
- The 3 fastest changes the user can make right now that will have the biggest impact
- Each must be specific and actionable in under 5 minutes

'intro': string
- A single 30-second interview self-introduction the candidate can read aloud. Natural spoken English.

'starStories': array of exactly 4 objects { title, S, T, A, R }
- Four distinct STAR stories from specific roles, projects, or accomplishments on the resume (not generic advice).
- Fill in every S, T, A, R field with specific real content from the resume. Never leave any field as a generic instruction or template. T = the specific goal of that project/role. A = specific actions the candidate took. R = the specific outcome or metric achieved.

Return only valid JSON. No markdown.

CRITICAL FORMATTING RULES:
- intro must be maximum 5 sentences total. It should take exactly 25-35 seconds to read aloud. Do not use paragraph breaks. Write it as one flowing paragraph.

- Every fullAnswer must be written as a complete natural paragraph the candidate can actually say or adapt. No dashes or structured data patterns. Write it as if coaching someone on exactly what to say, in first person. Each should be about six to seven sentences and sound natural when read aloud.

- Bad format (for fullAnswer only): 'Java — built X — shows Y' as a stub; use full natural paragraphs instead.
- Good format (for fullAnswer): 'In my project work, I built X using Java which directly demonstrates Y'

All text fields must read like a human wrote them for a human to speak aloud, except matchedStrengths which must use the exact three-part em-dash structure defined above.`;

function extractJsonObject(
  content: string,
  logLabel: string,
): Record<string, unknown> {
  const trimmed = content.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = fence ? fence[1].trim() : trimmed;

  const tryParse = (s: string, phase: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch (e) {
      console.error(`[${logLabel}] JSON.parse failed (${phase})`, {
        error: e instanceof Error ? e.message : String(e),
        preview: s.slice(0, 2500),
      });
    }
    return null;
  };

  const first = tryParse(jsonStr, "primary");
  if (first) return first;

  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
    const bracket = tryParse(jsonStr, "bracket-slice");
    if (bracket) return bracket;
  }

  console.error(`[${logLabel}] Could not parse model JSON`, {
    rawPreview: content.slice(0, 4000),
    rawLength: content.length,
  });
  throw new Error("Could not parse JSON from model response");
}

async function runAnalyzeOpenAI({
  resume,
  jobDescription,
}: {
  resume: string;
  jobDescription: string;
}) {
  const resumeSlice = resume.slice(0, ANALYZE_MAX_RESUME_CHARS);
  const jobSlice = jobDescription.slice(0, ANALYZE_MAX_JOB_CHARS);
  const userContent = ANALYZE_SYSTEM.replace(
    "{resumeText}",
    resumeSlice,
  ).replace("{jobText}", jobSlice);

  let completion: Response;
  try {
    completion = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(OPENAI_FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: userContent }],
        max_tokens: 8192,
        temperature: 0.4,
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      console.error("[/api/analyze] OpenAI fetch timed out", {
        timeoutMs: OPENAI_FETCH_TIMEOUT_MS,
      });
      throw new Error(
        `OpenAI request timed out after ${OPENAI_FETCH_TIMEOUT_MS / 1000}s`,
      );
    }
    console.error("[/api/analyze] OpenAI fetch failed", e);
    throw e;
  }

  const rawCompletionText = await completion.text();
  if (!completion.ok) {
    console.error("[/api/analyze] OpenAI HTTP error", {
      status: completion.status,
      bodyPreview: rawCompletionText.slice(0, 2000),
    });
    throw new Error(`OpenAI error: ${rawCompletionText.slice(0, 500)}`);
  }

  let apiData: unknown;
  try {
    apiData = JSON.parse(rawCompletionText) as unknown;
  } catch (e) {
    console.error("[/api/analyze] OpenAI response body is not valid JSON", {
      error: e instanceof Error ? e.message : String(e),
      preview: rawCompletionText.slice(0, 2500),
    });
    throw new Error("Invalid JSON in OpenAI API response body");
  }

  const wrapped = apiData as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = wrapped.choices?.[0]?.message?.content ?? "";

  console.log("[/api/analyze] OpenAI assistant message", {
    contentLength: content.length,
    contentPreview: content.slice(0, 500),
    resumeCharsUsed: resumeSlice.length,
    jobCharsUsed: jobSlice.length,
  });

  const obj = extractJsonObject(content, "/api/analyze");

  console.log("[/api/analyze] Parsed model JSON", {
    keys: Object.keys(obj).sort(),
    ...summarizeOpenAIResult(obj),
  });

  return {
    keywords: obj.keywords,
    matchedStrengths: obj.matchedStrengths,
    gaps: obj.gaps,
    rewrites: obj.rewrites,
    atsScore: obj.atsScore,
    experienceMatch: obj.experienceMatch,
    educationMatch: obj.educationMatch,
    quickWins: obj.quickWins,
    intro: obj.intro,
    starStories: obj.starStories,
  };
}

export async function POST(request: Request) {
  const routePath = new URL(request.url).pathname;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnalyzeBody(body);
  if (!parsed.ok) {
    return jsonNoStore(
      { error: parsed.error },
      { status: parsed.status },
    );
  }
  const analyzeInput = parsed;

  if (!OPENAI_API_KEY) {
    return jsonNoStore(
      { error: "Missing OPENAI_API_KEY on the server" },
      { status: 503 },
    );
  }

  type JobResolveOk = { ok: true; text: string; jobLink: string | null };
  type JobResolvePaste = {
    ok: false;
    jobTextPasteRequired: true;
    message: string;
    jobLink: string | null;
  };

  async function resolveJobDescription(): Promise<JobResolveOk | JobResolvePaste> {
    if (analyzeInput.job.kind === "text") {
      const text = analyzeInput.job.text.replace(/\s+/g, " ").trim();
      const jobLink = analyzeInput.job.urlContext ?? null;
      return {
        ok: true,
        text: text.slice(0, MAX_JOB_CHARS),
        jobLink,
      };
    }

    const url = analyzeInput.job.url;
    const scraped = await fetchJobDescriptionFromUrlWithDetails(
      url,
      JOB_PAGE_FETCH_TIMEOUT_MS,
    );
    if (!scraped.ok) {
      return {
        ok: false,
        jobTextPasteRequired: true,
        message: scraped.message,
        jobLink: url,
      };
    }
    const text = scraped.text.replace(/\s+/g, " ").trim();
    if (text.length < JOB_FETCH_MIN_MEANINGFUL_CHARS) {
      return {
        ok: false,
        jobTextPasteRequired: true,
        message: JOB_PASTE_FALLBACK_USER_MESSAGE,
        jobLink: url,
      };
    }
    return {
      ok: true,
      text: text.slice(0, MAX_JOB_CHARS),
      jobLink: url,
    };
  }

  const tJob0 = Date.now();
  const resolved = await resolveJobDescription();
  const msJobResolve = Date.now() - tJob0;
  if (!resolved.ok) {
    console.log("[/api/analyze] Job URL/text requires paste fallback", {
      msJobResolve,
      jobLink: resolved.jobLink,
    });
    return jsonNoStore(
      {
        jobTextPasteRequired: true,
        jobTextPasteMessage: resolved.message,
        jobLink: resolved.jobLink,
      },
      { status: 200 },
    );
  }

  const jobDescription = resolved.text;
  const resolvedJobLink = resolved.jobLink;

  const tResume0 = Date.now();
  const resumeText = await cleanResumeToPlainText(analyzeInput.resume);
  const msResumeClean = Date.now() - tResume0;
  const fp = resumeTextFingerprint(resumeText);
  console.log(
    `[${routePath}] resume fingerprint`,
    JSON.stringify({
      length: fp.length,
      sha256Prefix: fp.sha256Prefix,
    }),
  );

  if (resumeText.length < MIN_MEANINGFUL_CHARS) {
    return jsonNoStore(
      {
        error:
          "Could not extract enough readable text from your resume. Try: a .txt/.md file; a PDF with selectable text (not a scan); or .docx. Legacy .doc is not supported.",
      },
      { status: 400 },
    );
  }

  try {
    const tAi0 = Date.now();
    const result = await runAnalyzeOpenAI({
      resume: resumeText,
      jobDescription,
    });
    const msOpenAI = Date.now() - tAi0;
    console.log("[/api/analyze] Analyze pipeline timings (ms)", {
      msJobResolve,
      msResumeClean,
      msOpenAI,
      jobDescLen: jobDescription.length,
      resumeLen: resumeText.length,
      ...summarizeOpenAIResult(result),
    });
    return jsonNoStore({
      ...result,
      resolvedJobPosting: jobDescription,
      jobLink: resolvedJobLink,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/analyze] Analyze failed", {
      msJobResolve,
      msResumeClean,
      error: msg,
    });
    if (msg.includes("insufficient_quota") || msg.includes("billing")) {
      return jsonNoStore(
        {
          error: "OpenAI quota or billing issue. Add credits in your OpenAI account.",
        },
        { status: 402 },
      );
    }
    if (msg.includes("timed out")) {
      return jsonNoStore(
        {
          error:
            "Analysis timed out. Try again with a shorter job description or paste the posting text instead of only a URL.",
        },
        { status: 504 },
      );
    }
    return jsonNoStore(
      {
        error: "Analysis didn't complete. Try again in a moment.",
      },
      { status: 500 },
    );
  }
}
