"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InterviewPrep, PredictedQuestion } from "@/lib/analysisTypes";
import { interviewPrepPlainText } from "@/lib/interviewPrepPlainText";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { FeatureLock } from "@/components/subscription/FeatureLock";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { FollowUpEmailGenerator } from "@/components/applyfy/FollowUpEmailGenerator";
import { InterviewSimulator } from "@/components/applyfy/InterviewSimulator";
import { InterviewSimulatorTeaser } from "@/components/applyfy/InterviewSimulatorTeaser";
import { SalaryNegotiationCoachModal } from "@/components/applyfy/SalaryNegotiationCoachModal";

export function InterviewPrepPanel({ prep }: { prep: InterviewPrep }) {
  const { isPro, isProPlus } = useSubscription();
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

  const introDisplay = prep.intro ?? prep.introPitch;

  const prepResetKey = useMemo(
    () =>
      `${introDisplay?.slice(0, 48)}|${prep.behavioral.map((q) => q.question).join("¦")}|${prep.technical.map((q) => q.question).join("¦")}`,
    [introDisplay, prep.behavioral, prep.technical],
  );

  useEffect(() => {
    setExtraBehavioral([]);
    setExtraTechnical([]);
    setMoreError(null);
  }, [prepResetKey]);

  const generateMore = useCallback(
    async (kind: "behavioral" | "technical") => {
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
      jobPosting,
      jobLink,
      resume,
      prep.behavioral,
      prep.technical,
      extraBehavioral,
      extraTechnical,
    ],
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
  ) {
    const locked = !isPro && globalIndex >= 3;

    const tipEl = (
      <div className="mt-3 flex gap-2 rounded-lg bg-[#eff6ff] px-3.5 py-2.5 text-[13px] text-[#1a56db]">
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
          <span className="font-medium">Tip:</span> {item.tip}
        </span>
      </div>
    );

    const inner = (
      <article className="rounded-r-xl rounded-l-none border border-[#e2e8f0] border-l-4 border-l-[#1a56db] bg-white py-4 pl-5 pr-5">
        <p className="text-[15px] font-bold leading-snug text-[#0f172a]">
          <span className="text-[#1a56db]">{globalIndex + 1}.</span>{" "}
          {item.question}
        </p>
        <p className="mt-2 text-[13px] italic text-[#64748b]">
          Why they ask this: {item.context}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-[1.7] text-[#0f172a]">
          {item.fullAnswer}
        </p>
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

      <div className="mb-8 rounded-2xl border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#0f172a]">
              Salary Negotiation Coach
            </h3>
            <p className="mt-1 text-sm text-[#64748b]">
              Paste your offer. Get a word-for-word script.
            </p>
            {!isProPlus ? (
              <p className="mt-2 text-xs font-medium text-amber-800/90">
                Pro+ feature — upgrade to generate your script.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSalaryCoachOpen(true)}
            className="inline-flex shrink-0 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            style={{ background: "var(--gradient-hero)" }}
          >
            Open Salary Coach
          </button>
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
        <div className="relative mb-10 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-5">
          <button
            type="button"
            onClick={() => void copyPlainText(introDisplay)}
            className="absolute right-4 top-4 text-xs font-medium text-[#1a56db] transition-colors hover:underline"
          >
            Copy
          </button>
          <h3 className="mb-3 flex items-center gap-2 pr-16 text-sm font-bold text-[#1a56db]">
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

      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#0f172a]">
            Behavioral questions
          </h3>
          {isPro ? (
            <button
              type="button"
              disabled={loadingBehavioral}
              onClick={() => void generateMore("behavioral")}
              className="rounded-lg border border-[#1a56db] bg-transparent px-3 py-2 text-xs font-medium text-[#1a56db] transition-all duration-200 hover:bg-[#1a56db] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingBehavioral
                ? "Generating…"
                : "Generate more related questions"}
            </button>
          ) : null}
        </div>
        <p className="mb-4 text-xs text-[#94a3b8]">
          {isPro
            ? "Adds 3 more behavioral questions for this job (uses your resume and job description)."
            : "Free plan includes 3 questions (behavioral section first). Upgrade for unlimited questions, tips, and more."}
        </p>
        <div className="space-y-5">
          {behavioralAll.map((item, i) =>
            renderQuestionBlock(item, i, "b", i),
          )}
        </div>
      </div>

      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        {isProPlus ? (
          <InterviewSimulator questions={behavioralAll} />
        ) : (
          <InterviewSimulatorTeaser locked />
        )}
      </div>

      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        <FollowUpEmailGenerator />
      </div>

      <div className="mb-8 border-t border-[#f1f5f9] pt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#0f172a]">
            Technical questions
          </h3>
          {isPro ? (
            <button
              type="button"
              disabled={loadingTechnical}
              onClick={() => void generateMore("technical")}
              className="rounded-lg border border-[#1a56db] bg-transparent px-3 py-2 text-xs font-medium text-[#1a56db] transition-all duration-200 hover:bg-[#1a56db] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingTechnical
                ? "Generating…"
                : "Generate more related questions"}
            </button>
          ) : null}
        </div>
        <p className="mb-4 text-xs text-[#94a3b8]">
          {isPro ? "Adds 3 more technical questions for this job." : null}
        </p>
        <div className="space-y-5">
          {technicalAll.map((item, i) =>
            renderQuestionBlock(
              item,
              i,
              "t",
              behavioralAll.length + i,
            ),
          )}
        </div>
      </div>

      {prep.starStories.length > 0 ? (
        <div className="mb-8 border-t border-[#f1f5f9] pt-8">
          <h3 className="mb-3 text-base font-bold text-[#0f172a]">
            STAR stories
          </h3>
          <div className="space-y-4">
            {prep.starStories.slice(0, 4).map((story, i) => (
              <article
                key={`ss-${i}-${story.title}`}
                className="rounded-xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#64748b]"
              >
                <p className="font-bold text-[#0f172a]">{story.title}</p>
                <p className="mt-2">
                  <span className="font-semibold">S:</span> {story.S}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">T:</span> {story.T}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">A:</span> {story.A}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">R:</span> {story.R}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {prep.redFlags.length > 0 ? (
        <div className="border-t border-[#f1f5f9] pt-8">
          <h3 className="mb-3 text-base font-bold text-[#0f172a]">
            Risk areas / red flags
          </h3>
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
    </section>
  );
}
