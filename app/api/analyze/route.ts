import { auth, clerkClient } from "@clerk/nextjs/server";

import { mergeClerkPublicMetadata } from "@/lib/clerkStripeSync";
import {
  fetchJobDescriptionFromUrlWithDetails,
  JOB_FETCH_MIN_MEANINGFUL_CHARS,
  JOB_PAGE_FETCH_TIMEOUT_MS,
  JOB_PASTE_FALLBACK_USER_MESSAGE,
  MAX_JOB_CHARS,
} from "@/lib/jobDescription";
import { jsonNoStore } from "@/lib/jsonResponseNoStore";
import { parseAnalyzeBody } from "@/lib/parseAnalyzeBody";
import { resumeTextFingerprint } from "@/lib/resumeFingerprint";
import { cleanResumeToPlainText } from "@/lib/resumeText";
import { RESUME_REWRITE_HONESTY_SYSTEM } from "@/lib/prompts/resumeRewriteHonesty";
import {
  padRewritesToSix,
  sanitizeAnalyzeRewrites,
} from "@/lib/sanitizeAnalyzeRewrites";
import { effectiveTierFromClerkPublicMetadata } from "@/lib/effectiveSubscriptionTier";
import { requireOpenAiApiKey } from "@/lib/openAiKeyGuard";
import {
  FREE_ANALYSIS_SCAN_LIMIT,
  hasProPlan,
  isAdminBypassEmail,
  tierFromPublicMetadata,
} from "@/lib/tier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
/** Vercel / Next.js: allow long OpenAI + scrape (see vercel.json too). */
export const maxDuration = 60;

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

/** Abort OpenAI request after this many ms (matches maxDuration budget). */
const OPENAI_FETCH_TIMEOUT_MS = 60_000;

/** Trim prompt size for smaller / faster models (character caps, not tokens). */
const ANALYZE_MAX_RESUME_CHARS = 12_000;
const ANALYZE_MAX_JOB_CHARS = 10_000;
const MIN_MEANINGFUL_CHARS = 80;

function summarizeOpenAIResult(result: Record<string, unknown>) {
  const kw = result.keywords;
  const kArr = Array.isArray(kw) ? kw : [];
  let kwEmptyEvidence = 0;
  for (const row of kArr) {
    if (typeof row !== "object" || row === null) {
      kwEmptyEvidence += 1;
      continue;
    }
    const ev = (row as { evidence?: unknown }).evidence;
    if (typeof ev !== "string" || !ev.trim()) kwEmptyEvidence += 1;
  }
  return {
    nKeywords: kArr.length,
    kwEmptyEvidence,
    nStrengths: Array.isArray(result.matchedStrengths)
      ? result.matchedStrengths.length
      : -1,
    nGaps: Array.isArray(result.gaps) ? result.gaps.length : -1,
    nRewrites: Array.isArray(result.rewrites) ? result.rewrites.length : -1,
    nQuickWins: Array.isArray(result.quickWins) ? result.quickWins.length : -1,
    hasAts: typeof result.atsScore === "number",
    hasExp: typeof result.experienceMatch === "number",
    hasEdu: typeof result.educationMatch === "number",
  };
}

