"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Analysis } from "@/lib/analysisTypes";
import { stableJobKey } from "@/lib/alignedJobKeywords";
import type { CoverLength, CoverTone } from "@/lib/parseCoverLetterTypes";
import {
  buildAnalysisFromAnalyzeApi,
  type AnalyzeApiResponse,
} from "@/lib/buildAnalysisFromAnalyzeApi";
import { clientResumeFingerprint } from "@/lib/clientResumeFingerprint";
import { JOB_PASTE_FALLBACK_USER_MESSAGE } from "@/lib/jobDescription";
import {
  canFreeRegenerateCoverLetter,
  getCoverGenCountThisMonth,
  incrementCoverGenCount,
} from "@/lib/coverGenQuota";
import { MIN_JOB_POSTING_CHARS } from "@/lib/parseAnalyzeBody";
import { appendAtsScore } from "@/lib/atsHistory";
import { purgeFabricatedResumeLines } from "@/lib/resumeFabricationPurge";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import {
  verifyKeywordsAgainstResume,
} from "@/lib/atsDeterministicKeywords";
import {
  filterAtsKeywordLabels,
  isUsableAtsKeywordLabel,
} from "@/lib/jobKeywordSanitize";

type JobPasteFallbackState = { active: boolean; message: string };

export type ResumeSourceOfTruth = "original" | "optimized";

export type HybridAtsPayload = {
  ats_score: number;
  present_keywords: string[];
  missing_keywords: string[];
  reasoning?: string;
  /** From hybrid API — used to recompute final score after code keyword verification. */
  quality_score_25?: number;
  keyword_score_75?: number;
  /** Resume text that was scored — used for code verification (context resume may lag setState). */
  resumePlainVerified?: string;
  /** @deprecated Unused; literal-only verification ignores synonym maps. */
  synonymMapVerified?: Record<string, string[]>;
  /** ATS keyword labels for this score (same order as API) — avoids stale ref before re-render. */
  keywordLabelsVerified?: string[];
};

type ApplyfyContextValue = {
  resume: string;
  setResume: (v: string) => void;
  jobLink: string;
  setJobLink: (v: string) => void;
  jobPosting: string;
  setJobPosting: (v: string) => void;
  /** Optional company name hint supplied by the user on the Input page. */
  jobCompanyHint: string;
  setJobCompanyHint: (v: string) => void;
  /** Optional job title/role hint supplied by the user on the Input page. */
  jobRoleHint: string;
  setJobRoleHint: (v: string) => void;
  jobPasteFallback: JobPasteFallbackState;
  loadingAnalyze: boolean;
  analyzeError: string | null;
  baselineAnalysis: Analysis | null;
  analysis: Analysis | null;
  runAnalyze: () => Promise<boolean>;
  loadingCoverLetter: boolean;
  coverLetter: string | null;
  coverLetterError: string | null;
  coverTone: CoverTone;
  setCoverTone: (t: CoverTone) => void;
  coverLength: CoverLength;
  setCoverLength: (l: CoverLength) => void;
  regenerateCoverLetter: () => Promise<void>;
  /** Regenerate with an explicit title + company override (used when extraction failed). */
  regenerateCoverLetterWithMeta: (title: string, company: string) => Promise<void>;
  setCoverLetterDraft: (v: string) => void;
  copyCoverLetter: () => Promise<void>;
  copyPlainText: (text: string) => Promise<void>;
  copyFeedback: string | null;
  matchRescanDraft: string;
  setMatchRescanDraft: (v: string) => void;
  resetSession: () => void;
  /** Clear analysis/scores/optimization for a new resume upload; keeps job link & posting. */
  invalidateAnalysisForNewResume: () => void;
  /** Parsed upload text only (purged). Immutable editor source of truth. */
  originalResumePlain: string;
  /** Re-parse resume payload to plain text and purge fabricated lines. Returns purged plain text. */
  hydrateOriginalResumePlain: (resumePayload: string) => Promise<string>;
  /** Keyword skill labels for this job session — set on first successful analyze; reused everywhere. */
  jobKeywordLabels: string[];
  /** Deprecated: literal-only matching; always null. */
  jobKeywordSynonymMap: Record<string, string[]> | null;
  resumeSourceOfTruth: ResumeSourceOfTruth;
  optimizationAppliedAt: number | null;
  markResumeOptimized: (opts: {
    resumePlainBefore: string;
    analysisSnapshot: Analysis | null;
  }) => void;
  undoResumeOptimization: () => void;
  /** True after Optimize until a successful analyze refreshes scores for the new resume. */
  reanalyzeAfterOptimizeNeeded: boolean;
  /** Hybrid ATS (deterministic keywords + model bullet quality). Single source for Analysis + Editor. */
  preOptimizationHybridAtsScore: number | null;
  committedHybridAtsScore: number | null;
  committedHybridPresent: string[];
  committedHybridMissing: string[];
  ingestHybridAtsScore: (
    payload: HybridAtsPayload,
    source: "baseline" | "recalc" | "optimize",
  ) => void;
};

