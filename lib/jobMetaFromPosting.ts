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

  if (!company) {
    const flat = jobPosting
      .replace(/\*+|#+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const m = flat.match(
      /\b(?:at|@)\s+([A-Za-z0-9][A-Za-z0-9&.'\-\s]{1,48}?)(?=\s*[,.;]|$|\s+\||\s+—|\s+–|\s+for\b|\s+and\b)/i,
    );
    if (m?.[1]) company = m[1].trim();
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

/**
 * Extract only the job title from a full posting (not the first paragraph of the description).
 * Looks for labeled lines first, then short title-like lines before falling back conservatively.
 */
export function extractJobTitleFromPosting(jobPosting: string): string {
  if (!jobPosting.trim()) return "";
  const lines = jobPosting
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const labelRe =
    /^(?:job\s*title|position|role|opening)\s*[:#\-–—]\s*(.+)$/i;
  for (const line of lines.slice(0, 40)) {
    const m = line.match(labelRe);
    if (m?.[1]) {
      const t = sanitizeJobTitle(m[1]);
      if (t) return t;
    }
  }

  for (const line of lines.slice(0, 18)) {
    const cleaned = line.replace(/^#+\s*/, "").replace(/^\*\s*/, "").trim();
    if (cleaned.length < 6 || cleaned.length > 90) continue;
    if (cleaned.split(/\s+/).length > 14) continue;
    if (
      /^(we |our |the company|join us|about (the )?role|overview|responsibilit|requirement|qualification|what you|you will|looking for)/i.test(
        cleaned,
      )
    ) {
      continue;
    }
    if (
      /engineer|developer|manager|designer|analyst|scientist|specialist|architect|director|lead|intern|coordinator|recruiter|writer|consultant|associate|representative/i.test(
        cleaned,
      )
    ) {
      return sanitizeJobTitle(cleaned);
    }
  }

  const first = lines[0]?.replace(/^#+\s*/, "").trim() ?? "";
  if (
    first.length >= 6 &&
    first.length <= 72 &&
    first.split(/\s+/).length <= 12 &&
    !/^(we |join |about |the company|overview|responsibilit)/i.test(first) &&
    !/\.$/.test(first)
  ) {
    const head = first.split(/\s+[\|—–-]\s+/)[0]?.trim() ?? first;
    if (head.length >= 6 && head.split(/\s+/).length <= 10) {
      return sanitizeJobTitle(head);
    }
  }

  return "";
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
  const raw = jobLink.trim();
  if (!raw) return "";
  let host = "";
  try {
    host = new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    // Long tracking URLs, pasted whitespace, or partial URLs break `new URL`.
    const head = raw.slice(0, 8000);
    const m = head.match(/https?:\/\/([^/?#\s]+)/i);
    if (m?.[1]) {
      host = m[1].replace(/^www\./, "").split(":")[0] ?? "";
    }
  }
  if (!host || host.includes("invalid")) return "";
  const base = host.split(".")[0]?.trim() ?? "";
  return base ? base.replace(/-/g, " ") : "";
}
