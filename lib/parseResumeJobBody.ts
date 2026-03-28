export type ParseResumeJobResult =
  | { ok: true; resume: string; jobLink: string }
  | { ok: false; error: string; status: number };

export function parseResumeJobBody(body: unknown): ParseResumeJobResult {
  if (
    typeof body !== "object" ||
    body === null ||
    !("resume" in body) ||
    !("jobLink" in body)
  ) {
    return {
      ok: false,
      error: "Expected { resume, jobLink }",
      status: 400,
    };
  }

  const { resume, jobLink } = body as {
    resume: unknown;
    jobLink: unknown;
  };

  if (typeof resume !== "string" || resume.trim().length === 0) {
    return {
      ok: false,
      error: "resume must be a non-empty string",
      status: 400,
    };
  }

  if (typeof jobLink !== "string" || jobLink.trim().length === 0) {
    return {
      ok: false,
      error: "jobLink must be a non-empty string",
      status: 400,
    };
  }

  return { ok: true, resume: resume.trim(), jobLink: jobLink.trim() };
}
