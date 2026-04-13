import { extractKeyRequirementsFromJob, MAX_JOB_CHARS } from "@/lib/jobDescription";
import { extractJobTitleAndCompany } from "@/lib/jobMetaFromPosting";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import type { CoverLength, CoverTone } from "@/lib/parseCoverLetterBody";
import { parseCoverLetterBody } from "@/lib/parseCoverLetterBody";
import { resumeTextFingerprint } from "@/lib/resumeFingerprint";
import { cleanResumeToPlainText } from "@/lib/resumeText";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

function lengthGuidance(len: CoverLength): string {
  switch (len) {
    case "short":
      return "Target about 130–200 words total. Tight paragraphs.";
    case "detailed":
      return "Target about 320–420 words. Allow two substantial body paragraphs.";
    default:
      return "Target about 220–320 words. Balanced depth.";
  }
}

function toneGuidance(tone: CoverTone): string {
  switch (tone) {
    case "concise":
      return "Tone: direct and economical. Short sentences. No filler clauses.";
    case "storytelling":
      return "Tone: narrative where it helps—brief scene-setting, then outcomes. Still professional.";
    default:
      return "Tone: confident and professional. Active voice. Clear claims tied to evidence.";
  }
}

async function runCoverLetterOpenAI(params: {
  openaiApiKey: string;
  resumeText: string;
  jobDescription: string;
  jobLink: string;
  title: string;
  company: string;
  tone: CoverTone;
  length: CoverLength;
  topRequirements: string[];
}): Promise<string> {
  try {
    const system = `COVER LETTER PROMPT:
You are an elite career coach who has helped candidates land roles at Google, Apple, and top startups. Write a cover letter that feels human, confident, and specifically crafted for this exact role — not a template.

Resume: {resumeText}
Job Posting: {jobText}
Tone: {tone} (Concise = direct and punchy, Confident = assertive and achievement-focused, Storytelling = narrative-driven with a personal arc)
Length: {length} (Short = 150 words, Standard = 250 words, Detailed = 380 words)

Rules you must follow:
- SALUTATION: If exactCompanyName is provided and non-empty, write "Dear [exactCompanyName] Team,". Otherwise write "Dear Hiring Manager,". Never invent a person's name.
- OPENING LINE: The very first sentence of the letter body must follow this exact formula: "I am writing to express my interest in the [exactJobTitle] role at [exactCompanyName]." (If no company name is available, omit "at [company]".) Never place a task description or job duty in the opening line. Never wrap the title in quotes or rephrase it as a duty.
- Never quote the job description word for word — always paraphrase and make it first-person
- Every paragraph must reference something SPECIFIC from the resume — a real project, metric, or skill
- Sound like a real ambitious human wrote this, not an AI
- Vary sentence length for natural rhythm
- End with a confident close — not "I hope to hear from you"
- Sign off as "Sincerely," followed by a blank line — do not write [Your Name]
- Each regeneration must produce a meaningfully different letter — different body paragraphs, different examples pulled from the resume (the opening formula stays constant)`;

    const user = `resumeText:
${params.resumeText.slice(0, 24_000)}

jobText:
${params.jobDescription.slice(0, MAX_JOB_CHARS)}

tone: ${params.tone}
length: ${params.length}
exactJobTitle: ${params.title}
exactCompanyName: ${params.company}
jobLink: ${params.jobLink}
toneGuidance: ${toneGuidance(params.tone)}
lengthGuidance: ${lengthGuidance(params.length)}
criticalRequirements:
${params.topRequirements.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join("\n")}`;

    const completion = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${params.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens:
          params.length === "short" ? 500 : params.length === "detailed" ? 1200 : 800,
        temperature: 0.45,
      }),
    });

    if (!completion.ok) {
      const err = await completion.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = (await completion.json()) as {
        choices?: { message?: { content?: string } }[];
      };
    } catch {
      throw new Error("OpenAI returned invalid JSON.");
    }
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Cover letter generation failed",
    );
  }
}

const MIN_RESUME_CHARS = 40;

export async function POST(request: Request) {
  const routePath = new URL(request.url).pathname;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseCoverLetterBody(body);
  if (!parsed.ok) {
    return jsonNoStore(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  const keyCheck = requireOpenAiApiKey();
  if (!keyCheck.ok) {
    return jsonNoStore({ error: keyCheck.error }, { status: 503 });
  }

  let resumeText: string;
  try {
    resumeText = await cleanResumeToPlainText(parsed.resume);
  } catch {
    return jsonNoStore(
      { error: "Could not read resume text." },
      { status: 400 },
    );
  }

  {
    const fp = resumeTextFingerprint(resumeText);
    console.log(
      `[${routePath}] resume fingerprint`,
      JSON.stringify({ length: fp.length, sha256Prefix: fp.sha256Prefix }),
    );
  }

  if (resumeText.length < MIN_RESUME_CHARS) {
    return jsonNoStore(
      { error: "Resume text is too short to generate a cover letter." },
      { status: 400 },
    );
  }

  const jobText = parsed.jobPosting;
  if (!resumeText || !jobText) {
    return jsonNoStore(
      { error: "Missing resume or job text" },
      { status: 400 },
    );
  }
  if (!parsed.tone || !parsed.length) {
    return jsonNoStore(
      { error: "Missing tone or length" },
      { status: 400 },
    );
  }

  const topRequirements = extractKeyRequirementsFromJob(jobText).slice(0, 3);

  // Caller-provided values take priority over extraction
  const { title: extractedTitle, company: extractedCompany } =
    extractJobTitleAndCompany(jobText, parsed.jobLink);

  const title = parsed.jobTitle || extractedTitle;
  const company = parsed.jobCompany || extractedCompany;

  // If still no title after extraction, signal the client to ask the user
  if (!title) {
    return jsonNoStore({ error: "MISSING_JOB_META" }, { status: 422 });
  }
  // company is optional — prompt falls back gracefully when empty

  try {
    const letter = await runCoverLetterOpenAI({
      openaiApiKey: keyCheck.key,
      resumeText,
      jobDescription: jobText,
      jobLink: parsed.jobLink,
      title,
      company,
      tone: parsed.tone,
      length: parsed.length,
      topRequirements,
    });
    if (!letter) {
      return jsonNoStore(
        { error: "Empty response from model" },
        { status: 500 },
      );
    }
    return jsonNoStore({ letter });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cover letter generation failed";
    return jsonNoStore({ error: msg }, { status: 500 });
  }
}
