import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import {
  generateCompetitiveAssessment,
} from "@/lib/resumeOptimizeTwoPhase";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 30;

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
  const resumeText =
    typeof o.resumeText === "string"
      ? o.resumeText.replace(/\r\n/g, "\n").trim().slice(0, 20_000)
      : "";
  const jobDescription =
    typeof o.jobDescription === "string"
      ? o.jobDescription.replace(/\r\n/g, "\n").trim().slice(0, 10_000)
      : "";

  if (!resumeText || resumeText.length < 10) {
    return jsonNoStore({ error: "resumeText is required." }, { status: 400 });
  }
  if (!jobDescription || jobDescription.length < 20) {
    return jsonNoStore(
      { error: "jobDescription is required." },
      { status: 400 },
    );
  }

  try {
    const assessment = await generateCompetitiveAssessment(
      openaiKey,
      resumeText,
      jobDescription,
    );
    return jsonNoStore({ assessment });
  } catch (e) {
    console.error("[resume-competitive-assessment]", e);
    return jsonNoStore(
      { error: "Could not generate assessment." },
      { status: 502 },
    );
  }
}
