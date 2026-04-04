import type { PredictedQuestion } from "@/lib/analysisTypes";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { cleanResumeToPlainText } from "@/lib/resumeText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

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
    /* fallback */
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
  throw new Error("Could not parse JSON");
}

function parseQuestions(
  raw: unknown,
  kind: "behavioral" | "technical",
): PredictedQuestion[] {
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
    if (question && context && fullAnswer && tip) {
      out.push({ question, context, fullAnswer, tip, kind });
    }
  }
  return out.slice(0, 3);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const kindRaw = typeof o.kind === "string" ? o.kind.trim().toLowerCase() : "";
  const kind: "behavioral" | "technical" =
    kindRaw === "technical" ? "technical" : "behavioral";

  if (!OPENAI_API_KEY) {
    return jsonNoStore(
      { error: "Missing OPENAI_API_KEY on the server" },
      { status: 503 },
    );
  }

  const resumeIn = typeof o.resume === "string" ? o.resume : "";
  const jobPosting = typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const existingQuestions = Array.isArray(o.existingQuestions)
    ? o.existingQuestions.filter((q): q is string => typeof q === "string")
    : [];

  let resumeText: string;
  try {
    resumeText = await cleanResumeToPlainText(resumeIn);
  } catch {
    return jsonNoStore(
      { error: "Could not read resume content." },
      { status: 400 },
    );
  }

  if (resumeText.length < 80) {
    return jsonNoStore(
      { error: "Resume must contain enough readable text." },
      { status: 400 },
    );
  }
  if (jobPosting.length < 80) {
    return jsonNoStore(
      { error: "Job description must be at least 80 characters." },
      { status: 400 },
    );
  }

  const avoid = existingQuestions.length
    ? `Do not repeat or paraphrase these questions:\n${existingQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n`
    : "";

  const userContent = `${avoid}Generate exactly 3 new ${kind} interview questions for this candidate and role. Each must include a specific suggested answer grounded in their resume and the job.

Return JSON with key "questions" — array of exactly 3 objects, each with keys: question (string), context (why interviewers ask), fullAnswer (detailed answer they can practice), tip (one practical tip).

Resume (plain text):
${resumeText.slice(0, 12_000)}

Job posting:
${jobPosting.slice(0, 18_000)}

CRITICAL FORMATTING RULES:
- intro must be written as natural spoken English a real person would say out loud in an interview. No dashes, no structured format, no skill — example — relevance pattern. Just flowing conversational sentences.

- Every fullAnswer must be written as a complete natural paragraph the candidate can actually say or adapt. No dashes or structured data patterns. Write it as if coaching someone on exactly what to say, in first person. Aim for about five to six sentences so it sounds like something you would actually say out loud, not a bullet list or template.

- Bad format: 'Java — built X — shows Y'
- Good format: 'In my project work, I built X using Java which directly demonstrates Y'

All text fields must read like a human wrote them for a human to speak aloud.`;

  try {
    const completion = await fetch(OPENAI_API_URL, {
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
        temperature: 0.45,
      }),
    });

    if (!completion.ok) {
      return jsonNoStore(
        { error: "Could not generate more questions right now. Try again." },
        { status: 502 },
      );
    }

    const apiData = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = apiData.choices?.[0]?.message?.content ?? "";
    const obj = extractJsonObject(content);
    const questions = parseQuestions(obj.questions, kind);
    if (questions.length === 0) {
      return jsonNoStore(
        { error: "Could not parse generated questions. Try again." },
        { status: 502 },
      );
    }
    return jsonNoStore({ questions });
  } catch {
    return jsonNoStore(
      { error: "Could not generate more questions right now. Try again." },
      { status: 500 },
    );
  }
}
