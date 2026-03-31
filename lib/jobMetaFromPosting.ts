/**
 * Client-safe job title / company extraction from posting text (mirrors server heuristics).
 */
export function extractJobTitleAndCompany(
  jobPosting: string,
  jobLink: string,
): { title: string; company: string } {
  const lines = jobPosting
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);

  let title = "";
  let company = "";

  for (const line of lines) {
    if (!title && line.length >= 4 && line.length <= 90) {
      if (
        /engineer|developer|manager|analyst|designer|scientist|specialist|lead|intern|architect/i.test(
          line,
        )
      ) {
        title = line.replace(/^#+\s*/, "").trim();
      }
    }
    if (!company) {
      const m = line.match(
        /\b(?:at|@|company[:\s])\s+([A-Z][A-Za-z0-9&.\- ]{1,50})/i,
      );
      if (m?.[1]) company = m[1].trim();
    }
  }

  if (!title) title = lines[0]?.replace(/^#+\s*/, "").trim() || "";

  if (!company) {
    company =
      lines
        .find((l) => /company|about us|about the company/i.test(l))
        ?.replace(/.*?:\s*/, "")
        .trim()
        .slice(0, 50) || detectCompanyFromLink(jobLink);
  }

  return {
    title: sanitizeJobTitle(title),
    company: sanitizeCompany(company),
  };
}

export function sanitizeJobTitle(input: string): string {
  const oneLine = (input || "").split("\n")[0]?.trim() ?? "";
  const compact = oneLine.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim();
  const shortened =
    compact.split(/\s+-\s+|\s+\|\s+|\s+at\s+/i)[0]?.trim() || compact;
  const cleaned = shortened.replace(/^[^A-Za-z0-9]*/, "").trim();
  if (!cleaned) return "";
  return cleaned.length > 60 ? `${cleaned.slice(0, 59).trim()}…` : cleaned;
}

export function sanitizeCompany(input: string): string {
  const oneLine = (input || "").split("\n")[0]?.trim() ?? "";
  const compact = oneLine.replace(/\s+/g, " ");
  const noTail = compact
    .split(/[-|,:]/)[0]
    ?.replace(/\b(inc|llc|ltd|limited|corp|corporation)\b\.?/gi, "")
    .trim();
  const cleaned = (noTail || compact).trim();
  if (!cleaned) return "";
  return cleaned.length > 40 ? `${cleaned.slice(0, 39).trim()}…` : cleaned;
}

function detectCompanyFromLink(jobLink: string): string {
  try {
    const host = new URL(jobLink).hostname.replace(/^www\./, "");
    if (!host || host.includes("invalid")) return "";
    const base = host.split(".")[0]?.trim() ?? "";
    return base ? base.replace(/-/g, " ") : "";
  } catch {
    return "";
  }
}
