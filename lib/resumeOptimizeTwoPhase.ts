import {
  applyRewrittenBulletLines,
  blocksToPlain,
  bulletJoined,
  bulletTextChanged,
  isSectionHeader,
  mapHeaderToSection,
  parseResumeIntoBlocks,
  shouldRewriteBulletForOptimize,
  type BulletBlock,
  type ResumeBlock,
} from "@/lib/resumeEditorBlocks";
import { isKeywordLiterallyPresent } from "@/lib/atsDeterministicKeywords";
import { optimizeResumeStandardsOnly } from "@/lib/optimizeResumePrompt";
import { bulletRewriteMissingSentenceEnd } from "@/lib/resumeOptimizeRewrites";
import { preserveKeywordsInBulletText } from "@/lib/resumeOptimizePreserveKeywords";

const OPENAI_MODEL = "gpt-4o";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/** Job-ATS list is technical/posting phrases only (server-filtered to the JD). Universal soft skills are mandated separately — do not treat them as technical keyword stuffing. */
const UNIVERSAL_SOFT_SKILL_TERMS =
  "communication, collaboration, attention to detail, ownership, leadership";

const BULLET_SYSTEM = `You rewrite ONE resume bullet point using the full saved job description as context.

    Goals:
    - **Paraphrase substantively**: produce clearly new wording (stronger verbs, tighter structure, clearer outcomes). Do not only swap a few words or reorder the same sentence — the reader should see a real rewrite while keeping every fact from the original.
    - Reflect the job's stated priorities, responsibilities, and vocabulary in natural prose — as if this resume were written for this posting.
    - NEVER fabricate experience, employers, dates, metrics, or tools the candidate did not already have in the bullet or resume facts.

    Two keyword tracks (do not confuse them):
    1) JOB ATS PHRASES (comma-separated list in the user message): only technical tools, domain terms, and short phrases that **actually appear in the saved job description**. Weave them in only when the same facts support them; never add technical/domain terms from outside that list for density.
    2) **MISSING RESUME KEYWORDS** (if listed in the user message): phrases that do not yet appear literally anywhere on the resume. When this bullet's work **clearly** covers that skill or domain, weave **1–2** of them in using the **job posting's exact phrasing** (multi-word phrases intact). Skip any keyword that would require inventing experience. If none fit honestly, skip.
    3) UNIVERSAL SOFT SKILLS (${UNIVERSAL_SOFT_SKILL_TERMS}): These are NOT technical keywords. When this bullet describes real work (tasks, outcomes, teamwork, delivery, review, or stakeholder interaction), you MUST naturally incorporate at least one of these concepts using honest wording drawn from what the bullet already implies — e.g. cross-team or partner work → collaboration; updates, docs, or presenting → communication; careful work or QA → attention to detail; end-to-end or initiative → ownership; guiding or coordinating others → leadership. Do not stack buzzwords; one or two natural phrases max. Exception: if the bullet is only a bare tool list, a single education line with no work behavior, or there is no describable work angle, skip soft-skill expansion.

    Rules:
    - NEVER remove, shorten away, or substitute any programming language, tool, framework, library, database, cloud product, or technical term that appears in the original bullet. Keep correct spelling; you may add more only when consistent with facts.
    - When a JOB ATS phrase describes work the candidate already did in other words, rewrite to use the job's exact phrasing where still accurate — do not claim new scope.
    - Change the opening verb for stronger impact when possible, without dropping named skills from the original.
    - Replace weak verbs where it helps: Assisted→Managed, Collaborated→Partnered,
      Built→Engineered, Created→Delivered, Facilitating→Led,
      Supporting→Mentored, Added→Implemented, Worked→Drove
    - Weave JOB ATS phrases from the list when they fit the same facts; do not delete existing ones from the original bullet.
    - End with a result or impact if not already present.
    - Do not end bullets with generic filler phrases. Each ending must be specific to that bullet.
    - The bullet must end with a complete sentence (. ! ? or …). Never truncate mid-thought.
    - Keep all numbers exactly (25%, 30%, 40%)
    - Return ONLY the rewritten bullet. Nothing else. No explanation.`;

