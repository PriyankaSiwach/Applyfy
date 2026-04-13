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

/** Parse the three-part em-dash format: "skill — experience — relevance" */
function parseStrength(s: string): {
  skill: string;
  experience: string;
  relevance: string;
} {
  const parts = s.split(/\s*[—–]\s*/);
  return {
    skill: parts[0]?.trim() || "",
    experience: parts[1]?.trim() || s.trim(),
    relevance: parts[2]?.trim() || "",
  };
}

function exp(strengths: string[], i: number, fallback: string): string {
  const s = strengths[i];
  if (!s) return fallback;
  return parseStrength(s).experience || fallback;
}

function rel(strengths: string[], i: number, fallback: string): string {
  const s = strengths[i];
  if (!s) return fallback;
  return parseStrength(s).relevance || fallback;
}

function skillName(strengths: string[], i: number, fallback: string): string {
  const s = strengths[i];
  if (!s) return fallback;
  return parseStrength(s).skill || fallback;
}

/**
 * Returns true when the experience string is concrete enough to build a STAR answer from.
 * A segment like "Built Memory Map, a real-time mapping app" is specific (8+ words with context).
 * A segment like "has relevant experience" is too vague.
 */
function isSpecific(e: string): boolean {
  const words = e.trim().split(/\s+/).filter(Boolean);
  return words.length >= 7;
}

/**
 * Normalize the experience segment so it reads grammatically as the opening of a sentence.
 * "Built Memory Map…" → "I built Memory Map…"
 * "Led the Satellite Telemetry Platform…" → "I led the Satellite Telemetry Platform…"
 * "Developed a…" → "I developed a…"
 */
function toFirstPerson(e: string): string {
  // If it starts with a past-tense verb (common LLM output), prepend "I"
  if (/^[A-Z][a-z]+(ed|t)\b/.test(e.trim())) {
    return `I ${e.charAt(0).toLowerCase()}${e.slice(1)}`;
  }
  // If it starts with "Was" / "Worked" / "Managed" etc.
  if (/^(Was |Were |Worked |Managed |Served |Acted |Helped )/.test(e.trim())) {
    return `I ${e.charAt(0).toLowerCase()}${e.slice(1)}`;
  }
  return e;
}

const PREPARE_NOTE =
  "You may want to prepare a personal example for this question — nothing in your resume maps clearly to this scenario. Think of a specific moment: name the project or team, describe what you did, and walk through the result.";

function buildThirtySecondIntro(matchedStrengths: string[]): {
  intro?: string;
  introPitch: string;
} {
  const e0 = exp(matchedStrengths, 0, "");
  const e1 = exp(matchedStrengths, 1, "");
  const r0 = rel(matchedStrengths, 0, "");
  const sk0 = skillName(matchedStrengths, 0, "my background");

  const sentences = [
    "Hi — thanks for taking the time today.",
    e0
      ? `My background is in ${sk0.toLowerCase()}, and most recently ${e0}.`
      : "I bring a mix of technical depth and cross-functional delivery experience.",
    e1 ? `I've also had strong results with ${e1}.` : null,
    r0
      ? `I'm particularly drawn to this role because ${r0}.`
      : "I'm excited about how my experience directly maps to what this team is working on.",
    "I'd love to walk you through a few specific examples of how I'd add value here.",
  ].filter(Boolean) as string[];

  const pitch = sentences.join(" ");
  return { intro: pitch, introPitch: pitch };
}