const ANALYZE_ANALYSIS_SYSTEM_APPEND = `PART 2 — Full JSON analysis (same response):
You must return one JSON object exactly as described in the user message: keywords (semantic matching), matchedStrengths, gaps, rewrites, atsScore, experienceMatch, educationMatch, quickWins, intro, starStories.

Target ATS themes come from the job posting in the user message — not from inventing resume content. Keywords in JSON must be **grounded in the posting text**: each \`skill\` string must appear in the job posting (case-insensitive), as a contiguous phrase or clear single-token match — never invent unrelated domains (e.g. do not output "cloud computing", "machine learning", or data/tech stacks unless those words appear in the posting).

For the \`rewrites\` array: PART 1 (resume editor HARD RULES in the earlier system message) overrides everything else. Never "add missing keywords" by creating new lines or skill/tool lists. Each item must be one existing line (or same line count as that line) rewritten in place — not new resume content.

---

You are an expert ATS resume analyzer with deep hiring experience. When evaluating keyword matches:
- Use SEMANTIC matching, not literal string matching.
- A keyword is PRESENT if the resume contains direct evidence, related tools, equivalent terminology, or behavioral proof of that skill.
- A keyword is MISSING only if there is zero evidence — direct or indirect — anywhere on the resume.
- For soft skills, look for behavioral examples, not just the exact phrase.
- Do NOT cap the number of matched strengths — return ALL matches found (see user task: one strength line per matched keyword, in order).
- Score gaps honestly: only flag as a gap if truly absent with no proxy evidence.
- When suggesting fixes, reference specific resume content and explain exactly how to reframe it to cover the gap.

Skill clusters (treat as semantic support when the job uses the umbrella label):
- Data / quantitative stack: NumPy, Matplotlib, pandas, scipy, similar tooling or coursework can support job phrases like "Statistical Methods" or "Data Analysis" when the resume shows that work.
- Problem solving / analytical thinking: productivity improvements, error reduction, streamlined workflows, debugging, root-cause analysis, or measurable process wins count — even if the words "problem solving" never appear.
- Leadership / collaboration: managing, coordinating, leading, mentoring, cross-functional delivery, or strong team project outcomes can support "Technical Leadership" or similar when aligned with the posting.

Soft skills pass (apply when scoring keywords and gaps):
- Communication: mentoring, teaching, presenting, stakeholder updates, documentation for others, cross-functional collaboration.
- Leadership: managed, led, coordinated, owned initiatives, mentored others.
- Project management: timelines, deliverables, sprints, milestones, roadmaps, coordinated releases.
Never mark a soft-skill-style requirement as missing if clear behavioral evidence exists anywhere on the resume.`;

const ANALYZE_SYSTEM_PROMPT = `${RESUME_REWRITE_HONESTY_SYSTEM}

---

${ANALYZE_ANALYSIS_SYSTEM_APPEND}`;

const STRICT_REWRITE_RETRY_SUFFIX = `

CRITICAL — REGENERATE THE ENTIRE JSON AGAIN.
Your previous output likely violated rewrite rules (fabricated "Tools:", "Soft Skills:", "Domain knowledge:", "Data & analytics:", "Operations & logistics:", ERP/NetSuite/SAP/Oracle not on the resume, comma-separated fake skill rows, or extra lines). 

For rewrites ONLY:
- Each "original" must be an exact substring from the resume above.
- Each "rewritten" must have at most 2 more non-empty lines than "original" (same structure).
- Never add labeled lists (Tools:, Soft skills:, Domain knowledge:, etc.) unless that exact label already appears on that original line.
- Never introduce tools, vendors, or domains not present in that original line.
- If you cannot honestly rewrite a line, set rewritten equal to original and explain in whyBetter.`;