const STRUCTURE_SYSTEM = `You are a resume formatter. Every bullet line (starts with •, -, *, –, —, or a short numbered prefix like "1." / "2)") has already been rewritten in a prior step — preserve that wording exactly (tiny grammar fixes only). NEVER delete programming languages, tools, frameworks, or technical terms from any bullet (enhance and add only).

Output ONE valid JSON object only:
{
  "optimizedResume": "complete resume text, nothing truncated",
  "summaryAdded": "the 2-line summary you wrote under SUMMARY, or empty string",
  "atsKeywordsInjected": ["phrases from the job description only — real tools/skills that appear in the posting; not invented domains"],
  "missedKeywords": ["job keywords with no honest basis in the resume"]
}

Layout at the TOP (immediately after the candidate's name, contact lines, and any link line — before SUMMARY):
1. Insert exactly one line: Tailored for: [Job Title]
   Use the job title supplied in the user message exactly for [Job Title]. If none supplied, derive a short title from the job description (max 72 characters).
2. Then a single blank line.
3. Then the SUMMARY section.

SUMMARY (regenerate completely):
- Replace any existing summary/objective body entirely. Do not keep prior summary wording.
- Use the EXACT same ALL-CAPS header that appears in the input resume (e.g. "SUMMARY", "PROFESSIONAL SUMMARY", "OBJECTIVE") — never rename it.
- Follow with exactly 1–2 NEW complete sentences. NEVER use the posting's job title (e.g. "Senior Accountant", "Software Engineer II") as the candidate's current identity or targeting phrase. Instead, identify the FUNCTIONAL AREA that the role sits in (e.g. "financial reporting and accounting", "full-stack web development", "data analytics and business intelligence") by reading the responsibilities and requirements in the JD — then write: "[Background] professional targeting [functional area] opportunities." Second sentence: tie to top JD requirements using only resume-supported facts. No invented employers, tools, or metrics.
- Example: if the job title is "Senior Accountant", derive the functional area from the JD body and write "targeting roles in financial reporting and accounting" — NOT "targeting Senior Accountant opportunities".

SECTION ORDER AND HEADERS — CRITICAL:
- Preserve the original section order from the input resume exactly. Do NOT reorder sections (e.g. if Education comes before Experience in the input, keep it that way).
- Copy each section header verbatim from the input resume. NEVER rename a section (e.g. if input says "TECHNICAL SKILLS", output "TECHNICAL SKILLS" — not "SKILLS").
- The only exception: move SUMMARY (whatever it is named) to appear immediately after the contact/name block if it is not already there.

SKILLS LINES:
- Keep every comma-separated skill category line exactly as-is. Do not reorder items within a skill line. Do not remove any skill name.

OTHER FACTS:
- Keep certification lines, education facts (GPA, coursework, Dean's List) word-for-word.
- Do not remove any skill/tool name from bullet text.
- Never fabricate experience.`;

function stripBulletResponse(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "").trim();
  t = t.replace(/^```[^\n]*\n?|```$/g, "").trim();
  return t;
}

const MAX_JOB_CTX_BULLET = 48_000;

