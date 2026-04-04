import { extractJobTitleAndCompany } from "@/lib/jobMetaFromPosting";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { cleanResumeToPlainText } from "@/lib/resumeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";

const SYSTEM_PROMPT = `You are a professional job application assistant. Generate a short, confident, non-desperate follow-up email for a job applicant. Use the resume and job posting context provided.
Keep it under 120 words. Subject line + body only.
Do not use phrases like "I hope this email finds you well" or "I wanted to circle back". Sound human and direct.
Output format:
Subject: [subject line]

[email body]`;

function extractAnthropicText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as {
    content?: { type?: string; text?: string }[];
  };
  const blocks = d.content;
  if (!Array.isArray(blocks)) return "";
  const textBlock = blocks.find((b) => b.type === "text" && b.text);
  return (textBlock?.text ?? "").trim();
}

export async function POST(request: Request) {
  if (!ANTHROPIC_API_KEY) {
    return jsonNoStore(
      { error: "Missing ANTHROPIC_API_KEY on the server" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const resumeRaw = typeof o.resume === "string" ? o.resume : "";
  const jobPosting = typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const jobLink = typeof o.jobLink === "string" ? o.jobLink.trim() : "";
  const daysRaw = o.daysSinceApplied;
  const daysSinceApplied =
    typeof daysRaw === "number" && Number.isFinite(daysRaw)
      ? Math.min(30, Math.max(1, Math.round(daysRaw)))
      : 7;
  const hiringManagerName =
    typeof o.hiringManagerName === "string"
      ? o.hiringManagerName.trim().slice(0, 80)
      : "";

  if (!resumeRaw.trim()) {
    return jsonNoStore(
      { error: "Resume text is required." },
      { status: 400 },
    );
  }
  if (jobPosting.length < 40) {
    return jsonNoStore(
      { error: "Job posting context is too short. Run analysis with a full job description." },
      { status: 400 },
    );
  }

  const resumePlain = await cleanResumeToPlainText(resumeRaw);
  const resumeSummary = resumePlain.slice(0, 3_500);
  const { title, company } = extractJobTitleAndCompany(jobPosting, jobLink);
  const jobTitle = title || "this role";
  const companyName = company || "the company";
  const managerLabel =
    hiringManagerName.length > 0 ? hiringManagerName : "the hiring manager";

  const userMessage = `Resume summary: ${resumeSummary}

Job: ${jobTitle} at ${companyName}. Applied ${daysSinceApplied} days ago. Hiring manager: ${managerLabel}.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const rawText = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      return jsonNoStore(
        { error: "Couldn't generate — try again" },
        { status: 502 },
      );
    }

    if (!res.ok) {
      const errObj = data as { error?: { message?: string } };
      const msg = errObj?.error?.message ?? rawText.slice(0, 200);
      console.error("[follow-up-email]", res.status, msg);
      return jsonNoStore(
        { error: "Couldn't generate — try again" },
        { status: res.status >= 500 ? 502 : 400 },
      );
    }

    const text = extractAnthropicText(data);
    if (!text) {
      return jsonNoStore(
        { error: "Couldn't generate — try again" },
        { status: 502 },
      );
    }

    return jsonNoStore({ email: text });
  } catch (e) {
    console.error("[follow-up-email]", e);
    return jsonNoStore(
      { error: "Couldn't generate — try again" },
      { status: 502 },
    );
  }
}
