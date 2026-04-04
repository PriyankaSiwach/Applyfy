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
  const introText = prep.intro ?? prep.introPitch;
  const lines: string[] = [
    "30-second intro",
    introText,
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
      (r, i) =>
        `${i + 1}. Issue: ${r.issue}\n   How to frame: ${r.howToFrame}`,
    ),
  ];
  return lines.join("\n");
}