const ApplyfyContext = createContext<ApplyfyContextValue | null>(null);

export function useApplyfy(): ApplyfyContextValue {
  const ctx = useContext(ApplyfyContext);
  if (!ctx) {
    throw new Error("useApplyfy must be used within ApplyfyProvider");
  }
  return ctx;
}

const PLACEHOLDER_JOB_LINK = "https://applyfy.local/pasted-job";

export function ApplyfyProvider({ children }: { children: React.ReactNode }) {
  const { tier } = useSubscription();
  const [resume, setResume] = useState("");
  const [originalResumePlain, setOriginalResumePlain] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [jobPosting, setJobPosting] = useState("");
  const [jobPasteFallback, setJobPasteFallback] = useState<JobPasteFallbackState>(
    { active: false, message: "" },
  );
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingCoverLetter, setLoadingCoverLetter] = useState(false);
  const [baselineAnalysis, setBaselineAnalysis] = useState<Analysis | null>(
    null,
  );
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(
    null,
  );
  const [coverTone, setCoverTone] = useState<CoverTone>("confident");
  const [coverLength, setCoverLength] = useState<CoverLength>("standard");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [matchRescanDraft, setMatchRescanDraft] = useState("");
  const [jobKeywordLabels, setJobKeywordLabels] = useState<string[]>([]);
  const jobKeywordJobKeyRef = useRef("");
  const [jobCompanyHint, _setJobCompanyHint] = useState("");
  const [jobRoleHint, _setJobRoleHint] = useState("");
  const jobCompanyHintRef = useRef("");
  const jobRoleHintRef = useRef("");
  const setJobCompanyHint = useCallback((v: string) => {
    jobCompanyHintRef.current = v;
    _setJobCompanyHint(v);
  }, []);
  const setJobRoleHint = useCallback((v: string) => {
    jobRoleHintRef.current = v;
    _setJobRoleHint(v);
  }, []);
  const [resumeSourceOfTruth, setResumeSourceOfTruth] =
    useState<ResumeSourceOfTruth>("original");
  const [optimizationAppliedAt, setOptimizationAppliedAt] = useState<
    number | null
  >(null);
  const [resumePlainBeforeOptimize, setResumePlainBeforeOptimize] = useState<
    string | null
  >(null);
  const [analysisBeforeOptimize, setAnalysisBeforeOptimize] =
    useState<Analysis | null>(null);
  const [reanalyzeAfterOptimizeNeeded, setReanalyzeAfterOptimizeNeeded] =
    useState(false);
  const reanalyzeAfterOptimizeNeededRef = useRef(false);
  const [preOptimizationHybridAtsScore, setPreOptimizationHybridAtsScore] =
    useState<number | null>(null);
  const [preOptimizationHybridPresent, setPreOptimizationHybridPresent] =
    useState<string[]>([]);
  const [preOptimizationHybridMissing, setPreOptimizationHybridMissing] =
    useState<string[]>([]);
  const [committedHybridAtsScore, setCommittedHybridAtsScore] = useState<
    number | null
  >(null);
  const [committedHybridPresent, setCommittedHybridPresent] = useState<
    string[]
  >([]);
  const [committedHybridMissing, setCommittedHybridMissing] = useState<
    string[]
  >([]);
  const hybridBaselineCapturedRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  const jobKeywordLabelsRef = useRef(jobKeywordLabels);
  jobKeywordLabelsRef.current = jobKeywordLabels;

  const analysis = useMemo(() => baselineAnalysis, [baselineAnalysis]);

  const ingestHybridAtsScore = useCallback(
    (payload: HybridAtsPayload, source: "baseline" | "recalc" | "optimize") => {
      const resumePlainForVerify =
        typeof payload.resumePlainVerified === "string" &&
        payload.resumePlainVerified.trim().length >= 10
          ? payload.resumePlainVerified.replace(/\r\n/g, "\n").trim()
          : resumeRef.current.replace(/\r\n/g, "\n").trim();

      const usableJob = jobKeywordLabelsRef.current.filter(isUsableAtsKeywordLabel);
      const fromPayload = filterAtsKeywordLabels(
        payload.keywordLabelsVerified ?? [],
      );
      const labels =
        fromPayload.length > 0
          ? fromPayload
          : usableJob.length > 0
            ? usableJob
            : filterAtsKeywordLabels([
                ...new Set([
                  ...payload.present_keywords,
                  ...payload.missing_keywords,
                ]),
              ]);

      const verified = verifyKeywordsAgainstResume(
        resumePlainForVerify,
        labels,
        null,
      );

      let quality25 =
        typeof payload.quality_score_25 === "number" &&
        Number.isFinite(payload.quality_score_25)
          ? Math.round(payload.quality_score_25)
          : Math.round(payload.ats_score - verified.score75);
      quality25 = Math.min(25, Math.max(0, quality25));

      const score = Math.min(
        100,
        Math.max(0, Math.round(verified.score75 + quality25)),
      );
      const present = verified.present;
      const missing = verified.missing;

      if (source === "baseline") {
        if (!hybridBaselineCapturedRef.current) {
          hybridBaselineCapturedRef.current = true;
          setPreOptimizationHybridAtsScore(score);
          setPreOptimizationHybridPresent(present);
          setPreOptimizationHybridMissing(missing);
          setCommittedHybridPresent(present);
          setCommittedHybridMissing(missing);
          setCommittedHybridAtsScore(score);
        }
        return;
      }
      if (source === "recalc") {
        if (resumeSourceOfTruth === "optimized") {
          // Floor = max(pre-optimization baseline, current committed score).
          // If baseline was never captured (user skipped Analyze), use the
          // current committed score so the display never drops unexpectedly.
          const recalcFloor = Math.max(
            preOptimizationHybridAtsScore ?? 0,
            committedHybridAtsScore ?? 0,
          );
          if (recalcFloor > 0 && score < recalcFloor) {
            // Keep the higher score; still update present/missing keywords
            setCommittedHybridAtsScore(recalcFloor);
            setCommittedHybridPresent(present);
            setCommittedHybridMissing(missing);
          } else {
            setCommittedHybridPresent(present);
            setCommittedHybridMissing(missing);
            setCommittedHybridAtsScore(score);
          }
        } else {
          setCommittedHybridPresent(present);
          setCommittedHybridMissing(missing);
          setCommittedHybridAtsScore(score);
        }
        return;
      }
      // "optimize" source — committed score must never drop below whatever
      // was displayed before the optimization ran.
      setCommittedHybridPresent(present);
      setCommittedHybridMissing(missing);
      const floor = Math.max(
        preOptimizationHybridAtsScore ?? 0,
        committedHybridAtsScore ?? 0,
      );
      setCommittedHybridAtsScore(floor > 0 ? Math.max(score, floor) : score);
    },
    [
      preOptimizationHybridAtsScore,
      preOptimizationHybridPresent,
      preOptimizationHybridMissing,
      resumeSourceOfTruth,
      committedHybridAtsScore,
    ],
  );

  const markResumeOptimized = useCallback(
    (opts: {
      resumePlainBefore: string;
      analysisSnapshot: Analysis | null;
    }) => {
      setResumePlainBeforeOptimize(opts.resumePlainBefore);
      setAnalysisBeforeOptimize(opts.analysisSnapshot);
      setResumeSourceOfTruth("optimized");
      setOptimizationAppliedAt(Date.now());
      setReanalyzeAfterOptimizeNeeded(true);
      reanalyzeAfterOptimizeNeededRef.current = true;
    },
    [],
  );

  const undoResumeOptimization = useCallback(() => {
    if (!resumePlainBeforeOptimize) return;
    setResume(resumePlainBeforeOptimize);
    if (analysisBeforeOptimize) {
      setBaselineAnalysis(analysisBeforeOptimize);
    }
    setResumePlainBeforeOptimize(null);
    setAnalysisBeforeOptimize(null);
    setResumeSourceOfTruth("original");
    setOptimizationAppliedAt(null);
    setReanalyzeAfterOptimizeNeeded(false);
    reanalyzeAfterOptimizeNeededRef.current = false;
    if (preOptimizationHybridAtsScore !== null) {
      setCommittedHybridAtsScore(preOptimizationHybridAtsScore);
      setCommittedHybridPresent([...preOptimizationHybridPresent]);
      setCommittedHybridMissing([...preOptimizationHybridMissing]);
    }
  }, [
    resumePlainBeforeOptimize,
    analysisBeforeOptimize,
    preOptimizationHybridAtsScore,
    preOptimizationHybridPresent,
    preOptimizationHybridMissing,
  ]);

  const hydrateOriginalResumePlain = useCallback(
    async (resumePayload: string): Promise<string> => {
      const trimmed = resumePayload.trim();
      if (!trimmed) {
        setOriginalResumePlain("");
        return "";
      }
      try {
        const res = await fetch("/api/resume-plain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume: trimmed }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) {
          setOriginalResumePlain("");
          return "";
        }
        const raw = (data.text ?? "").trim();
        const purged = purgeFabricatedResumeLines(raw, raw);
        setOriginalResumePlain(purged);
        return purged;
      } catch {
        setOriginalResumePlain("");
        return "";
      }
    },
    [],
  );

  const showCopiedToast = useCallback(() => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyFeedback("Copied!");
    copyTimerRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const postCoverLetter = useCallback(
    async (tone: CoverTone, length: CoverLength) => {
      setLoadingCoverLetter(true);
      setCoverLetterError(null);
      try {
        const effectiveTone: CoverTone =
          tier === "free" ? "confident" : tone;
        const effectiveLength: CoverLength =
          tier === "free" ? "standard" : length;
        const res = await fetch("/api/cover-letter", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume,
            jobPosting,
            jobLink: jobLink.trim() || PLACEHOLDER_JOB_LINK,
            tone: effectiveTone,
            length: effectiveLength,
            requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            jobTitle: jobRoleHintRef.current,
            jobCompany: jobCompanyHintRef.current,
          }),
        });
        const raw = await res.text();
        let data: { letter?: string; error?: string };
        try {
          data = JSON.parse(raw) as { letter?: string; error?: string };
        } catch {
          throw new Error(
            raw.trimStart().startsWith("<!DOCTYPE") || raw.includes("<html")
              ? "Server returned an error page instead of data."
              : raw.slice(0, 200) || res.statusText,
          );
        }
        if (!res.ok) {
          throw new Error(data.error ?? res.statusText);
        }
        if (!data.letter || !data.letter.trim()) {
          throw new Error("Cover letter response was empty.");
        }
        setCoverLetter(data.letter.trim());
        if (tier === "free" && getCoverGenCountThisMonth() === 0) {
          incrementCoverGenCount();
        }
      } catch (err) {
        setCoverLetterError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setLoadingCoverLetter(false);
      }
    },
    [resume, jobPosting, jobLink, tier],
  );

  useEffect(() => {
    if (!analysis) return;
    void postCoverLetter(coverTone, coverLength);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  useEffect(() => {
    reanalyzeAfterOptimizeNeededRef.current = reanalyzeAfterOptimizeNeeded;
  }, [reanalyzeAfterOptimizeNeeded]);

  const regenerateCoverLetter = useCallback(async () => {
    if (tier === "free" && !canFreeRegenerateCoverLetter()) {
      setCoverLetterError(
        "You have used your free cover letter for this month. Upgrade to Pro for unlimited generations.",
      );
      return;
    }
    await postCoverLetter(coverTone, coverLength);
  }, [postCoverLetter, coverTone, coverLength, tier]);

  const regenerateCoverLetterWithMeta = useCallback(
    async (title: string, company: string) => {
      // Update refs immediately so postCoverLetter picks them up without stale-closure issues
      jobRoleHintRef.current = title;
      jobCompanyHintRef.current = company;
      _setJobRoleHint(title);
      _setJobCompanyHint(company);
      await postCoverLetter(coverTone, coverLength);
    },
    [postCoverLetter, coverTone, coverLength],
  );

  const setCoverLetterDraft = useCallback((v: string) => {
    setCoverLetter(v);
  }, []);

  const runAnalyze = useCallback(async (): Promise<boolean> => {
    setLoadingAnalyze(true);
    setAnalyzeError(null);
    setCoverLetter(null);
    setCoverLetterError(null);
    setJobPasteFallback({ active: false, message: "" });
    setMatchRescanDraft("");
    try {
      if (process.env.NODE_ENV === "development") {
        const fp = clientResumeFingerprint(resume.trim());
        console.debug("[Applyfy] runAnalyze payload", {
          ...fp,
          isDataUrl: resume.trim().toLowerCase().startsWith("data:"),
        });
      }
      const primary = jobLink.trim();
      const secondary = jobPosting.trim();
      const isHttp = /^https?:\/\//i.test(primary);
      const payload: Record<string, unknown> = {
        resume,
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      if (secondary.length >= MIN_JOB_POSTING_CHARS) {
        payload.jobPosting = secondary;
        if (isHttp) payload.jobLink = primary;
      } else if (isHttp) {
        payload.jobLink = primary;
      } else if (primary.length >= MIN_JOB_POSTING_CHARS) {
        payload.jobPosting = primary;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.text();
      let data: AnalyzeApiResponse;
      try {
        data = JSON.parse(raw) as AnalyzeApiResponse;
      } catch {
        setJobPasteFallback({
          active: true,
          message: JOB_PASTE_FALLBACK_USER_MESSAGE,
        });
        setAnalyzeError(null);
        setReanalyzeAfterOptimizeNeeded(false);
        return false;
      }
      if (data.jobTextPasteRequired === true) {
        setJobPasteFallback({
          active: true,
          message:
            data.jobTextPasteMessage ?? JOB_PASTE_FALLBACK_USER_MESSAGE,
        });
        setBaselineAnalysis(null);
        setAnalyzeError(null);
        setReanalyzeAfterOptimizeNeeded(false);
        return false;
      }
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "";
        const code =
          typeof (data as { code?: unknown }).code === "string"
            ? (data as { code: string }).code
            : undefined;
        // For all non-2xx responses, always show the error message inline.
        // Only use the paste-fallback for 400 errors without a message (bad
        // request where we can't tell the user anything more specific).
        if (msg) {
          setAnalyzeError(
            res.status === 402 && code === "FREE_SCAN_LIMIT"
              ? `${msg} Upgrade from Pricing whenever you're ready.`
              : msg,
          );
          setReanalyzeAfterOptimizeNeeded(false);
          return false;
        }
        // Generic fallback only when the server returned no usable message.
        setAnalyzeError(
          "Analysis didn't complete. Check your connection and try again.",
        );
        setReanalyzeAfterOptimizeNeeded(false);
        return false;
      }
      try {
        const resumePlain = await hydrateOriginalResumePlain(resume);
        const { analysis: built, resolvedJobPosting } =
          buildAnalysisFromAnalyzeApi(data, {
            resumePlainForLiteralKeywords:
              resumePlain.trim().length >= 10 ? resumePlain : undefined,
          });
        if (resolvedJobPosting) {
          setJobPosting(resolvedJobPosting);
        }
        setBaselineAnalysis(built);
        const postingForHistory = resolvedJobPosting ?? jobPosting.trim();
        const jk = stableJobKey(postingForHistory, primary);
        if (jobKeywordJobKeyRef.current !== jk) {
          jobKeywordJobKeyRef.current = jk;
          setJobKeywordLabels(
            built.keywords.map((k) => k.skill.trim()).filter(Boolean),
          );
          hybridBaselineCapturedRef.current = false;
          setPreOptimizationHybridAtsScore(null);
          setPreOptimizationHybridPresent([]);
          setPreOptimizationHybridMissing([]);
          setCommittedHybridAtsScore(null);
          setCommittedHybridPresent([]);
          setCommittedHybridMissing([]);
        }

        const hybridKw = built.keywords
          .map((k) => k.skill.trim())
          .filter(isUsableAtsKeywordLabel);

        const shouldPostOptimizeHybrid = reanalyzeAfterOptimizeNeededRef.current;
        setReanalyzeAfterOptimizeNeeded(false);
        reanalyzeAfterOptimizeNeededRef.current = false;

        if (
          !hybridBaselineCapturedRef.current &&
          resumePlain.trim().length >= 10 &&
          hybridKw.length > 0
        ) {
          try {
            const hybridRes = await fetch("/api/resume-editor-score", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({
                resumeText: resumePlain.trim(),
                jobPosting: postingForHistory,
                atsKeywords: hybridKw,
              }),
            });
            const hybridRaw = await hybridRes.text();
            const hybridData = JSON.parse(hybridRaw) as {
              result?: HybridAtsPayload;
            };
            if (hybridRes.ok && hybridData.result) {
              ingestHybridAtsScore(
                {
                  ...hybridData.result,
                  resumePlainVerified: resumePlain.trim(),
                  keywordLabelsVerified: hybridKw,
                },
                "baseline",
              );
            }
          } catch {
            /* ignore */
          }
        }

        if (shouldPostOptimizeHybrid && resume.trim().length >= 10) {
          const resumeForHybrid = resume.trim();
          void (async () => {
            try {
              const res = await fetch("/api/resume-editor-score", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                  resumeText: resumeForHybrid,
                  jobPosting: postingForHistory,
                  atsKeywords: hybridKw,
                }),
              });
              const raw = await res.text();
              const data = JSON.parse(raw) as {
                result?: HybridAtsPayload;
              };
              if (res.ok && data.result) {
                ingestHybridAtsScore(
                  {
                    ...data.result,
                    resumePlainVerified: resumeForHybrid,
                    keywordLabelsVerified: hybridKw,
                  },
                  "optimize",
                );
              }
            } catch {
              /* ignore */
            }
          })();
        }
        appendAtsScore(built.atsScore, {
          jobPosting: postingForHistory,
          jobLink: primary,
        });
        return true;
      } catch (buildErr) {
        const d = data as Record<string, unknown>;
        console.error("[Applyfy] buildAnalysisFromAnalyzeApi failed", {
          err:
            buildErr instanceof Error ? buildErr.message : String(buildErr),
          resStatus: res.status,
          topKeys: Object.keys(d).sort(),
          nKeywords: Array.isArray(d.keywords) ? d.keywords.length : null,
          nRewrites: Array.isArray(d.rewrites) ? d.rewrites.length : null,
          nGaps: Array.isArray(d.gaps) ? d.gaps.length : null,
          nStrengths: Array.isArray(d.matchedStrengths)
            ? d.matchedStrengths.length
            : null,
          nQuickWins: Array.isArray(d.quickWins) ? d.quickWins.length : null,
        });
        setAnalyzeError(
          "We couldn't finish analysis. Try again or paste the job description.",
        );
        setReanalyzeAfterOptimizeNeeded(false);
        return false;
      }
    } catch {
      setJobPasteFallback({
        active: true,
        message: JOB_PASTE_FALLBACK_USER_MESSAGE,
      });
      setAnalyzeError(null);
      setReanalyzeAfterOptimizeNeeded(false);
      return false;
    } finally {
      setLoadingAnalyze(false);
    }
  }, [resume, jobLink, jobPosting, hydrateOriginalResumePlain, ingestHybridAtsScore]);

  const copyCoverLetter = useCallback(async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      showCopiedToast();
    } catch {
      setCopyFeedback("Copy failed");
      copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [coverLetter, showCopiedToast]);

  const copyPlainText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showCopiedToast();
      } catch {
        setCopyFeedback("Copy failed");
        copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
      }
    },
    [showCopiedToast],
  );

  const invalidateAnalysisForNewResume = useCallback(() => {
    setBaselineAnalysis(null);
    setAnalyzeError(null);
    setCoverLetter(null);
    setCoverLetterError(null);
    setMatchRescanDraft("");
    setJobKeywordLabels([]);
    jobKeywordJobKeyRef.current = "";
    setResumeSourceOfTruth("original");
    setOptimizationAppliedAt(null);
    setResumePlainBeforeOptimize(null);
    setAnalysisBeforeOptimize(null);
    setReanalyzeAfterOptimizeNeeded(false);
    reanalyzeAfterOptimizeNeededRef.current = false;
    hybridBaselineCapturedRef.current = false;
    setPreOptimizationHybridAtsScore(null);
    setPreOptimizationHybridPresent([]);
    setPreOptimizationHybridMissing([]);
    setCommittedHybridAtsScore(null);
    setCommittedHybridPresent([]);
    setCommittedHybridMissing([]);
  }, []);

  const resetSession = useCallback(() => {
    setResume("");
    setOriginalResumePlain("");
    setJobLink("");
    setJobPosting("");
    setJobPasteFallback({ active: false, message: "" });
    jobCompanyHintRef.current = "";
    jobRoleHintRef.current = "";
    _setJobCompanyHint("");
    _setJobRoleHint("");
    invalidateAnalysisForNewResume();
  }, [invalidateAnalysisForNewResume]);

  const value = useMemo(
    () => ({
      resume,
      setResume,
      jobLink,
      setJobLink,
      jobPosting,
      setJobPosting,
      jobCompanyHint,
      setJobCompanyHint,
      jobRoleHint,
      setJobRoleHint,
      jobPasteFallback,
      loadingAnalyze,
      analyzeError,
      baselineAnalysis,
      analysis,
      runAnalyze,
      loadingCoverLetter,
      coverLetter,
      coverLetterError,
      coverTone,
      setCoverTone,
      coverLength,
      setCoverLength,
      regenerateCoverLetter,
      regenerateCoverLetterWithMeta,
      setCoverLetterDraft,
      copyCoverLetter,
      copyPlainText,
      copyFeedback,
      matchRescanDraft,
      setMatchRescanDraft,
      resetSession,
      invalidateAnalysisForNewResume,
      originalResumePlain,
      hydrateOriginalResumePlain,
      jobKeywordLabels,
      jobKeywordSynonymMap: null,
      resumeSourceOfTruth,
      optimizationAppliedAt,
      markResumeOptimized,
      undoResumeOptimization,
      reanalyzeAfterOptimizeNeeded,
      preOptimizationHybridAtsScore,
      committedHybridAtsScore,
      committedHybridPresent,
      committedHybridMissing,
      ingestHybridAtsScore,
    }),
    [
      resume,
      jobLink,
      jobPosting,
      setJobPosting,
      jobCompanyHint,
      setJobCompanyHint,
      jobRoleHint,
      setJobRoleHint,
      jobPasteFallback,
      loadingAnalyze,
      analyzeError,
      baselineAnalysis,
      analysis,
      runAnalyze,
      loadingCoverLetter,
      coverLetter,
      coverLetterError,
      coverTone,
      coverLength,
      regenerateCoverLetter,
      regenerateCoverLetterWithMeta,
      setCoverLetterDraft,
      copyCoverLetter,
      copyPlainText,
      copyFeedback,
      matchRescanDraft,
      setMatchRescanDraft,
      resetSession,
      invalidateAnalysisForNewResume,
      originalResumePlain,
      hydrateOriginalResumePlain,
      jobKeywordLabels,
      resumeSourceOfTruth,
      optimizationAppliedAt,
      markResumeOptimized,
      undoResumeOptimization,
      reanalyzeAfterOptimizeNeeded,
      preOptimizationHybridAtsScore,
      committedHybridAtsScore,
      committedHybridPresent,
      committedHybridMissing,
      ingestHybridAtsScore,
    ],
  );

  return (
    <ApplyfyContext.Provider value={value}>{children}</ApplyfyContext.Provider>
  );
}
