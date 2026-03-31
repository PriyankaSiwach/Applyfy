const MIN_CHARS = 80;

function isValidJobUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type ParseAnalyzeResult =
  | { ok: true; resume: string; jobLink: string; jobPosting?: never }
  | { ok: true; resume: string; jobPosting: string; jobLink?: never }
  | { ok: false; error: string; status: number };

export function parseAnalyzeBody(body: unknown): ParseAnalyzeResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }
  const o = body as Record<string, unknown>;
  const resume = typeof o.resume === "string" ? o.resume.trim() : "";
  const jobPosting = typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const jobLinkRaw = typeof o.jobLink === "string" ? o.jobLink.trim() : "";

  if (!resume) {
    return { ok: false, error: "resume must be a non-empty string", status: 400 };
  }

  const isDataUrl = resume.toLowerCase().startsWith("data:");
  if (!isDataUrl && resume.length < MIN_CHARS) {
    return {
      ok: false,
      error: `Resume text must be at least ${MIN_CHARS} characters.`,
      status: 400,
    };
  }

  if (jobLinkRaw) {
    if (!isValidJobUrl(jobLinkRaw)) {
      return {
        ok: false,
        error: "jobLink must be a valid http(s) URL",
        status: 400,
      };
    }
    return { ok: true, resume, jobLink: jobLinkRaw };
  }

  if (!jobPosting) {
    return {
      ok: false,
      error: "Provide a job link (jobLink) or paste job text (jobPosting).",
      status: 400,
    };
  }
  if (jobPosting.length < MIN_CHARS) {
    return {
      ok: false,
      error: `Job posting must be at least ${MIN_CHARS} characters.`,
      status: 400,
    };
  }

  return { ok: true, resume, jobPosting };
}