function behavioralSet(
  strengths: string[],
  _wins: string[],
  gaps: GapInsight[],
): PredictedQuestion[] {
  const g = gaps;
  const cards: Omit<PredictedQuestion, "kind">[] = [
    {
      question:
        "Tell me about a time you drove a meaningful outcome end-to-end.",
      context:
        "They want proof you own problems, coordinate others, and finish — not just tasks you touched.",
      fullAnswer: (() => {
        const e = exp(strengths, 0, "");
        const r = rel(strengths, 0, "");
        const sk = skillName(strengths, 0, "");
        if (!isSpecific(e)) return PREPARE_NOTE;
        const fp = toFirstPerson(e);
        const relLine = r
          ? ` What this experience demonstrated is that ${r.replace(/^(this )?(directly )?(aligns?|matches?|connects?) with /i, "")}.`
          : "";
        return (
          `Situation: ${fp}. ` +
          `Task: My responsibility was to own the full delivery — from deciding what "done" looked like all the way through to shipping something working${sk ? ` using ${sk}` : ""}. ` +
          `Action: I drove the key decisions myself — scope, architecture, and the tradeoffs when things got complicated. I coordinated with anyone who had a dependency and kept moving. ` +
          `Result and learning: The work shipped and I can walk you through the specifics.${relLine} What I carry from that: end-to-end ownership means you can't delegate the hard calls. That's the standard I hold myself to.`
        );
      })(),
      tip: "Lead with outcome, then one obstacle, then what you learned.",
    },
    {
      question: "Describe a conflict or disagreement you navigated on a team.",
      context:
        "They're testing judgment, empathy, and whether you can disagree without derailing delivery.",
      fullAnswer: (() => {
        const e = exp(strengths, 1, "");
        const sk = skillName(strengths, 1, "");
        if (!isSpecific(e)) return PREPARE_NOTE;
        const fp = toFirstPerson(e);
        return (
          `Situation: ${fp}. During that work${sk ? ` on ${sk}` : ""}, there was a real disagreement with a colleague about how to approach a core part of the problem — we had different assumptions about what the right tradeoff was. ` +
          `Task: I needed to resolve it without letting it stall the project or damage the working relationship. ` +
          `Action: I asked for a focused one-on-one where we each walked through our reasoning without interruption. What I found was we were both right about different parts — and the hybrid approach we landed on was stronger than either original idea. ` +
          `Result and learning: The project moved forward, and that experience solidified my default stance in disagreements: go in curious, not combative. Separate the idea from the person defending it.`
        );
      })(),
      tip: "Never blame — show the system and your part in fixing it.",
    },
    {
      question:
        "When priorities shifted suddenly, how did you reprioritize and communicate?",
      context:
        "Role chaos is common; they want structured thinking and stakeholder alignment.",
      fullAnswer: (() => {
        const e = exp(strengths, 2, "");
        const r = rel(strengths, 2, "");
        if (!isSpecific(e)) return PREPARE_NOTE;
        const fp = toFirstPerson(e);
        const relLine = r
          ? ` ${r.charAt(0).toUpperCase()}${r.slice(1)}.`
          : "";
        return (
          `Situation: ${fp}. Mid-way through that work, a key dependency changed and the original plan was no longer viable. ` +
          `Task: I had to figure out what was still critical versus what could be deferred — and I had to do it quickly without losing stakeholder trust. ` +
          `Action: I mapped impact vs. urgency in about 30 minutes, identified what protected the core deliverable, and communicated the updated plan proactively — before anyone came looking for answers. I gave honest timelines, not optimistic ones. ` +
          `Result and learning: We shipped the core deliverable on time.${relLine} What I learned: in moments of disruption the thing that preserves trust most is getting ahead of the news rather than reacting to it.`
        );
      })(),
      tip: "Name the framework you used — impact vs. urgency, risk-based triage, etc.",
    },
    {
      question:
        "Give an example of feedback you received and how you acted on it.",
      context:
        "Growth mindset signal — can you receive critique and convert it to behavior change?",
      fullAnswer: (() => {
        const sk = skillName(strengths, 3, "");
        const e = exp(strengths, 3, "");
        const gFix = g[1]?.fix ?? "";
        if (!isSpecific(e) && !sk) return PREPARE_NOTE;
        const context = isSpecific(e) ? toFirstPerson(e) : `my work in ${sk}`;
        const gLine = gFix
          ? ` ${gFix.charAt(0).toUpperCase()}${gFix.slice(1)}.`
          : "";
        return (
          `Situation: While ${context}, I received feedback from someone I respected that while my technical output was solid, I wasn't making my reasoning visible enough to the broader team — people couldn't follow the tradeoffs I was making. ` +
          `Task: I needed to change that behavior so my decisions carried more weight and the team could build on my work rather than just accept it. ` +
          `Action: I started documenting decision rationale, presenting alternatives before starting work rather than after, and asking for input earlier.${gLine} ` +
          `Result and learning: Over the months that followed my proposals gained traction faster. I now seek out that kind of feedback proactively because it's the clearest signal about what to improve next.`
        );
      })(),
      tip: "End with a metric or peer quote if you have one.",
    },
  ];
  return cards.map((x) => ({ ...x, kind: "behavioral" as const }));
}