const ANALYZE_USER_TASK = `Resume:
{resumeText}

Job posting:
{jobText}

Return JSON with exactly these keys:

'keywords': array of 12 objects {skill, found, evidence}
- Extract only real skills, technologies, tools, and job-relevant competencies that **appear in the job posting text** (each \`skill\` must be findable verbatim in the posting, case-insensitive — no invented or cross-domain terms from other industries).
- Short labels, 1-4 words each, copied or tightly quoted from the posting.
- Skip any text that is clearly a form field label or template artifact: e.g. "Job competency N", "Requirement N", "Competency #3", or any numbered placeholder pattern — never copy those as skill names.
- Mix technical terms and soft skills **only when those exact phrases or words appear in the posting**.
- Apply SEMANTIC matching: found=true if the resume shows the capability through direct terms, related tools, equivalent phrasing, or clear behavioral proof anywhere in the resume.
- found=false only when there is no reasonable proxy or evidence.
- evidence: exactly ONE sentence for the requirements table "Your resume" column for THIS row only. Must be unique across all 12 rows — never reuse the same wording.
  - If found is true: cite concrete proof (project, metric, role, tool, or behavior) that semantically satisfies the requirement.
  - If found is false: name the closest related content on the resume, OR one honest sentence on why nothing suffices — still tied to this resume, not generic advice. If there is genuinely no basis to claim the skill, say clearly that it cannot be honestly added without fabrication or new real experience (e.g. "Cannot be added — no supporting experience" or equivalent honest wording).
- Forbidden: vague boilerplate, repeated phrases across rows, or the exact text "Not clearly demonstrated in the resume text" (or close paraphrases of that phrase).

'matchedStrengths': array of strings (no maximum length)
- Include EXACTLY one entry for EVERY keyword row where found is true, in the SAME ORDER as those rows appear in the keywords array (omit entries for rows where found is false).
- Each string MUST use this format (em dashes — as separators, three parts only):
  "[Skill or job label] — [specific project or experience from the resume that proves it] — [why this is relevant to this specific job posting]"
- Example: "AWS serverless — Built a zero-cost URL shortener using Lambda, API Gateway, and DynamoDB — directly matches the job's emphasis on scalable cloud infrastructure"
- Never output a skill name alone; every line must name concrete resume content AND tie relevance to the job.
- If 9 keywords match semantically, return 9 lines — do not truncate.

'gaps': array of 5-6 objects {skill, reality, fix}
- skill: the missing requirement (only if truly missing after semantic check)
- reality: one honest sentence on what the resume currently shows toward this skill (never say 'no mention' — find the closest thing)
- fix: one sentence that NEVER recommends inventing tools, employers, skills, domains, or experience. Only suggest reframing existing true bullets, verifiable next steps (real projects, certifications), or honest acknowledgment that the gap cannot be closed without new experience.

'rewrites': array of 6 objects { original, rewritten, section, whyBetter, alreadyCoversSkill }
Follow the resume editor HARD RULES in the system message (PART 1). Do NOT "improve the resume" by adding skills, tools, or new lines.
- Pick 6 existing lines or bullets already in the resume text above.
- original: exact verbatim substring from the resume.
- rewritten: stronger wording of ONLY that line's facts; non-empty line count must not exceed original's by more than 2.
- Forbidden unless the original line already matches the same pattern: labeled rows like "Tools:", "Domain knowledge:", "Data & analytics:", "Operations & logistics:", "Soft skills:", or any "Label: skill A, skill B" comma inventory.
- Do NOT add missing keywords unless the original line already supports them semantically.
- alreadyCoversSkill: boolean when the line already matches the job theme; then light polish only.
- section: where the line lives.
- whyBetter: one sentence; if a keyword cannot be honestly woven, say so.

'atsScore': integer 0-100
- Keyword and phrasing alignment of the resume as-is against the job, using SEMANTIC interpretation (not substring hunting)
- Separate from match score — used as "Keywords alignment" in the match breakdown

'experienceMatch': integer 0-100
- Years of experience, seniority, and relevance of past roles vs this posting

'educationMatch': integer 0-100
- Degrees, fields of study, certifications vs the job (including reasonable equivalents)

'quickWins': array of 3 strings
- Fast, high-impact changes; specific and actionable in under 5 minutes

'intro': string
- ~30-second spoken self-introduction; natural English, 4-5 sentences, one flowing paragraph (25-35 seconds aloud)
- Specifically tailored to THIS job posting: (1) open with the candidate's background in the relevant functional area — NOT the job title verbatim, but the domain (e.g. "mobile engineering", "financial reporting"); (2) cite one concrete piece of resume experience that directly maps to the top requirement in this posting; (3) name what draws them to this type of role or the company's focus area as described in the JD; (4) close with a short transition into the conversation
- Every sentence must be grounded in both the candidate's resume AND this specific job description — never generic filler

'starStories': array of exactly 4 objects { title, S, T, A, R }
- Four distinct STAR stories from the resume; every field filled with real content from the resume

Return only valid JSON. No markdown.

CRITICAL FORMATTING RULES:
- intro must be maximum 5 sentences total, one flowing paragraph (25-35 seconds aloud).

- Every fullAnswer (if you output interview fields elsewhere) must be a complete natural paragraph in first person, six to seven sentences, speakable aloud — no em-dash skill stubs.

All text fields must read like a human wrote them for a human to speak aloud, except matchedStrengths which must use the exact three-part em-dash structure defined above.`;

