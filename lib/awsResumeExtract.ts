import { resumeFileToPayload } from "@/lib/resumeFileToPayload";

/**
 * Optional AWS resume pipeline (S3 upload -> Lambda parse -> DynamoDB), behind
 * NEXT_PUBLIC_AWS_RESUME_PIPELINE=1. Any failure falls back to resumeFileToPayload,
 * so /api/analyze receives either extracted plain text or today's data URL.
 */

// Static references so Next.js inlines them into the client bundle at build time.
const PIPELINE_FLAG = process.env.NEXT_PUBLIC_AWS_RESUME_PIPELINE;
const AWS_API_BASE = (process.env.NEXT_PUBLIC_AWS_API_BASE ?? "")
  .trim()
  .replace(/\/+$/, "");

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 15_000;
const API_REQUEST_TIMEOUT_MS = 10_000;
const UPLOAD_TIMEOUT_MS = 30_000;
/** Same floor /api/analyze applies before calling OpenAI. */
const MIN_EXTRACTED_CHARS = 80;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type GetClerkToken = () => Promise<string | null>;

export function isAwsResumePipelineEnabled(): boolean {
  return PIPELINE_FLAG === "1" && AWS_API_BASE.length > 0;
}

function awsContentType(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return DOCX_MIME;
  return null;
}

/** PDF/DOCX from a signed-in user only; .txt/.md and guests keep the local path. */
export function shouldUseAwsResumePipeline(
  file: File,
  isSignedIn: boolean | undefined,
): boolean {
  return (
    isAwsResumePipelineEnabled() &&
    isSignedIn === true &&
    awsContentType(file) !== null
  );
}

class AwsExtractError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bearerHeader(getToken: GetClerkToken): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) throw new AwsExtractError("no Clerk session token");
  return { Authorization: `Bearer ${token}` };
}

async function extractResumeTextViaAws(
  file: File,
  getToken: GetClerkToken,
): Promise<string> {
  const contentType = awsContentType(file);
  if (!contentType) throw new AwsExtractError("unsupported file type");

  const urlRes = await fetch(
    `${AWS_API_BASE}/upload-url?filename=${encodeURIComponent(file.name)}`,
    {
      cache: "no-store",
      headers: await bearerHeader(getToken),
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    },
  );
  if (!urlRes.ok) {
    throw new AwsExtractError(`upload-url returned ${urlRes.status}`);
  }
  const urlData = (await urlRes.json()) as { uploadUrl?: unknown; key?: unknown };
  if (typeof urlData.uploadUrl !== "string" || typeof urlData.key !== "string") {
    throw new AwsExtractError("upload-url response missing uploadUrl/key");
  }

  const putRes = await fetch(urlData.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!putRes.ok) {
    throw new AwsExtractError(`S3 upload returned ${putRes.status}`);
  }

  const resumeUrl = `${AWS_API_BASE}/resume/${encodeURIComponent(urlData.key)}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(resumeUrl, {
      cache: "no-store",
      headers: await bearerHeader(getToken),
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
    if (res.status === 404) {
      if (Date.now() >= deadline) {
        throw new AwsExtractError("timed out waiting for parsed resume");
      }
      continue;
    }
    if (!res.ok) {
      throw new AwsExtractError(`resume returned ${res.status}`);
    }
    const data = (await res.json()) as {
      extractedText?: unknown;
      charLength?: unknown;
    };
    const text =
      typeof data.extractedText === "string" ? data.extractedText.trim() : "";
    const charLength =
      typeof data.charLength === "number" ? data.charLength : text.length;
    if (charLength < MIN_EXTRACTED_CHARS || text.length < MIN_EXTRACTED_CHARS) {
      throw new AwsExtractError("extracted text too short");
    }
    return text;
  }
}

/**
 * Extracted plain text via AWS, or resumeFileToPayload(file) on any failure
 * (non-2xx, timeout, too-short text, network error, missing token).
 */
export async function resumeFileToPayloadViaAws(
  file: File,
  getToken: GetClerkToken,
): Promise<string> {
  try {
    return await extractResumeTextViaAws(file, getToken);
  } catch (err) {
    const reason =
      err instanceof AwsExtractError
        ? err.message
        : err instanceof Error && err.name === "TimeoutError"
          ? "request timed out"
          : "network error";
    console.warn(`[awsResumeExtract] falling back to local upload: ${reason}`);
    return resumeFileToPayload(file);
  }
}
