"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useApplyfy,
  type HybridAtsPayload,
} from "@/components/applyfy/ApplyfyProvider";
import {
  blocksToPlain,
  bulletJoined,
  bulletTextChanged,
  type BulletBlock,
  type ResumeBlock,
  isSectionHeader,
  pairBulletRewritesAligned,
  parseResumeIntoBlocks,
  shouldSendBulletToAi,
} from "@/lib/resumeEditorBlocks";
import { verifyKeywordsAgainstResume } from "@/lib/atsDeterministicKeywords";
import { extractJobTitleFromPosting } from "@/lib/jobMetaFromPosting";
import { filterKeywordLabelsToJobPosting } from "@/lib/jobKeywordInPosting";
import { filterAtsKeywordLabels } from "@/lib/jobKeywordSanitize";
import {
  purgeFabricatedResumeLines,
  purgeResumeEditorBrowserStorage,
} from "@/lib/resumeFabricationPurge";
import { downloadResumePdf } from "@/lib/resumePdfExport";

const LS_JOB = "jobPosting";
const LS_ATS_SCORE = "atsScore";

const CARD =
  "mb-[14px] rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5";

/**
 * Textarea that grows to fit its full content — no clipping of long rewritten bullets.
 * Uses a layout-effect to set height = scrollHeight after every render.
 */
function AutoResizeTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  });
  return (
    <textarea
      {...props}
      ref={ref}
      style={{ overflowY: "hidden", ...props.style }}
    />
  );
}

/** Map final bullet blocks to pre-optimize text for inline highlight + undo. */
function buildBulletPendingFromRewrites(
  bulletBlocks: BulletBlock[],
  rewrites: Array<{ original: string; rewritten: string }>,
): Record<string, string> {
  const pending: Record<string, string> = {};
  const norm = (s: string) =>
    s.replace(/\r\n/g, "\n").trim().replace(/\s+/g, " ");
  for (const b of bulletBlocks) {
    const joined = bulletJoined(b);
    const rw = rewrites.find(
      (r) =>
        r.rewritten.trim().length > 0 &&
        norm(r.rewritten) === norm(joined),
    );
    if (!rw) continue;
    if (rw.original.trim() === rw.rewritten.trim()) continue;
    if (!bulletTextChanged(rw.original, joined)) continue;
    pending[b.id] = rw.original.replace(/\r\n/g, "\n").trimEnd();
  }
  return pending;
}

function buildPlainPendingAligned(
  oldBlocks: ResumeBlock[],
  newBlocks: ResumeBlock[],
): Record<string, string> {
  const pending: Record<string, string> = {};
  let oi = 0;
  let ni = 0;
  while (oi < oldBlocks.length && ni < newBlocks.length) {
    const ob = oldBlocks[oi]!;
    const nb = newBlocks[ni]!;
    if (ob.kind === nb.kind) {
      if (ob.kind === "plain") {
        const o = ob.lines.join("\n");
        const nw = nb.lines.join("\n");
        if (o.trim() !== nw.trim()) {
          pending[nb.id] = o;
        }
      }
      oi++;
      ni++;
      continue;
    }
    if (nb.kind === "plain" && ob.kind === "bullet") {
      ni++;
      continue;
    }
    if (nb.kind === "bullet" && ob.kind === "plain") {
      oi++;
      continue;
    }
    oi++;
    ni++;
  }
  return pending;
}

const MILESTONES = [
  { min: 0, label: "Start", unlock: "Optimize lines from the job" },
  { min: 55, label: "Getting there", unlock: "Stronger ATS visibility" },
  { min: 65, label: "Good", unlock: "Competitive for screeners" },
  { min: 75, label: "Strong", unlock: "Passes most ATS filters" },
  { min: 85, label: "Excellent", unlock: "Top bucket for matches" },
] as const;

function nextMilestone(score: number): (typeof MILESTONES)[number] {
  for (const m of MILESTONES) {
    if (score < m.min) return m;
  }
  return MILESTONES[MILESTONES.length - 1]!;
}

