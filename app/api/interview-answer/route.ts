import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { cleanResumeToPlainText } from "@/lib/resumeText";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

const SYSTEM_PROMPT = `You are an interview assistant helping a job candidate prepare specific answers to interview questions.

Rules:
- ALWAYS produce a full 4–6 sentence answer. No exceptions.
- If the resume contains relevant experience → use it. Name the specific project, role, or company from the resume (e.g. "during my MoMA internship", "while building Memory Map", "in my Student Success Mentor role"). Follow this internal structure: situation → what they did → result → how it applies here.
- If the resume does NOT contain a clear match → generate a strong, realistic, generic answer that fits an early-career or student candidate. Do NOT make up fake companies, project names, or specific metrics. Keep it believable and grounded. At the very end of a generic answer, add exactly this line on its own: "Tip: Try to connect this answer with a relevant project or experience from your resume."
- Never say "no relevant experience found", "try adding experience", "nothing maps to this", or any variation. Always answer the question.
- Write in first person, natural spoken English — not a bullet list or formal essay.
- Return one answer per question with no extra commentary.`;

function extractJsonArray(text: string): { question: string; answer: string }[] {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1].trim() : trimmed;

  const tryParse = (s: string) => {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as { question: string; answer: string }[];
    }
    if (typeof parsed === "object" && parsed !== null) {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.answers)) {
        return o.answers as { question: string; answer: string }[];
      }
    }
    return null;
  };

  try {
    const result = tryParse(jsonStr);
    if (result) return result;
  } catch {
    /* fall through */
  }

  const start = jsonStr.indexOf("[");
  const end = jsonStr.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const result = tryParse(jsonStr.slice(start, end + 1));
      if (result) return result;
    } catch {
      /* fall through */
    }
  }

  const start2 = jsonStr.indexOf("{");
  const end2 = jsonStr.lastIndexOf("}");
  if (start2 >= 0 && end2 > start2) {
    try {
      const result = tryParse(jsonStr.slice(start2, end2 + 1));
      if (result) return result;
    } catch {
      /* fall through */
    }
  }

  throw new Error("Could not parse answers JSON");
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
  const questions = Array.isArray(o.questions)
    ? (o.questions as unknown[]).filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  const resumeIn = typeof o.resume === "string" ? o.resume : "";
  const jobPosting = typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";

  if (questions.length === 0) {
    return jsonNoStore({ error: "No questions provided." }, { status: 400 });
  }

  // Resume and JD are used as context but not required — missing context just means
  // more generic answers, which is still better than no answer.
  let resumeText = "";
  if (resumeIn) {
    try {
      resumeText = await cleanResumeToPlainText(resumeIn);
    } catch {
      resumeText = "";
    }
  }

  const questionList = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n");

  const resumeSection = resumeText.trim()
    ? `Resume:\n${resumeText.slice(0, 12_000)}`
    : "Resume: (not provided — generate realistic generic answers)";

  const jobSection = jobPosting.trim()
    ? `Job Description:\n${jobPosting.slice(0, 8_000)}`
    : "Job Description: (not provided)";

  const userContent = `${resumeSection}

${jobSection}

For each question below, generate a complete 4–6 sentence answer following the system rules.
If the resume has relevant experience, use it and name the specific project/role.
If not, generate a strong generic answer and end with the tip line.
Never leave any answer empty. Always answer every question.

Return a JSON object with key "answers" — an array where each item has "question" (exact text) and "answer".

Questions:
${questionList}`;

  try {
    const completion = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 6000,
        temperature: 0.4,
      }),
    });

    if (!completion.ok) {
      const errText = await completion.text();
      console.error("[interview-answer]", completion.status, errText.slice(0, 300));
      return jsonNoStore(
        { error: "Could not generate answers right now. Try again." },
        { status: 502 },
      );
    }

    const apiData = (await completion.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = apiData.choices?.[0]?.message?.content ?? "";

    let parsed: { question: string; answer: string }[];
    try {
      parsed = extractJsonArray(content);
    } catch {
      return jsonNoStore(
        { error: "Could not parse generated answers. Try again." },
        { status: 502 },
      );
    }

    // Build a map: question text → answer
    const answers: Record<string, string> = {};
    for (const item of parsed) {
      if (typeof item.question === "string" && typeof item.answer === "string") {
        answers[item.question.trim()] = item.answer.trim();
      }
    }

    // Also match by index in case question text got paraphrased
    questions.forEach((q, i) => {
      if (!answers[q]) {
        const byIndex = parsed[i];
        if (byIndex?.answer) {
          answers[q] = byIndex.answer.trim();
        }
      }
    });

    // Final safety net — if any question still has no answer, fill with a generic one
    const GENERIC_FALLBACK =
      "I approach this kind of situation by staying focused on the goal, communicating clearly with anyone involved, and being willing to adapt when circumstances change. I've found that breaking down the problem into smaller steps and checking in regularly helps me stay on track even under pressure. The most important thing is to stay solutions-oriented rather than getting stuck on what went wrong. I'm continuing to build experience in this area and would look forward to sharing a specific example as I grow in this role. Tip: Try to connect this answer with a relevant project or experience from your resume.";
    const EMPTY_PATTERNS = /^(you may want|no relevant|nothing maps|try adding|i don't have|i haven't|i'm not sure)/i;
    questions.forEach((q) => {
      const a = answers[q];
      if (!a || a.trim().length < 20 || EMPTY_PATTERNS.test(a.trim())) {
        answers[q] = GENERIC_FALLBACK;
      }
    });

    return jsonNoStore({ answers });
  } catch (e) {
    console.error("[interview-answer]", e);
    return jsonNoStore(
      { error: "Could not generate answers right now. Try again." },
      { status: 500 },
    );
  }
}
