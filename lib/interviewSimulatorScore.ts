/** Parsed AI scoring result for the interview simulator. */
export type InterviewSimulatorScoreResult = {
  clarity: { score: number; feedback: string };
  specificity: { score: number; feedback: string };
  star: { score: number; feedback: string };
  overall: number;
  top_strength: string;
  top_fix: string;
};
