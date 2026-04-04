export type ResumeEditorQuickFix = {
  /** Short label shown in the checklist */
  summary: string;
  /** Exact or near-exact phrase in the resume to replace (may be empty until API returns structured fixes) */
  target_phrase: string;
  /** Replacement text */
  replacement: string;
};

export type ResumeEditorAtsResult = {
  ats_score: number;
  missing_keywords: string[];
  present_keywords: string[];
  quick_fixes: ResumeEditorQuickFix[];
  score_reasoning: string;
};
