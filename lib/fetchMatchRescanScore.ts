/**
 * Calls the existing analyze API and returns match result fields for rescan UI.
 */
export async function fetchMatchRescanScore(params: {
  resumePayload: string;
  jobLink: string;
}): Promise<{
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}> {
  const { resumePayload, jobLink } = params;
  const res = await fetch("/api/analyze", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resume: resumePayload,
      jobLink: jobLink.trim(),
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
  });
  const raw = await res.text();
  let data: {
    matchScore?: number;
    matchedSkills?: unknown;
    missingSkills?: unknown;
    error?: string;
  };
  try {
    data = JSON.parse(raw) as { matchScore?: number; error?: string };
  } catch {
    throw new Error(
      raw.trimStart().startsWith("<!DOCTYPE") || raw.includes("<html")
        ? "Server returned an error page instead of data."
        : "Invalid response from server.",
    );
  }
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  if (typeof data.matchScore !== "number" || !Number.isFinite(data.matchScore)) {
    throw new Error("Response missing match score.");
  }
  const matchedSkills = Array.isArray(data.matchedSkills)
    ? data.matchedSkills.filter((s): s is string => typeof s === "string")
    : [];
  const missingSkills = Array.isArray(data.missingSkills)
    ? data.missingSkills.filter((s): s is string => typeof s === "string")
    : [];
  return {
    matchScore: data.matchScore,
    matchedSkills,
    missingSkills,
  };
}
