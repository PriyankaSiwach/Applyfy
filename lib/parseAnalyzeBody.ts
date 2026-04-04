export const MIN_JOB_POSTING_CHARS = 80;
const MIN_CHARS = MIN_JOB_POSTING_CHARS;

function isValidJobUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export type ParsedAnalyzeJob =
  | { kind: "fetch"; url: string }
  | { kind: "text"; text: string; urlContext?: string };

export type ParseAnalyzeResult =
  | {
      ok: true;
      resume: string;
      compareScan: boolean;
      job: ParsedAnalyzeJob;
    }
  | { ok: false; error: string; status: number };

export function parseAnalyzeBody(body: unknown): ParseAnalyzeResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body", status: 400 };
  }
  const o = body as Record<string, unknown>;
  const resume = typeof o.resume === "string" ? o.resume.trim() : "";
  const jobPostingField =
    typeof o.jobPosting === "string" ? o.jobPosting.trim() : "";
  const jobLinkRaw = typeof o.jobLink === "string" ? o.jobLink.trim() : "";
  const compareScan = o.compareScan === true;

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

  if (jobPostingField.length >= MIN_CHARS) {
    const urlContext =
      jobLinkRaw && looksLikeHttpUrl(jobLinkRaw) && isValidJobUrl(jobLinkRaw)
        ? jobLinkRaw
        : undefined;
    return {
      ok: true,
      resume,
      compareScan,
      job: { kind: "text", text: jobPostingField, urlContext },
    };
  }

  if (jobLinkRaw && looksLikeHttpUrl(jobLinkRaw)) {
    if (!isValidJobUrl(jobLinkRaw)) {
      return {
        ok: false,
        error:
          "That link does not look valid. Paste the job description text instead.",
        status: 400,
      };
    }
    return {
      ok: true,
      resume,
      compareScan,
      job: { kind: "fetch", url: jobLinkRaw },
    };
  }

  if (jobLinkRaw.length >= MIN_CHARS) {
    return {
      ok: true,
      resume,
      compareScan,
      job: { kind: "text", text: jobLinkRaw },
    };
  }

  if (!jobLinkRaw) {
    return {
      ok: false,
      error:
        "Add a job URL or paste the job description (at least 80 characters).",
      status: 400,
    };
  }

  return {
    ok: false,
    error:
      "Paste a job URL or at least 80 characters of the job description.",
    status: 400,
  };
}
