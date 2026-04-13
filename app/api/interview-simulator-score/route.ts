import type { InterviewSimulatorScoreResult } from "@/lib/interviewSimulatorScore";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { getOpenAiApiKey } from "@/lib/getOpenAiApiKey";
import { requirePremiumForApi } from "@/lib/requirePremiumForApi";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

const SYSTEM_PROMPT = `You are an expert interview coach. Score the following interview answer on 3 dimensions, each out of 10:
1. Clarity — is the answer clear and easy to follow?
2. Specificity — does it use concrete examples and details?
3. STAR method — does it cover Situation, Task, Action, Result?

Return ONLY valid JSON in this exact format:
{
  "clarity": { "score": 7, "feedback": "one sentence" },
  "specificity": { "score": 6, "feedback": "one sentence" },
  "star": { "score": 8, "feedback": "one sentence" },
  "overall": 7,
  "top_strength": "one sentence about what they did best",
  "top_fix": "one sentence about the single most important improvement"
}`;

function extractAnthropicText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as { content?: { type?: string; text?: string }[] };
  const blocks = d.content;
  if (!Array.isArray(blocks)) return "";
  const textBlock = blocks.find((b) => b.type === "text" && b.text);
  return (textBlock?.text ?? "").trim();
}

function extractOpenAIText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as {
    choices?: { message?: { content?: string } }[];
  };
  return (d.choices?.[0]?.message?.content ?? "").trim();
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* try substring */
  }
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(jsonStr.slice(start, end + 1)) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error("Invalid JSON");
}

function numInRange(n: unknown, min: number, max: number): number | null {
  let v: number;
  if (typeof n === "number" && Number.isFinite(n)) {
    v = Math.round(n);
  } else if (typeof n === "string") {
    const parsed = parseFloat(n);
    if (!Number.isFinite(parsed)) return null;
    v = Math.round(parsed);
  } else {
    return null;
  }
  if (v < min || v > max) return null;
  return v;
}

function parseDim(raw: unknown): { score: number; feedback: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const score = numInRange(o.score, 0, 10);
  if (score === null) return null;
  const feedback = typeof o.feedback === "string" ? o.feedback.trim() : "";
  return { score, feedback };
}

async function callAnthropicForScore(
  userMessage: string,
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const rawText = await res.text();
    if (!res.ok) {
      console.error("[interview-simulator-score/anthropic]", res.status, rawText.slice(0, 300));
      return null;
    }
    let data: unknown;
    try { data = JSON.parse(rawText) as unknown; } catch { return null; }
    return extractAnthropicText(data) || null;
  } catch (e) {
    console.error("[interview-simulator-score/anthropic]", e);
    return null;
  }
}

async function callOpenAIForScore(
  userMessage: string,
  openaiKey: string | undefined,
): Promise<string | null> {
  if (!openaiKey) return null;
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
    const rawText = await res.text();
    if (!res.ok) {
      console.error("[interview-simulator-score/openai]", res.status, rawText.slice(0, 300));
      return null;
    }
    let data: unknown;
    try { data = JSON.parse(rawText) as unknown; } catch { return null; }
    return extractOpenAIText(data) || null;
  } catch (e) {
    console.error("[interview-simulator-score/openai]", e);
    return null;
  }
}

export async function POST(request: Request) {
  const premiumGate = await requirePremiumForApi(request);
  if (!premiumGate.ok) return premiumGate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question.trim() : "";
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";

  if (!question || !answer) {
    return jsonNoStore(
      { error: "Question and answer are required." },
      { status: 400 },
    );
  }
  if (answer.length > 24_000) {
    return jsonNoStore({ error: "Answer is too long." }, { status: 400 });
  }

  const userMessage = `Question: ${question}\n\nAnswer: ${answer}`;
  const openaiKey = getOpenAiApiKey();

  // Try Anthropic first, fall back to OpenAI
  let text = await callAnthropicForScore(userMessage);
  if (!text) {
    text = await callOpenAIForScore(userMessage, openaiKey);
  }

  if (!text) {
    return jsonNoStore(
      { error: "Scoring is temporarily unavailable — check back soon." },
      { status: 503 },
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(text);
  } catch {
    return jsonNoStore(
      { error: "Could not score answer — try again." },
      { status: 502 },
    );
  }

  const clarity = parseDim(parsed.clarity);
  const specificity = parseDim(parsed.specificity);
  const star = parseDim(parsed.star);
  const overall = numInRange(parsed.overall, 0, 10);
  const top_strength =
    typeof parsed.top_strength === "string" ? parsed.top_strength.trim() : "";
  const top_fix =
    typeof parsed.top_fix === "string" ? parsed.top_fix.trim() : "";

  if (overall === null || !top_strength || !top_fix) {
    return jsonNoStore(
      { error: "Could not score answer — try again." },
      { status: 502 },
    );
  }

  // Use dimension scores when available; fall back to overall for any missing dimension
  const dimFallback = { score: overall, feedback: "" };
  const payload: InterviewSimulatorScoreResult = {
    clarity: clarity ?? dimFallback,
    specificity: specificity ?? dimFallback,
    star: star ?? dimFallback,
    overall,
    top_strength,
    top_fix,
  };

  return jsonNoStore({ score: payload });
}
