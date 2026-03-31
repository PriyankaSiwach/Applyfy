import type { InterviewPrep } from "@/lib/analysisTypes";

/** Read-only interview prep (no context hooks; for tracker modals). */
export function StoredInterviewPrepView({ prep }: { prep: InterviewPrep }) {
  return (
    <div className="max-h-[70vh] space-y-8 overflow-y-auto pr-1 text-left">
      {prep.introPitch ? (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-900">30-second intro</h3>
          <p className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800">
            {prep.introPitch}
          </p>
        </div>
      ) : null}

      <div className="border-t border-slate-100 pt-6">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Behavioral questions</h3>
        <div className="space-y-4">
          {prep.behavioral.slice(0, 4).map((item, i) => (
            <article
              key={`b-${i}-${item.question.slice(0, 24)}`}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
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

      <div className="border-t border-slate-100 pt-6">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Technical questions</h3>
        <div className="space-y-4">
          {prep.technical.slice(0, 4).map((item, i) => (
            <article
              key={`t-${i}-${item.question.slice(0, 24)}`}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
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
        <div className="border-t border-slate-100 pt-6">
          <h3 className="mb-3 text-sm font-bold text-slate-900">STAR stories</h3>
          <div className="space-y-4">
            {prep.starStories.slice(0, 2).map((story, i) => (
              <article
                key={`ss-${i}-${story.title}`}
                className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-800"
              >
                <p className="font-bold text-slate-900">{story.title}</p>
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
    </div>
  );
}
