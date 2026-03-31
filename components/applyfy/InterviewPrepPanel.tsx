"use client";

import type { InterviewPrep } from "@/lib/analysisTypes";
import { interviewPrepPlainText } from "@/lib/interviewPrepPlainText";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

export function InterviewPrepPanel({ prep }: { prep: InterviewPrep }) {
  const { copyPlainText } = useApplyfy();

  return (
    <section className="rounded-xl border border-slate-200/90 bg-card p-6 shadow-md sm:p-8">
      <div className="mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-left">
          Interview prep
        </h1>
        <button
          type="button"
          onClick={() => void copyPlainText(interviewPrepPlainText(prep))}
          className="shrink-0 rounded-lg border border-slate-300 bg-card px-4 py-2 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
        >
          Copy all
        </button>
      </div>
      <p className="mb-6 text-sm text-gray-600 sm:text-left">
        Tailored answers for this role. Edit and practice out loud in your own voice.
      </p>

      {prep.introPitch ? (
        <div className="mb-10">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">30-second intro</h2>
            <button
              type="button"
              onClick={() => void copyPlainText(prep.introPitch)}
              className="text-xs font-semibold text-accent transition-colors hover:text-primary-hover"
            >
              Copy
            </button>
          </div>
          <p className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800">
            {prep.introPitch}
          </p>
        </div>
      ) : null}

      <div className="mb-8 border-t border-slate-100 pt-8">
        <h2 className="mb-3 text-base font-bold text-slate-900">
          Behavioral questions
        </h2>
        <div className="space-y-5">
          {prep.behavioral.slice(0, 4).map((item, i) => (
            <article
              key={`b-${i}-${item.question.slice(0, 24)}`}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-5"
            >
              <p className="text-sm font-bold text-slate-900">
                {i + 1}. {item.question}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Why they ask this: {item.context}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {item.fullAnswer}
              </p>
              <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                Tip: {item.tip}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mb-8 border-t border-slate-100 pt-8">
        <h2 className="mb-3 text-base font-bold text-slate-900">
          Technical questions
        </h2>
        <div className="space-y-5">
          {prep.technical.slice(0, 4).map((item, i) => (
            <article
              key={`t-${i}-${item.question.slice(0, 24)}`}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-5"
            >
              <p className="text-sm font-bold text-slate-900">
                {i + 1}. {item.question}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Why they ask this: {item.context}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {item.fullAnswer}
              </p>
              <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                Tip: {item.tip}
              </div>
            </article>
          ))}
        </div>
      </div>

      {prep.starStories.length > 0 ? (
        <div className="mb-8 border-t border-slate-100 pt-8">
          <h2 className="mb-3 text-base font-bold text-slate-900">
            STAR stories
          </h2>
          <div className="space-y-4">
            {prep.starStories.slice(0, 2).map((story, i) => (
              <article
                key={`ss-${i}-${story.title}`}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-800"
              >
                <p className="font-bold text-slate-900">{story.title}</p>
                <p className="mt-2"><span className="font-semibold">S:</span> {story.S}</p>
                <p className="mt-2"><span className="font-semibold">T:</span> {story.T}</p>
                <p className="mt-2"><span className="font-semibold">A:</span> {story.A}</p>
                <p className="mt-2"><span className="font-semibold">R:</span> {story.R}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {prep.redFlags.length > 0 ? (
        <div className="border-t border-slate-100 pt-8">
          <h2 className="mb-3 text-base font-bold text-slate-900">
            Risk areas / red flags
          </h2>
          <ul className="space-y-4">
            {prep.redFlags.map((r, i) => (
              <li
                key={`ra-${i}`}
                className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm"
              >
                <p className="font-semibold text-slate-900">{r.gap}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  {r.script}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
