import type { SalaryCoachResult } from "@/lib/salaryCoachTypes";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

function buildUserContent(params: {
  jobTitle: string;
  offeredSalary: string;
  location: string;
  competingOffer: string;
}): string {
  const { jobTitle, offeredSalary, location, competingOffer } = params;
  return `You are an expert salary negotiation coach.
Generate a practical, word-for-word negotiation script.

Job: ${jobTitle}
Offered salary: ${offeredSalary}
Location: ${location || "Not specified"}
Competing offer: ${competingOffer || "None"}

Return a JSON object with exactly these keys (no markdown, no prose outside JSON):
- market_rate: string, estimated range e.g. "$95,000–$115,000"
- market_note: string, one sentence explaining why
- counteroffer: string, exact number to ask for e.g. "$98,000"
- sections: array of objects, each with "title" and "content" strings. Include at least these five (titles may be lightly adapted but keep the same intent):
  1) Opening email to send
  2) What to say on the phone
  3) If they say they cannot go higher
  4) If they ask for time to decide
  5) If they meet your number

Every "content" value must be full word-for-word text the user can copy.`;
}

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
  throw new Error("Invalid JSON");
}

function parseResult(raw: Record<string, unknown>): SalaryCoachResult | null {
  const market_rate =
    typeof raw.market_rate === "string" ? raw.market_rate.trim() : "";
  const market_note =
    typeof raw.market_note === "string" ? raw.market_note.trim() : "";
  const counteroffer =
    typeof raw.counteroffer === "string" ? raw.counteroffer.trim() : "";
  const sectionsRaw = raw.sections;
  if (!market_rate || !market_note || !counteroffer || !Array.isArray(sectionsRaw)) {
    return null;
  }
  const sections: SalaryCoachResult["sections"] = [];
  for (const item of sectionsRaw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const content = typeof o.content === "string" ? o.content.trim() : "";
    if (title && content) {
      sections.push({ title, content });
    }
  }
  if (sections.length === 0) return null;
  return { market_rate, market_note, counteroffer, sections };
}

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return jsonNoStore(
      { error: "Missing OPENAI_API_KEY on the server" },
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
  const jobTitle = typeof o.jobTitle === "string" ? o.jobTitle.trim() : "";
  const offeredSalary =
    typeof o.offeredSalary === "string" ? o.offeredSalary.trim() : "";
  const location = typeof o.location === "string" ? o.location.trim() : "";
  const competingOffer =
    typeof o.competingOffer === "string" ? o.competingOffer.trim() : "";

  if (!jobTitle || !offeredSalary) {
    return jsonNoStore(
      { error: "Job title and offered salary are required." },
      { status: 400 },
    );
  }

  const userContent = buildUserContent({
    jobTitle,
    offeredSalary,
    location,
    competingOffer,
  });

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: userContent }],
        max_tokens: 4096,
        temperature: 0.5,
      }),
    });

    const rawText = await res.text();
    let apiData: unknown;
    try {
      apiData = JSON.parse(rawText) as unknown;
    } catch {
      return jsonNoStore(
        { error: "Something went wrong generating your script. Please try again." },
        { status: 502 },
      );
    }

    if (!res.ok) {
      console.error("[salary-coach]", res.status, rawText.slice(0, 400));
      return jsonNoStore(
        { error: "Something went wrong generating your script. Please try again." },
        { status: 502 },
      );
    }

    const choices = (apiData as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices;
    const text = choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return jsonNoStore(
        { error: "Something went wrong generating your script. Please try again." },
        { status: 502 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(text);
    } catch {
      return jsonNoStore(
        { error: "Something went wrong generating your script. Please try again." },
        { status: 502 },
      );
    }

    const result = parseResult(parsed);
    if (!result) {
      return jsonNoStore(
        { error: "Something went wrong generating your script. Please try again." },
        { status: 502 },
      );
    }

    return jsonNoStore({ result });
  } catch (e) {
    console.error("[salary-coach]", e);
    return jsonNoStore(
      { error: "Something went wrong generating your script. Please try again." },
      { status: 502 },
    );
  }
}