function technicalSet(
  strengths: string[],
  _wins: string[],
  gaps: GapInsight[],
): PredictedQuestion[] {
  const g = gaps;
  const cards: Omit<PredictedQuestion, "kind">[] = [
    {
      question:
        "Walk me through how you'd debug a production issue affecting users.",
      context:
        "They want a calm method: reproduce, isolate, mitigate, fix, postmortem.",
      fullAnswer: (() => {
        const e = exp(strengths, 0, "");
        const r = rel(strengths, 0, "");
        const sk = skillName(strengths, 0, "");
        if (!isSpecific(e) && !sk) return PREPARE_NOTE;
        const context = isSpecific(e) ? toFirstPerson(e) : `my work with ${sk}`;
        const relLine = r ? ` ${r.charAt(0).toUpperCase()}${r.slice(1)}.` : "";
        return (
          `Situation: ${context}. That project involved real production concerns — uptime, data correctness, user-facing behavior that had to be right. ` +
          `Task: When something breaks in production, my job is to restore stability fast and learn from it so it doesn't repeat. ` +
          `Action: My debugging sequence is: (1) reproduce in a controlled context, (2) isolate the layer where state diverges from expectation using logs and metrics, (3) mitigate impact first — feature flag, rollback, or redirect — then fix properly, (4) communicate honest ETAs to stakeholders throughout. I invest in observability upfront so I have the data I need when an incident hits. ` +
          `Result and learning:${relLine} After each incident I run a brief postmortem: what broke, why monitoring didn't catch it sooner, and what goes in the runbook. The goal is to make each incident the last of its class.`
        );
      })(),
      tip: "Draw a timeline: detect → triage → mitigate → fix → learn.",
    },
    {
      question:
        "How do you approach designing or evolving a system for scale or reliability?",
      context:
        "Tests tradeoffs, constraints, and whether you think past the happy path.",
      fullAnswer: (() => {
        const e = exp(strengths, 1, "");
        const r = rel(strengths, 1, "");
        const sk = skillName(strengths, 1, "");
        const gFix = g[2]?.fix ?? "";
        if (!isSpecific(e) && !sk) return PREPARE_NOTE;
        const fp = isSpecific(e) ? toFirstPerson(e) : `my work with ${sk}`;
        const relLine = r ? ` ${r.charAt(0).toUpperCase()}${r.slice(1)}.` : "";
        const gLine = gFix ? ` I also think it's critical to ${gFix.toLowerCase().replace(/\.$/, "")} — you can't make a good tradeoff if you haven't named what you're giving up.` : "";
        return (
          `Situation: ${fp}. That system had real scale and reliability requirements I had to think through from the start — not bolt on later. ` +
          `Task: I needed to design something that handled the actual load and failed gracefully when dependencies went down, not just worked on the happy path. ` +
          `Action: I start with constraints rather than solutions — what's the traffic pattern, where are the natural failure points, how does the system degrade gracefully. I pay particular attention to where data flows create contention and whether components have clean enough boundaries to scale independently.${gLine} ` +
          `Result and learning:${relLine} The system held up. What I carry from that: every design is a set of bets about the future. Name the bets explicitly so you can revisit them when requirements change.`
        );
      })(),
      tip: "Name one thing you'd measure before and after a change.",
    },
    {
      question:
        "Tell me about a technical decision you'd revisit with hindsight.",
      context:
        "Judgment under uncertainty — no perfect answer, but clear reasoning matters.",
      fullAnswer: (() => {
        const e = exp(strengths, 2, "");
        const sk = skillName(strengths, 2, "");
        if (!isSpecific(e) && !sk) return PREPARE_NOTE;
        const fp = isSpecific(e) ? toFirstPerson(e) : `my work with ${sk}`;
        const skLine = sk ? ` I made a call about how to structure the ${sk} layer` : " I made a core architectural call";
        return (
          `Situation: ${fp}.${skLine} that made sense given what I knew at the time. ` +
          `Task: In hindsight, I was optimizing for the wrong variable — I underweighted how much the requirements would shift over the following months, and the design became harder to evolve than it needed to be. ` +
          `Action: When I recognized the issue, I documented what we were dealing with, proposed a targeted refactor for the parts that were creating the most friction, and got buy-in to address it incrementally rather than a big rewrite. ` +
          `Result and learning: The original call wasn't wrong given what I knew — but that experience trained me to frame technical decisions as "here's the assumption we're making" rather than "here's the right answer." That framing makes it much easier to revisit them honestly when circumstances change.`
        );
      })(),
      tip: "Show you iterate — seniority is revisiting assumptions, not defending them.",
    },
    {
      question:
        "How do you keep quality high when delivery pressure is intense?",
      context:
        "Balance of speed vs. rigor: reviews, tests, automation, debt paydown.",
      fullAnswer: (() => {
        const e = exp(strengths, 3, "");
        const r = rel(strengths, 3, "");
        const sk = skillName(strengths, 3, "");
        const gFix = g[3]?.fix ?? "";
        if (!isSpecific(e) && !sk) return PREPARE_NOTE;
        const fp = isSpecific(e) ? toFirstPerson(e) : `my work with ${sk}`;
        const relLine = r ? ` ${r.charAt(0).toUpperCase()}${r.slice(1)}.` : "";
        const gLine = gFix ? ` ${gFix.charAt(0).toUpperCase()}${gFix.slice(1)}.` : "";
        return (
          `Situation: ${fp}. That project had real delivery pressure — timelines were tight and cutting corners was tempting. ` +
          `Task: I needed to ship on time without creating a mess that would slow the team down for the next six months. ` +
          `Action: The first thing I protect when pressure is high is the definition of done — without a shared, concrete bar, every shortcut looks justified. I introduced a lightweight risk-based test checklist focused on critical paths, and I named debt explicitly when we took it: "we're shipping this knowing X needs work — here's the ticket." That kept the team aligned on what we were accepting and why.${gLine} ` +
          `Result and learning:${relLine} We shipped on time and the codebase was still navigable afterward. The key is conscious tradeoffs, not accidental ones.`
        );
      })(),
      tip: "Give one example where you said 'no' or narrowed scope to protect quality.",
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
    S: exp(strengths, i, "Situation: set team/company context and stakes."),
    T: "Task: the goal, deadline, or success criteria you were given.",
    A: "Action: what you personally did — tools, decisions, collaboration.",
    R: "Result: outcome with metrics, scope, or feedback — be specific.",
  }));
}

function riskBlock(gaps: GapInsight[]): InterviewRiskArea[] {
  return gaps.slice(0, 4).map((g) => ({
    issue: `Gap vs posting: ${g.skill}`,
    howToFrame: `Acknowledge briefly, then pivot: ${g.fix}`,
  }));
}

/** Interview prep when analyze omits a dedicated interview block — uses analysis fields only. */
export function stubInterviewPrepFromAnalysisContext(
  _quickWins: string[],
  matchedStrengths: string[],
  resumeGaps: GapInsight[],
): InterviewPrep {
  const strengths = matchedStrengths.filter(Boolean);
  const gaps =
    resumeGaps.length > 0
      ? resumeGaps
      : [{ skill: "Role fit", reality: "", fix: "Show transferable proof." }];
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
