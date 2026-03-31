import type { InterviewPrep } from "@/lib/analysisTypes";

export function interviewPrepPlainText(prep: InterviewPrep): string {
  const behavioral = prep.behavioral.map(
    (q, i) =>
      `${i + 1}. ${q.question}\n   Why they ask this: ${q.context}\n   Answer: ${q.fullAnswer}\n   Tip: ${q.tip}`,
  );
  const technical = prep.technical.map(
    (q, i) =>
      `${i + 1}. ${q.question}\n   Why they ask this: ${q.context}\n   Answer: ${q.fullAnswer}\n   Tip: ${q.tip}`,
  );
  const lines: string[] = [
    "30-second intro",
    prep.introPitch,
    "",
    "Behavioral questions",
    ...behavioral,
    "",
    "Technical questions",
    ...technical,
    "",
    "STAR stories",
    ...prep.starStories.map(
      (s, i) =>
        `${i + 1}. ${s.title}\n   S: ${s.S}\n   T: ${s.T}\n   A: ${s.A}\n   R: ${s.R}`,
    ),
    "",
    "Risk areas / red flags",
    ...prep.redFlags.map(
      (r, i) => `${i + 1}. Gap: ${r.gap}\n   Script: ${r.script}`,
    ),
  ];
  return lines.join("\n");
}
