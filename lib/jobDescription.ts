import {
  filterMeaningfulRequirementStrings,
  isMeaningfulJobRequirementLine,
} from "@/lib/jobRequirementFilter";

export const MAX_JOB_CHARS = 18_000;

const JOB_SECTION_PATTERNS = [
  /(?:responsibilit(?:y|ies)|what you(?:'ll)?\s*(?:do|own)|key responsibilities)[^:]{0,40}:?\s*([\s\S]{0,8000}?)(?=(?:qualification|requirement|what we|who you|benefits|about (?:the )?role|nice to have|bonus|perks)\b|$)/gi,
  /(?:qualification|requirement)s?[^:]{0,40}:?\s*([\s\S]{0,8000}?)(?=(?:responsibilit|what you|benefits|nice to have|bonus|apply|about (?:the )?company)\b|$)/gi,
  /(?:what we (?:look|need|want) for|who you are|about you|your background|skills?(?:\s+you\s+have)?)[^:]{0,40}:?\s*([\s\S]{0,8000}?)(?=(?:responsibilit|benefits|apply|qualification)\b|$)/gi,
  /(?:nice to have|bonus|preferred)[^:]{0,40}:?\s*([\s\S]{0,4000}?)(?=(?:apply|benefits|responsibilit)\b|$)/gi,
];

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|br|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPrimaryContent(html: string): string {
  const candidates: string[] = [];

  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (article) candidates.push(article[1]);

  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (main) candidates.push(main[1]);

  const roleMain = html.match(
    /(?:id|class)=["'][^"']*(?:job|description|posting|detail)[^"']*["'][^>]*>([\s\S]{200,12000}?)<\/(?:div|section)>/i,
  );
  if (roleMain) candidates.push(roleMain[1]);

  if (candidates.length === 0) {
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    candidates.push(body ? body[1] : html);
  }

  return candidates.sort((a, b) => b.length - a.length)[0] ?? html;
}

function extractMeaningfulJobRequirements(cleanedPlain: string): string {
  const sections: string[] = [];
  for (const re of JOB_SECTION_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleanedPlain)) !== null) {
      const chunk = m[1]?.trim();
      if (chunk && chunk.length > 40) sections.push(chunk);
    }
  }

  const merged = sections.length
    ? [...new Set(sections)].join("\n\n---\n\n")
    : cleanedPlain;

  return merged.slice(0, MAX_JOB_CHARS);
}

export async function fetchJobDescriptionText(jobLink: string): Promise<string> {
  const res = await fetch(jobLink, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Applyfy/1.0; +https://applyfy.app) AppleWebKit/537.36 (KHTML, like Gecko)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    throw new Error(`Could not fetch job page (HTTP ${res.status})`);
  }

  const html = await res.text();
  const primary = extractPrimaryContent(html);
  const plain = stripHtmlToText(primary);
  const meaningful = extractMeaningfulJobRequirements(plain);
  const fallback = plain.slice(0, MAX_JOB_CHARS);
  return meaningful.length > 200 ? meaningful : fallback;
}

/** Pull 8–12 concise requirement lines from scraped job text. */
export function extractKeyRequirementsFromJob(jobText: string): string[] {
  const raw = jobText.replace(/\s+/g, " ").trim();
  if (raw.length < 40) {
    return [
      "Relevant degree or equivalent practical experience",
      "Production software delivery in a team environment",
      "Written and verbal communication with stakeholders",
      "Problem-solving across ambiguous requirements",
      "Code quality, testing, and review practices",
      "Comfort learning new tools and domains quickly",
      "Collaboration with product and design partners",
      "Ownership of features end-to-end where applicable",
    ];
  }

  const chunks: string[] = [];
  const lineSplit = jobText.split(/\n+/);
  for (const line of lineSplit) {
    const t = line.replace(/^[\s•\-\*·\u2022\d.)]+\s*/i, "").trim();
    if (t.length >= 20 && t.length <= 240 && isMeaningfulJobRequirementLine(t)) {
      chunks.push(t);
    }
  }

  const sentenceSplit = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim());
  for (const s of sentenceSplit) {
    if (
      s.length >= 25 &&
      s.length <= 220 &&
      /[a-z]{4,}/i.test(s) &&
      isMeaningfulJobRequirementLine(s)
    ) {
      chunks.push(s);
    }
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of filterMeaningfulRequirementStrings(chunks)) {
    const key = c.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
    if (unique.length >= 12) break;
  }

  while (unique.length < 8 && raw.length > 100) {
    const start = unique.length * 90;
    const slice = raw.slice(start, start + 85).trim();
    if (slice.length < 30) break;
    const padded = slice.endsWith(".") ? slice : `${slice}.`;
    if (!isMeaningfulJobRequirementLine(padded)) break;
    const k = padded.slice(0, 80).toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(padded);
    } else break;
  }

  const FALLBACK_MEANINGFUL = [
    "Relevant degree or equivalent practical experience in a technical field",
    "Hands-on software development and shipping features in production",
    "Strong communication with engineers, product, and stakeholders",
    "Ability to translate ambiguous requirements into technical plans",
    "Testing, code review, and maintaining quality in a team codebase",
    "Willingness to learn new tools, frameworks, and business domains",
    "Collaboration across disciplines to deliver user-facing outcomes",
    "Ownership of problems end-to-end where scope allows",
  ];
  for (const line of FALLBACK_MEANINGFUL) {
    if (unique.length >= 8) break;
    const k = line.slice(0, 80).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(line);
  }

  return unique.slice(0, 12);
}
