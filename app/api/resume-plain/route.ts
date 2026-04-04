import { cleanResumeToPlainText } from "@/lib/resumeText";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }
  const resume =
    typeof (body as { resume?: unknown }).resume === "string"
      ? (body as { resume: string }).resume
      : "";
  if (!resume.trim()) {
    return jsonNoStore({ error: "Resume is required." }, { status: 400 });
  }
  const text = await cleanResumeToPlainText(resume);
  return jsonNoStore({ text });
}
