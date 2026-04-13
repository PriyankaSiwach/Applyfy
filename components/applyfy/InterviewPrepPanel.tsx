"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InterviewPrep, PredictedQuestion } from "@/lib/analysisTypes";

// ─── sessionStorage helpers for answer persistence ───────────────────────────
const IA_STORAGE_KEY = "applyfy_ia_v1";

function readCachedAiAnswers(cacheKey: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(IA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      key?: string;
      answers?: Record<string, string>;
    };
    if (parsed.key === cacheKey && parsed.answers) return parsed.answers;
  } catch {
    /* ignore — storage unavailable or corrupt */
  }
  return null;
}

function writeCachedAiAnswers(
  cacheKey: string,
  answers: Record<string, string>,
) {
  try {
    sessionStorage.setItem(
      IA_STORAGE_KEY,
      JSON.stringify({ key: cacheKey, answers }),
    );
  } catch {
    /* ignore — storage full or unavailable */
  }
}

function clearCachedAiAnswers() {
  try {
    sessionStorage.removeItem(IA_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
import { interviewPrepPlainText } from "@/lib/interviewPrepPlainText";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { FeatureLock } from "@/components/subscription/FeatureLock";
import { PremiumLockedButtonWrap } from "@/components/subscription/PremiumLockedButtonWrap";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { FollowUpEmailGenerator } from "@/components/applyfy/FollowUpEmailGenerator";
import { InterviewSimulator } from "@/components/applyfy/InterviewSimulator";
import { SalaryNegotiationCoachModal } from "@/components/applyfy/SalaryNegotiationCoachModal";

/** Behavioral question theme groups — match question theme to story signals. */
const BEHAVIORAL_THEMES: { match: RegExp; storySignals: RegExp }[] = [
  {
    match: /conflict|disagree|tension|pushback|argue|debate/i,
    storySignals: /conflict|disagree|tension|pushback|challenged|opposed|persuad|convinc|stakeholder|criticism|told me|argue|debate/i,
  },
  {
    match: /feedback|criticism|were told|told you|improve|didn.t agree/i,
    storySignals: /feedback|told|suggested|criticism|critique|advised|adjust|changed approach|revised|review|receptive/i,
  },
  {
    match: /priorit|shift|sudden|urgent|compet|juggl|deadline/i,
    storySignals: /priorit|deadline|urgent|shift|pivot|changed|sudden|interrupt|compet|juggl|trade.off|last.minute/i,
  },
  {
    match: /failure|mistake|didn.t work|went wrong|setback|failed/i,
    storySignals: /fail|mistake|error|didn.t|broke|missed|wrong|lesson|learned/i,
  },
  {
    match: /outcome|end.to.end|drove|impact|deliver|own|meaningful result/i,
    storySignals: /built|build|launch|deliver|ship|complete|project|led|drove|initiative|developed|deployed|released|published/i,
  },
  {
    match: /lead|team|influence|mentor|coordinate/i,
    storySignals: /team|lead|mentor|guide|coordinat|influenc|manag|present|trained/i,
  },
  {
    match: /collaborat|partner|cross.function|work with/i,
    storySignals: /together|partner|cross.function|coordinat|collaborat|worked with|joint/i,
  },
];

/**
 * Assign each STAR story to the behavioral question it best answers.
 * Scores against question + context text, boosts theme matches, and
 * ensures each story gets a different question where possible.
 */
function assignBestQuestionsForStories(
  stories: { title: string; S: string; T: string; A: string; R: string }[],
  behavioralQuestions: PredictedQuestion[],
): string[] {
  if (behavioralQuestions.length === 0) {
    return stories.map(() => "a behavioral question about your experience");
  }

  const usedIndices = new Set<number>();

  return stories.map((story) => {
    const storyText =
      `${story.title} ${story.S} ${story.T} ${story.A} ${story.R}`.toLowerCase();

    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < behavioralQuestions.length; i++) {
      const q = behavioralQuestions[i]!;
      const qFull = `${q.question} ${q.context}`.toLowerCase();

      // Method 1: direct word overlap against question + context
      const qWords = qFull.split(/\W+/).filter((w) => w.length > 3);
      let score = qWords.filter((w) => storyText.includes(w)).length;

      // Method 2: theme-based boost — much stronger signal than word overlap
      for (const theme of BEHAVIORAL_THEMES) {
        if (theme.match.test(qFull) && theme.storySignals.test(storyText)) {
          score += 6;
        }
      }

      // Strongly penalise already-used questions (force variety)
      if (usedIndices.has(i)) score -= 50;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const idx = bestIdx >= 0 ? bestIdx : usedIndices.size % behavioralQuestions.length;
    usedIndices.add(idx);
    return behavioralQuestions[idx]!.question;
  });
}

/** Strip a trailing "Tip: …" line injected by the answer API into the answer body. */
function splitAnswerTip(text: string): { body: string; inlineTip: string | null } {
  const m = text.match(/\n*Tip:\s*(.+)$/i);
  if (!m) return { body: text, inlineTip: null };
  return {
    body: text.slice(0, text.length - m[0].length).trim(),
    inlineTip: m[1].trim(),
  };
}

function StarStoryCollapsible({
  story,
  bestQ,
}: {
  story: { title: string; S: string; T: string; A: string; R: string };
  bestQ: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-bold text-[#0f172a]">{story.title}</p>
          <p className="mt-2 text-[12px] leading-snug text-[#64748b]">
            <span className="font-semibold text-[#7c3aed]">Best used for:</span>{" "}
            {bestQ}
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-[#94a3b8]">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[#f1f5f9] px-4 pb-4 pt-3 text-sm text-[#64748b]">
          <p>
            <span className="font-semibold text-[#0f172a]">S:</span> {story.S}
          </p>
          <p>
            <span className="font-semibold text-[#0f172a]">T:</span> {story.T}
          </p>
          <p>
            <span className="font-semibold text-[#0f172a]">A:</span> {story.A}
          </p>
          <p>
            <span className="font-semibold text-[#0f172a]">R:</span> {story.R}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function InterviewPrepPanel({ prep }: { prep: InterviewPrep }) {
  const { isPro, isPremium } = useSubscription();
  const { copyPlainText, resume, jobPosting, jobLink } = useApplyfy();
  const [extraBehavioral, setExtraBehavioral] = useState<PredictedQuestion[]>(
    [],
  );
  const [extraTechnical, setExtraTechnical] = useState<PredictedQuestion[]>(
    [],
  );
  const [loadingBehavioral, setLoadingBehavioral] = useState(false);
  const [loadingTechnical, setLoadingTechnical] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [salaryCoachOpen, setSalaryCoachOpen] = useState(false);

  useEffect(() => {
    if (!isPremium) setSalaryCoachOpen(false);
  }, [isPremium]);

  // AI-generated answers keyed by question text — overlaid on top of stub answers
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({});
  const [loadingAiAnswers, setLoadingAiAnswers] = useState(false);
  const answersLoadedKey = useRef<string>("");

  // Edit mode: track which question is being edited and the draft text
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // Per-question regeneration loading state
  const [regeneratingSet, setRegeneratingSet] = useState<Set<string>>(
    new Set(),
  );

  const introDisplay = prep.intro ?? prep.introPitch;

  const prepResetKey = useMemo(
    () =>
      `${introDisplay?.slice(0, 48)}|${prep.behavioral.map((q) => q.question).join("¦")}|${prep.technical.map((q) => q.question).join("¦")}`,
    [introDisplay, prep.behavioral, prep.technical],
  );

  // Track the previous prepResetKey so we can detect a genuine analysis change
  // (as opposed to an initial mount after navigation, which must NOT clear the cache).
  const prevPrepResetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const isRealChange =
      prevPrepResetKeyRef.current !== null &&
      prevPrepResetKeyRef.current !== prepResetKey;
    prevPrepResetKeyRef.current = prepResetKey;

    setExtraBehavioral([]);
    setExtraTechnical([]);
    setMoreError(null);
    setAiAnswers({});
    answersLoadedKey.current = "";

    // Only wipe the sessionStorage cache when the analysis genuinely changed
    // (new resume or job description). On a plain remount after navigation the
    // key is the same — clearing here would destroy the cache before the fetch
    // effect has a chance to read it, causing a redundant API call.
    if (isRealChange) {
      clearCachedAiAnswers();
    }
  }, [prepResetKey]);

  // Fetch AI-generated answers for all initial questions when resume + JD are ready.
  // Uses sessionStorage so navigating away and back does NOT re-call the API.
  useEffect(() => {
    const job = jobPosting.trim();
    if (!resume || job.length < 80) return;

    const allInitialQuestions = [
      ...prep.behavioral.map((q) => q.question),
      ...prep.technical.map((q) => q.question),
    ];
    if (allInitialQuestions.length === 0) return;

    const cacheKey = `${prepResetKey}|${resume.slice(0, 64)}|${job.slice(0, 64)}`;
    // Within-mount guard — prevents double-fetch on re-renders
    if (answersLoadedKey.current === cacheKey) return;
    answersLoadedKey.current = cacheKey;

    // Check sessionStorage first — hit means the user navigated back; no API call needed
    const cached = readCachedAiAnswers(cacheKey);
    if (cached) {
      setAiAnswers(cached);
      return;
    }

    // Cache miss — fetch from API then persist so the next navigation is instant
    setLoadingAiAnswers(true);
    fetch("/api/interview-answer", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: allInitialQuestions,
        resume,
        jobPosting: job,
      }),
    })
      .then((res) => res.json())
      .then((data: { answers?: Record<string, string>; error?: string }) => {
        if (data.answers && typeof data.answers === "object") {
          setAiAnswers(data.answers);
          writeCachedAiAnswers(cacheKey, data.answers);
        }
      })
      .catch(() => {
        /* silently fall back to stub answers */
      })
      .finally(() => {
        setLoadingAiAnswers(false);
      });
  }, [prepResetKey, resume, jobPosting, prep.behavioral, prep.technical]);

  const generateMore = useCallback(
    async (kind: "behavioral" | "technical") => {
      if (!isPremium) return;
      const job = jobPosting.trim();
      if (job.length < 80) {
        setMoreError(
          "Job description is missing or too short. Run analysis again with a complete job posting.",
        );
        return;
      }
      setMoreError(null);
      const existing =
        kind === "behavioral"
          ? [...prep.behavioral, ...extraBehavioral].map((q) => q.question)
          : [...prep.technical, ...extraTechnical].map((q) => q.question);
      const setLoading =
        kind === "behavioral" ? setLoadingBehavioral : setLoadingTechnical;
      setLoading(true);
      try {
        const res = await fetch("/api/interview-prep-more", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            resume,
            jobPosting: job,
            jobLink: jobLink.trim() || undefined,
            existingQuestions: existing,
          }),
        });
        const raw = await res.text();
        let data: { questions?: PredictedQuestion[]; error?: string };
        try {
          data = JSON.parse(raw) as {
            questions?: PredictedQuestion[];
            error?: string;
          };
        } catch {
          throw new Error("Bad response from server.");
        }
        if (!res.ok || !data.questions?.length) {
          throw new Error(
            data.error ?? "Could not generate more questions. Try again.",
          );
        }
        const tagged = data.questions.map((q) => ({
          ...q,
          kind,
        })) as PredictedQuestion[];
        if (kind === "behavioral") {
          setExtraBehavioral((prev) => [...prev, ...tagged]);
        } else {
          setExtraTechnical((prev) => [...prev, ...tagged]);
        }
      } catch (e) {
        setMoreError(
          e instanceof Error ? e.message : "Something went wrong.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      isPremium,
      jobPosting,
      jobLink,
      resume,
      prep.behavioral,
      prep.technical,
      extraBehavioral,
      extraTechnical,
    ],
  );

  // Regenerate answer for a single question
  const regenerateSingle = useCallback(
    async (question: string) => {
      const job = jobPosting.trim();
      setRegeneratingSet((prev) => new Set(prev).add(question));
      try {
        const res = await fetch("/api/interview-answer", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: [question], resume, jobPosting: job }),
        });
        const data = (await res.json()) as {
          answers?: Record<string, string>;
        };
        if (data.answers?.[question]) {
          const updated = { ...aiAnswers, [question]: data.answers[question]! };
          setAiAnswers(updated);
          // Persist the updated map so navigation doesn't lose the new answer
          const cacheKey = `${prepResetKey}|${resume.slice(0, 64)}|${job.slice(0, 64)}`;
          writeCachedAiAnswers(cacheKey, updated);
        }
      } catch {
        /* silently keep old answer */
      } finally {
        setRegeneratingSet((prev) => {
          const next = new Set(prev);
          next.delete(question);
          return next;
        });
      }
    },
    [jobPosting, resume, aiAnswers, prepResetKey],
  );

  // Save an edited answer draft
  const saveEdit = useCallback(
    (question: string, text: string) => {
      const updated = { ...aiAnswers, [question]: text };
      setAiAnswers(updated);
      const cacheKey = `${prepResetKey}|${resume.slice(0, 64)}|${jobPosting.slice(0, 64)}`;
      writeCachedAiAnswers(cacheKey, updated);
      setEditingQuestion(null);
      setEditDraft("");
    },
    [aiAnswers, prepResetKey, resume, jobPosting],
  );

  const behavioralAll = [...prep.behavioral, ...extraBehavioral];
  const technicalAll = [...prep.technical, ...extraTechnical];

  const mergedForExport = useMemo(() => {
    if (isPro) {
      return {
        ...prep,
        behavioral: [...prep.behavioral, ...extraBehavioral],
        technical: [...prep.technical, ...extraTechnical],
      };
    }
    const bAll = [...prep.behavioral, ...extraBehavioral];
    const tAll = [...prep.technical, ...extraTechnical];
    const bPart = bAll.slice(0, 3);
    const need = 3 - bPart.length;
    const tPart = need > 0 ? tAll.slice(0, need) : [];
    return {
      ...prep,
      behavioral: bPart,
      technical: tPart,
    };
  }, [prep, extraBehavioral, extraTechnical, isPro]);

  function renderQuestionBlock(
    item: PredictedQuestion,
    sectionIdx: number,
    prefix: string,
    globalIndex: number,
    isInitial = false,
  ) {
    const accentBorder = "border-l-[#7c3aed]";
    const accentText = "text-[#7c3aed]";
    const locked = !isPro && globalIndex >= 3;
    const rawAnswer =
      isInitial && aiAnswers[item.question]
        ? aiAnswers[item.question]
        : item.fullAnswer;
    // Strip any trailing "Tip: …" injected by the answer API into the body
    const { body: displayAnswer, inlineTip } = splitAnswerTip(rawAnswer ?? "");
    const tipText = item.tip || inlineTip || "";
    const isLoadingThisAnswer =
      isInitial && loadingAiAnswers && !aiAnswers[item.question];
    const isRegenerating = regeneratingSet.has(item.question);
    const isEditing = editingQuestion === item.question;
    // Show edit/regenerate controls only when there's a real answer to act on
    const canEdit = !locked && !isLoadingThisAnswer && !isRegenerating && !!displayAnswer;

    const tipEl = tipText ? (
      <div className="mt-3 flex gap-2 rounded-xl border border-[#e9d5ff]/80 bg-[#f5f3ff] px-3.5 py-2.5 text-[13px] text-[#6d28d9]">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <span>
          <span className="font-medium">Tip:</span> {tipText}
        </span>
      </div>
    ) : null;

    const answerBlock = (() => {
      if (isLoadingThisAnswer || isRegenerating) {
        return (
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-3 w-[92%] animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-3 w-[85%] animate-pulse rounded bg-[#f1f5f9]" />
            <div className="h-3 w-[70%] animate-pulse rounded bg-[#f1f5f9]" />
          </div>
        );
      }
      if (isEditing) {
        return (
          <div className="mt-3">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={7}
              className="box-border w-full resize-y rounded-xl border border-[#e2e8f0] bg-[#faf8ff] px-3 py-2.5 text-sm leading-[1.7] text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20"
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => saveEdit(item.question, editDraft)}
                className="applyfy-btn-primary rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition hover:brightness-[1.05]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setEditingQuestion(null); setEditDraft(""); }}
                className="rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-1.5 text-xs font-medium text-[#64748b] transition hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      }
      return (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-[1.7] text-[#0f172a]">
          {displayAnswer}
        </p>
      );
    })();

    const inner = (
      <article
        className={`rounded-r-xl rounded-l-none border border-[#e2e8f0] border-l-4 bg-white py-4 pl-5 pr-5 ${accentBorder}`}
      >
        <p className="text-[15px] font-bold leading-snug text-[#0f172a]">
          <span className={accentText}>{globalIndex + 1}.</span>{" "}
          {item.question}
        </p>
        <p className="mt-2 text-[13px] italic text-[#64748b]">
          Why they ask this: {item.context}
        </p>

        {answerBlock}

        {/* Edit / Regenerate controls */}
        {canEdit && !isEditing ? (
          <div className="mt-3 flex items-center gap-3 border-t border-[#f1f5f9] pt-3">
            <button
              type="button"
              onClick={() => {
                setEditingQuestion(item.question);
                setEditDraft(displayAnswer ?? "");
              }}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748b] transition hover:text-[#0f172a]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit answer
            </button>
            <span className="text-[#e2e8f0]">·</span>
            <button
              type="button"
              onClick={() => void regenerateSingle(item.question)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#64748b] transition hover:text-[#7c3aed]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate answer
            </button>
          </div>
        ) : null}

        {locked ? (
          tipEl
        ) : isPro ? (
          tipEl
        ) : (
          <FeatureLock
            locked
            tier="pro"
            description="Unlock coaching tips for every question — know exactly how to frame your answer."
          >
            {tipEl}
          </FeatureLock>
        )}
      </article>
    );

    const key = `${prefix}-${sectionIdx}-${item.question.slice(0, 24)}`;
    if (locked) {
      return (
        <FeatureLock
          key={key}
          locked
          tier="pro"
          description="Get unlimited tailored interview questions for this specific role."
        >
          {inner}
        </FeatureLock>
      );
    }
    return <div key={key}>{inner}</div>;
  }

  return (
    <section className="w-full min-w-0">
      <div className="mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-[#0f172a] sm:text-left">
          Interview prep
        </h2>
        <button
          type="button"
          onClick={() =>
            void copyPlainText(interviewPrepPlainText(mergedForExport))
          }
          className="shrink-0 rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-medium text-[#64748b] transition-all hover:bg-[#f8fafc]"
        >
          Copy all
        </button>
      </div>
      <p className="mb-6 text-sm text-[#64748b] sm:text-left">
        Tailored answers for this role. Edit and practice out loud in your own
        voice.
      </p>

      {loadingAiAnswers ? (
        <div
          role="status"
          aria-live="polite"
          className="skeleton-shimmer-animate mb-6 flex items-center gap-3 rounded-xl border border-[#e0e7ff] bg-gradient-to-r from-[#faf8ff] to-white px-4 py-3.5 text-sm text-[#5b21b6] shadow-sm"
        >
          <svg
            className="h-5 w-5 shrink-0 animate-spin text-[#7c3aed]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="font-medium leading-snug">
            Personalizing answers from your resume and this job posting…
          </span>
        </div>
      ) : null}

      <div className="mb-8 overflow-visible rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#faf8ff] via-white to-[#f5f3ff] p-6 shadow-[0_12px_40px_-14px_rgba(124,58,237,0.12)] sm:p-7">
        <div className="flex flex-col gap-4 overflow-visible sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#0f172a]">
              Salary Negotiation Coach
            </h3>
            <p className="mt-1 text-sm text-[#64748b]">
              Paste your offer. Get a word-for-word script.
            </p>
          </div>
          <PremiumLockedButtonWrap isPremium={isPremium}>
            <button
              type="button"
              onClick={() => setSalaryCoachOpen(true)}
              className="applyfy-btn-primary inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-4px_rgba(124,58,237,0.4)] transition-all duration-200 hover:brightness-[1.06]"
            >
              Open Salary Coach
            </button>
          </PremiumLockedButtonWrap>
        </div>
      </div>

      <SalaryNegotiationCoachModal
        open={salaryCoachOpen}
        onClose={() => setSalaryCoachOpen(false)}
      />

      {moreError ? (
        <p className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
          {moreError}
        </p>
      ) : null}

      {introDisplay ? (
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-[#c4b5fd]/60 bg-gradient-to-br from-[#ede9fe] via-[#f5f3ff] to-white p-6 shadow-[0_12px_40px_-12px_rgba(124,58,237,0.15)] ring-1 ring-white/80 sm:p-7">
          <button
            type="button"
            onClick={() => void copyPlainText(introDisplay)}
            className="absolute right-4 top-4 text-xs font-medium text-[#7c3aed] transition-colors hover:underline"
          >
            Copy
          </button>
          <h3 className="mb-3 flex items-center gap-2 pr-16 text-sm font-bold text-[#7c3aed]">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            30-second intro
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#0f172a]">
            {introDisplay}
          </p>
        </div>
      ) : null}

      {/* ── Behavioral questions ───────────────────────────────────────── */}
      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#0f172a]">
            Behavioral questions
          </h3>
          <PremiumLockedButtonWrap isPremium={isPremium}>
            <button
              type="button"
              disabled={loadingBehavioral || !isPremium}
              onClick={() => void generateMore("behavioral")}
              title={
                isPremium
                  ? "Adds 3 more behavioral questions tailored to this role"
                  : undefined
              }
              className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                isPremium
                  ? "border-[#c4b5fd] bg-[#faf8ff] text-[#6d28d9] hover:border-[#7c3aed] hover:bg-[#7c3aed] hover:text-white disabled:opacity-50"
                  : "border-[#c4b5fd] bg-[#faf8ff] text-[#6d28d9]"
              }`}
            >
              {loadingBehavioral ? "Generating…" : "Generate more related questions"}
            </button>
          </PremiumLockedButtonWrap>
        </div>
        <p className="mb-4 text-xs text-[#94a3b8]">
          {isPremium
            ? "Adds 3 more behavioral questions for this job (uses your resume and job description)."
            : isPro
              ? "Premium adds unlimited batches of related questions for this job."
              : "Free plan includes 3 questions. Upgrade for unlimited questions, tips, and more."}
        </p>
        <div className="space-y-5">
          {behavioralAll.map((item, i) =>
            renderQuestionBlock(item, i, "b", i, i < prep.behavioral.length),
          )}
        </div>
      </div>

      {/* ── Technical questions ─────────────────────────────────────── */}
      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#0f172a]">
            Technical questions
          </h3>
          <PremiumLockedButtonWrap isPremium={isPremium}>
            <button
              type="button"
              disabled={loadingTechnical || !isPremium}
              onClick={() => void generateMore("technical")}
              title={
                isPremium
                  ? "Adds 3 more technical questions tailored to this role"
                  : undefined
              }
              className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                isPremium
                  ? "border-[#c4b5fd] bg-[#faf8ff] text-[#6d28d9] hover:border-[#7c3aed] hover:bg-[#7c3aed] hover:text-white disabled:opacity-50"
                  : "border-[#c4b5fd] bg-[#faf8ff] text-[#6d28d9]"
              }`}
            >
              {loadingTechnical ? "Generating…" : "Generate more related questions"}
            </button>
          </PremiumLockedButtonWrap>
        </div>
        <p className="mb-4 text-xs text-[#94a3b8]">
          {isPremium
            ? "Adds 3 more technical questions for this job."
            : isPro
              ? "Premium unlocks generating more technical questions."
              : null}
        </p>
        <div className="space-y-5">
          {technicalAll.map((item, i) =>
            renderQuestionBlock(
              item,
              i,
              "t",
              behavioralAll.length + i,
              i < prep.technical.length,
            ),
          )}
        </div>
      </div>

      {/* ── STAR stories ───────────────────────────────────────────────── */}
      {prep.starStories.length > 0 ? (
        <div className="mb-8 border-t border-[#f1f5f9] pt-8">
          <h3 className="mb-3 text-base font-bold text-[#0f172a]">
            STAR stories
          </h3>
          <div className="space-y-4">
            {(() => {
              const bestQuestions = assignBestQuestionsForStories(prep.starStories.slice(0, 4), behavioralAll);
              return prep.starStories.slice(0, 4).map((story, i) => {
              const bestQ = bestQuestions[i] ?? "a behavioral question about your experience";
              return (
                <StarStoryCollapsible
                  key={`ss-${i}-${story.title}`}
                  story={story}
                  bestQ={bestQ}
                />
              );
            });
            })()}
          </div>
        </div>
      ) : null}

      {/* ── Risk areas ─────────────────────────────────────────────────── */}
      {prep.redFlags.length > 0 ? (
        <div className="mb-8 border-t border-[#f1f5f9] pt-8">
          <h3 className="mb-1 text-base font-bold text-[#0f172a]">
            Risk areas / red flags
          </h3>
          <p className="mb-4 text-[12px] italic text-[#94a3b8]">
            These exact keyword phrases are not on your resume yet — add them
            only if the experience described below is accurate.
          </p>
          <ul className="space-y-4">
            {prep.redFlags.map((r, i) => (
              <li
                key={`ra-${i}-${r.issue.slice(0, 20)}`}
                className="rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-4 text-sm"
              >
                <p className="font-semibold text-[#0f172a]">{r.issue}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
                  {r.howToFrame}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Interview Simulator (moved to bottom) ──────────────────────── */}
      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        <InterviewSimulator questions={behavioralAll} isPremium={isPremium} />
      </div>

      {/* ── Follow-up Email (moved to bottom) ─────────────────────────── */}
      <div className="border-t border-[#f1f5f9] pt-8">
        <FollowUpEmailGenerator />
      </div>
    </section>
  );
}
