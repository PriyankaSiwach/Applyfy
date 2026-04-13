import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { filterAtsKeywordLabels } from "@/lib/jobKeywordSanitize";
import { normalizeSynonymMapFromApi } from "@/lib/jobKeywordSynonymMap";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

const MAX_JOB = 14_000;
const MAX_KEYWORDS = 80;

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
  const jobPosting =
    typeof o.jobPosting === "string" ? o.jobPosting.replace(/\r\n/g, "\n").trim() : "";
  const kwRaw = o.keywords;
  const keywords = filterAtsKeywordLabels(
    Array.isArray(kwRaw)
      ? kwRaw
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
      : [],
  ).slice(0, MAX_KEYWORDS);

  if (keywords.length === 0) {
    return jsonNoStore({ error: "keywords array is required." }, { status: 400 });
  }

  const jobSlice =
    jobPosting.length > 0 ? jobPosting.slice(0, MAX_JOB) : "(No job description text — infer only from keyword names.)";

  const keywordList = keywords
    .map((k, i) => `${i + 1}. ${k}`)
    .join("\n");

  const user = `Given these ATS keywords extracted from this job description (use each exact string as a JSON key, including capitalization):
${keywordList}

Job description (context):
"""
${jobSlice}
"""

For each keyword, return a JSON object whose keys are the exact keywords above (same spelling) and whose values are arrays of short phrases that might appear on a resume and would strongly prove that skill for THIS role.

Rules:
- Only include terms that genuinely prove the skill.
- Do not include loose associations (e.g. generic "database" or "databases" alone must NOT count as proof of SQL unless the job is clearly about relational/SQL work and the term is used in that sense — prefer specific engines like mysql, postgresql, t-sql).
- Think: if a recruiter saw this term on a resume, would they accept it as proof of the keyword? If yes, include it. If maybe, exclude it.
- Use lowercase phrases where possible; multi-word phrases are OK.
- Return ONLY a single JSON object, no markdown, no explanation.`;

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 4_096,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON: one object mapping each ATS keyword string to an array of resume evidence strings. No markdown, no commentary.",
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
    console.error("[job-keyword-synonyms] non-JSON", rawText.slice(0, 400));
    return jsonNoStore(
      { error: "Synonym generation failed (invalid provider response)." },
      { status: 502 },
    );
  }
  if (!res.ok) {
    console.error("[job-keyword-synonyms] OpenAI error", res.status, rawText.slice(0, 400));
    return jsonNoStore(
      { error: "Synonym generation failed." },
      { status: 502 },
    );
  }

  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices;
  const text = choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return jsonNoStore({ synonymMap: normalizeSynonymMapFromApi({}, keywords) });
  }

  try {
    const obj = stripJsonObject(text);
    const synonymMap = normalizeSynonymMapFromApi(obj, keywords);
    return jsonNoStore({ synonymMap });
  } catch (e) {
    console.error("[job-keyword-synonyms] parse", e);
    return jsonNoStore({ synonymMap: normalizeSynonymMapFromApi({}, keywords) });
  }
}
