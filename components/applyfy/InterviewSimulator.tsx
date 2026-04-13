"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PredictedQuestion } from "@/lib/analysisTypes";
import type { InterviewSimulatorScoreResult } from "@/lib/interviewSimulatorScore";
import { ScoreArcOutOfTen } from "@/components/applyfy/ScoreArc";
import { PremiumLockedButtonWrap } from "@/components/subscription/PremiumLockedButtonWrap";

type Step = 1 | 2 | 3;

type HistoryEntry = {
  question: string;
  answer: string;
  score: InterviewSimulatorScoreResult;
};

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function barToneClass(score: number): string {
  if (score < 5) return "bg-red-500";
  if (score <= 7) return "bg-amber-500";
  return "bg-violet-500";
}

function TypingDots() {
  return (
    <div
      className="flex items-center justify-center gap-1.5 py-10"
      role="status"
      aria-label="Scoring"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-[#7c3aed] [animation:sim-dot_1.2s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function DimensionScoreBar({
  label,
  score,
  feedback,
  delayMs,
}: {
  label: string;
  score: number;
  feedback: string;
  delayMs: number;
}) {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setFill(score), 80 + delayMs);
    return () => clearTimeout(t);
  }, [score, delayMs]);

  const pct = (fill / 10) * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#0f172a]">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#0f172a]">
          {score}/10
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f5f9]">
        <div
          className={`h-full rounded-full transition-[width] duration-[800ms] ease-out ${barToneClass(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">{feedback}</p>
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#0f172a]"
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

function overallTone(score: number): string {
  if (score < 5) return "text-red-600";
  if (score <= 7) return "text-amber-600";
  return "text-violet-600";
}

function AnswerHistory({
  history,
  onBack,
}: {
  history: HistoryEntry[];
  onBack: () => void;
}) {
  const allText = history
    .map(
      (h, i) =>
        `Q${i + 1}: ${h.question}\n\nAnswer: ${h.answer}\n\nScore: ${h.score.overall}/10`,
    )
    .join("\n\n---\n\n");

  return (
    <div className="mt-4 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#7c3aed] transition hover:underline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to practice
        </button>
        {history.length > 0 && (
          <CopyButton text={allText} label="Copy all" />
        )}
      </div>

      {history.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#94a3b8]">
          No answers recorded yet — submit an answer to see it here.
        </p>
      ) : (
        <div className="space-y-4">
          {history.map((h, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#e2e8f0] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-bold leading-snug text-[#0f172a]">
                  <span className="mr-1.5 text-[#7c3aed]">Q{i + 1}.</span>
                  {h.question}
                </p>
                <CopyButton
                  text={`Q: ${h.question}\n\nAnswer: ${h.answer}\n\nScore: ${h.score.overall}/10`}
                />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.7] text-[#334155]">
                {h.answer}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#f1f5f9] pt-3 text-[12px] text-[#64748b]">
                <span className={`font-semibold ${overallTone(h.score.overall)}`}>
                  Overall {h.score.overall}/10
                </span>
                <span>Clarity {h.score.clarity.score}/10</span>
                <span>Specificity {h.score.specificity.score}/10</span>
                <span>STAR {h.score.star.score}/10</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InterviewSimulator({
  questions,
  isPremium = true,
}: {
  questions: PredictedQuestion[];
  /** When false, shows the full simulator UI but locks scoring actions for non‑Premium users. */
  isPremium?: boolean;
}) {
  const total = questions.length;
  const [qIndex, setQIndex] = useState(0);
  const [step, setStep] = useState<Step>(1);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewSimulatorScoreResult | null>(
    null,
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Clamp index whenever the questions list shrinks (shouldn't normally happen,
  // but guards against stale state if the parent re-renders with fewer items).
  const safeIndex = Math.min(qIndex, Math.max(0, total - 1));
  const current = questions[safeIndex];
  const isLastQuestion = safeIndex >= total - 1;

  const resetForQuestion = useCallback((idx: number) => {
    setQIndex(idx);
    setStep(1);
    setAnswer("");
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (isPremium) return;
    setStep(1);
    setAnswer("");
    setResult(null);
    setError(null);
    setLoading(false);
    setShowHistory(false);
  }, [isPremium]);

  const submitScore = useCallback(async () => {
    if (!isPremium) return;
    if (!current || !answer.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview-simulator-score", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: current.question,
          answer: answer.trim(),
        }),
      });
      const raw = await res.text();
      let data: { score?: InterviewSimulatorScoreResult; error?: string };
      try {
        data = JSON.parse(raw) as {
          score?: InterviewSimulatorScoreResult;
          error?: string;
        };
      } catch {
        setError("Could not score answer — try again.");
        return;
      }
      if (!res.ok || !data.score) {
        setError(data.error ?? "Could not score answer — try again.");
        return;
      }
      setResult(data.score);
      setStep(3);
      setHistory((prev) => [
        ...prev,
        { question: current.question, answer: answer.trim(), score: data.score! },
      ]);
    } catch {
      setError("Could not score answer — try again.");
    } finally {
      setLoading(false);
    }
  }, [current, answer, isPremium]);

  const headerProgress = useMemo(() => {
    if (total < 1) return null;
    return (
      <p className="mb-4 text-center text-sm font-medium text-[#64748b]">
        Question {safeIndex + 1} of {total}
      </p>
    );
  }, [safeIndex, total]);

  if (total < 1) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 text-center text-sm text-[#64748b]">
        <h3 className="text-lg font-bold text-[#0f172a]">Interview Simulator</h3>
        <p className="mt-2">
          Generate behavioral questions above to practice with AI scoring.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ddd6fe] bg-gradient-to-b from-white to-[#faf8ff] p-6 shadow-[0_16px_48px_-16px_rgba(124,58,237,0.14)] ring-1 ring-[#ede9fe]/80 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-center">
          <h3 className="text-xl font-bold text-[#0f172a]">
            Interview Simulator
          </h3>
          <p className="mt-1 text-sm text-[#64748b]">
            Practice answers — scored on clarity, specificity, and STAR.
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="shrink-0 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#0f172a]"
          >
            {showHistory ? "Back to practice" : `Answers (${history.length})`}
          </button>
        )}
      </div>

      {showHistory ? (
        <AnswerHistory history={history} onBack={() => setShowHistory(false)} />
      ) : (
        <>
      {headerProgress}

      {step === 1 && current ? (
        <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-[#fafafa] p-6">
          <p className="text-[20px] font-bold leading-snug text-[#0f172a]">
            {current.question}
          </p>
          <p className="mt-4 text-[15px] italic leading-relaxed text-[#64748b]">
            Why they ask this: {current.context}
          </p>
          <PremiumLockedButtonWrap isPremium={isPremium} fullWidth className="mt-8">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="applyfy-btn-primary w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:brightness-[1.05] sm:w-auto"
            >
              Start answering
            </button>
          </PremiumLockedButtonWrap>
        </div>
      ) : null}

      {/* Step 2: keep the question visible above the textarea */}
      {step === 2 && current && !loading ? (
        <div className="mt-6">
          <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-[#fafafa] px-5 py-4">
            <p className="text-[17px] font-bold leading-snug text-[#0f172a]">
              {current.question}
            </p>
            <p className="mt-2 text-[13px] italic leading-relaxed text-[#64748b]">
              Why they ask this: {current.context}
            </p>
          </div>
          <div className="relative rounded-xl border border-[#e2e8f0] bg-white p-1 focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/20">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here... aim for 2–3 minutes of speaking time (roughly 300–400 words)"
              rows={10}
              className="box-border min-h-[200px] w-full resize-y rounded-lg border-0 bg-transparent px-4 py-3 pb-8 text-[15px] leading-[1.7] text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              aria-label="Your answer"
            />
            <div className="pointer-events-none absolute bottom-3 right-4 text-xs tabular-nums text-[#94a3b8]">
              {wordCount(answer)} words
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
          <PremiumLockedButtonWrap isPremium={isPremium} fullWidth className="mt-5">
            <button
              type="button"
              disabled={!answer.trim() || !isPremium}
              onClick={() => void submitScore()}
              className="applyfy-btn-primary w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Submit for scoring
            </button>
          </PremiumLockedButtonWrap>
        </div>
      ) : null}

      {loading ? <TypingDots /> : null}

      {step === 3 && result && !loading ? (
        <div className="mt-6 space-y-8">
          <div className="space-y-5">
            <DimensionScoreBar
              label="Clarity"
              score={result.clarity.score}
              feedback={result.clarity.feedback}
              delayMs={0}
            />
            <DimensionScoreBar
              label="Specificity"
              score={result.specificity.score}
              feedback={result.specificity.feedback}
              delayMs={120}
            />
            <DimensionScoreBar
              label="STAR method"
              score={result.star.score}
              feedback={result.star.feedback}
              delayMs={240}
            />
          </div>

          <div className="flex justify-center border-t border-[#f1f5f9] pt-6">
            <ScoreArcOutOfTen score={result.overall} />
          </div>

          <div className="rounded-xl border border-violet-200/80 bg-violet-50/70 px-4 py-3 text-sm text-[#0f172a]">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-800">
              What you did well
            </p>
            <p className="mt-1 leading-relaxed">{result.top_strength}</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-[#0f172a]">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
              Top thing to fix
            </p>
            <p className="mt-1 leading-relaxed">{result.top_fix}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setAnswer("");
                setStep(2);
                setResult(null);
                setError(null);
              }}
              className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#f8fafc]"
            >
              Try again
            </button>
            {isLastQuestion ? (
              <button
                type="button"
                onClick={() => resetForQuestion(0)}
                className="applyfy-btn-primary rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-[1.05]"
              >
                Start over
              </button>
            ) : (
              <button
                type="button"
                onClick={() => resetForQuestion(safeIndex + 1)}
                className="applyfy-btn-primary rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-[1.05]"
              >
                Next question
              </button>
            )}
          </div>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
