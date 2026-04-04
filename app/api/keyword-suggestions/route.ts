import { jsonNoStore } from "@/lib/jsonResponseNoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

function extractJsonArray(text: string): string[] {
  const trimmed = text.trim().replace(/^`+json\s*/i, "").replace(/^`+/, "").replace(/`+$/, "");
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 3);
    }
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 3);
    }
  }
  throw new Error("Invalid JSON array");
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
  const keyword =
    typeof o.keyword === "string" ? o.keyword.trim().slice(0, 120) : "";
  const jobTitle =
    typeof o.jobTitle === "string" ? o.jobTitle.trim().slice(0, 200) : "professional";

  if (!keyword) {
    return jsonNoStore({ error: "keyword is required" }, { status: 400 });
  }

  const userContent = `Give me 2 short resume bullet point sentences that naturally include the keyword "${keyword}" for a ${jobTitle} role. Return ONLY a JSON array of 2 strings, no markdown: ["sentence 1", "sentence 2"]`;

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
        max_tokens: 200,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.5,
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

    console.log("[keyword-suggestions] OpenAI status", res.status);

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

    const suggestions = extractJsonArray(text);
    if (suggestions.length < 1) {
      return jsonNoStore({ error: "No suggestions" }, { status: 502 });
    }

    return jsonNoStore({ suggestions });
  } catch (e) {
    console.error("[keyword-suggestions]", e);
    return jsonNoStore({ error: "Request failed" }, { status: 502 });
  }
}
