import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { RESUME_REWRITE_HONESTY_SYSTEM } from "@/lib/prompts/resumeRewriteHonesty";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

const MAX_RESUME = 14_000;

function normSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function snippetInResume(resumePlain: string, snippet: string): boolean {
  const t = snippet.trim();
  if (t.length < 6) return false;
  if (resumePlain.includes(t)) return true;
  const a = normSpace(resumePlain);
  const b = normSpace(t);
  return b.length >= 6 && a.includes(b);
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^`+json\s*/i, "").replace(/^`+/, "").replace(/`+$/, "");
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error("Invalid JSON object");
}

export async function POST(request: Request) {
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
  const keyword =
    typeof o.keyword === "string" ? o.keyword.trim().slice(0, 120) : "";
  const jobTitle =
    typeof o.jobTitle === "string" ? o.jobTitle.trim().slice(0, 200) : "professional";
  const resumeText =
    typeof o.resumeText === "string" ? o.resumeText.replace(/\r\n/g, "\n").trim() : "";

  if (!keyword) {
    return jsonNoStore({ error: "keyword is required" }, { status: 400 });
  }
  if (resumeText.length < 80) {
    return jsonNoStore(
      { error: "resumeText is required (at least 80 characters)." },
      { status: 400 },
    );
  }

  const resumeSlice = resumeText.slice(0, MAX_RESUME);

  const userContent = `Resume (verbatim — you may ONLY rewrite lines copied from this text):
"""
${resumeSlice}
"""

Job keyword / requirement to surface honestly: "${keyword}"
Role context: ${jobTitle}

Return ONLY valid JSON with exactly these keys:
- "items": array, maximum 2 objects, each { "originalSnippet": string, "rewritten": string }
  - originalSnippet MUST be a contiguous substring copied verbatim from the resume above (one bullet line or skill fragment).
  - rewritten must be a single continuous line or sentence in the same style as the resume — NOT a labeled list ("Tools:", "Domain knowledge:", "Data & analytics:", etc.) and NOT "Category: skill A, skill B" rows.
  - rewritten must describe ONLY the same facts as originalSnippet; stronger verbs and honest ATS phrasing for "${keyword}" only if already supported by that line.
  - Never add employers, tools, technologies, domains, or metrics not in originalSnippet.
- "honestMessage": string. If items is empty, set to a short user-facing explanation such as "Cannot be added — no supporting experience in your resume." If items is non-empty, use "".

If "${keyword}" cannot be honestly tied to any line in the resume, items must be [] and honestMessage must explain that it cannot be added without fabrication.`;

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
        response_format: { type: "json_object" },
        max_tokens: 600,
        temperature: 0.25,
        messages: [
          { role: "system", content: RESUME_REWRITE_HONESTY_SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    const rawText = await res.text();
    let apiData: unknown;
    try {
      apiData = JSON.parse(rawText) as unknown;
    } catch {
      console.error("[keyword-suggestions] bad JSON", rawText.slice(0, 300));
      return jsonNoStore({ error: "Bad response" }, { status: 502 });
    }

    if (!res.ok) {
      console.error("[keyword-suggestions]", res.status, rawText.slice(0, 400));
      return jsonNoStore({ error: "Request failed" }, { status: 502 });
    }

    const choices = (apiData as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices;
    const text = choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return jsonNoStore({ error: "Empty response" }, { status: 502 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(text);
    } catch (e) {
      console.error("[keyword-suggestions] parse", e, text.slice(0, 400));
      return jsonNoStore({ error: "Invalid model JSON" }, { status: 502 });
    }

    const rawItems = parsed.items;
    const honestRaw = parsed.honestMessage;
    const honestMessage =
      typeof honestRaw === "string" && honestRaw.trim()
        ? honestRaw.trim()
        : "";

    const items: { originalSnippet: string; rewritten: string }[] = [];
    if (Array.isArray(rawItems)) {
      for (const row of rawItems) {
        if (typeof row !== "object" || row === null) continue;
        const r = row as Record<string, unknown>;
        const originalSnippet =
          typeof r.originalSnippet === "string" ? r.originalSnippet.trim() : "";
        const rewritten =
          typeof r.rewritten === "string" ? r.rewritten.trim() : "";
        if (!originalSnippet || !rewritten) continue;
        if (!snippetInResume(resumeSlice, originalSnippet)) continue;
        items.push({ originalSnippet, rewritten });
        if (items.length >= 2) break;
      }
    }

    const defaultHonest =
      "Cannot be added — no supporting experience in your resume.";
    const messageOut =
      items.length === 0
        ? honestMessage || defaultHonest
        : "";

    return jsonNoStore({
      items,
      honestMessage: messageOut,
    });
  } catch (e) {
    console.error("[keyword-suggestions]", e);
    return jsonNoStore({ error: "Request failed" }, { status: 502 });
  }
}
