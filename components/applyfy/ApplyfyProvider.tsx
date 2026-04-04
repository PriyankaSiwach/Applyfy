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
import { readSubscriptionTier } from "@/lib/subscriptionTier";

type JobPasteFallbackState = { active: boolean; message: string };

type ApplyfyContextValue = {
  resume: string;
  setResume: (v: string) => void;
  jobLink: string;
  setJobLink: (v: string) => void;
  jobPosting: string;
  setJobPosting: (v: string) => void;
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
  setCoverLetterDraft: (v: string) => void;
  copyCoverLetter: () => Promise<void>;
  downloadCoverLetterTxt: () => void;
  copyPlainText: (text: string) => Promise<void>;
  copyFeedback: string | null;
  matchRescanDraft: string;
  setMatchRescanDraft: (v: string) => void;
  resetSession: () => void;
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
  const [resume, setResume] = useState("");
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
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysis = useMemo(() => baselineAnalysis, [baselineAnalysis]);

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
        const tier = readSubscriptionTier();
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
        if (
          readSubscriptionTier() === "free" &&
          getCoverGenCountThisMonth() === 0
        ) {
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
    [resume, jobPosting, jobLink],
  );

  useEffect(() => {
    if (!analysis) return;
    void postCoverLetter(coverTone, coverLength);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const regenerateCoverLetter = useCallback(async () => {
    if (readSubscriptionTier() === "free" && !canFreeRegenerateCoverLetter()) {
      setCoverLetterError(
        "You have used your free cover letter for this month. Upgrade to Pro for unlimited generations.",
      );
      return;
    }
    await postCoverLetter(coverTone, coverLength);
  }, [postCoverLetter, coverTone, coverLength]);

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
        return false;
      }
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "";
        if (res.status === 400 && msg) {
          setAnalyzeError(msg);
          return false;
        }
        if (res.status === 402 || res.status === 503 || res.status === 504) {
          setAnalyzeError(
            msg || "Service temporarily unavailable. Try again later.",
          );
          return false;
        }
        setJobPasteFallback({
          active: true,
          message: JOB_PASTE_FALLBACK_USER_MESSAGE,
        });
        setAnalyzeError(null);
        return false;
      }
      try {
        const { analysis: built, resolvedJobPosting } =
          buildAnalysisFromAnalyzeApi(data);
        if (resolvedJobPosting) {
          setJobPosting(resolvedJobPosting);
        }
        setBaselineAnalysis(built);
        const postingForHistory = resolvedJobPosting ?? jobPosting.trim();
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
        return false;
      }
    } catch {
      setJobPasteFallback({
        active: true,
        message: JOB_PASTE_FALLBACK_USER_MESSAGE,
      });
      setAnalyzeError(null);
      return false;
    } finally {
      setLoadingAnalyze(false);
    }
  }, [resume, jobLink, jobPosting]);

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

  const downloadCoverLetterTxt = useCallback(() => {
    if (!coverLetter) return;
    const blob = new Blob([coverLetter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cover-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [coverLetter]);

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

  const resetSession = useCallback(() => {
    setResume("");
    setJobLink("");
    setJobPosting("");
    setJobPasteFallback({ active: false, message: "" });
    setBaselineAnalysis(null);
    setAnalyzeError(null);
    setCoverLetter(null);
    setCoverLetterError(null);
    setMatchRescanDraft("");
  }, []);

  const value = useMemo(
    () => ({
      resume,
      setResume,
      jobLink,
      setJobLink,
      jobPosting,
      setJobPosting,
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
      setCoverLetterDraft,
      copyCoverLetter,
      downloadCoverLetterTxt,
      copyPlainText,
      copyFeedback,
      matchRescanDraft,
      setMatchRescanDraft,
      resetSession,
    }),
    [
      resume,
      jobLink,
      jobPosting,
      setJobPosting,
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
      setCoverLetterDraft,
      copyCoverLetter,
      downloadCoverLetterTxt,
      copyPlainText,
      copyFeedback,
      matchRescanDraft,
      setMatchRescanDraft,
      resetSession,
    ],
  );

  return (
    <ApplyfyContext.Provider value={value}>{children}</ApplyfyContext.Provider>
  );
}
