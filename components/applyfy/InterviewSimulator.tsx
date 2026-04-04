"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PredictedQuestion } from "@/lib/analysisTypes";
import type { InterviewSimulatorScoreResult } from "@/lib/interviewSimulatorScore";
import { ScoreArcOutOfTen } from "@/components/applyfy/ScoreArc";

type Step = 1 | 2 | 3;

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function barToneClass(score: number): string {
  if (score < 5) return "bg-red-500";
  if (score <= 7) return "bg-amber-500";
  return "bg-emerald-500";
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
          className="h-2.5 w-2.5 rounded-full bg-[#1a56db] [animation:sim-dot_1.2s_ease-in-out_infinite]"
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

export function InterviewSimulator({
  questions,
}: {
  questions: PredictedQuestion[];
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

  const current = questions[qIndex];

  const resetForQuestion = useCallback((idx: number) => {
    setQIndex(idx);
    setStep(1);
    setAnswer("");
    setResult(null);
    setError(null);
  }, []);

  const submitScore = useCallback(async () => {
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
    } catch {
      setError("Could not score answer — try again.");
    } finally {
      setLoading(false);
    }
  }, [current, answer]);

  const headerProgress = useMemo(() => {
    if (total < 1) return null;
    return (
      <p className="mb-4 text-center text-sm font-medium text-[#64748b]">
        Question {qIndex + 1} of {total}
      </p>
    );
  }, [qIndex, total]);

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
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-center text-xl font-bold text-[#0f172a]">
        Interview Simulator
      </h3>
      <p className="mt-1 text-center text-sm text-[#64748b]">
        Practice answers — scored on clarity, specificity, and STAR.
      </p>

      {headerProgress}

      {step === 1 && current ? (
        <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-[#fafafa] p-6">
          <p className="text-[20px] font-bold leading-snug text-[#0f172a]">
            {current.question}
          </p>
          <p className="mt-4 text-[15px] italic leading-relaxed text-[#64748b]">
            Why they ask this: {current.context}
          </p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-8 w-full rounded-xl bg-[#1a56db] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] sm:w-auto"
          >
            Start answering
          </button>
        </div>
      ) : null}

      {step === 2 && current && !loading ? (
        <div className="mt-6">
          <div className="relative rounded-xl border border-[#e2e8f0] bg-white p-1 focus-within:border-[#1a56db] focus-within:ring-2 focus-within:ring-[#1a56db]/15">
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
          <button
            type="button"
            disabled={!answer.trim()}
            onClick={() => void submitScore()}
            className="mt-5 w-full rounded-xl bg-[#1a56db] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Submit for scoring
          </button>
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

          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-sm text-[#0f172a]">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
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
            <button
              type="button"
              onClick={() => {
                const next = (qIndex + 1) % total;
                resetForQuestion(next);
              }}
              className="rounded-xl bg-[#1a56db] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Next question
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
