import type {
  ResumeEditorAtsResult,
  ResumeEditorQuickFix,
} from "@/lib/resumeEditorAtsTypes";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

const ATS_SYSTEM = `You are an ATS (Applicant Tracking System) scoring engine.
Score the resume strictly based on keyword presence, relevant experience match, and skill alignment with the job posting.

IMPORTANT RULES:
- If a keyword from the job posting appears anywhere in the resume, count it as present
- Score should INCREASE when relevant keywords are added
- Score should NEVER decrease just because of formatting
- Score range: 0-100
- Be consistent: same resume + same job = same score
- Only penalize for genuinely missing required skills`;

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

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim());
}

function asQuickFixes(v: unknown): ResumeEditorQuickFix[] {
  if (!Array.isArray(v)) return [];
  const out: ResumeEditorQuickFix[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const summary =
      typeof o.summary === "string"
        ? o.summary.trim()
        : typeof o.label === "string"
          ? o.label.trim()
          : "";
    const target_phrase =
      typeof o.target_phrase === "string"
        ? o.target_phrase.trim()
        : typeof o.target === "string"
          ? o.target.trim()
          : "";
    const replacement =
      typeof o.replacement === "string"
        ? o.replacement.trim()
        : typeof o.improved === "string"
          ? o.improved.trim()
          : "";
    if (!summary) continue;
    out.push({ summary, target_phrase, replacement });
  }
  return out.slice(0, 12);
}

function parseResult(raw: Record<string, unknown>): ResumeEditorAtsResult | null {
  const atsRaw = raw.ats_score;
  const ats_score =
    typeof atsRaw === "number" && Number.isFinite(atsRaw)
      ? Math.min(100, Math.max(0, Math.round(atsRaw)))
      : null;
  if (ats_score === null) return null;
  const missing_keywords = asStringArray(raw.missing_keywords);
  const present_keywords = asStringArray(raw.present_keywords);
  let quick_fixes = asQuickFixes(raw.quick_fixes);
  if (quick_fixes.length === 0 && Array.isArray(raw.quick_wins)) {
    quick_fixes = asStringArray(raw.quick_wins).map((s) => ({
      summary: s,
      target_phrase: "",
      replacement: "",
    }));
  }
  const score_reasoning =
    typeof raw.score_reasoning === "string" ? raw.score_reasoning.trim() : "";
  return {
    ats_score,
    missing_keywords,
    present_keywords,
    quick_fixes,
    score_reasoning:
      score_reasoning || "Score reflects how well the resume matches the posting.",
  };
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
  const jobPosting =
    typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const resumeText =
    typeof o.resumeText === "string" ? o.resumeText.trim() : "";
  const previousScoreRaw = o.previousScore;
  const previousScore =
    typeof previousScoreRaw === "number" && Number.isFinite(previousScoreRaw)
      ? Math.min(100, Math.max(0, Math.round(previousScoreRaw)))
      : null;
  const recentChangeNote =
    typeof o.recentChangeNote === "string" ? o.recentChangeNote.trim() : "";

  if (!jobPosting || jobPosting.length < 80) {
    return jsonNoStore(
      { error: "Job posting is required (at least 80 characters)." },
      { status: 400 },
    );
  }
  if (!resumeText || resumeText.length < 20) {
    return jsonNoStore(
      { error: "Resume text is required." },
      { status: 400 },
    );
  }
  if (resumeText.length > 48_000) {
    return jsonNoStore({ error: "Resume text is too long." }, { status: 400 });
  }
  if (jobPosting.length > 64_000) {
    return jsonNoStore({ error: "Job posting is too long." }, { status: 400 });
  }

  const prevLine =
    previousScore !== null
      ? `Previous score was ${previousScore}. Only change the score if the resume content has meaningfully changed.`
      : "This is the first live score for this session.";

  const changeBlock = recentChangeNote
    ? `\n\nThe following improvement was just applied to the resume:\n${recentChangeNote.slice(0, 2000)}\nRescore accordingly.`
    : "";

  const userContent = `Job posting:
${jobPosting.slice(0, 50_000)}

Updated resume:
${resumeText.slice(0, 40_000)}

${prevLine}${changeBlock}

Return a JSON object with exactly these keys (no markdown, no text outside JSON):
- ats_score: integer 0-100
- missing_keywords: array of short strings (job terms still absent or only weakly present)
- present_keywords: array of short strings (clearly present in the resume text, including substring matches)
- quick_fixes: array of 2-8 objects, each with:
  - "summary": one-line actionable instruction shown in the UI
  - "target_phrase": exact substring from the CURRENT resume text to replace (must match verbatim if possible; empty string only if no specific phrase)
  - "replacement": full replacement text for that substring (can be empty if not applicable)
- score_reasoning: one concise sentence explaining the score (and mention keyword adds if relevant)`;

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
        messages: [
          { role: "system", content: ATS_SYSTEM },
          { role: "user", content: userContent },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    const rawText = await res.text();
    let apiData: unknown;
    try {
      apiData = JSON.parse(rawText) as unknown;
    } catch {
      return jsonNoStore(
        { error: "Could not parse scoring response." },
        { status: 502 },
      );
    }

    if (!res.ok) {
      console.error("[resume-editor-ats]", res.status, rawText.slice(0, 400));
      return jsonNoStore(
        { error: "Could not update score — try again." },
        { status: 502 },
      );
    }

    const choices = (apiData as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices;
    const text = choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return jsonNoStore(
        { error: "Could not update score — try again." },
        { status: 502 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(text);
    } catch {
      return jsonNoStore(
        { error: "Could not update score — try again." },
        { status: 502 },
      );
    }

    const result = parseResult(parsed);
    if (!result) {
      return jsonNoStore(
        { error: "Could not update score — try again." },
        { status: 502 },
      );
    }

    return jsonNoStore({ result });
  } catch (e) {
    console.error("[resume-editor-ats]", e);
    return jsonNoStore(
      { error: "Could not update score — try again." },
      { status: 502 },
    );
  }
}
