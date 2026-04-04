import type { InterviewSimulatorScoreResult } from "@/lib/interviewSimulatorScore";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";

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
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < min || v > max) return null;
  return v;
}

function parseDim(raw: unknown): { score: number; feedback: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const score = numInRange(o.score, 0, 10);
  const feedback =
    typeof o.feedback === "string" ? o.feedback.trim() : "";
  if (score === null || !feedback) return null;
  return { score, feedback };
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
    let data: unknown;
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      return jsonNoStore(
        { error: "Could not score answer — try again." },
        { status: 502 },
      );
    }

    if (!res.ok) {
      console.error("[interview-simulator-score]", res.status, rawText.slice(0, 300));
      return jsonNoStore(
        { error: "Could not score answer — try again." },
        { status: 502 },
      );
    }

    const text = extractAnthropicText(data);
    if (!text) {
      return jsonNoStore(
        { error: "Could not score answer — try again." },
        { status: 502 },
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
      typeof parsed.top_strength === "string"
        ? parsed.top_strength.trim()
        : "";
    const top_fix =
      typeof parsed.top_fix === "string" ? parsed.top_fix.trim() : "";

    if (!clarity || !specificity || !star || overall === null || !top_strength || !top_fix) {
      return jsonNoStore(
        { error: "Could not score answer — try again." },
        { status: 502 },
      );
    }

    const payload: InterviewSimulatorScoreResult = {
      clarity,
      specificity,
      star,
      overall,
      top_strength,
      top_fix,
    };

    return jsonNoStore({ score: payload });
  } catch (e) {
    console.error("[interview-simulator-score]", e);
    return jsonNoStore(
      { error: "Could not score answer — try again." },
      { status: 502 },
    );
  }
}
