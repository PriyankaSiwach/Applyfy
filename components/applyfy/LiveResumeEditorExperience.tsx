"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import {
  findAndReplaceInResumeEditor,
  highlightRewriteInEditor,
  scheduleRemoveJustAppliedClass,
} from "@/lib/resumeEditorRewriteMatch";
import { appendSentenceToResume } from "@/lib/resumeEditorTextOps";

const LS_RESUME = "resumeText";
const LS_JOB = "jobPosting";
const LS_ATS_SCORE = "atsScore";

const CARD =
  "mb-[14px] rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainToEditorHtml(plain: string): string {
  return escapeHtml(plain.replace(/\r\n/g, "\n")).replace(/\n/g, "<br>");
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function scoreHue(score: number): string {
  if (score < 40) return "#ef4444";
  if (score < 60) return "#f59e0b";
  if (score < 75) return "#3b7eff";
  return "#10b981";
}

function scoreStatusLabel(score: number): { text: string; color: string } {
  if (score < 40) return { text: "Needs work", color: "#ef4444" };
  if (score < 60) return { text: "Getting there", color: "#f59e0b" };
  if (score < 75) return { text: "Looking good", color: "#3b7eff" };
  if (score < 90) return { text: "Strong match", color: "#10b981" };
  return { text: "Excellent match", color: "#10b981" };
}

function scoreMotivationLine(score: number): string {
  if (score < 40) return "Apply the rewrites below to boost your score";
  if (score < 60)
    return "You're close — a few fixes will make a big difference";
  if (score < 75) return "Good match. Clean up the remaining keywords";
  return "You're ready to apply with confidence";
}