function milestoneBarLabels(): { pct: number; label: string }[] {
  return [
    { pct: 55, label: "55" },
    { pct: 65, label: "65" },
    { pct: 75, label: "75" },
    { pct: 85, label: "85+" },
  ];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function scoreHue(score: number): string {
  if (score < 45) return "#ef4444";
  if (score < 70) return "#7c3aed";
  return "#059669";
}

function scoreStatusLabel(score: number): { text: string; color: string } {
  if (score < 45) return { text: "Needs work", color: "#ef4444" };
  if (score < 70) return { text: "Getting there", color: "#6d28d9" };
  if (score < 90) return { text: "Strong match", color: "#059669" };
  return { text: "Excellent match", color: "#047857" };
}

function normKwLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Matches /api/resume-optimize and /api/resume-editor-score: merge job + analyze keywords,
 * then keep only phrases that appear in the job posting when the posting is long enough.
 */
function buildAtsKeywordsForResumeEditor(
  jobPosting: string,
  jobKeywordLabels: string[],
  analysisKeywordSkills: string[] | undefined,
): string[] {
  const fromJob = filterAtsKeywordLabels(jobKeywordLabels);
  const fromAnalysis = filterAtsKeywordLabels(analysisKeywordSkills ?? []);
  const merged = [...new Set([...fromJob, ...fromAnalysis])];
  const jd = jobPosting.replace(/\r\n/g, "\n").trim();
  if (jd.length >= 40) {
    return filterKeywordLabelsToJobPosting(jd, merged);
  }
  return merged;
}

function normSectionKeyFromLine(line: string): string {
  return line.trim().toUpperCase().replace(/\s+/g, " ");
}

function titleCaseFromHeaderLine(line: string): string {
  const t = line.trim().toLowerCase();
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionHeaderKeys(blocks: ResumeBlock[]): Set<string> {
  const s = new Set<string>();
  for (const b of blocks) {
    if (b.kind !== "plain") continue;
    const first = b.lines[0]?.trim() ?? "";
    if (isSectionHeader(first)) s.add(normSectionKeyFromLine(first));
  }
  return s;
}

function sectionTitlesAdded(
  oldBlocks: ResumeBlock[],
  newBlocks: ResumeBlock[],
): string[] {
  const oldKeys = sectionHeaderKeys(oldBlocks);
  const out: string[] = [];
  for (const b of newBlocks) {
    if (b.kind !== "plain") continue;
    const first = b.lines[0]?.trim() ?? "";
    if (!isSectionHeader(first)) continue;
    const k = normSectionKeyFromLine(first);
    if (!oldKeys.has(k)) out.push(titleCaseFromHeaderLine(first));
  }
  return out;
}

function keywordsNewlyMatched(before: string[], after: string[]): string[] {
  const bset = new Set(before.map(normKwLabel));
  return after.filter((k) => !bset.has(normKwLabel(k)));
}

type OptimizeChangeSummary = {
  bulletsRewritten: number;
  keywordsAdded: string[];
  sectionsAdded: string[];
  scoreBefore: number;
  scoreAfter: number | null;
  biggestGap: string | null;
};

type CompetitiveAssessment = {
  strength: string;
  matchOn: string[];
  gaps: string[];
  recruiterAction: string;
  assessment: string;
};

function formatKeywordListForSummary(keywords: string[], maxVisible = 8): string {
  if (keywords.length === 0) return "";
  if (keywords.length <= maxVisible) return keywords.join(", ");
  return `${keywords.slice(0, maxVisible).join(", ")}, +${keywords.length - maxVisible} more`;
}

export function LiveResumeEditorExperience({
  variant = "page",
  onEmbeddedContinue,
  onEmbeddedBack,
}: {
  variant?: "page" | "embedded";
  onEmbeddedContinue?: () => void;
  onEmbeddedBack?: () => void;
}) {
  const {
    resume,
    setResume,
    jobPosting,
    baselineAnalysis,
    originalResumePlain,
    jobKeywordLabels,
    markResumeOptimized,
    undoResumeOptimization,
    committedHybridAtsScore,
    committedHybridPresent,
    committedHybridMissing,
    ingestHybridAtsScore,
    preOptimizationHybridAtsScore,
    optimizationAppliedAt,
    resumeSourceOfTruth,
  } = useApplyfy();

  const resumePayloadRef = useRef(resume);
  resumePayloadRef.current = resume;

  const analysisKey = baselineAnalysis
    ? `${baselineAnalysis.matchScore}-${baselineAnalysis.atsScore}`
    : "none";

  const [blocks, setBlocks] = useState<ResumeBlock[]>([]);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [blockPending, setBlockPending] = useState<Record<string, string>>({});
  const [undoSnapshot, setUndoSnapshot] = useState<string | null>(null);
  const [optimizePhase, setOptimizePhase] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [optimizeProgress, setOptimizeProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [displayScore, setDisplayScore] = useState(0);
  const [presentKw, setPresentKw] = useState<string[]>([]);
  const [missingKw, setMissingKw] = useState<string[]>([]);
  const [keywordStartCount, setKeywordStartCount] = useState<number | null>(
    null,
  );
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [hasRecalculatedOnce, setHasRecalculatedOnce] = useState(false);
  const [changeSummary, setChangeSummary] = useState<OptimizeChangeSummary | null>(
    null,
  );
  /** From last /api/resume-optimize response — drives "What changed" bullet count. */
  const [optimizeBulletsRewrittenCount, setOptimizeBulletsRewrittenCount] = useState<
    number | null
  >(null);
  const [changeSummaryOpen, setChangeSummaryOpen] = useState(true);
  const [tailoredForLabel, setTailoredForLabel] = useState<string | null>(null);
  const [competitiveAssessment, setCompetitiveAssessment] =
    useState<CompetitiveAssessment | null>(null);
  const [competitiveLoading, setCompetitiveLoading] = useState(false);

  const countAnimRef = useRef<number | null>(null);
  const blockPendingRef = useRef(blockPending);
  blockPendingRef.current = blockPending;

  /** Current editor resume (optimized bullets + manual edits). Never use originalResumePlain for scoring. */
  const optimizedResumeText = useMemo(() => blocksToPlain(blocks), [blocks]);

  const animateScoreTo = useCallback((target: number, start: number) => {
    if (countAnimRef.current !== null) {
      cancelAnimationFrame(countAnimRef.current);
      countAnimRef.current = null;
    }
    const t0 = performance.now();
    const dur = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const v = Math.round(start + (target - start) * easeOutCubic(t));
      setDisplayScore(v);
      if (t < 1) {
        countAnimRef.current = requestAnimationFrame(tick);
      } else {
        countAnimRef.current = null;
      }
    };
    countAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const prevCommittedHybridScoreRef = useRef<number | null>(null);

  useEffect(() => {
    if (committedHybridAtsScore === null) {
      prevCommittedHybridScoreRef.current = null;
      if (countAnimRef.current !== null) {
        cancelAnimationFrame(countAnimRef.current);
        countAnimRef.current = null;
      }
      setPresentKw([]);
      setMissingKw([]);
      setDisplayScore(0);
      try {
        localStorage.removeItem(LS_ATS_SCORE);
      } catch {
        /* ignore */
      }
      return;
    }
    setPresentKw(committedHybridPresent);
    setMissingKw(committedHybridMissing);
    setKeywordStartCount((prev) =>
      prev === null ? committedHybridPresent.length : prev,
    );
    try {
      localStorage.setItem(LS_ATS_SCORE, String(committedHybridAtsScore));
    } catch {
      /* ignore */
    }
    const prev = prevCommittedHybridScoreRef.current;
    prevCommittedHybridScoreRef.current = committedHybridAtsScore;
    if (prev === null || prev === committedHybridAtsScore) {
      if (countAnimRef.current !== null) {
        cancelAnimationFrame(countAnimRef.current);
        countAnimRef.current = null;
      }
      setDisplayScore(committedHybridAtsScore);
      return;
    }
    animateScoreTo(committedHybridAtsScore, prev);
  }, [
    committedHybridAtsScore,
    committedHybridPresent,
    committedHybridMissing,
    animateScoreTo,
  ]);

  useEffect(() => {
    if (jobPosting.trim()) {
      try {
        localStorage.setItem(LS_JOB, jobPosting);
      } catch {
        /* ignore */
      }
    }
  }, [jobPosting]);

  useEffect(() => {
    purgeResumeEditorBrowserStorage();
    let cancelled = false;
    (async () => {
      setInitLoading(true);
      setInitError(null);
      const payload = resumePayloadRef.current.trim();
      const origPlain = originalResumePlain.trim();
      if (!payload && !origPlain) {
        setBlocks([]);
        setInitLoading(false);
        return;
      }
      try {
        let p = "";
        if (payload.startsWith("data:")) {
          if (origPlain) {
            p = origPlain;
          } else {
            const res = await fetch("/api/resume-plain", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resume: payload }),
            });
            const data = (await res.json()) as { text?: string; error?: string };
            if (!res.ok) {
              throw new Error(data.error ?? "Could not parse resume.");
            }
            p = (data.text ?? "").trim();
          }
        } else {
          // Plain-text resume in context — always wins over immutable upload text
          // so remounts and reloads keep Optimize / manual edits.
          p = (payload || origPlain).trim();
          if (!p) {
            setBlocks([]);
            setInitLoading(false);
            return;
          }
        }
        p = purgeFabricatedResumeLines(p, p);
        // Strip any legacy "Tailored for:" line from the resume body (now shown as a UI badge only).
        p = p.replace(/^[ \t]*Tailored for:.*\r?\n?/im, "").replace(/\n{3,}/g, "\n\n").trim();
        if (cancelled) return;
        const nextBlocks = parseResumeIntoBlocks(p);
        setBlocks(nextBlocks);
        setResume(p);
        setBlockPending({});
        setUndoSnapshot(null);
        setOptimizePhase("idle");
        setChangeSummary(null);
      } catch (e) {
        if (!cancelled) {
          setInitError(
            e instanceof Error ? e.message : "Could not load resume text.",
          );
        }
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisKey, originalResumePlain, setResume]);

  useEffect(() => {
    if (!baselineAnalysis) {
      setKeywordStartCount(null);
    }
  }, [baselineAnalysis]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const updatePlainBlock = useCallback(
    (id: string, joined: string) => {
      let nextPlain = "";
      setBlocks((prev) => {
        const next = prev.map((b) =>
          b.id === id && b.kind === "plain"
            ? { ...b, lines: joined.split("\n") }
            : b,
        );
        nextPlain = blocksToPlain(next);
        return next;
      });
      setResume(nextPlain);
      setBlockPending((p) => {
        if (!(id in p)) return p;
        const n = { ...p };
        delete n[id];
        return n;
      });
    },
    [setResume],
  );

  const updateBulletBlock = useCallback(
    (id: string, joined: string) => {
      let nextPlain = "";
      setBlocks((prev) => {
        const next = prev.map((b) =>
          b.id === id && b.kind === "bullet"
            ? { ...b, lines: joined.split("\n") }
            : b,
        );
        nextPlain = blocksToPlain(next);
        return next;
      });
      setResume(nextPlain);
      setBlockPending((p) => {
        if (!(id in p)) return p;
        const n = { ...p };
        delete n[id];
        return n;
      });
    },
    [setResume],
  );

  const keepBlock = useCallback((id: string) => {
    setBlockPending((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, []);

  const undoBlock = useCallback(
    (id: string) => {
      const before = blockPendingRef.current[id];
      if (before === undefined) return;
      let nextPlain = "";
      setBlocks((prevBlocks) => {
        const next = prevBlocks.map((b) =>
          b.id === id ? { ...b, lines: before.split("\n") } : b,
        );
        nextPlain = blocksToPlain(next);
        return next;
      });
      setResume(nextPlain);
      setBlockPending((prev) => {
        if (prev[id] === undefined) return prev;
        const n = { ...prev };
        delete n[id];
        return n;
      });
    },
    [setResume],
  );

  const undoAllOptimize = useCallback(() => {
    if (!undoSnapshot) return;
    const nextBlocks = parseResumeIntoBlocks(undoSnapshot);
    setBlocks(nextBlocks);
    setResume(undoSnapshot);
    setBlockPending({});
    setUndoSnapshot(null);
    setOptimizePhase("idle");
    setChangeSummary(null);
    setOptimizeBulletsRewrittenCount(null);
    setTailoredForLabel(null);
    setCompetitiveAssessment(null);
    undoResumeOptimization();
  }, [undoSnapshot, setResume, undoResumeOptimization]);

  const recalculateScore = useCallback(
    async (
      resumePlainOverride?: string,
      opts?: {
        quiet?: boolean;
        ingestAs?: "recalc" | "optimize";
        skipCompetitive?: boolean;
      },
    ): Promise<{
      presentAfter: string[];
      freshAtsScore: number | null;
    } | null> => {
      const text = (
        resumePlainOverride ?? blocksToPlain(blocksRef.current)
      ).trim();
      const job =
        jobPosting.trim() ||
        (typeof window !== "undefined"
          ? localStorage.getItem(LS_JOB)?.trim() ?? ""
          : "");
      if (text.length < 10) {
        if (!opts?.quiet) setScoreError("Add resume text before scoring.");
        return null;
      }
      if (!job.trim()) {
        if (!opts?.quiet) {
          setScoreError("Job posting is missing. Go back to Analyze.");
        }
        return null;
      }
      const atsKeywords = buildAtsKeywordsForResumeEditor(
        job,
        jobKeywordLabels,
        baselineAnalysis?.keywords.map((k) => k.skill),
      );
      const ingestAs = opts?.ingestAs ?? "recalc";

      if (!opts?.quiet) {
        setScoring(true);
        setScoreError(null);
        setCompetitiveLoading(true);
      }

      const maybeFetchCompetitive = () => {
        if (opts?.skipCompetitive) {
          if (!opts?.quiet) setCompetitiveLoading(false);
          return;
        }
        void (async () => {
          try {
            const caRes = await fetch("/api/resume-competitive-assessment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({ resumeText: text, jobDescription: job }),
            });
            const caRaw = await caRes.text();
            const caData = JSON.parse(caRaw) as {
              assessment?: CompetitiveAssessment | null;
            };
            if (caRes.ok && caData.assessment) {
              setCompetitiveAssessment(caData.assessment);
            }
          } catch {
            /* non-fatal */
          } finally {
            if (!opts?.quiet) setCompetitiveLoading(false);
          }
        })();
      };

      let presentAfter: string[] = [];
      let freshAtsScore: number | null = null;

      const applyFallbackIngest = () => {
        const ver = verifyKeywordsAgainstResume(text, atsKeywords, null);
        presentAfter = ver.present;
        const q25Fallback = 10;
        const compositeFb = Math.min(
          100,
          Math.max(0, Math.round(ver.score75 + q25Fallback)),
        );
        freshAtsScore = compositeFb;
        ingestHybridAtsScore(
          {
            ats_score: Math.min(100, Math.round(ver.score75 + q25Fallback)),
            present_keywords: ver.present,
            missing_keywords: ver.missing,
            quality_score_25: q25Fallback,
            resumePlainVerified: text,
            keywordLabelsVerified: atsKeywords,
          },
          ingestAs,
        );
      };

      try {
        if (process.env.NODE_ENV === "development" && !opts?.quiet) {
          console.info("[resume-editor-score client] resumeText sent to API", {
            charLength: text.length,
            head: text.slice(0, 200),
            tail: text.slice(-200),
          });
        }
        const res = await fetch("/api/resume-editor-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            resumeText: text,
            jobPosting: job,
            atsKeywords,
          }),
        });
        const raw = await res.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          if (!opts?.quiet) throw new Error("Invalid response");
          applyFallbackIngest();
          maybeFetchCompetitive();
          return { presentAfter, freshAtsScore };
        }
        const o = parsed as { result?: HybridAtsPayload; error?: string };
        if (res.ok && o.result) {
          const r = o.result;
          const codeVerified = verifyKeywordsAgainstResume(
            text,
            atsKeywords,
            null,
          );
          presentAfter = codeVerified.present;
          let q25 =
            typeof r.quality_score_25 === "number" &&
            Number.isFinite(r.quality_score_25)
              ? Math.round(r.quality_score_25)
              : Math.round(r.ats_score - codeVerified.score75);
          q25 = Math.min(25, Math.max(0, q25));
          const composite = Math.min(
            100,
            Math.max(0, Math.round(codeVerified.score75 + q25)),
          );
          freshAtsScore = composite;
          ingestHybridAtsScore(
            {
              ...r,
              resumePlainVerified: text,
              keywordLabelsVerified: atsKeywords,
            },
            ingestAs,
          );
        } else {
          applyFallbackIngest();
        }

        if (!opts?.quiet) setHasRecalculatedOnce(true);
        maybeFetchCompetitive();
        return { presentAfter, freshAtsScore };
      } catch (e) {
        if (!opts?.quiet) {
          setScoreError(
            e instanceof Error ? e.message : "Score update failed.",
          );
        }
        applyFallbackIngest();
        maybeFetchCompetitive();
        return { presentAfter, freshAtsScore };
      } finally {
        if (!opts?.quiet) setScoring(false);
      }
    },
    [jobPosting, baselineAnalysis, jobKeywordLabels, ingestHybridAtsScore],
  );

  const runOptimize = useCallback(async () => {
    if (optimizePhase === "running" || initLoading) return;
    const snapshot = blocksToPlain(blocks);
    const job =
      jobPosting.trim() ||
      (typeof window !== "undefined"
        ? localStorage.getItem(LS_JOB)?.trim() ?? ""
        : "");
    const jobTitleForApi = extractJobTitleFromPosting(job);
    const atsKeywords = buildAtsKeywordsForResumeEditor(
      job,
      jobKeywordLabels,
      baselineAnalysis?.keywords.map((k) => k.skill),
    );
    // Same label set + literal scan as post-optimize; snapshot is frozen pre-optimize text.
    const keywordsPresentBefore = verifyKeywordsAgainstResume(
      snapshot,
      atsKeywords,
      null,
    ).present;
    // Capture the pre-optimization keyword count so the panel shows the
    // real "Before optimization: X keywords" value, not 0.
    setKeywordStartCount(keywordsPresentBefore.length);
    const blocksBeforeOptimize = parseResumeIntoBlocks(snapshot);
    const scoreBeforeSnapshot =
      committedHybridAtsScore !== null ? committedHybridAtsScore : displayScore;
    setUndoSnapshot(snapshot);
    setChangeSummary(null);
    setOptimizeBulletsRewrittenCount(null);
    setOptimizePhase("running");
    setBlockPending({});
    setOptimizeProgress(
      "Rewriting bullets (gpt-4o) → summary → quantification & verb polish → competitive assessment…",
    );
    const analysisSnapshot = baselineAnalysis;
    try {
      const res = await fetch("/api/resume-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: snapshot,
          jobDescription: job,
          atsKeywords,
          jobTitle: jobTitleForApi,
        }),
      });
      const data = (await res.json()) as {
        optimizedResume?: string;
        tailoredForTitle?: string | null;
        rewrittenBullets?: Array<{
          original: string;
          rewritten: string;
        }>;
        bulletsRewrittenCount?: number;
        competitiveAssessment?: CompetitiveAssessment | null;
        biggestGap?: string | null;
        error?: string;
      };
      if (!res.ok || typeof data.optimizedResume !== "string") {
        throw new Error(data.error ?? "Optimization failed.");
      }
      const bulletsRewrittenFromApi =
        typeof data.bulletsRewrittenCount === "number" &&
        Number.isFinite(data.bulletsRewrittenCount)
          ? Math.max(0, Math.round(data.bulletsRewrittenCount))
          : 0;
      setOptimizeBulletsRewrittenCount(bulletsRewrittenFromApi);
      let text = data.optimizedResume.trim();
      text = purgeFabricatedResumeLines(text, text);
      // Safety net: strip any remaining "Tailored for:" line the model may have injected.
      text = text.replace(/^[ \t]*Tailored for:.*\r?\n?/im, "").replace(/\n{3,}/g, "\n\n").trim();
      const titleLabel =
        typeof data.tailoredForTitle === "string" && data.tailoredForTitle.trim()
          ? data.tailoredForTitle.trim()
          : jobTitleForApi.trim();
      setTailoredForLabel(titleLabel || null);
      if (data.competitiveAssessment) {
        setCompetitiveAssessment(data.competitiveAssessment);
      }
      const nextBlocks = parseResumeIntoBlocks(text);
      setBlocks(nextBlocks);
      setResume(text);
      let rw = Array.isArray(data.rewrittenBullets)
        ? data.rewrittenBullets
        : [];
      if (rw.length === 0) {
        rw = pairBulletRewritesAligned(snapshot, text);
      }
      const bulletBlocks = nextBlocks.filter(
        (b): b is BulletBlock => b.kind === "bullet",
      );
      const bulletPending = buildBulletPendingFromRewrites(bulletBlocks, rw);
      const plainPending = buildPlainPendingAligned(
        parseResumeIntoBlocks(snapshot),
        nextBlocks,
      );
      setBlockPending({ ...bulletPending, ...plainPending });

      const scoreOutcome = await recalculateScore(text, {
        quiet: true,
        ingestAs: "optimize",
        skipCompetitive: true,
      });
      const presentAfterList =
        scoreOutcome?.presentAfter ?? keywordsPresentBefore;
      const scoreAfterNum = scoreOutcome?.freshAtsScore ?? null;

      markResumeOptimized({
        resumePlainBefore: snapshot,
        analysisSnapshot,
      });
      setOptimizePhase("done");
      const kwAdded = keywordsNewlyMatched(
        keywordsPresentBefore,
        presentAfterList,
      );
      const sectionsAdded = sectionTitlesAdded(blocksBeforeOptimize, nextBlocks);
      const biggestGap =
        typeof data.biggestGap === "string" && data.biggestGap.trim()
          ? data.biggestGap.trim()
          : null;
      setChangeSummary({
        bulletsRewritten: bulletsRewrittenFromApi,
        keywordsAdded: kwAdded,
        sectionsAdded,
        scoreBefore: scoreBeforeSnapshot,
        scoreAfter: scoreAfterNum,
        biggestGap,
      });
      setChangeSummaryOpen(true);
      setToast(
        `${bulletsRewrittenFromApi} bullets rewritten · ATS score updated`,
      );
    } catch (e) {
      setOptimizePhase("idle");
      setChangeSummary(null);
      setOptimizeBulletsRewrittenCount(null);
      setToast(e instanceof Error ? e.message : "Optimization failed.");
    } finally {
      setOptimizeProgress(null);
    }
  }, [
    blocks,
    optimizePhase,
    initLoading,
    jobPosting,
    baselineAnalysis,
    jobKeywordLabels,
    markResumeOptimized,
    setResume,
    recalculateScore,
    committedHybridAtsScore,
    displayScore,
  ]);

  const onPrimaryButtonClick = useCallback(() => {
    const shouldRecalculate =
      optimizePhase === "done" ||
      (optimizePhase === "idle" &&
        optimizationAppliedAt !== null &&
        resumeSourceOfTruth === "optimized");
    if (shouldRecalculate) {
      void recalculateScore();
      return;
    }
    void runOptimize();
  }, [
    optimizePhase,
    optimizationAppliedAt,
    resumeSourceOfTruth,
    recalculateScore,
    runOptimize,
  ]);

  const downloadTxt = useCallback(() => {
    const blob = new Blob([optimizedResumeText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-edited.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [optimizedResumeText]);

  const [pdfDownloading, setPdfDownloading] = useState(false);
  const downloadPdf = useCallback(async () => {
    if (pdfDownloading) return;
    setPdfDownloading(true);
    try {
      await downloadResumePdf(optimizedResumeText, "resume.pdf");
    } catch (e) {
      console.error("[pdf-export]", e);
    } finally {
      setPdfDownloading(false);
    }
  }, [optimizedResumeText, pdfDownloading]);

  const status = scoreStatusLabel(displayScore);
  const hasPendingAi = Object.keys(blockPending).length > 0;
  const isOptimizedSession =
    optimizationAppliedAt !== null && resumeSourceOfTruth === "optimized";
  const primaryShowsOptimized =
    optimizePhase === "done" ||
    (optimizePhase === "idle" && isOptimizedSession);
  const showUndoAll =
    undoSnapshot !== null && (primaryShowsOptimized || hasPendingAi);

  const bottomBar = (
    <div
      className={`flex flex-col gap-4 border-t border-[var(--border)] bg-[var(--bg-card)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${
        variant === "page" ? "fixed bottom-0 left-0 right-0 z-50" : ""
      }`}
    >
      <div className="flex flex-wrap gap-2">
        {variant === "embedded" && onEmbeddedBack ? (
          <button
            type="button"
            onClick={onEmbeddedBack}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
          >
            ← Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={downloadTxt}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
        >
          Download resume (.txt)
        </button>
        <button
          type="button"
          onClick={() => void downloadPdf()}
          disabled={pdfDownloading}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] disabled:opacity-60"
        >
          {pdfDownloading ? "Generating PDF…" : "Download resume (.pdf)"}
        </button>
        {variant === "page" ? (
          <Link
            href="/match"
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            Next
          </Link>
        ) : onEmbeddedContinue ? (
          <button
            type="button"
            onClick={onEmbeddedContinue}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            Next
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-6 px-6 py-6 ${
        variant === "page" ? "pb-36" : "pb-8"
      }`}
    >
      {toast ? (
        <div
          className="re-editor-toast fixed bottom-24 left-1/2 z-[130] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:gap-6">
        <div className="flex min-h-0 flex-col">
          <div className="mb-4">
            <h1
              className="text-[22px] font-extrabold text-[var(--text-primary)]"
              style={{ fontWeight: 800 }}
            >
              Resume Editor
            </h1>
            {tailoredForLabel ? (
              <p
                className="mt-2 inline-block rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
                title="Also inserted at the top of your resume export"
              >
                Tailored for {tailoredForLabel}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Full resume in one scroll. Optimize runs{" "}
              <span className="font-semibold">gpt-4o</span> per bullet, then a
              structure pass. Changed lines show inline with yellow highlight
              and Keep / Undo.
            </p>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              disabled={initLoading || optimizePhase === "running"}
              onClick={onPrimaryButtonClick}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_var(--brand-glow)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background:
                  primaryShowsOptimized
                    ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                    : "linear-gradient(135deg, var(--brand), var(--brand-2))",
              }}
            >
              {optimizePhase === "running"
                ? "Optimizing…"
                : primaryShowsOptimized
                  ? "✓ Optimized — Recalculate Score"
                  : "✨ Optimize Resume"}
            </button>
            {optimizeProgress ? (
              <span className="text-xs text-[var(--text-muted)]">
                {optimizeProgress}
              </span>
            ) : null}
            {showUndoAll ? (
              <button
                type="button"
                onClick={undoAllOptimize}
                className="text-left text-sm font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
              >
                Undo all changes
              </button>
            ) : null}
          </div>

          {changeSummary && primaryShowsOptimized ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-violet-200/70 bg-[var(--bg-card)] shadow-sm">
              <button
                type="button"
                onClick={() => setChangeSummaryOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-violet-50/50"
                aria-expanded={changeSummaryOpen}
              >
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  ✨ What changed
                </span>
                <span className="shrink-0 text-xs font-semibold text-violet-700">
                  {changeSummaryOpen ? (
                    <>Hide <span aria-hidden>▼</span></>
                  ) : (
                    <>Show <span aria-hidden>▶</span></>
                  )}
                </span>
              </button>
              {changeSummaryOpen ? (
                <div className="border-t border-violet-200/50 px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      <span className="text-[var(--text-primary)]">
                        {optimizeBulletsRewrittenCount !== null
                          ? optimizeBulletsRewrittenCount
                          : changeSummary.bulletsRewritten}
                      </span>{" "}
                      bullet
                      {(optimizeBulletsRewrittenCount !== null
                        ? optimizeBulletsRewrittenCount
                        : changeSummary.bulletsRewritten) !== 1
                        ? "s"
                        : ""}{" "}
                      rewritten
                      — job-aligned language, soft skills surfaced, quantification added, verb duplicates resolved
                    </li>
                    {changeSummary.keywordsAdded.length > 0 ? (
                      <li>
                        <span className="text-[var(--text-primary)]">
                          {changeSummary.keywordsAdded.length}
                        </span>{" "}
                        keyword
                        {changeSummary.keywordsAdded.length !== 1 ? "s" : ""}{" "}
                        added:{" "}
                        <span className="font-medium text-violet-800">
                          {formatKeywordListForSummary(changeSummary.keywordsAdded)}
                        </span>
                      </li>
                    ) : null}
                    {changeSummary.sectionsAdded.length > 0 ? (
                      <li>
                        <span className="text-[var(--text-primary)]">
                          {changeSummary.sectionsAdded.length}
                        </span>{" "}
                        section
                        {changeSummary.sectionsAdded.length !== 1 ? "s" : ""}{" "}
                        added:{" "}
                        <span className="font-medium text-[var(--text-primary)]">
                          {changeSummary.sectionsAdded.join(", ")}
                        </span>
                      </li>
                    ) : null}
                    {changeSummary.biggestGap ? (
                      <li className="border-t border-violet-200/40 pt-2">
                        <span className="font-semibold text-amber-700">
                          Biggest remaining gap:
                        </span>{" "}
                        <span className="text-[var(--text-primary)]">
                          {changeSummary.biggestGap}
                        </span>
                        {" — consider addressing this in an interview or cover letter."}
                      </li>
                    ) : null}
                    {changeSummary.scoreAfter !== null ? (
                      <li>
                        {changeSummary.scoreAfter > changeSummary.scoreBefore
                          ? "Score improved: "
                          : "ATS score: "}
                        <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                          {changeSummary.scoreBefore}
                        </span>
                        {" → "}
                        <span
                          className={`font-semibold tabular-nums ${
                            changeSummary.scoreAfter > changeSummary.scoreBefore
                              ? "text-violet-700"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {changeSummary.scoreAfter}
                        </span>
                      </li>
                    ) : (
                      <li className="text-[var(--text-muted)]">
                        ATS score updated in the sidebar — tap Recalculate if
                        you want a fresh quality pass.
                      </li>
                    )}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {initLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading resume…</p>
          ) : null}
          {initError ? (
            <p className="mb-2 text-sm text-amber-600">{initError}</p>
          ) : null}

          <label className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Resume
          </label>
          <div className="re-resume-page-shell rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-5">
            {blocks.length === 0 && !initLoading ? (
              <p className="text-sm text-[var(--text-muted)]">No resume text.</p>
            ) : (
              <div
                className="re-resume-inline-doc mx-auto max-w-[210mm] space-y-0 font-serif"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {blocks.map((b) => {
                  if (b.kind === "plain") {
                    // Strip leading blank lines that the parser bundles with
                    // the first real content line (e.g. the blank line
                    // between EDUCATION and the university name).  Trailing
                    // blank lines are also dropped so the textarea height
                    // stays tight.
                    const joined = b.lines.join("\n").replace(/^(\s*\n)+/, "").trimEnd();
                    if (joined.trim() === "") return null;
                    const pendingBefore = blockPending[b.id];
                    const showChrome =
                      pendingBefore !== undefined &&
                      bulletTextChanged(pendingBefore, joined);
                    return (
                      <div
                        key={b.id}
                        className={`re-line-row rounded-r-lg ${
                          showChrome ? "re-line-ai-pending" : ""
                        }`}
                      >
                        <AutoResizeTextarea
                          value={joined}
                          onChange={(e) =>
                            updatePlainBlock(b.id, e.target.value)
                          }
                          disabled={initLoading || optimizePhase === "running"}
                          spellCheck
                          className="w-full resize-none border-0 bg-transparent py-0.5 text-[13px] leading-[1.65] text-[var(--text-primary)] outline-none ring-0 focus:ring-0 disabled:opacity-60"
                          aria-label="Resume section"
                        />
                        {showChrome ? (
                          <div className="re-line-actions flex justify-end gap-2 pb-1 pr-1">
                            <button
                              type="button"
                              onClick={() => keepBlock(b.id)}
                              className="rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-600"
                            >
                              ✓ Keep
                            </button>
                            <button
                              type="button"
                              onClick={() => undoBlock(b.id)}
                              className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
                            >
                              ↩ Undo
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  const bullet = b;
                  const joined = bulletJoined(bullet);
                  const aiTarget = shouldSendBulletToAi(bullet);
                  const pendingBefore = blockPending[bullet.id];
                  const showChrome =
                    aiTarget &&
                    pendingBefore !== undefined &&
                    bulletTextChanged(pendingBefore, joined);
                  return (
                    <div
                      key={bullet.id}
                      className={`re-line-row rounded-r-lg ${
                        showChrome ? "re-line-ai-pending" : ""
                      }`}
                    >
                      <AutoResizeTextarea
                        value={joined}
                        onChange={(e) =>
                          updateBulletBlock(bullet.id, e.target.value)
                        }
                        disabled={initLoading || optimizePhase === "running"}
                        spellCheck
                        className="w-full resize-none border-0 bg-transparent py-0.5 text-[13px] leading-[1.65] text-[var(--text-primary)] outline-none ring-0 focus:ring-0 disabled:opacity-60"
                        aria-label="Resume bullet"
                      />
                      {showChrome ? (
                        <div className="re-line-actions flex justify-end gap-2 pb-1 pr-1">
                          <button
                            type="button"
                            onClick={() => keepBlock(bullet.id)}
                            className="rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-600"
                          >
                            ✓ Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => undoBlock(bullet.id)}
                            className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
                          >
                            ↩ Undo
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className={CARD}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-[var(--text-primary)]">
                ATS Score
              </span>
              <button
                type="button"
                disabled={scoring}
                onClick={() => void recalculateScore()}
                className="text-[13px] font-semibold text-[var(--brand)] disabled:opacity-60"
              >
                {scoring ? "Scoring…" : "↻ Recalculate"}
              </button>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className="text-[48px] font-extrabold leading-none"
                style={{
                  fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
                  color: scoreHue(displayScore),
                }}
              >
                {displayScore}
              </span>
              <span className="text-xl text-[var(--text-muted)]">/100</span>
            </div>
            <p
              className="mt-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: status.color }}
            >
              {status.text}
            </p>
            {!hasRecalculatedOnce ? (
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                Keywords from saved analysis · Recalculate refreshes bullet
                quality (0–25)
              </p>
            ) : null}
            {scoreError ? (
              <p className="mt-2 text-xs text-red-600">{scoreError}</p>
            ) : null}

            <div className="mt-4">
              <div className="mb-1.5 flex select-none justify-between gap-0.5 text-[8px] font-bold uppercase leading-tight tracking-tight text-[var(--text-muted)] sm:text-[9px]">
                <span className="w-[55%] text-center">55 · Getting there</span>
                <span className="w-[10%] text-center">65 · Good</span>
                <span className="w-[10%] text-center">75 · Strong</span>
                <span className="w-[10%] text-right">85+</span>
              </div>
              <div
                className={`relative h-2.5 w-full overflow-visible rounded-full bg-[var(--bg-surface)] ${scoring ? "re-progress-track-shimmer" : ""}`}
              >
                {milestoneBarLabels().map(({ pct }) => (
                  <div
                    key={pct}
                    className="absolute top-0 z-[1] h-full w-px -translate-x-1/2 bg-[var(--border)]"
                    style={{ left: `${pct}%` }}
                    aria-hidden
                  />
                ))}
                <div
                  className={`relative z-[2] h-full overflow-hidden rounded-full ${scoring ? "resume-editor-progress-pulse" : ""}`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-[800ms] ease-out"
                    style={{
                      width: `${displayScore}%`,
                      background:
                        "linear-gradient(90deg, #fecdd3 0%, #fde68a 26%, #ddd6fe 52%, #bbf7d0 100%)",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[var(--text-secondary)]">
                Next milestone:{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {nextMilestone(displayScore).label}
                </span>{" "}
                ({nextMilestone(displayScore).min}+) —{" "}
                {nextMilestone(displayScore).unlock}.
              </p>
            </div>
          </div>

          <div className={CARD}>
            <h3 className="mb-2 text-[13px] font-bold text-[var(--text-primary)]">
              Keyword coverage
            </h3>
            {baselineAnalysis?.keywords?.length ? (
              <>
                <p className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                  <span className="text-[var(--text-muted)]">Before optimization:</span>{" "}
                  <span className="tabular-nums text-[var(--text-secondary)]">
                    {keywordStartCount ?? presentKw.length} keywords
                  </span>{" "}
                  <span className="text-[var(--text-muted)]" aria-hidden>
                    ➜
                  </span>{" "}
                  <span className="text-violet-600">Now:</span>{" "}
                  <span className="font-bold tabular-nums text-violet-700">
                    {presentKw.length} matched
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-red-600">
                  Still missing: {missingKw.length} (exact + job-tuned evidence
                  terms)
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {presentKw.slice(0, 14).map((k) => (
                    <span
                      key={`p-${k}`}
                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: "rgba(16,185,129,0.08)",
                        borderColor: "rgba(16,185,129,0.35)",
                        color: "#047857",
                      }}
                    >
                      {k}
                    </span>
                  ))}
                  {presentKw.length > 14 ? (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      +{presentKw.length - 14} more
                    </span>
                  ) : null}
                </div>
                {missingKw.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {missingKw.slice(0, 10).map((k) => (
                      <span
                        key={`m-${k}`}
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: "rgba(239,68,68,0.06)",
                          borderColor: "rgba(239,68,68,0.25)",
                          color: "#dc2626",
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] italic text-[var(--text-muted)]">
                Run analyze with a job to track keyword coverage.
              </p>
            )}
          </div>

          {/* Application assessment panel */}
          {(competitiveAssessment || competitiveLoading) ? (
            <div className={CARD}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                  Application Assessment
                </h3>
                {competitiveLoading ? (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Analyzing…
                  </span>
                ) : null}
              </div>
              {competitiveAssessment && !competitiveLoading ? (
                <>
                  <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {competitiveAssessment.assessment ||
                      (() => {
                        const m = competitiveAssessment.matchOn.slice(0, 2).join(" and ");
                        const g = competitiveAssessment.gaps.slice(0, 2).join(" and ");
                        return `Your application is competitive on ${m || "several key areas"}.${g ? ` To strengthen your chances further, consider addressing ${g} in your cover letter or interview.` : ""}`;
                      })()}
                  </p>
                  {competitiveAssessment.matchOn.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-violet-700">
                        Strengths:
                      </p>
                      <ul className="mt-0.5 space-y-0.5 pl-3">
                        {competitiveAssessment.matchOn.map((m) => (
                          <li
                            key={m}
                            className="text-[11px] text-[var(--text-secondary)] before:mr-1 before:content-['•'] before:text-violet-500"
                          >
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {competitiveAssessment.gaps.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold text-amber-700">
                        Areas to address:
                      </p>
                      <ul className="mt-0.5 space-y-0.5 pl-3">
                        {competitiveAssessment.gaps.map((g) => (
                          <li
                            key={g}
                            className="text-[11px] text-[var(--text-secondary)] before:mr-1 before:content-['•'] before:text-amber-500"
                          >
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {bottomBar}
    </div>
  );
}
