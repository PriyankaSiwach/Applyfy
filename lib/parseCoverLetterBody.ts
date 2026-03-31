import type { CoverLength, CoverTone } from "@/lib/parseCoverLetterTypes";

export type { CoverLength, CoverTone } from "@/lib/parseCoverLetterTypes";

const TONES = new Set<string>(["concise", "confident", "storytelling"]);
const LENGTHS = new Set<string>(["short", "standard", "detailed"]);

const MIN_RESUME = 40;
const MIN_JOB = 80;

export type ParseCoverLetterResult =
  | {
      ok: true;
      resume: string;
      jobPosting: string;
      jobLink: string;
      tone: CoverTone;
      length: CoverLength;
    }
  | { ok: false; error: string; status: number };

export function parseCoverLetterBody(body: unknown): ParseCoverLetterResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }
  const o = body as Record<string, unknown>;
  const resume = typeof o.resume === "string" ? o.resume.trim() : "";
  const jobPosting =
    typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const jobLink =
    typeof o.jobLink === "string" ? o.jobLink.trim() : "https://local.invalid";

  if (!resume || resume.length < MIN_RESUME) {
    return {
      ok: false,
      error: "resume must be a non-empty string with enough text.",
      status: 400,
    };
  }
  if (!jobPosting || jobPosting.length < MIN_JOB) {
    return {
      ok: false,
      error: "jobPosting must be a non-empty string with enough text.",
      status: 400,
    };
  }

  const toneRaw =
    typeof o.tone === "string" ? o.tone.trim().toLowerCase() : "confident";
  const lengthRaw =
    typeof o.length === "string" ? o.length.trim().toLowerCase() : "standard";

  const tone = TONES.has(toneRaw) ? (toneRaw as CoverTone) : "confident";
  const length = LENGTHS.has(lengthRaw)
    ? (lengthRaw as CoverLength)
    : "standard";

  return {
    ok: true,
    resume,
    jobPosting,
    jobLink,
    tone,
    length,
  };
}
