import type {
  GapInsight,
  InterviewPrep,
  InterviewRiskArea,
  PredictedQuestion,
  StarStory,
} from "@/lib/analysisTypes";

function take<T>(arr: T[], i: number, fallback: T): T {
  return arr[i] ?? fallback;
}

function gapLine(gaps: GapInsight[], i: number, fallback: string): string {
  const g = gaps[i];
  if (!g) return fallback;
  const r = g.reality.trim();
  return r ? `${g.skill} — ${r} ${g.fix}` : `${g.skill}: ${g.fix}`;
}

function buildThirtySecondIntro(matchedStrengths: string[]): {
  intro?: string;
  introPitch: string;
} {
  const a = take(matchedStrengths, 0, "");
  const b = take(matchedStrengths, 1, "");
  const c = take(matchedStrengths, 2, "");
  const pitch = [
    "Hi — thanks for the time today.",
    a && `In one line, my background: ${a}`,
    b && `A recent example that fits this role: ${b}`,
    c && `What I'm looking for next: ${c}`,
    "I'm excited to dig into how I'd add value on your team.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    intro: pitch,
    introPitch: pitch,
  };
}

function behavioralSet(
  strengths: string[],
  wins: string[],
  gaps: GapInsight[],
): PredictedQuestion[] {
  const s = strengths;
  const g = gaps;
  const cards: Omit<PredictedQuestion, "kind">[] = [
    {
      question:
        "Tell me about a time you drove a meaningful outcome end-to-end.",
      context:
        "They want proof you own problems, coordinate others, and finish—not just tasks you touched.",
      fullAnswer: `${take(s, 0, "Pick one shipped project.")} Tie it to scope, stakeholders, and the measurable result. ${take(wins, 0, "")} If relevant, note how you handled ambiguity or tradeoffs.`,
      tip: "Lead with outcome, then one obstacle, then what you learned.",
    },
    {
      question: "Describe a conflict or disagreement you navigated on a team.",
      context:
        "They’re testing judgment, empathy, and whether you can disagree without derailing delivery.",
      fullAnswer: `Ground the story in ${take(s, 1, "a real team setting")}. Explain the tension, your role, and the resolution. ${gapLine(g, 0, "If a posting gap applies, show how you addressed it constructively.")}`,
      tip: "Never blame—show the system and your part in fixing it.",
    },
    {
      question:
        "When priorities shifted suddenly, how did you reprioritize and communicate?",
      context:
        "Role chaos is common; they want structured thinking and stakeholder alignment.",
      fullAnswer: `Use ${take(s, 2, "an example")} with a before/after priority list, who you informed, and what slipped or stayed. ${take(wins, 1, "")}`,
      tip: "Name the framework you used (impact vs. urgency, risk, etc.).",
    },
    {
      question:
        "Give an example of feedback you received and how you acted on it.",
      context:
        "Growth mindset signal—can you receive critique and convert it to behavior change?",
      fullAnswer: `Reference ${take(s, 3, "a skill you improved")}. Describe the feedback, your plan, and evidence of improvement. ${gapLine(g, 1, "Connect to a gap area you’re actively closing.")}`,
      tip: "End with a metric or peer quote if you have one.",
    },
  ];
  return cards.map((x) => ({ ...x, kind: "behavioral" as const }));
}

function technicalSet(
  strengths: string[],
  wins: string[],
  gaps: GapInsight[],
): PredictedQuestion[] {
  const s = strengths;
  const g = gaps;
  const cards: Omit<PredictedQuestion, "kind">[] = [
    {
      question:
        "Walk me through how you’d debug a production issue affecting users.",
      context:
        "They want a calm method: reproduce, isolate, mitigate, fix, postmortem.",
      fullAnswer: `Anchor in ${take(s, 0, "your stack")}: observability, logs, rollbacks, feature flags. ${take(wins, 2, "")} Mention how you communicate ETA to stakeholders.`,
      tip: "Draw a simple timeline: detect → triage → fix → verify → learn.",
    },
    {
      question:
        "How do you approach designing or evolving a system for scale or reliability?",
      context:
        "Tests tradeoffs, constraints, and whether you think past the happy path.",
      fullAnswer: `Tie to ${take(s, 1, "a system you influenced")}: bottlenecks, monitoring, failure modes, and testing. ${gapLine(g, 2, "Address a gap area with a concrete mitigation.")}`,
      tip: "Name one thing you’d measure before and after a change.",
    },
    {
      question:
        "Tell me about a technical decision you’d revisit with hindsight.",
      context:
        "Judgment under uncertainty—no perfect answer, but clear reasoning matters.",
      fullAnswer: `Pick ${take(s, 2, "a real fork in the road")}. What you chose, why, what broke, what you’d do now. ${take(wins, 0, "")}`,
      tip: "Show you iterate—seniority is revisiting assumptions.",
    },
    {
      question:
        "How do you keep quality high when delivery pressure is intense?",
      context:
        "Balance of speed vs. rigor: reviews, tests, automation, debt paydown.",
      fullAnswer: `Use ${take(s, 3, "your delivery context")}: concrete practices (CI, checklists, risk-based testing). ${gapLine(g, 3, "Link to a gap and how you’d still ship safely.")}`,
      tip: "Give one example where you said “no” or narrowed scope to protect quality.",
    },
  ];
  return cards.map((x) => ({ ...x, kind: "technical" as const }));
}

function starBlock(strengths: string[]): StarStory[] {
  const titles = [
    "Impact under constraint",
    "Cross-functional delivery",
    "Learning something new fast",
    "Handling a setback",
  ];
  return titles.map((title, i) => ({
    title,
    S: take(strengths, i, "Situation: set team/company context and stakes."),
    T: "Task: the goal, deadline, or success criteria you were given.",
    A: "Action: what you personally did (tools, decisions, collaboration).",
    R: "Result: outcome with metrics, scope, or feedback—be specific.",
  }));
}

function riskBlock(gaps: GapInsight[]): InterviewRiskArea[] {
  return gaps.slice(0, 4).map((g) => ({
    issue: `Gap vs posting: ${g.skill}`,
    howToFrame: `Acknowledge briefly, then pivot: ${g.fix} Tie to proof from your resume where possible.`,
  }));
}

/** Interview prep when analyze omits a dedicated interview block—uses analysis fields only (not quick wins as intro). */
export function stubInterviewPrepFromAnalysisContext(
  _quickWins: string[],
  matchedStrengths: string[],
  resumeGaps: GapInsight[],
): InterviewPrep {
  const strengths = matchedStrengths.filter(Boolean);
  const gaps = resumeGaps.length > 0 ? resumeGaps : [{ skill: "Role fit", reality: "", fix: "Show transferable proof." }];
  const wins = _quickWins.filter(Boolean);

  const behavioral = behavioralSet(strengths, wins, gaps);
  const technical = technicalSet(strengths, wins, gaps);
  const predictedQuestions = [...behavioral, ...technical];
  const { intro, introPitch } = buildThirtySecondIntro(strengths);

  return {
    intro,
    introPitch,
    behavioral,
    technical,
    redFlags: riskBlock(gaps),
    starStories: starBlock(strengths),
    likelyQuestions: predictedQuestions.map((q) => q.question),
    keyStories: [],
    riskAreas: [],
    predictedQuestions,
  };
}
