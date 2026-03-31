import { NextResponse } from "next/server";
import { extractKeyRequirementsFromJob, MAX_JOB_CHARS } from "@/lib/jobDescription";
import type { CoverLength, CoverTone } from "@/lib/parseCoverLetterBody";
import { parseCoverLetterBody } from "@/lib/parseCoverLetterBody";
import { cleanResumeToPlainText } from "@/lib/resumeText";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

function detectCompanyFromLink(jobLink: string): string {
  try {
    const host = new URL(jobLink).hostname.replace(/^www\./, "");
    if (!host || host.includes("invalid")) return "";
    const base = host.split(".")[0]?.trim() ?? "";
    return base ? base.replace(/-/g, " ") : "";
  } catch {
    return "";
  }
}

function extractJobTitleAndCompany(jobPosting: string, jobLink: string): {
  title: string;
  company: string;
} {
  const lines = jobPosting
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);

  let title = "";
  let company = "";

  for (const line of lines) {
    if (!title && line.length >= 4 && line.length <= 90) {
      if (/engineer|developer|manager|analyst|designer|scientist|specialist|lead|intern|architect/i.test(line)) {
        title = line.replace(/^#+\s*/, "").trim();
      }
    }
    if (!company) {
      const m = line.match(
        /\b(?:at|@|company[:\s])\s+([A-Z][A-Za-z0-9&.\- ]{1,50})/i,
      );
      if (m?.[1]) company = m[1].trim();
    }
  }

  if (!title) title = lines[0]?.replace(/^#+\s*/, "").trim() || "";
  if (!company) {
    company =
      lines.find((l) => /company|about us|about the company/i.test(l))
        ?.replace(/.*?:\s*/, "")
        .trim()
        .slice(0, 50) ||
      detectCompanyFromLink(jobLink);
  }

  return { title, company };
}

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
- First line must name the exact job title and company extracted from the posting
- Never quote the job description word for word — always paraphrase and make it first-person
- Every paragraph must reference something SPECIFIC from the resume — a real project, metric, or skill
- Sound like a real ambitious human wrote this, not an AI
- Vary sentence length for natural rhythm
- End with a confident close — not "I hope to hear from you"
- Sign off as "Sincerely," followed by a blank line — do not write [Your Name]
- Each regeneration must produce a meaningfully different letter — different opening line, different structure, different examples pulled from the resume`;

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
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseCoverLetterBody(body);
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

  let resumeText: string;
  try {
    resumeText = await cleanResumeToPlainText(parsed.resume);
  } catch {
    return NextResponse.json(
      { error: "Could not read resume text." },
      { status: 400 },
    );
  }

  if (resumeText.length < MIN_RESUME_CHARS) {
    return NextResponse.json(
      { error: "Resume text is too short to generate a cover letter." },
      { status: 400 },
    );
  }

  const jobText = parsed.jobPosting;
  if (!resumeText || !jobText) {
    return NextResponse.json(
      { error: "Missing resume or job text" },
      { status: 400 },
    );
  }
  if (!parsed.tone || !parsed.length) {
    return NextResponse.json(
      { error: "Missing tone or length" },
      { status: 400 },
    );
  }

  const topRequirements = extractKeyRequirementsFromJob(jobText).slice(
    0,
    3,
  );
  const { title, company } = extractJobTitleAndCompany(
    jobText,
    parsed.jobLink,
  );
  if (!title || !company) {
    return NextResponse.json(
      {
        error:
          "Could not extract exact job title and company from the posting text.",
      },
      { status: 400 },
    );
  }

  try {
    const letter = await runCoverLetterOpenAI({
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
      return NextResponse.json(
        { error: "Empty response from model" },
        { status: 500 },
      );
    }
    return NextResponse.json({ letter });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cover letter generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
