import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import {
  RESUME_BULLET_OPTIMIZER_SYSTEM,
  resumeBulletRewriteUserMessage,
} from "@/lib/resumeLineRewritePrompt";
import { validateOptimizedBullet } from "@/lib/resumeLineRewriteValidation";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

const MAX_BULLET = 2000;
const MAX_RESUME_CTX = 48_000;

function stripFences(s: string): string {
  let t = s.trim();
  t = t.replace(/^`+json\s*/i, "").replace(/^`+/, "").replace(/`+$/, "");
  return t.trim();
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
  const originalBullet =
    typeof o.originalBullet === "string"
      ? o.originalBullet.replace(/\r\n/g, "\n").trim()
      : "";
  const fullResumeContext =
    typeof o.fullResumeContext === "string"
      ? o.fullResumeContext.replace(/\r\n/g, "\n").trim().slice(0, MAX_RESUME_CTX)
      : "";

  if (!originalBullet || originalBullet.length < 8) {
    return jsonNoStore(
      { error: "originalBullet is required (at least 8 characters)." },
      { status: 400 },
    );
  }
  if (originalBullet.length > MAX_BULLET) {
    return jsonNoStore({ error: "originalBullet is too long." }, { status: 400 });
  }

  const corpus =
    fullResumeContext.length > 0
      ? fullResumeContext
      : originalBullet;

  const userContent = resumeBulletRewriteUserMessage(
    originalBullet.slice(0, MAX_BULLET),
  );

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
        max_tokens: 400,
        temperature: 0.2,
        messages: [
          { role: "system", content: RESUME_BULLET_OPTIMIZER_SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    const rawText = await res.text();
    let apiData: unknown;
    try {
      apiData = JSON.parse(rawText) as unknown;
    } catch {
      return jsonNoStore({ error: "Bad response from model." }, { status: 502 });
    }

    if (!res.ok) {
      console.error("[resume-line-rewrite]", res.status, rawText.slice(0, 400));
      return jsonNoStore({ error: "Request failed" }, { status: 502 });
    }

    const choices = (apiData as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices;
    let text = stripFences(choices?.[0]?.message?.content?.trim() ?? "");
    if (!text) {
      return jsonNoStore({ error: "Empty model output" }, { status: 502 });
    }

    text = text.replace(/^["']|["']$/g, "").trim();

    const v = validateOptimizedBullet(originalBullet, text, corpus);
    if (!v.ok) {
      return jsonNoStore(
        {
          error: "Validation rejected model output.",
          detail: v.error,
          retry: true,
        },
        { status: 422 },
      );
    }

    return jsonNoStore({ rewritten: text });
  } catch (e) {
    console.error("[resume-line-rewrite]", e);
    return jsonNoStore({ error: "Request failed" }, { status: 502 });
  }
}