export async function rewriteSingleBulletOpenAI(
  apiKey: string,
  bulletText: string,
  atsKeywordsCsv: string,
  jobDescription: string,
  jobTitle: string,
  missingKeywordsNotOnResumeYet: string[],
): Promise<string> {
  const jd = jobDescription.replace(/\r\n/g, "\n").trim().slice(0, MAX_JOB_CTX_BULLET);
  const titleLine =
    jobTitle.trim() ||
    "See job description for role title";
  const missingCsv =
    missingKeywordsNotOnResumeYet.length > 0
      ? missingKeywordsNotOnResumeYet.slice(0, 24).join(", ")
      : "(none — resume may already include most ATS phrases; still paraphrase and strengthen the bullet.)";
  const user = `SAVED JOB DESCRIPTION (full text — use for priorities, language, and honest alignment):
${jd}

Target role title: ${titleLine}

JOB ATS PHRASES — must each appear in the job description above; weave only when facts support (not for generic technical stuffing): ${atsKeywordsCsv}

MISSING FROM RESUME (literal) — these exact phrases do not appear anywhere on the candidate's resume text yet. Work 1–2 into THIS bullet only when the bullet already describes that work honestly; use exact multi-word phrasing from the job when you add them:
${missingCsv}

UNIVERSAL SOFT SKILLS — incorporate naturally where this bullet's work supports: ${UNIVERSAL_SOFT_SKILL_TERMS} (required for substantive work bullets; see system rules).

Rewrite ONLY the bullet below.

Bullet to rewrite:
${bulletText}`;

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 800,
      temperature: 0.42,
      messages: [
        { role: "system", content: BULLET_SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error("Bad response from bullet rewrite.");
  }
  if (!res.ok) {
    console.error("[resume-optimize bullet]", res.status, rawText.slice(0, 300));
    throw new Error("Bullet rewrite failed");
  }
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices;
  const text = stripBulletResponse(
    choices?.[0]?.message?.content?.trim() ?? "",
  );
  if (!text) throw new Error("Empty bullet rewrite");
  return text;
}

function cloneBlocks(blocks: ResumeBlock[]): ResumeBlock[] {
  return blocks.map((b) =>
    b.kind === "bullet"
      ? { ...b, lines: [...b.lines] }
      : { ...b, lines: [...b.lines] },
  );
}

export async function phaseOneRewriteAllBullets(
  apiKey: string,
  blocks: ResumeBlock[],
  atsKeywordsCsv: string,
  jobDescription: string,
  atsKeywordsList: string[],
  jobTitle: string,
): Promise<{ blocks: ResumeBlock[]; pairs: { original: string; rewritten: string }[] }> {
  const out = cloneBlocks(blocks);
  const pairs: { original: string; rewritten: string }[] = [];
  let resumePlainSoFar = blocksToPlain(out);

  for (let i = 0; i < out.length; i++) {
    const b = out[i]!;
    if (b.kind !== "bullet") continue;
    const originalJoined = bulletJoined(b);
    if (!shouldRewriteBulletForOptimize(b)) {
      pairs.push({ original: originalJoined, rewritten: originalJoined });
      continue;
    }
    const bulletForModel = bulletJoined(b);
    const missingFromResume = atsKeywordsList.filter(
      (kw) =>
        kw.trim().length > 0 && !isKeywordLiterallyPresent(kw, resumePlainSoFar),
    );
    try {
      const rwRaw = await rewriteSingleBulletOpenAI(
        apiKey,
        bulletForModel,
        atsKeywordsCsv,
        jobDescription,
        jobTitle,
        missingFromResume,
      );
      const rw = preserveKeywordsInBulletText(
        bulletForModel,
        rwRaw,
        atsKeywordsList,
      );
      const newLines = applyRewrittenBulletLines(b.lines, rw);
      const updated: BulletBlock = { ...b, lines: newLines };
      const joinedOut = bulletJoined(updated);
      if (bulletRewriteMissingSentenceEnd(joinedOut)) {
        pairs.push({
          original: originalJoined,
          rewritten: originalJoined,
        });
        continue;
      }
      out[i] = updated;
      pairs.push({
        original: originalJoined,
        rewritten: joinedOut,
      });
      resumePlainSoFar = blocksToPlain(out);
    } catch (e) {
      console.error("[resume-optimize] bullet skip", e);
      pairs.push({
        original: originalJoined,
        rewritten: originalJoined,
      });
    }
  }

  return { blocks: out, pairs };
}

function stripFences(s: string): string {
  let t = s.trim();
  t = t.replace(/^`+json\s*/i, "").replace(/^`+/, "").replace(/`+$/, "");
  return t.trim();
}

export async function phaseTwoStructureResume(
  apiKey: string,
  intermediateResume: string,
  jobDescription: string,
  atsKeywordsCsv: string,
  jobTitle: string,
): Promise<{
  optimizedResume: string;
  summaryAdded: unknown;
  atsKeywordsInjected: unknown;
  missedKeywords: unknown;
}> {
  const standards = optimizeResumeStandardsOnly(intermediateResume, jobDescription);
  const displayTitle =
    jobTitle.trim() ||
    "Role (derive a short title from the job description if missing)";
  const jdFull = jobDescription.replace(/\r\n/g, "\n").trim().slice(0, 56_000);
  const user = `PHASE 2 — STRUCTURE, TAILORED LABEL & FULL SUMMARY REGENERATION

Job title for the "Tailored for:" line and summary: ${displayTitle}

FULL SAVED JOB DESCRIPTION (top requirements and language for the new summary; never invent resume facts):
${jdFull}

The resume below already has every bullet (•, -, *, or numbered list lines under roles) rewritten. Keep all bullet wording except tiny grammar fixes; fix section order; reorder skills.

ATS / job keywords (comma-separated): ${atsKeywordsCsv}

EDITORIAL STANDARDS (summary + layout + skills — bullets stay as given):
${standards}

Required:
- Immediately after the name/contact block, insert exactly one line: Tailored for: ${displayTitle}
- Completely replace the summary section body with 1–2 NEW sentences. Do not present ${displayTitle} as the candidate's current job title or identity; frame their real background and aspirational targeting toward that type of role (per STRUCTURE_SYSTEM). Ground every claim in the resume.

---

INPUT RESUME (bullets already optimized — use as base):
${intermediateResume.slice(0, 47_000)}`;

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 16_384,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STRUCTURE_SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error("Bad structure response.");
  }
  if (!res.ok) {
    console.error("[resume-optimize structure]", res.status, rawText.slice(0, 400));
    throw new Error("Structure pass failed");
  }
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices;
  let raw = choices?.[0]?.message?.content?.trim() ?? "";
  raw = stripFences(raw);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const optimizedResume =
    typeof parsed.optimizedResume === "string"
      ? parsed.optimizedResume.replace(/\r\n/g, "\n").trim()
      : "";
  if (!optimizedResume || optimizedResume.length < 10) {
    throw new Error("Structure pass returned empty resume.");
  }
  return {
    optimizedResume,
    summaryAdded: parsed.summaryAdded,
    atsKeywordsInjected: parsed.atsKeywordsInjected,
    missedKeywords: parsed.missedKeywords,
  };
}

// ─── Phase 3: quantification + verb diversity ────────────────────────────────

const PHASE3_SYSTEM = `You are a resume polish editor. Apply two targeted sweeps to the resume below and output ONLY the complete polished resume text — no JSON, no markdown fences, no explanation.

SWEEP A — Quantification:
For every bullet (line starting with •, -, *, –, —, or 1–2 digit numbering like "1.") that has no number, percentage, metric, count, or scale phrase:
- If a number is inferable from context (team size, project count, user base), add it naturally.
- If not inferable, add a soft quantifier: "at scale", "across multiple teams", "consistently", "for a cross-functional audience", "across all environments", "across every workstream".
- Keep all existing numbers exactly. Never invent specific percentages or dollar amounts.
- Skip bullets that already have a number or scale phrase.

SWEEP B — Verb diversity (covers ALL bullets in the entire resume, including Projects):
- Scan every bullet's opening action verb across ALL sections.
- If the same verb appears in 3 or more bullets, replace all occurrences after the second with a different synonym.
- When choosing a replacement: first check which verbs are already used 0 or 1 times across ALL bullets — pick only from those; never pick a verb that already appears 2+ times. Then pick from: Spearheaded, Architected, Delivered, Streamlined, Accelerated, Coordinated, Elevated, Championed, Facilitated, Optimized, Executed, Deployed, Orchestrated, Established, Authored, Directed, Launched, Drove, Implemented, Developed. Do NOT use "Engineered" as a replacement.
- Change only the opening verb; keep everything else in the bullet intact.
- Apply this sweep to bullets in ALL sections (Experience, Projects, Education, etc.).

SWEEP C — Soft skill phrase cap (apply across the ENTIRE resume, all sections):
- Track occurrences GLOBALLY across every bullet in every section (not per-section).
- Soft-skill phrases to cap (match case-insensitively, as whole phrases):
    "attention to detail", "high attention to detail", "ownership", "collaboration",
    "communication", "leadership", "leadership skills", "cross-functional",
    "demonstrated leadership", "strong communication", "strong collaboration".
- For EACH phrase independently: count how many bullets it appears in, reading top to bottom. Allow at most 3 occurrences total. For every bullet that would be the 4th, 5th, etc. occurrence, remove the phrase (or its surrounding clause) smoothly. Keep the first 3 occurrences exactly as-is.
- When removing a phrase, revise the remainder of the sentence so it remains grammatically complete. Never leave a dangling fragment like "with and attention to client needs."

Rules (all sweeps):
- Never remove any tool, technology, programming language, or named entity from any bullet.
- Do not add new bullets or sections.
- Output the full resume text.`;

export async function phaseThreePolish(
  apiKey: string,
  resumeText: string,
  jobDescription: string,
): Promise<string> {
  const jdCtx = jobDescription.replace(/\r\n/g, "\n").trim().slice(0, 6_000);
  const user = `Job context (for quantification hints only):
${jdCtx}

---

RESUME (apply Sweep A + B + C):
${resumeText.replace(/\r\n/g, "\n").trim().slice(0, 47_000)}`;

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 16_384,
      temperature: 0.15,
      messages: [
        { role: "system", content: PHASE3_SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });

  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    return resumeText;
  }
  if (!res.ok) {
    console.error("[resume-optimize phase3]", res.status, rawText.slice(0, 300));
    return resumeText;
  }
  const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
    ?.choices;
  const text = (choices?.[0]?.message?.content ?? "").replace(/\r\n/g, "\n").trim();
  if (!text || text.length < 100) return resumeText;
  // Strip any accidental fences
  return stripFences(text);
}

// ─── Competitive assessment ───────────────────────────────────────────────────

const COMPETITIVE_SYSTEM = `You assess a candidate's resume against a job posting and return ONLY a JSON object with this exact shape:
{
  "strength": "emerging" | "growing" | "competitive",
  "matchOn": ["up to 3 short phrases — concrete strengths the resume shows for this role"],
  "gaps": ["up to 3 short phrases — specific areas to address, framed constructively"],
  "assessment": "One coaching-style sentence using this template: 'Your application is competitive on [X] and [Y]. To strengthen your chances further, consider addressing [gap 1] and [gap 2] in your cover letter or interview.' Use the exact matchOn and gaps values."
}

CRITICAL tone rules — never use these words: "weak", "pass", "unlikely", "recruiter would pass", "not competitive", "insufficient". Always frame gaps as opportunities, not disqualifiers. Write like a career coach, not a rejection letter. Be honest but constructive.`;

export type CompetitiveAssessment = {
  strength: string;
  matchOn: string[];
  gaps: string[];
  recruiterAction: string;
  assessment: string;
};

export async function generateCompetitiveAssessment(
  apiKey: string,
  resumeText: string,
  jobDescription: string,
): Promise<CompetitiveAssessment | null> {
  const user = `JOB DESCRIPTION:
${jobDescription.replace(/\r\n/g, "\n").trim().slice(0, 8_000)}

RESUME:
${resumeText.replace(/\r\n/g, "\n").trim().slice(0, 12_000)}`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 400,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: COMPETITIVE_SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });

    const rawText = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices;
    const text = (choices?.[0]?.message?.content ?? "").trim();
    if (!text) return null;

    const parsed = JSON.parse(stripFences(text)) as Record<string, unknown>;
    return {
      strength: typeof parsed.strength === "string" ? parsed.strength : "growing",
      matchOn: Array.isArray(parsed.matchOn)
        ? (parsed.matchOn as unknown[])
            .filter((x): x is string => typeof x === "string")
            .slice(0, 3)
        : [],
      gaps: Array.isArray(parsed.gaps)
        ? (parsed.gaps as unknown[])
            .filter((x): x is string => typeof x === "string")
            .slice(0, 3)
        : [],
      recruiterAction: "",
      assessment:
        typeof parsed.assessment === "string" ? parsed.assessment.trim() : "",
    };
  } catch {
    return null;
  }
}

// ─── Skills section reordering pass ─────────────────────────────────────────

const SKILLS_REORDER_SYSTEM = `You are a resume skills optimizer. You receive a Skills section (from its header through the last skills line) and a job description. Apply these rules and return ONLY the updated Skills section text — no JSON, no explanation.

Rules:
1. For each comma-separated skill category line, reorder the skills so those that appear in the job description come FIRST. Preserve the rest after them.
2. Transferable notes — add ONLY when ALL three conditions are true:
   a. The job description mentions a specific tool/technology.
   b. That tool does NOT already appear anywhere in the candidate's Skills section (do not add a note if the candidate already has the tool).
   c. The candidate has a genuinely adjacent skill that transfers to the missing tool (e.g. candidate has MongoDB, job wants PostgreSQL → "MongoDB (transferable to PostgreSQL)").
   Never annotate two tools the candidate already has with each other. Never invent adjacency.
3. NEVER remove any skill. NEVER add a skill the candidate doesn't already have unless it is a parenthetical transferability note as described above.
4. Preserve the exact section header text.
5. Output the full updated Skills section text only.`;

function extractSkillsSectionBounds(
  resumeText: string,
): { pre: string; section: string; post: string } | null {
  const lines = resumeText.split("\n");
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (start === -1) {
      if (t && isSectionHeader(t) && mapHeaderToSection(t) === "skills") {
        start = i;
      }
    } else {
      if (t && isSectionHeader(t) && mapHeaderToSection(t) !== "skills") {
        end = i;
        break;
      }
    }
  }

  if (start === -1) return null;

  return {
    pre: lines.slice(0, start).join("\n"),
    section: lines.slice(start, end).join("\n"),
    post: lines.slice(end).join("\n"),
  };
}

export async function phaseSkillsReorder(
  apiKey: string,
  resumeText: string,
  jobDescription: string,
): Promise<string> {
  const bounds = extractSkillsSectionBounds(resumeText);
  if (!bounds) return resumeText; // no skills section found

  const jdCtx = jobDescription.replace(/\r\n/g, "\n").trim().slice(0, 8_000);
  const user = `JOB DESCRIPTION:
${jdCtx}

SKILLS SECTION TO REORDER:
${bounds.section}`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 2_000,
        temperature: 0.1,
        messages: [
          { role: "system", content: SKILLS_REORDER_SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });

    const rawText = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      return resumeText;
    }
    if (!res.ok) {
      console.error("[resume-optimize skills-reorder]", res.status, rawText.slice(0, 300));
      return resumeText;
    }

    const choices = (data as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices;
    const newSection = stripFences(
      (choices?.[0]?.message?.content ?? "").replace(/\r\n/g, "\n").trim(),
    );

    if (!newSection || newSection.length < 5) return resumeText;

    // Reassemble the resume with updated skills section
    const parts = [bounds.pre, newSection, bounds.post].filter(Boolean);
    return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return resumeText;
  }
}

export function extractBulletLines(plain: string): string[] {
  const blocks = parseResumeIntoBlocks(plain);
  return blocks
    .filter((b): b is BulletBlock => b.kind === "bullet")
    .map((b) => bulletJoined(b));
}

/** Pair original snapshot bullets to final bullets by index (same reading order). */
export function zipRewrittenBulletsForClient(
  originalPlain: string,
  finalPlain: string,
): { original: string; rewritten: string }[] {
  const orig = extractBulletLines(originalPlain);
  const fin = extractBulletLines(finalPlain);
  const n = Math.min(orig.length, fin.length);
  const out: { original: string; rewritten: string }[] = [];
  for (let i = 0; i < n; i++) {
    const o = orig[i]!;
    const f = fin[i]!;
    if (bulletTextChanged(o, f)) out.push({ original: o, rewritten: f });
  }
  return out;
}

export { OPENAI_MODEL as RESUME_OPTIMIZE_OPENAI_MODEL };
