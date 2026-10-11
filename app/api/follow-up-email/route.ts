import { extractJobTitleAndCompany } from "@/lib/jobMetaFromPosting";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";
import { cleanResumeToPlainText } from "@/lib/resumeText";
import { requirePremiumForApi } from "@/lib/requirePremiumForApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are a professional job application assistant. Generate a short, confident, non-desperate follow-up email for a job applicant. Use the resume and job posting context provided.
Keep it under 120 words. Subject line + body only.
Do not use phrases like "I hope this email finds you well" or "I wanted to circle back". Sound human and direct.
Output format:
Subject: [subject line]

[email body]`;

function extractOpenAIText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as {
    choices?: { message?: { content?: string } }[];
  };
  return (d.choices?.[0]?.message?.content ?? "").trim();
}

export async function POST(request: Request) {
  const premiumGate = await requirePremiumForApi(request);
  if (!premiumGate.ok) return premiumGate.response;

  const keyCheck = requireOpenAiApiKey();
  if (!keyCheck.ok) {
    return jsonNoStore({ error: keyCheck.error }, { status: 503 });
  }
  const openaiKey = keyCheck.key;

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
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
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

    const text = extractOpenAIText(data);
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