function extractJsonObject(
  content: string,
  logLabel: string,
): Record<string, unknown> {
  const trimmed = content.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let jsonStr = fence ? fence[1].trim() : trimmed;

  const tryParse = (s: string, phase: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch (e) {
      console.error(`[${logLabel}] JSON.parse failed (${phase})`, {
        error: e instanceof Error ? e.message : String(e),
        preview: s.slice(0, 2500),
      });
    }
    return null;
  };

  const first = tryParse(jsonStr, "primary");
  if (first) return first;

  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
    const bracket = tryParse(jsonStr, "bracket-slice");
    if (bracket) return bracket;
  }

  console.error(`[${logLabel}] Could not parse model JSON`, {
    rawPreview: content.slice(0, 4000),
    rawLength: content.length,
  });
  throw new Error("Could not parse JSON from model response");
}

async function fetchAnalyzeJsonObject(
  apiKey: string,
  userContent: string,
): Promise<Record<string, unknown>> {
  let completion: Response;
  try {
    completion = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(OPENAI_FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYZE_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 8192,
        temperature: 0,
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      console.error("[/api/analyze] OpenAI fetch timed out", {
        timeoutMs: OPENAI_FETCH_TIMEOUT_MS,
      });
      throw new Error(
        `OpenAI request timed out after ${OPENAI_FETCH_TIMEOUT_MS / 1000}s`,
      );
    }
    console.error("[/api/analyze] OpenAI fetch failed", e);
    throw e;
  }

  const rawCompletionText = await completion.text();
  if (!completion.ok) {
    console.error("[/api/analyze] OpenAI HTTP error", {
      status: completion.status,
      bodyPreview: rawCompletionText.slice(0, 2000),
    });
    throw new Error(`OpenAI error: ${rawCompletionText.slice(0, 500)}`);
  }

  let apiData: unknown;
  try {
    apiData = JSON.parse(rawCompletionText) as unknown;
  } catch (e) {
    console.error("[/api/analyze] OpenAI response body is not valid JSON", {
      error: e instanceof Error ? e.message : String(e),
      preview: rawCompletionText.slice(0, 2500),
    });
    throw new Error("Invalid JSON in OpenAI API response body");
  }

  const wrapped = apiData as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = wrapped.choices?.[0]?.message?.content ?? "";

  return extractJsonObject(content, "/api/analyze");
}

async function runAnalyzeOpenAI({
  apiKey,
  resume,
  jobDescription,
}: {
  apiKey: string;
  resume: string;
  jobDescription: string;
}) {
  const resumeSlice = resume.slice(0, ANALYZE_MAX_RESUME_CHARS);
  const jobSlice = jobDescription.slice(0, ANALYZE_MAX_JOB_CHARS);
  const userBase = ANALYZE_USER_TASK.replace(
    "{resumeText}",
    resumeSlice,
  ).replace("{jobText}", jobSlice);

  let obj = await fetchAnalyzeJsonObject(apiKey, userBase);

  console.log("[/api/analyze] OpenAI assistant message (pass 1)", {
    keys: Object.keys(obj).sort(),
    ...summarizeOpenAIResult(obj),
  });

  let san = sanitizeAnalyzeRewrites(obj.rewrites, resumeSlice);
  if (san.needsRetry) {
    console.warn("[/api/analyze] rewrite sanitize triggered retry", san.notes);
    obj = await fetchAnalyzeJsonObject(
      apiKey,
      userBase + STRICT_REWRITE_RETRY_SUFFIX,
    );
    console.log("[/api/analyze] OpenAI pass 2", {
      keys: Object.keys(obj).sort(),
      ...summarizeOpenAIResult(obj),
    });
    san = sanitizeAnalyzeRewrites(obj.rewrites, resumeSlice);
    if (san.notes.length) {
      console.warn("[/api/analyze] rewrite sanitize after retry", san.notes);
    }
  }

  const padded = padRewritesToSix(san.rewrites, resumeSlice);
  obj.rewrites = padded;

  console.log("[/api/analyze] Final parsed model JSON", {
    keys: Object.keys(obj).sort(),
    ...summarizeOpenAIResult(obj),
    resumeCharsUsed: resumeSlice.length,
    jobCharsUsed: jobSlice.length,
  });

  return {
    keywords: obj.keywords,
    matchedStrengths: obj.matchedStrengths,
    gaps: obj.gaps,
    rewrites: obj.rewrites,
    atsScore: obj.atsScore,
    experienceMatch: obj.experienceMatch,
    educationMatch: obj.educationMatch,
    quickWins: obj.quickWins,
    intro: obj.intro,
    starStories: obj.starStories,
  };
}

