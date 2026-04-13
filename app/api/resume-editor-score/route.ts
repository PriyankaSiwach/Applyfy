import { createHash } from "node:crypto";

import { verifyKeywordsAgainstResume } from "@/lib/atsDeterministicKeywords";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { filterKeywordLabelsToJobPosting } from "@/lib/jobKeywordInPosting";
import { filterAtsKeywordLabels } from "@/lib/jobKeywordSanitize";
import { parseResumeIntoBlocks } from "@/lib/resumeEditorBlocks";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

function extractBulletLines(resumePlain: string): string {
  const blocks = parseResumeIntoBlocks(resumePlain.replace(/\r\n/g, "\n"));
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind !== "bullet") continue;
    lines.push(...b.lines);
  }
  const joined = lines.join("\n").trim();
  return joined.length > 0 ? joined : resumePlain.slice(0, 12_000);
}

function stripJsonObject(text: string): Record<string, unknown> {
  let s = text.trim();
  s = s.replace(/^`+json\s*/i, "").replace(/^`+/, "").replace(/`+$/, "");
  s = s.trim();
  const parsed = JSON.parse(s) as unknown;
  if (typeof parsed === "object" && parsed !== null) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("Invalid JSON");
}

async function fetchBulletQualityScore25(
  resumeBullets: string,
  openaiKey: string,
): Promise<number> {
  if (!openaiKey) return 0;
  const user = `Rate the overall strength of these resume bullets on a scale of 0-25 only.
Consider: strong action verbs, specificity, and measurable outcomes where present.
Return ONE JSON object only, no markdown: {"quality_score": <integer 0-25>}

BULLETS:
${resumeBullets.slice(0, 24_000)}`;

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 80,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON with a single integer quality_score 0-25.",
        },
        { role: "user", content: user },
      ],
    }),
  });
  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    console.error("[resume-editor-score] quality OpenAI non-JSON", rawText.slice(0, 400));
    return 0;
  }
  if (!res.ok) {
    console.error("[resume-editor-score] quality OpenAI error", res.status, rawText.slice(0, 400));
    return 0;
  }
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices;
  const text = choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return 0;
  try {
    const obj = stripJsonObject(text);
    const q = obj.quality_score;
    if (typeof q !== "number" || !Number.isFinite(q)) return 0;
    return Math.min(25, Math.max(0, Math.round(q)));
  } catch {
    return 0;
  }
}

export type HybridScoreResult = {
  ats_score: number;
  present_keywords: string[];
  missing_keywords: string[];
  reasoning: string;
  keyword_score_75: number;
  quality_score_25: number;
};

export async function POST(request: Request) {
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
    typeof o.resumeText === "string" ? o.resumeText.replace(/\r\n/g, "\n").trim() : "";

  const kwRaw = o.atsKeywords;
  let atsKeywords = filterAtsKeywordLabels(
    Array.isArray(kwRaw)
      ? kwRaw
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
      : [],
  );
  if (jobPosting.length >= 40) {
    atsKeywords = filterKeywordLabelsToJobPosting(jobPosting, atsKeywords);
  }

  if (!resumeTextFixed || resumeTextFixed.length < 10) {
    return jsonNoStore({ error: "Resume text is required." }, { status: 400 });
  }
  if (resumeTextFixed.length > 48_000) {
    return jsonNoStore({ error: "Resume text is too long." }, { status: 400 });
  }

  const keyCheck = requireOpenAiApiKey();
  if (!keyCheck.ok) {
    return jsonNoStore({ error: keyCheck.error }, { status: 503 });
  }
  const openaiKey = keyCheck.key;

  const resumeFp = createHash("sha256")
    .update(resumeTextFixed, "utf8")
    .digest("hex")
    .slice(0, 16);
  console.log("[resume-editor-score] hybrid fingerprint", {
    sha256_16: resumeFp,
    charLength: resumeTextFixed.length,
    nKeywords: atsKeywords.length,
  });

  const verified = verifyKeywordsAgainstResume(
    resumeTextFixed,
    atsKeywords,
    null,
  );
  const bullets = extractBulletLines(resumeTextFixed);
  const quality25 = await fetchBulletQualityScore25(bullets, openaiKey);
  const rawTotal = verified.score75 + quality25;
  const ats_score = Math.min(100, Math.max(0, Math.round(rawTotal)));

  const reasoning =
    `Keyword match (literal text only, case-insensitive): ${verified.matchedCount}/${verified.totalCount} → ${verified.score75}/75. ` +
    `Bullet quality (model): ${quality25}/25.`;

  const result: HybridScoreResult = {
    ats_score,
    present_keywords: verified.present,
    missing_keywords: verified.missing,
    reasoning,
    keyword_score_75: verified.score75,
    quality_score_25: quality25,
  };

  return jsonNoStore({ result });
}
