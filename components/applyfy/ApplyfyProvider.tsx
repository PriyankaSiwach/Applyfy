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
import { parseInterviewPrepFromApi } from "@/lib/analysisTypes";
import type { CoverLength, CoverTone } from "@/lib/parseCoverLetterTypes";

type ApplyfyContextValue = {
  resume: string;
  setResume: (v: string) => void;
  jobLink: string;
  setJobLink: (v: string) => void;
  /** Fetched job text after analysis (used for cover letter API). */
  jobPosting: string;
  loadingAnalyze: boolean;
  analyzeError: string | null;
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
  /** Editable resume text used for match rescan (plain text). Cleared when uploading binary resume. */
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
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingCoverLetter, setLoadingCoverLetter] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
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
        const res = await fetch("/api/cover-letter", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume,
            jobPosting,
            jobLink: jobLink.trim() || PLACEHOLDER_JOB_LINK,
            tone,
            length,
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
      } catch (err) {
        setCoverLetterError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setLoadingCoverLetter(false);
      }
    },
    [resume, jobPosting, jobLink, analysis],
  );

  useEffect(() => {
    if (!analysis) return;
    void postCoverLetter(coverTone, coverLength);
    // Only refetch cover letter when a new analysis result exists (not when tone/length alone changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  const regenerateCoverLetter = useCallback(async () => {
    await postCoverLetter(coverTone, coverLength);
  }, [postCoverLetter, coverTone, coverLength]);

  const setCoverLetterDraft = useCallback((v: string) => {
    setCoverLetter(v);
  }, []);

  const runAnalyze = useCallback(async (): Promise<boolean> => {
    setLoadingAnalyze(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setCoverLetter(null);
    setCoverLetterError(null);
    setJobPosting("");
    setMatchRescanDraft("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jobLink: jobLink.trim(),
          requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      });
      const raw = await res.text();
      type AnalyzeApiResponse = Analysis & {
        error?: string;
        resolvedJobPosting?: string;
      };
      let data: AnalyzeApiResponse;
      try {
        data = JSON.parse(raw) as AnalyzeApiResponse;
      } catch {
        throw new Error(
          raw.trimStart().startsWith("<!DOCTYPE") || raw.includes("<html")
            ? "Server returned an error page instead of data. Check the terminal for details and try again."
            : raw.slice(0, 200) || res.statusText,
        );
      }
      if (!res.ok) {
        throw new Error(data.error ?? res.statusText);
      }
      if (
        typeof data.matchScore !== "number" ||
        !Number.isFinite(data.matchScore)
      ) {
        throw new Error("Analysis response missing match score.");
      }
      if (!Array.isArray(data.matchExplanation) || data.matchExplanation.length < 3) {
        throw new Error("Analysis response missing detailed match insights.");
      }
      if (typeof data.resolvedJobPosting === "string" && data.resolvedJobPosting) {
        setJobPosting(data.resolvedJobPosting);
      }
      const interviewPrep = parseInterviewPrepFromApi(data.interviewPrep);
      if (!interviewPrep.introPitch.trim()) {
        throw new Error("Analysis response missing interview intro pitch.");
      }
      if (interviewPrep.predictedQuestions.length < 5) {
        throw new Error("Analysis response missing interview questions.");
      }

      setAnalysis({
        matchScore: data.matchScore,
        matchExplanation: data.matchExplanation ?? [],
        matchedSkills: data.matchedSkills ?? [],
        missingSkills: data.missingSkills ?? [],
        bulletSuggestions: data.bulletSuggestions ?? [],
        sectionSuggestions: data.sectionSuggestions ?? [],
        atsKeywords: data.atsKeywords ?? [],
        atsMatched: data.atsMatched ?? [],
        requirementChecks: data.requirementChecks ?? [],
        interviewPrep,
      });
      return true;
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      return false;
    } finally {
      setLoadingAnalyze(false);
    }
  }, [resume, jobLink]);

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
    setAnalysis(null);
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
      loadingAnalyze,
      analyzeError,
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
      loadingAnalyze,
      analyzeError,
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
      resetSession,
    ],
  );

  return (
    <ApplyfyContext.Provider value={value}>{children}</ApplyfyContext.Provider>
  );
}