export async function POST(request: Request) {
  const routePath = new URL(request.url).pathname;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnalyzeBody(body);
  if (!parsed.ok) {
    return jsonNoStore(
      { error: parsed.error },
      { status: parsed.status },
    );
  }
  const analyzeInput = parsed;

  const keyCheck = requireOpenAiApiKey();
  if (!keyCheck.ok) {
    return jsonNoStore({ error: keyCheck.error }, { status: 503 });
  }
  const openaiKey = keyCheck.key;

  /** Admin or paid (Clerk + Stripe) — skip free scan cap and post-run increment. */
  let skipFreeScanAccounting = false;
  const { userId } = await auth();
  if (userId) {
    try {
      const c = await clerkClient();
      const user = await c.users.getUser(userId);
      const primaryEmail =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ?? null;
      const reqHost =
        request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
        request.headers.get("host") ??
        null;
      const meta = user.publicMetadata as Record<string, unknown>;

      // 1) Admin email → unlimited
      if (isAdminBypassEmail(primaryEmail, reqHost)) {
        skipFreeScanAccounting = true;
      } else {
        // 2) Active Pro/Premium (metadata or live Stripe) → unlimited
        const effectiveTier = await effectiveTierFromClerkPublicMetadata(meta);
        if (hasProPlan(effectiveTier)) {
          skipFreeScanAccounting = true;
        } else {
          // 3) Free only — enforce 3-scan cap
          const used = Number(meta.analysisScanCount ?? 0);
          const u = Number.isFinite(used) ? used : 0;
          if (u >= FREE_ANALYSIS_SCAN_LIMIT) {
            return jsonNoStore(
              {
                error:
                  "You've used all 3 free scans. Upgrade to Pro for unlimited analyses.",
                code: "FREE_SCAN_LIMIT",
              },
              { status: 402 },
            );
          }
        }
      }
    } catch (e) {
      console.error("[/api/analyze] tier/scan check", e);
    }
  }

  type JobResolveOk = { ok: true; text: string; jobLink: string | null };
  type JobResolvePaste = {
    ok: false;
    jobTextPasteRequired: true;
    message: string;
    jobLink: string | null;
  };

  async function resolveJobDescription(): Promise<JobResolveOk | JobResolvePaste> {
    if (analyzeInput.job.kind === "text") {
      const text = analyzeInput.job.text.replace(/\s+/g, " ").trim();
      const jobLink = analyzeInput.job.urlContext ?? null;
      return {
        ok: true,
        text: text.slice(0, MAX_JOB_CHARS),
        jobLink,
      };
    }

    const url = analyzeInput.job.url;
    const scraped = await fetchJobDescriptionFromUrlWithDetails(
      url,
      JOB_PAGE_FETCH_TIMEOUT_MS,
    );
    if (!scraped.ok) {
      return {
        ok: false,
        jobTextPasteRequired: true,
        message: scraped.message,
        jobLink: url,
      };
    }
    const text = scraped.text.replace(/\s+/g, " ").trim();
    if (text.length < JOB_FETCH_MIN_MEANINGFUL_CHARS) {
      return {
        ok: false,
        jobTextPasteRequired: true,
        message: JOB_PASTE_FALLBACK_USER_MESSAGE,
        jobLink: url,
      };
    }
    return {
      ok: true,
      text: text.slice(0, MAX_JOB_CHARS),
      jobLink: url,
    };
  }

  const tJob0 = Date.now();
  const resolved = await resolveJobDescription();
  const msJobResolve = Date.now() - tJob0;
  if (!resolved.ok) {
    console.log("[/api/analyze] Job URL/text requires paste fallback", {
      msJobResolve,
      jobLink: resolved.jobLink,
    });
    return jsonNoStore(
      {
        jobTextPasteRequired: true,
        jobTextPasteMessage: resolved.message,
        jobLink: resolved.jobLink,
      },
      { status: 200 },
    );
  }

  const jobDescription = resolved.text;
  const resolvedJobLink = resolved.jobLink;

  const tResume0 = Date.now();
  const resumeText = await cleanResumeToPlainText(analyzeInput.resume);
  const msResumeClean = Date.now() - tResume0;
  const fp = resumeTextFingerprint(resumeText);
  console.log(
    `[${routePath}] resume fingerprint`,
    JSON.stringify({
      length: fp.length,
      sha256Prefix: fp.sha256Prefix,
    }),
  );

  if (resumeText.length < MIN_MEANINGFUL_CHARS) {
    return jsonNoStore(
      {
        error:
          "Could not extract enough readable text from your resume. Try: a .txt/.md file; a PDF with selectable text (not a scan); or .docx. Legacy .doc is not supported.",
      },
      { status: 400 },
    );
  }

  try {
    const tAi0 = Date.now();
    const result = await runAnalyzeOpenAI({
      apiKey: openaiKey,
      resume: resumeText,
      jobDescription,
    });
    const msOpenAI = Date.now() - tAi0;
    console.log("[/api/analyze] Analyze pipeline timings (ms)", {
      msJobResolve,
      msResumeClean,
      msOpenAI,
      jobDescLen: jobDescription.length,
      resumeLen: resumeText.length,
      ...summarizeOpenAIResult(result),
    });
    if (userId) {
      try {
        const c = await clerkClient();
        const user = await c.users.getUser(userId);
        const meta = user.publicMetadata as Record<string, unknown>;
        const primaryEmail =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
            ?.emailAddress ?? null;
        const reqHost =
          request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
          request.headers.get("host") ??
          null;
        if (!isAdminBypassEmail(primaryEmail, reqHost)) {
          const effectiveTier = await effectiveTierFromClerkPublicMetadata(meta);
          const metaTier = tierFromPublicMetadata(meta);
          if (hasProPlan(effectiveTier) && !hasProPlan(metaTier)) {
            await mergeClerkPublicMetadata(userId, {
              subscriptionTier: effectiveTier,
            });
          }
          if (
            !skipFreeScanAccounting &&
            !hasProPlan(effectiveTier)
          ) {
            const prev = Number(meta.analysisScanCount ?? 0);
            const next = (Number.isFinite(prev) ? prev : 0) + 1;
            await mergeClerkPublicMetadata(userId, { analysisScanCount: next });
          }
        }
      } catch (e) {
        console.error("[/api/analyze] increment analysisScanCount", e);
      }
    }
    return jsonNoStore({
      ...result,
      resolvedJobPosting: jobDescription,
      jobLink: resolvedJobLink,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/analyze] Analyze failed", {
      msJobResolve,
      msResumeClean,
      error: msg,
    });
    if (msg.includes("insufficient_quota") || msg.includes("billing")) {
      return jsonNoStore(
        {
          error: "OpenAI quota or billing issue. Add credits in your OpenAI account.",
        },
        { status: 402 },
      );
    }
    if (msg.includes("timed out")) {
      return jsonNoStore(
        {
          error:
            "Analysis timed out. Try again with a shorter job description or paste the posting text instead of only a URL.",
        },
        { status: 504 },
      );
    }
    return jsonNoStore(
      {
        error: "Analysis didn't complete. Try again in a moment.",
      },
      { status: 500 },
    );
  }
}