type ScoreResult = {
  ats_score: number;
  present_keywords: string[];
  missing_keywords: string[];
  reasoning: string;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LiveResumeEditorExperience({
  variant = "page",
  onEmbeddedContinue,
  onEmbeddedBack,
}: {
  variant?: "page" | "embedded";
  onEmbeddedContinue?: () => void;
  onEmbeddedBack?: () => void;
}) {
  const { resume, setResume, jobPosting, baselineAnalysis } = useApplyfy();

  const editorRef = useRef<HTMLDivElement>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deltaHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countAnimRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const steadyHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recalculateScoreRef = useRef<() => Promise<void>>(async () => {});
  const appliedSetRef = useRef<Set<number>>(new Set());
  const displayScoreRef = useRef(0);
  const hoverCleanupRef = useRef<(() => void) | null>(null);
  const suggestionCacheRef = useRef<Map<string, string[]>>(new Map());

  const resumeSnapRef = useRef(resume);

  const [loadingResume, setLoadingResume] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayScore, setDisplayScore] = useState(0);
  const [presentKw, setPresentKw] = useState<string[]>([]);
  const [missingKw, setMissingKw] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [hasRecalculatedOnce, setHasRecalculatedOnce] = useState(false);

  const [scoring, setScoring] = useState(false);
  const [scoringNote, setScoringNote] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [deltaLabel, setDeltaLabel] = useState<string | null>(null);

  const [appliedCards, setAppliedCards] = useState<Set<number>>(
    () => new Set(),
  );
  const [checkAnimKey, setCheckAnimKey] = useState(0);
  const cardBackupsRef = useRef<Map<number, string>>(new Map());

  const [applyAllState, setApplyAllState] = useState<
    "idle" | "loading" | "done"
  >("idle");
  const applyAllRunningRef = useRef(false);
  const bulkScoreBeforeRef = useRef<number | null>(null);
  const pendingBulkRecalcRef = useRef(false);

  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(
    null,
  );
  const [steadyBanner, setSteadyBanner] = useState<string | null>(null);
  const [scoreGlowPulse, setScoreGlowPulse] = useState(false);

  const [kwTooltip, setKwTooltip] = useState<{
    keyword: string;
    left: number;
    top: number;
  } | null>(null);
  const [kwSuggestionsLoading, setKwSuggestionsLoading] = useState(false);
  const [kwSuggestions, setKwSuggestions] = useState<string[]>([]);
  const kwTooltipRef = useRef<HTMLDivElement>(null);

  const [strengthAnimate, setStrengthAnimate] = useState(false);

  const rewrites = baselineAnalysis?.rewrites ?? [];

  resumeSnapRef.current = resume;
  displayScoreRef.current = displayScore;
  appliedSetRef.current = appliedCards;

  useEffect(() => {
    if (!baselineAnalysis) return;
    const score = clampScore(Math.round(baselineAnalysis.atsScore));
    try {
      localStorage.setItem(LS_ATS_SCORE, String(score));
    } catch {
      /* ignore */
    }
    setDisplayScore(score);
    setHasRecalculatedOnce(false);
    setPresentKw([]);
    setMissingKw(
      baselineAnalysis.keywords
        .filter((k) => !k.found)
        .map((k) => k.skill),
    );
    setReasoning(
      baselineAnalysis.matchExplanation?.[0]?.trim() ||
        "Recalculate to refresh your ATS score against the current resume text.",
    );
    setApplyAllState("idle");
    setAppliedCards(new Set());
    cardBackupsRef.current = new Map();
  }, [baselineAnalysis]);

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
    let cancelled = false;
    async function init() {
      setLoadingResume(true);
      setLoadError(null);
      try {
        const stored = localStorage.getItem(LS_RESUME);
        if (stored !== null && stored.trim().length > 0) {
          if (!cancelled && editorRef.current) {
            editorRef.current.innerHTML = plainToEditorHtml(stored);
            setResume(stored);
          }
          if (!cancelled) setLoadingResume(false);
          return;
        }

        const r = resumeSnapRef.current.trim();
        if (!r) {
          if (!cancelled) setLoadingResume(false);
          return;
        }

        if (!r.toLowerCase().startsWith("data:")) {
          if (!cancelled && editorRef.current) {
            editorRef.current.innerHTML = plainToEditorHtml(
              r.replace(/\r\n/g, "\n"),
            );
          }
          if (!cancelled) setLoadingResume(false);
          return;
        }

        const res = await fetch("/api/resume-plain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume: r }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Could not load resume text.");
        }
        const text = (data.text ?? "").trim();
        if (!cancelled && editorRef.current) {
          editorRef.current.innerHTML = text
            ? plainToEditorHtml(text)
            : "";
          if (text) {
            try {
              localStorage.setItem(LS_RESUME, text);
            } catch {
              /* ignore */
            }
            setResume(text);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Could not load resume.",
          );
        }
      } finally {
        if (!cancelled) setLoadingResume(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [setResume]);

  useEffect(() => {
    if (loadingResume) return;
    const el = editorRef.current;
    if (!el || el.innerText.trim().length > 0) return;
    const stored = localStorage.getItem(LS_RESUME);
    if (stored !== null && stored.trim().length > 0) return;
    const r = resume.trim();
    if (!r || r.toLowerCase().startsWith("data:")) return;
    el.innerHTML = plainToEditorHtml(r.replace(/\r\n/g, "\n"));
  }, [resume, loadingResume]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setStrengthAnimate(true));
    return () => cancelAnimationFrame(t);
  }, [baselineAnalysis?.atsScore, hasRecalculatedOnce, presentKw.length]);

  useEffect(() => {
    if (!kwTooltip) return;
    const close = (e: MouseEvent) => {
      if (kwTooltipRef.current?.contains(e.target as Node)) return;
      setKwTooltip(null);
      setKwSuggestions([]);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [kwTooltip]);

  const persistEditorToStorage = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const plain = el.innerText.replace(/\r\n/g, "\n");
    try {
      localStorage.setItem(LS_RESUME, plain);
    } catch {
      /* ignore */
    }
    setResume(plain);
  }, [setResume]);

  const onEditorInput = useCallback(() => {
    if (hoverCleanupRef.current) {
      hoverCleanupRef.current();
      hoverCleanupRef.current = null;
    }
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistEditorToStorage();
    }, 400);
  }, [persistEditorToStorage]);

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

  const recalculateScore = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || scoring) {
      // #region agent log
      fetch("http://127.0.0.1:7677/ingest/8db16057-cb80-4431-9287-3e6d24985fec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "67af35",
        },
        body: JSON.stringify({
          sessionId: "67af35",
          hypothesisId: "H5",
          location: "LiveResumeEditorExperience.tsx:recalculateScore",
          message: "recalc early return",
          data: { hasEditor: !!editor, scoring },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }

    const resumeText = editor.innerText.replace(/\r\n/g, "\n").trim();
    const job =
      jobPosting.trim() ||
      (typeof window !== "undefined"
        ? localStorage.getItem(LS_JOB)?.trim() ?? ""
        : "");

    if (resumeText.length < 10) {
      setScoreError("Add resume text before scoring.");
      return;
    }
    if (job.length < 40) {
      setScoreError("Job posting is missing. Go back to Analyze.");
      return;
    }

    setScoring(true);
    setScoreError(null);
    if (pendingBulkRecalcRef.current) {
      setScoringNote("Recalculating with improvements...");
    } else {
      setScoringNote(null);
    }
    const prev = displayScore;

    try {
      const res = await fetch("/api/resume-editor-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          resumeText,
          jobPosting: job,
          previousScore: prev,
        }),
      });

      const raw = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        console.error("[resume-editor] score response not JSON", raw.slice(0, 400));
        throw new Error("Invalid response");
      }

      console.log("[resume-editor] score API full response", {
        status: res.status,
        body: data,
      });

      const o = data as { result?: ScoreResult; error?: string };
      if (!res.ok || !o.result) {
        // #region agent log
        fetch("http://127.0.0.1:7677/ingest/8db16057-cb80-4431-9287-3e6d24985fec", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "67af35",
          },
          body: JSON.stringify({
            sessionId: "67af35",
            hypothesisId: "H4",
            location: "LiveResumeEditorExperience.tsx:recalculateScore",
            message: "score API not ok",
            data: {
              status: res.status,
              errSnippet: (o.error ?? "").slice(0, 120),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        throw new Error(o.error ?? "Score update failed.");
      }

      const r = o.result;
      const d = r.ats_score - prev;
      if (d !== 0) {
        setDeltaLabel(
          d > 0 ? `+${d} from last score` : `${d} from last score`,
        );
        if (deltaHideRef.current) clearTimeout(deltaHideRef.current);
        deltaHideRef.current = setTimeout(() => {
          setDeltaLabel(null);
          deltaHideRef.current = null;
        }, 5000);
      } else {
        setDeltaLabel(null);
      }

      animateScoreTo(r.ats_score, prev);
      setPresentKw(r.present_keywords);
      setMissingKw(r.missing_keywords);
      setReasoning(r.reasoning || "");
      setHasRecalculatedOnce(true);
      try {
        localStorage.setItem(LS_ATS_SCORE, String(r.ats_score));
      } catch {
        /* ignore */
      }
      persistEditorToStorage();

      if (pendingBulkRecalcRef.current && bulkScoreBeforeRef.current !== null) {
        const before = bulkScoreBeforeRef.current;
        if (r.ats_score > before) {
          setScoreGlowPulse(true);
          setTimeout(() => setScoreGlowPulse(false), 700);
          setCelebrationBanner(
            `🎉 Your score improved by +${r.ats_score - before} points!`,
          );
          if (celebrationHideRef.current) clearTimeout(celebrationHideRef.current);
          celebrationHideRef.current = setTimeout(() => {
            setCelebrationBanner(null);
            celebrationHideRef.current = null;
          }, 4000);
        } else {
          setSteadyBanner(
            "Score held steady. Your resume is now better worded — recalculate again after adding keywords.",
          );
          if (steadyHideRef.current) clearTimeout(steadyHideRef.current);
          steadyHideRef.current = setTimeout(() => {
            setSteadyBanner(null);
            steadyHideRef.current = null;
          }, 6000);
        }
      }
      pendingBulkRecalcRef.current = false;
      bulkScoreBeforeRef.current = null;
    } catch (e) {
      console.error("[resume-editor] score error", e);
      setScoreError(
        "Score update failed. Your last score is shown.",
      );
      pendingBulkRecalcRef.current = false;
      bulkScoreBeforeRef.current = null;
    } finally {
      setScoring(false);
      setScoringNote(null);
    }
  }, [
    scoring,
    jobPosting,
    displayScore,
    animateScoreTo,
    persistEditorToStorage,
  ]);

  useEffect(() => {
    recalculateScoreRef.current = recalculateScore;
  }, [recalculateScore]);

  const onRewriteApply = useCallback(
    (cardIndex: number, originalText: string, rewrittenText: string) => {
      const editor = document.getElementById(
        "resume-editor",
      ) as HTMLDivElement | null;
      if (!editor) return;

      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }

      const backup = editor.innerHTML;
      const ok = findAndReplaceInResumeEditor(
        editor,
        originalText,
        rewrittenText,
      );

      if (!ok) {
        return;
      }

      cardBackupsRef.current.set(cardIndex, backup);
      setAppliedCards((s) => new Set(s).add(cardIndex));
      setCheckAnimKey((k) => k + 1);
      persistEditorToStorage();

      scheduleRemoveJustAppliedClass(editor, 2000);

      requestAnimationFrame(() => {
        editor
          .querySelector(".just-applied")
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    [persistEditorToStorage],
  );

  const onRewriteUndo = useCallback(
    (cardIndex: number) => {
      const editor = document.getElementById(
        "resume-editor",
      ) as HTMLDivElement | null;
      const backup = cardBackupsRef.current.get(cardIndex);
      if (!editor || backup === undefined) return;

      editor.innerHTML = backup;
      editor.classList.add("re-flash-red");
      window.setTimeout(() => editor.classList.remove("re-flash-red"), 1000);

      cardBackupsRef.current.delete(cardIndex);
      setAppliedCards((s) => {
        const n = new Set(s);
        n.delete(cardIndex);
        return n;
      });
      persistEditorToStorage();
    },
    [persistEditorToStorage],
  );

  const onRewriteCardEnter = useCallback(
    (originalText: string) => {
      const editor = document.getElementById(
        "resume-editor",
      ) as HTMLElement | null;
      if (!editor) return;
      if (hoverCleanupRef.current) {
        hoverCleanupRef.current();
        hoverCleanupRef.current = null;
      }
      const cleanup = highlightRewriteInEditor(editor, originalText);
      hoverCleanupRef.current = cleanup;
    },
    [],
  );

  const onRewriteCardLeave = useCallback(() => {
    if (hoverCleanupRef.current) {
      hoverCleanupRef.current();
      hoverCleanupRef.current = null;
    }
  }, []);

  const openKeywordTooltip = useCallback(
    async (keyword: string, anchor: HTMLElement) => {
      const r = anchor.getBoundingClientRect();
      setKwTooltip({
        keyword,
        left: r.left,
        top: r.bottom + 6,
      });
      const cached = suggestionCacheRef.current.get(keyword);
      if (cached) {
        setKwSuggestions(cached);
        setKwSuggestionsLoading(false);
        return;
      }
      setKwSuggestions([]);
      setKwSuggestionsLoading(true);
      const jobTitle =
        jobPosting.split("\n").find((l) => l.trim().length > 0)?.trim().slice(0, 200) ||
        "professional";
      try {
        const res = await fetch("/api/keyword-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, jobTitle }),
        });
        const data = (await res.json()) as {
          suggestions?: string[];
          error?: string;
        };
        if (!res.ok || !data.suggestions?.length) {
          throw new Error(data.error ?? "Failed");
        }
        suggestionCacheRef.current.set(keyword, data.suggestions);
        setKwSuggestions(data.suggestions);
      } catch (e) {
        console.error("[resume-editor] keyword suggestions", e);
        setKwSuggestions([]);
      } finally {
        setKwSuggestionsLoading(false);
      }
    },
    [jobPosting],
  );

  const addSuggestionToResume = useCallback(
    (sentence: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const plain = editor.innerText.replace(/\r\n/g, "\n");
      const next = appendSentenceToResume(plain, sentence);
      editor.innerHTML = plainToEditorHtml(next);
      persistEditorToStorage();
      setKwTooltip(null);
      setKwSuggestions([]);
    },
    [persistEditorToStorage],
  );

  const handleApplyAll = useCallback(async () => {
    if (applyAllRunningRef.current || rewrites.length === 0) return;
    const editor = document.getElementById(
      "resume-editor",
    ) as HTMLDivElement | null;
    if (!editor) return;

    applyAllRunningRef.current = true;
    setApplyAllState("loading");

    for (let i = 0; i < rewrites.length; i++) {
      await delay(400);
      if (appliedSetRef.current.has(i)) continue;

      const { original, rewritten } = rewrites[i]!;
      const backup = editor.innerHTML;
      const ok = findAndReplaceInResumeEditor(editor, original, rewritten);
      if (ok) {
        cardBackupsRef.current.set(i, backup);
        setAppliedCards((s) => new Set(s).add(i));
        setCheckAnimKey((k) => k + 1);
        scheduleRemoveJustAppliedClass(editor, 2000);
        requestAnimationFrame(() => {
          editor
            .querySelector(".just-applied")
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
      persistEditorToStorage();
    }

    setApplyAllState("done");
    applyAllRunningRef.current = false;

    await delay(800);
    bulkScoreBeforeRef.current = displayScoreRef.current;
    pendingBulkRecalcRef.current = true;
    // #region agent log
    fetch("http://127.0.0.1:7677/ingest/8db16057-cb80-4431-9287-3e6d24985fec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "67af35",
      },
      body: JSON.stringify({
        sessionId: "67af35",
        hypothesisId: "H5",
        location: "LiveResumeEditorExperience.tsx:handleApplyAll",
        message: "invoking recalculate after apply all",
        data: { bulkScoreBefore: displayScoreRef.current },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await recalculateScoreRef.current();
  }, [rewrites]);

  const downloadTxt = useCallback(() => {
    const el = editorRef.current;
    const plain = el ? el.innerText.replace(/\r\n/g, "\n") : "";
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume-edited.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const groupedRewrites = useMemo(() => {
    const m = new Map<
      string,
      {
        globalIdx: number;
        originalText: string;
        rewrittenText: string;
        explanation: string;
      }[]
    >();
    rewrites.forEach((r, globalIdx) => {
      const label = (r.section ?? "Other").trim() || "Other";
      if (!m.has(label)) m.set(label, []);
      m.get(label)!.push({
        globalIdx,
        originalText: r.original,
        rewrittenText: r.rewritten,
        explanation: r.whyBetter,
      });
    });
    return [...m.entries()];
  }, [rewrites]);

  const jobTitleLine = useMemo(() => {
    return (
      jobPosting.split("\n").find((l) => l.trim().length > 0)?.trim().slice(0, 200) ||
      "Professional"
    );
  }, [jobPosting]);

  const strengthMeters = useMemo(() => {
    if (!baselineAnalysis) {
      return { kw: 0, exp: 0, overall: 0 };
    }
    const totalKw = presentKw.length + missingKw.length;
    const kwPct =
      totalKw > 0
        ? Math.round((100 * presentKw.length) / totalKw)
        : Math.round(
            (100 *
              baselineAnalysis.keywords.filter((k) => k.found).length) /
              Math.max(1, baselineAnalysis.keywords.length),
          );
    const exp = clampScore(Math.round(baselineAnalysis.experienceMatch));
    const overall = clampScore(
      Math.round((displayScore + baselineAnalysis.matchScore) / 2),
    );
    return { kw: kwPct, exp, overall };
  }, [baselineAnalysis, presentKw.length, missingKw.length, displayScore]);

  const status = scoreStatusLabel(displayScore);
  const motivation = scoreMotivationLine(displayScore);

  const bottomBar = (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-card)] px-6 py-4 ${
        variant === "page"
          ? "fixed inset-x-0 bottom-0 z-50"
          : "mt-8 rounded-xl border border-[var(--border)]"
      }`}
      style={
        variant === "page"
          ? { paddingBottom: "max(16px, env(safe-area-inset-bottom))" }
          : undefined
      }
    >
      {variant === "page" ? (
        <Link
          href="/analyze"
          className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
        >
          ← Back to Analyze
        </Link>
      ) : onEmbeddedBack ? (
        <button
          type="button"
          onClick={onEmbeddedBack}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={downloadTxt}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]"
        >
          Download resume (.txt)
        </button>
        {variant === "page" ? (
          <Link
            href="/match"
            onClick={() => persistEditorToStorage()}
            className="inline-flex rounded-[10px] px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            Continue to Match →
          </Link>
        ) : onEmbeddedContinue ? (
          <button
            type="button"
            onClick={() => {
              persistEditorToStorage();
              onEmbeddedContinue();
            }}
            className="rounded-[10px] px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            Continue to Match →
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
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[55%_45%] lg:gap-6">
        <div className="flex min-h-0 flex-col">
          <div className="mb-4">
            <h1
              className="text-[22px] font-extrabold text-[var(--text-primary)]"
              style={{ fontWeight: 800 }}
            >
              Resume Editor
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Preview changes on hover, apply rewrites, then recalculate when
              you&apos;re ready.
            </p>
          </div>

          <div className="mb-2">
            <span className="text-xs text-[var(--text-muted)]">
              Missing keywords:
            </span>
            <div className="flex max-w-full flex-wrap gap-2 py-3">
              {missingKw.map((k) => (
                <div key={k} className="relative">
                  <button
                    type="button"
                    onClick={(e) => void openKeywordTooltip(k, e.currentTarget)}
                    className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium transition hover:opacity-90"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      borderColor: "rgba(239,68,68,0.3)",
                      color: "#dc2626",
                    }}
                  >
                    {k}
                  </button>
                </div>
              ))}
              {missingKw.length === 0 ? (
                <span className="text-xs text-[var(--text-muted)]">
                  {hasRecalculatedOnce
                    ? "Great — no missing keywords listed."
                    : "Recalculate to refresh keyword gaps."}
                </span>
              ) : null}
            </div>
          </div>

          {loadingResume ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
          ) : null}
          {loadError ? (
            <p className="mb-2 text-sm text-amber-600">{loadError}</p>
          ) : null}

          <div
            ref={editorRef}
            id="resume-editor"
            contentEditable={!loadingResume}
            suppressContentEditableWarning
            onInput={onEditorInput}
            className="min-h-[70vh] whitespace-pre-wrap break-words rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-9 py-8 text-[14px] leading-[1.8] text-[var(--text-primary)] outline-none transition-[box-shadow,border-color] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-glow)]"
            style={{ fontFamily: "Georgia, serif" }}
          />
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
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--brand)] disabled:opacity-70"
              >
                {scoring ? (
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent"
                    aria-hidden
                  />
                ) : null}
                {scoring ? "Scoring…" : "↻ Recalculate score"}
              </button>
            </div>

            {!scoring ? (
              <p
                className="mb-1 text-[12px] font-bold uppercase tracking-wide"
                style={{ color: status.color }}
              >
                {status.text}
              </p>
            ) : null}

            {scoring ? (
              <div className="flex items-center gap-1 py-3">
                <span className="re-score-dot" />
                <span className="re-score-dot" />
                <span className="re-score-dot" />
              </div>
            ) : (
              <div
                className={`flex items-baseline gap-1 ${scoreGlowPulse ? "re-editor-score-glow-pulse rounded-lg" : ""}`}
              >
                <span
                  className="text-[64px] font-extrabold leading-none"
                  style={{
                    fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif",
                    color: scoreHue(displayScore),
                  }}
                >
                  {displayScore}
                </span>
                <span className="text-2xl text-[var(--text-muted)]">/100</span>
              </div>
            )}

            {!hasRecalculatedOnce && !scoring ? (
              <p className="mt-2 text-[12px] italic text-[var(--text-muted)]">
                From your last analysis · Recalculate to update
              </p>
            ) : null}

            {!scoring ? (
              <p className="mt-2 text-[13px] italic text-[var(--text-secondary)]">
                {motivation}
              </p>
            ) : null}

            {scoringNote ? (
              <p className="mt-2 text-[12px] font-medium text-[var(--brand)]">
                {scoringNote}
              </p>
            ) : null}

            <div
              className={`mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)] ${scoring ? "re-progress-track-shimmer" : ""}`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-[800ms] ease-out ${
                  scoring ? "resume-editor-progress-pulse" : ""
                }`}
                style={{
                  width: `${displayScore}%`,
                  background:
                    "linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%)",
                  borderRadius: 999,
                }}
              />
            </div>

            {reasoning && !scoring ? (
              <p className="mt-3 text-xs italic text-[var(--text-muted)]">
                {reasoning}
              </p>
            ) : null}

            {deltaLabel ? (
              <p
                className={`mt-2 text-[13px] ${
                  deltaLabel.startsWith("+")
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {deltaLabel.startsWith("+") ? "↑ " : "↓ "}
                {deltaLabel}
              </p>
            ) : null}

            {celebrationBanner ? (
              <div
                className="mt-3 rounded-xl border px-4 py-3 text-sm font-semibold text-[#10b981]"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  borderColor: "rgba(16,185,129,0.2)",
                }}
              >
                {celebrationBanner}
              </div>
            ) : null}

            {steadyBanner ? (
              <div
                className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
              >
                {steadyBanner}
              </div>
            ) : null}

            {scoreError ? (
              <div
                className="mt-3 rounded-lg border border-[rgba(239,68,68,0.2)] px-3 py-2 text-xs"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  color: "var(--red)",
                }}
              >
                {scoreError}{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => void recalculateScore()}
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>

          <div className={CARD}>
            <h3 className="mb-3 text-[13px] font-bold text-[var(--text-primary)]">
              Keyword coverage
            </h3>
            {!hasRecalculatedOnce ? (
              <p className="text-[13px] italic text-[var(--text-muted)]">
                Click Recalculate to see your keyword coverage
              </p>
            ) : (
              <>
                <p className="text-[13px] text-emerald-600">
                  Present: {presentKw.length} keywords
                </p>
                <p className="mt-1 text-[13px] text-red-600">
                  Missing: {missingKw.length} keywords
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {presentKw.slice(0, 12).map((k) => (
                    <span
                      key={`p-${k}`}
                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: "rgba(16,185,129,0.08)",
                        borderColor: "rgba(16,185,129,0.3)",
                        color: "#16a34a",
                      }}
                    >
                      {k}
                    </span>
                  ))}
                  {presentKw.length > 12 ? (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      +{presentKw.length - 12} more
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className={CARD}>
            <h3 className="mb-3 text-[13px] font-bold text-[var(--text-primary)]">
              Resume rewrites
            </h3>
            {rewrites.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No rewrites in your analysis.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={applyAllState !== "idle"}
                  onClick={() => void handleApplyAll()}
                  className={`mb-2 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold text-white shadow-[0_4px_20px_var(--brand-glow)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-90 ${
                    applyAllState === "loading"
                      ? "re-editor-apply-all-btn--loading"
                      : ""
                  }`}
                  style={
                    applyAllState === "done"
                      ? {
                          background: "rgba(16,185,129,0.15)",
                          border: "1px solid rgba(16,185,129,0.3)",
                          color: "#10b981",
                          boxShadow: "none",
                        }
                      : {
                          background:
                            "linear-gradient(135deg, var(--brand), var(--brand-2))",
                        }
                  }
                >
                  {applyAllState === "loading"
                    ? "✨ Applying improvements..."
                    : applyAllState === "done"
                      ? "✓ All improvements applied"
                      : "✨ Apply all improvements"}
                </button>
                <p className="mb-4 text-center text-xs text-[var(--text-muted)]">
                  Applies all rewrites to your resume at once
                </p>

                <div className="space-y-6">
                  {groupedRewrites.map(([sectionLabel, items]) => (
                    <div key={sectionLabel}>
                      <div className="mb-2 border-b border-[var(--border)] pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        {sectionLabel}
                      </div>
                      <ul className="space-y-3">
                        {items.map((item) => {
                          const i = item.globalIdx;
                          const applied = appliedCards.has(i);
                          return (
                            <li
                              key={i}
                              className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors sm:p-4"
                              onMouseEnter={() =>
                                onRewriteCardEnter(item.originalText)
                              }
                              onMouseLeave={onRewriteCardLeave}
                            >
                              <div className="flex gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="mb-1.5 text-[12px] italic leading-snug text-[var(--text-muted)] line-through">
                                    {item.originalText}
                                  </p>
                                  <p className="text-[13px] font-medium leading-[1.6] text-[var(--text-primary)]">
                                    {item.rewrittenText}
                                  </p>
                                  <p className="mt-1 text-[11px] italic text-[var(--text-muted)]">
                                    {item.explanation}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <button
                                    type="button"
                                    disabled={applied}
                                    onClick={() =>
                                      onRewriteApply(
                                        i,
                                        item.originalText,
                                        item.rewrittenText,
                                      )
                                    }
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition disabled:cursor-default disabled:opacity-100 ${
                                      applied
                                        ? ""
                                        : "hover:border-[#10b981] hover:bg-[rgba(16,185,129,0.08)] hover:text-[#10b981]"
                                    }`}
                                    style={
                                      applied
                                        ? {
                                            borderColor:
                                              "rgba(16,185,129,0.5)",
                                            background:
                                              "rgba(16,185,129,0.2)",
                                            color: "#10b981",
                                          }
                                        : {
                                            borderColor: "var(--border)",
                                            background: "var(--bg-card)",
                                          }
                                    }
                                    title="Apply rewrite"
                                  >
                                    {applied ? (
                                      <svg
                                        key={`chk-${i}-${checkAnimKey}`}
                                        className="h-3.5 w-3.5 resume-editor-check-draw text-[#10b981]"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        aria-hidden
                                      >
                                        <path
                                          d="M2 6l3 3 5-5"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    ) : (
                                      "✓"
                                    )}
                                  </button>
                                  {applied ? (
                                    <button
                                      type="button"
                                      onClick={() => onRewriteUndo(i)}
                                      className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    >
                                      ↩ Undo
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}

            {baselineAnalysis ? (
              <div className="mt-8 border-t border-[var(--border)] pt-6">
                <h4 className="mb-4 text-[13px] font-bold text-[var(--text-primary)]">
                  Your resume strength
                </h4>
                <div className="space-y-3">
                  {(
                    [
                      ["Keyword match", strengthMeters.kw, 0],
                      ["Experience clarity", strengthMeters.exp, 80],
                      ["Overall readiness", strengthMeters.overall, 160],
                    ] as const
                  ).map(([label, pct, stagger]) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 text-[12px]"
                    >
                      <span className="w-[130px] shrink-0 text-[var(--text-secondary)]">
                        {label}
                      </span>
                      <div className="relative h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                        <div
                          className="h-full rounded-full bg-[var(--brand)]"
                          style={{
                            width: strengthAnimate ? `${pct}%` : "0%",
                            transition: "width 1s ease-out",
                            transitionDelay: `${stagger}ms`,
                          }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right font-semibold text-[var(--text-primary)]">
                        {pct}%
                      </span>
                    </div>
                  ))}
                </div>
                {displayScore >= 60 ? (
                  <Link
                    href="/match"
                    onClick={() => persistEditorToStorage()}
                    className="mt-4 inline-block text-[13px] font-semibold text-[var(--brand)]"
                  >
                    Ready to move on? →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {bottomBar}

      {kwTooltip ? (
        <div
          ref={kwTooltipRef}
          className="fixed z-[100] w-[280px] rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
          style={{
            left: kwTooltip.left,
            top: kwTooltip.top,
          }}
        >
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {kwTooltip.keyword}
          </p>
          <div className="my-2 border-t border-[var(--border)]" />
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Where to add it:
          </p>
          {kwSuggestionsLoading ? (
            <div className="flex gap-1 py-2">
              <span className="re-score-dot" />
              <span className="re-score-dot" />
              <span className="re-score-dot" />
            </div>
          ) : kwSuggestions.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              Couldn&apos;t load suggestions. Try again later.
            </p>
          ) : (
            <ul className="space-y-2">
              {kwSuggestions.map((s, idx) => (
                <li
                  key={idx}
                  className="border-l-2 border-[var(--brand)] py-1 pl-2.5 pr-1 text-[13px] text-[var(--text-secondary)]"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => addSuggestionToResume(s)}
                    className="mt-1 block text-xs font-semibold text-[var(--brand)]"
                  >
                    Add to resume
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">
            Role context: {jobTitleLine}
          </p>
        </div>
      ) : null}
    </div>
  );
}
