import { appendFileSync } from "node:fs";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_RESUME_SCORE_MODEL ?? "claude-sonnet-4-20250514";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

const DEBUG_LOG = "/Users/priyankasiwach/Desktop/applyfy/.cursor/debug-67af35.log";

function dbgApi(payload: Record<string, unknown>) {
  try {
    appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "67af35",
        timestamp: Date.now(),
        ...payload,
      })}\n`,
    );
  } catch {
    /* ignore */
  }
}

function extractAnthropicText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const d = data as { content?: { type?: string; text?: string }[] };
  const blocks = d.content;
  if (!Array.isArray(blocks)) return "";
  const textBlock = blocks.find((b) => b.type === "text" && b.text);
  return (textBlock?.text ?? "").trim();
}

function stripBackticksAndParseJson(text: string): Record<string, unknown> {
  let s = text.trim();
  s = s.replace(/^`+json\s*/i, "").replace(/^`+/, "").replace(/`+$/, "");
  s = s.trim();
  try {
    const parsed = JSON.parse(s) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(s.slice(start, end + 1)) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error("Invalid JSON in model response");
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

type ScorePayload = {
  ats_score: number;
  present_keywords: string[];
  missing_keywords: string[];
  reasoning: string;
};

function toScoreResult(parsed: Record<string, unknown>): ScorePayload | null {
  const scoreRaw = parsed.ats_score;
  const ats_score =
    typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
      ? Math.min(100, Math.max(0, Math.round(scoreRaw)))
      : null;
  if (ats_score === null) return null;
  return {
    ats_score,
    present_keywords: asStringArray(parsed.present_keywords),
    missing_keywords: asStringArray(parsed.missing_keywords),
    reasoning:
      typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
  };
}

async function scoreWithAnthropic(userContent: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
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
      max_tokens: 400,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    console.error("[resume-editor-score] Anthropic non-JSON", rawText.slice(0, 400));
    return null;
  }
  if (!res.ok) {
    console.error("[resume-editor-score] Anthropic error", res.status, rawText.slice(0, 400));
    return null;
  }
  const text = extractAnthropicText(data);
  return text || null;
}

async function scoreWithOpenAI(userContent: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    console.error("[resume-editor-score] OpenAI non-JSON", rawText.slice(0, 400));
    return null;
  }
  if (!res.ok) {
    console.error("[resume-editor-score] OpenAI error", res.status, rawText.slice(0, 400));
    return null;
  }
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices;
  const text = choices?.[0]?.message?.content?.trim() ?? "";
  return text || null;
}

export async function POST(request: Request) {
  dbgApi({
    hypothesisId: "H4",
    location: "resume-editor-score/route.ts:POST",
    message: "resume-editor-score entry",
    data: {
      hasAnthropicKey: Boolean(ANTHROPIC_API_KEY),
      hasOpenaiKey: Boolean(OPENAI_API_KEY),
    },
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const jobPosting =
    typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const resumeTextFixed =
    typeof o.resumeText === "string" ? o.resumeText.trim() : "";

  const prevRaw = o.previousScore;
  const previousScore =
    typeof prevRaw === "number" && Number.isFinite(prevRaw)
      ? Math.min(100, Math.max(0, Math.round(prevRaw)))
      : 0;

  if (!jobPosting || jobPosting.length < 40) {
    return jsonNoStore(
      { error: "Job posting is required." },
      { status: 400 },
    );
  }
  if (!resumeTextFixed || resumeTextFixed.length < 10) {
    return jsonNoStore({ error: "Resume text is required." }, { status: 400 });
  }
  if (resumeTextFixed.length > 48_000) {
    return jsonNoStore({ error: "Resume text is too long." }, { status: 400 });
  }

  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
    return jsonNoStore(
      {
        error:
          "No AI key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY on the server.",
      },
      { status: 503 },
    );
  }

  const userContent = `Score this resume against the job posting for ATS keyword match. Be consistent and accurate. If a keyword from the job appears anywhere in the resume text count it as present. Previous score was ${previousScore} — only change significantly if content changed significantly.

Job posting:
${jobPosting.slice(0, 60_000)}

Resume:
${resumeTextFixed.slice(0, 40_000)}

Return ONLY this JSON with no markdown:
{"ats_score": 72, "present_keywords": ["AWS", "Python"], "missing_keywords": ["SQL", "Machine Learning"], "reasoning": "one sentence"}`;

  try {
    let rawModelText: string | null = null;
    let provider: "anthropic" | "openai" | null = null;

    if (ANTHROPIC_API_KEY) {
      rawModelText = await scoreWithAnthropic(userContent);
      if (rawModelText) provider = "anthropic";
    }
    if (!rawModelText && OPENAI_API_KEY) {
      rawModelText = await scoreWithOpenAI(userContent);
      if (rawModelText) provider = "openai";
    }

    dbgApi({
      hypothesisId: "H4-fix",
      location: "resume-editor-score/route.ts:POST",
      message: "model text received",
      data: { provider, textLen: rawModelText?.length ?? 0 },
    });

    if (!rawModelText) {
      return jsonNoStore(
        { error: "Score update failed." },
        { status: 502 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = stripBackticksAndParseJson(rawModelText);
    } catch (e) {
      console.error("[resume-editor-score] JSON parse", e, rawModelText.slice(0, 500));
      return jsonNoStore(
        { error: "Could not parse score response." },
        { status: 502 },
      );
    }

    const result = toScoreResult(parsed);
    if (!result) {
      return jsonNoStore(
        { error: "Invalid score in response." },
        { status: 502 },
      );
    }

    return jsonNoStore({ result });
  } catch (e) {
    console.error("[resume-editor-score]", e);
    return jsonNoStore(
      { error: "Score update failed." },
      { status: 502 },
    );
  }
}
