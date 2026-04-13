"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import { ApplicationStepper } from "@/components/applyfy/ApplicationStepper";
import { CoverLetterPanel } from "@/components/applyfy/CoverLetterPanel";
import { InterviewPrepPanel } from "@/components/applyfy/InterviewPrepPanel";
import { MatchScoreArcAndBreakdown } from "@/components/applyfy/MatchScoreArcAndBreakdown";
import { TrustDataBar } from "@/components/applyfy/TrustDataBar";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import {
  extractJobTitleAndCompany,
  sanitizeCompany,
  sanitizeJobTitle,
} from "@/lib/jobMetaFromPosting";
import type { InterviewPrep } from "@/lib/analysisTypes";
import { resumeFileToPayload } from "@/lib/resumeFileToPayload";
import { MIN_JOB_POSTING_CHARS } from "@/lib/parseAnalyzeBody";
import { upsertTrackerApplication } from "@/lib/trackerStorage";
import { GatedFeature } from "@/components/subscription/GatedFeature";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { AtsScoreHistory } from "@/components/applyfy/AtsScoreHistory";
import { ReadinessChecklist } from "@/components/applyfy/ReadinessChecklist";
import { FollowUpEmailCta } from "@/components/applyfy/FollowUpEmailCta";
import { LiveResumeEditorExperience } from "@/components/applyfy/LiveResumeEditorExperience";
import { StrengthEmDashLine } from "@/components/applyfy/StrengthEmDashLine";
import {
  keywordChipsFromResumeLiteral,
  resumePlainForKeywordMatching,
} from "@/lib/alignedJobKeywords";
import { analysisForMatchDisplay } from "@/lib/matchDisplayAnalysis";

const steps = [
  "Input",
  "Analyze",
  "Match",
  "Resume Editor",
  "Cover letter",
  "Interview prep",
] as const;

// ── Step progress persistence ─────────────────────────────────────────────────
const STEP_STORAGE_KEY = "applyfy-step-v1";
type StepProgress = { currentStep: number; maxUnlocked: number };

function loadStepProgress(): StepProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STEP_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StepProgress;
    if (typeof p.currentStep === "number" && typeof p.maxUnlocked === "number") {
      return {
        currentStep: Math.min(5, Math.max(0, Math.round(p.currentStep))),
        maxUnlocked: Math.min(6, Math.max(1, Math.round(p.maxUnlocked))),
      };
    }
  } catch { /* ignore */ }
  return null;
}

function saveStepProgress(currentStep: number, maxUnlocked: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STEP_STORAGE_KEY, JSON.stringify({ currentStep, maxUnlocked })); } catch { /* ignore */ }
}

function clearStepProgress() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(STEP_STORAGE_KEY); } catch { /* ignore */ }
}

const ANALYZE_STATUS_MESSAGES = [
  "Reading your resume...",
  "Scanning job requirements...",
  "Identifying keyword gaps...",
  "Building your analysis...",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

function Spinner({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-[#64748b]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e2e8f0] border-t-[#7c3aed]" />
      <span>{label}</span>
    </div>
  );
}

function PrimaryNextButton({
  onClick,
  label = "Next",
  disabled = false,
  loading = false,
  variant = "default",
}: {
  onClick: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Input step “Run analysis” — purple base + shimmer on hover */
  variant?: "default" | "runAnalysis";
}) {
  const isBusy = loading;
  const cls =
    variant === "runAnalysis"
      ? "applyfy-btn-primary applyfy-btn-run-analysis"
      : "applyfy-btn-primary bg-[#7c3aed] shadow-[0_2px_10px_rgba(124,58,237,0.35)] hover:bg-[#6d28d9]";
  return (
    <button
      type="button"
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      onClick={() => void onClick()}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {isBusy ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
      {!isBusy ? <span aria-hidden>→</span> : null}
    </button>
  );
}

function StepFooterNav({
  onBack,
  next,
}: {
  onBack: () => void;
  /** Primary action on the right (e.g. Next). Omit on the last step if there is no Next. */
  next?: ReactNode;
}) {
  const backBtn = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-transparent px-6 text-sm font-medium text-[#64748b] transition-all duration-150 hover:bg-[#f8fafc] active:scale-[0.98]"
    >
      <span aria-hidden>←</span>
      Back
    </button>
  );
  if (next == null) {
    return <div className="mt-8 flex justify-start">{backBtn}</div>;
  }
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      {backBtn}
      <div className="flex shrink-0 justify-end">{next}</div>
    </div>
  );
}

export default function MyApplicationPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Context hooks must come before the step useState so their values are
  // available to the lazy initialisers below (which run synchronously on
  // first render, before any useEffect).
  const { isPro, isFree, isProOnly, mounted: tierMounted } = useSubscription();
  const {
    resume,
    setResume,
    jobLink,
    setJobLink,
    jobPosting,
    setJobPosting,
    jobPasteFallback,
    loadingAnalyze,
    analyzeError,
    analysis,
    baselineAnalysis,
    runAnalyze,
    loadingCoverLetter,
    coverLetter,
    coverLetterError,
    resetSession,
    hydrateOriginalResumePlain,
    invalidateAnalysisForNewResume,
    originalResumePlain,
    jobKeywordLabels,
    resumeSourceOfTruth,
    optimizationAppliedAt,
    undoResumeOptimization,
    reanalyzeAfterOptimizeNeeded,
    committedHybridAtsScore,
    jobCompanyHint,
    setJobCompanyHint,
    jobRoleHint,
    setJobRoleHint,
  } = useApplyfy();

  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // SSR-safe defaults: server and client both start with (0, 1) to avoid
  // hydration mismatches.  localStorage is read in a useEffect after mount.
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [maxUnlocked, setMaxUnlocked] = useState(1);
  // Prevents the persist effect from firing with the initial (0,1) defaults
  // before the restore effect has had a chance to load the real saved values.
  const skipFirstPersistRef = useRef(true);

  const [trackerNotice, setTrackerNotice] = useState<string | null>(null);
  const [analyzeStatusIdx, setAnalyzeStatusIdx] = useState(0);
  const [analyzeSlowHint, setAnalyzeSlowHint] = useState(false);
  const [atsProgress, setAtsProgress] = useState(0);
  const [atsCountDisplay, setAtsCountDisplay] = useState(0);
  const [resumeDropHover, setResumeDropHover] = useState(false);
  const resumeDragDepth = useRef(0);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalCompany, setSaveModalCompany] = useState("");
  const [saveModalRole, setSaveModalRole] = useState("");
  const [saveModalError, setSaveModalError] = useState<string | null>(null);

  function goBackOneStep() {
    setCurrentStep((s) => (s > 0 ? ((s - 1) as StepIndex) : s));
  }

  const displayAtsScore = useMemo(() => {
    const raw =
      committedHybridAtsScore !== null
        ? committedHybridAtsScore
        : (baselineAnalysis?.atsScore ?? 0);
    return Math.min(100, Math.max(0, Math.round(raw)));
  }, [committedHybridAtsScore, baselineAnalysis?.atsScore]);

  /** Light pastel multicolor bar; number tint hints low / mid / high without heavy blue. */
  const atsScoreVisual = useMemo(() => {
    const s = displayAtsScore;
    const bar =
      "linear-gradient(90deg, #fecdd3 0%, #fde68a 28%, #ddd6fe 52%, #bbf7d0 100%)";
    if (s < 45) {
      return {
        text: "#be123c",
        icon: "#7c3aed",
        bar,
      };
    }
    if (s < 70) {
      return {
        text: "#5b21b6",
        icon: "#7c3aed",
        bar,
      };
    }
    return {
      text: "#047857",
      icon: "#10b981",
      bar,
    };
  }, [displayAtsScore]);

  const matchDisplayAnalysis = useMemo(() => {
    if (!baselineAnalysis) return null;
    return analysisForMatchDisplay(baselineAnalysis, committedHybridAtsScore);
  }, [baselineAnalysis, committedHybridAtsScore]);

  const stepperLockBadges = useMemo(() => {
    if (!tierMounted) {
      return { locks: [] as StepIndex[], premiumOnly: [] as StepIndex[] };
    }
    if (isFree) {
      return {
        locks: [2, 3, 4, 5] as StepIndex[],
        premiumOnly: [] as StepIndex[],
      };
    }
    if (isProOnly) {
      return {
        locks: [5] as StepIndex[],
        premiumOnly: [5] as StepIndex[],
      };
    }
    return { locks: [] as StepIndex[], premiumOnly: [] as StepIndex[] };
  }, [tierMounted, isFree, isProOnly]);

  const stepperMaxUnlocked = useMemo(
    () => (isFree ? Math.min(maxUnlocked, 2) : maxUnlocked),
    [isFree, maxUnlocked],
  );

  useEffect(() => {
    if (!tierMounted || !isFree) return;
    setCurrentStep((s) => (s > 1 ? 1 : s));
    setMaxUnlocked((m) => Math.min(m, 2));
  }, [tierMounted, isFree]);

  useEffect(() => {
    if (currentStep !== 1 || !baselineAnalysis) {
      setAtsProgress(0);
      return;
    }
    setAtsProgress(0);
    const t = window.setTimeout(() => {
      setAtsProgress(displayAtsScore);
    }, 80);
    return () => clearTimeout(t);
  }, [currentStep, baselineAnalysis, displayAtsScore]);

  useEffect(() => {
    if (currentStep !== 1 || !baselineAnalysis) {
      setAtsCountDisplay(0);
      return;
    }
    const target = displayAtsScore;
    setAtsCountDisplay(0);
    const start = performance.now();
    const duration = 800;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setAtsCountDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentStep, baselineAnalysis, displayAtsScore]);

  const resumeReady = resume.trim().length > 0;

  useEffect(() => {
    if (!resumeReady && currentStep > 0) {
      setCurrentStep(0);
    }
  }, [resumeReady, currentStep]);

  useEffect(() => {
    if (!loadingAnalyze) {
      setAnalyzeStatusIdx(0);
      setAnalyzeSlowHint(false);
      return;
    }
    setAnalyzeStatusIdx(0);
    const interval = setInterval(() => {
      setAnalyzeStatusIdx((i) => (i + 1) % ANALYZE_STATUS_MESSAGES.length);
    }, 3000);
    const slowT = window.setTimeout(() => setAnalyzeSlowHint(true), 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(slowT);
    };
  }, [loadingAnalyze]);

  // RESTORE: runs once on mount (after hydration) — declared first so React
  // runs it before the persist effect in the same flush.
  useEffect(() => {
    const saved = loadStepProgress();
    if (saved) {
      setMaxUnlocked(saved.maxUnlocked);
      if (analysis !== null && saved.currentStep > 0) {
        setCurrentStep(saved.currentStep as StepIndex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PERSIST: skip the very first effect run (same flush as restore, closure
  // still holds initial (0,1)); allow all subsequent runs.
  useEffect(() => {
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    saveStepProgress(currentStep, maxUnlocked);
  }, [currentStep, maxUnlocked]);

  async function onFileChange(files: FileList | null) {
    setFileError(null);
    const file = files?.[0];
    if (!file) {
      invalidateAnalysisForNewResume();
      setFileLabel(null);
      setResume("");
      void hydrateOriginalResumePlain("");
      return;
    }
    try {
      invalidateAnalysisForNewResume();
      const payload = await resumeFileToPayload(file);
      setResume(payload);
      setFileLabel(file.name);
      void hydrateOriginalResumePlain(payload);
    } catch {
      invalidateAnalysisForNewResume();
      setFileError("Could not read that file. Try another format.");
      setFileLabel(null);
      setResume("");
      void hydrateOriginalResumePlain("");
    }
  }

  async function handleInputNext() {
    setFileError(null);
    if (!resume.trim()) {
      setFileError("Upload a resume file (.pdf, .docx, .txt, or .md).");
      return;
    }
    const primary = jobLink.trim();
    const secondary = jobPosting.trim();
    const isHttp = /^https?:\/\//i.test(primary);
    if (!primary) {
      setFileError("Add a job URL or paste the job description.");
      return;
    }
    if (jobPasteFallback.active) {
      if (secondary.length < MIN_JOB_POSTING_CHARS) {
        setFileError(
          `Paste the job description below (at least ${MIN_JOB_POSTING_CHARS} characters).`,
        );
        return;
      }
    } else if (!isHttp && primary.length < MIN_JOB_POSTING_CHARS) {
      setFileError(
        `Paste a job URL or at least ${MIN_JOB_POSTING_CHARS} characters of the job description.`,
      );
      return;
    }
    const ok = await runAnalyze();
    if (!ok) return;
    setCurrentStep(1);
    setMaxUnlocked(2);
  }

  function isMetaSuspect(value: string, maxWords: number): boolean {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "Company" || trimmed === "Role") return true;
    if (trimmed.length > 120) return true;
    if (trimmed.split(/\s+/).filter(Boolean).length > maxWords) return true;
    if (/[.,:!?]/.test(trimmed) && trimmed.split(/\s+/).length > 4) return true;
    if (/^(we are|we're|our |the team|join us|looking for|seeking|about the role|you will)/i.test(trimmed)) return true;
    return false;
  }

  function doTrackerSave(company: string, role: string) {
    if (!analysis || !coverLetter || !jobPosting.trim()) return;
    if (!isPro) {
      setTrackerNotice("Upgrade to Pro to save applications to your tracker.");
      return;
    }
    upsertTrackerApplication({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      company: company.trim() || "Company",
      jobTitle: role.trim() || "Role",
      date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
      matchScore: Math.round(analysis.matchScore),
      status: "Saved",
      resumeSnapshot: resume.length > 200_000 ? resume.slice(0, 200_000) : resume,
      coverLetter,
      interviewPrep: JSON.parse(JSON.stringify(analysis.interviewPrep)) as InterviewPrep,
      analysisSnapshot: {
        matchExplanation: [...analysis.matchExplanation],
        matchedSkills: [...analysis.matchedSkills],
        missingSkills: [...analysis.missingSkills],
        atsMatched: [...analysis.atsMatched],
        atsKeywords: [...analysis.atsKeywords],
      },
      interviewDate: null,
      dateApplied: null,
      notes: "",
    });
    setSaveModalOpen(false);
    setTrackerNotice("Saved to your tracker");
  }

  function handleSaveModalConfirm() {
    const c = saveModalCompany.trim();
    const r = saveModalRole.trim();
    if (!c) { setSaveModalError("Enter the company name."); return; }
    if (!r) { setSaveModalError("Enter the job title."); return; }
    doTrackerSave(c, r);
  }

  function saveToTracker() {
    if (!analysis || !coverLetter || !jobPosting.trim()) return;
    if (!isPro) {
      setTrackerNotice("Upgrade to Pro to save to your tracker.");
      return;
    }

    // Priority 1 — use what the user explicitly typed on the Input page
    const hintCompany = jobCompanyHint.trim();
    const hintRole = jobRoleHint.trim();

    // Priority 2 — extract from job description / link
    const { company: extractedCompany, title: extractedTitle } =
      extractJobTitleAndCompany(jobPosting, jobLink);
    const extractedC = sanitizeCompany(extractedCompany);
    const extractedR = sanitizeJobTitle(extractedTitle);

    const finalCompany = hintCompany || (isMetaSuspect(extractedC, 5) ? "" : extractedC);
    const finalRole = hintRole || (isMetaSuspect(extractedR, 9) ? "" : extractedR);

    // Priority 3 — if still missing, ask the user via modal
    if (!finalCompany || !finalRole) {
      setSaveModalCompany(finalCompany);
      setSaveModalRole(finalRole);
      setSaveModalError(null);
      setSaveModalOpen(true);
    } else {
      doTrackerSave(finalCompany, finalRole);
    }
  }

  const whyLines = baselineAnalysis?.matchExplanation.slice(0, 3) ?? [];

  const resumePlainForKw = useMemo(
    () => resumePlainForKeywordMatching(resume, originalResumePlain),
    [resume, originalResumePlain],
  );

  const analyzeKeywordChips = useMemo(() => {
    if (!baselineAnalysis) return [];
    return keywordChipsFromResumeLiteral(
      resumePlainForKw,
      jobKeywordLabels,
      baselineAnalysis.keywords.map((k) => k.skill.trim()),
    );
  }, [baselineAnalysis, jobKeywordLabels, resumePlainForKw]);

  const missingKeywordCount = useMemo(
    () => analyzeKeywordChips.filter((c) => !c.found).length,
    [analyzeKeywordChips],
  );

  const strongerBulletsCount = baselineAnalysis?.rewrites.length ?? 0;

  useEffect(() => {
    if (currentStep !== 1) return;
    if (!reanalyzeAfterOptimizeNeeded || loadingAnalyze) return;
    void runAnalyze();
  }, [currentStep, reanalyzeAfterOptimizeNeeded, loadingAnalyze, runAnalyze]);

  const jobMeta = useMemo(
    () => extractJobTitleAndCompany(jobPosting, jobLink),
    [jobPosting, jobLink],
  );

  const skillMatchTableRows = useMemo(() => {
    if (!baselineAnalysis) return [];
    const checks = baselineAnalysis.requirementChecks;
    if (checks.length > 0) return checks;
    return baselineAnalysis.keywords.map((k) => ({
      skill: k.skill,
      present: k.found,
      evidence: k.evidence,
    }));
  }, [baselineAnalysis]);

  function buildResultsPayload() {
    if (!analysis || !coverLetter) return null;
    return {
      keywords: [...analysis.atsMatched, ...analysis.atsKeywords].slice(0, 20),
      matchScore: analysis.matchScore,
      coverLetter,
      interviewQuestions: analysis.interviewPrep.predictedQuestions.map(
        (q) => q.question,
      ),
    };
  }

  function downloadResultsPdf() {
    setSaveError(null);
    setSaveSuccess(null);
    const payload = buildResultsPayload();
    if (!payload) {
      setSaveError("Results are incomplete. Generate all sections first.");
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const margin = 40;
    const maxWidth = width - margin * 2;
    let y = 50;

    function section(title: string, bodyLines: string[]) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title, margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (const line of bodyLines) {
        const wrapped = doc.splitTextToSize(line, maxWidth);
        for (const w of wrapped) {
          if (y > 790) {
            doc.addPage();
            y = 50;
          }
          doc.text(w, margin, y);
          y += 14;
        }
      }
      y += 10;
    }

    section("Keywords", [
      payload.keywords.length
        ? payload.keywords.join(", ")
        : "No keywords available.",
    ]);
    section("Match score", [`${Math.round(payload.matchScore)}%`]);
    section("Cover letter", payload.coverLetter.split("\n"));
    section(
      "Interview questions",
      payload.interviewQuestions.map((q, i) => `${i + 1}. ${q}`),
    );
    doc.save("applyfy-results.pdf");
    setSaveSuccess("PDF downloaded.");
  }

  async function emailResults() {
    setSaveError(null);
    setSaveSuccess(null);
    const payload = buildResultsPayload();
    if (!payload) {
      setSaveError("Results are incomplete. Generate all sections first.");
      return;
    }
    if (!emailTo.trim()) {
      setSaveError("Enter an email address.");
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/results-email", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          ...payload,
        }),
      });
      const raw = await res.text();
      let data: { error?: string };
      try {
        data = JSON.parse(raw) as { error?: string };
      } catch {
        throw new Error(raw || "Email API error.");
      }
      if (!res.ok) {
        // Email service not configured — open mailto as fallback
        if (res.status === 503) {
          const subject = encodeURIComponent("Applyfy Application Results");
          const body = encodeURIComponent(
            [
              `Match Score: ${Math.round((payload.matchScore ?? 0) * 100) / 100}%`,
              "",
              "Top Keywords:",
              (payload.keywords ?? []).slice(0, 12).map((k) => `• ${k}`).join("\n"),
              "",
              "Cover Letter (excerpt):",
              (payload.coverLetter ?? "").slice(0, 800),
              payload.coverLetter && payload.coverLetter.length > 800 ? "…[download PDF for full results]" : "",
            ].join("\n"),
          );
          window.open(
            `mailto:${emailTo.trim()}?subject=${subject}&body=${body}`,
            "_blank",
          );
          setSaveSuccess("Your email client opened with results pre-filled. Click Send to deliver.");
          return;
        }
        throw new Error(data.error ?? "Email send failed.");
      }
      setSaveSuccess("Results emailed successfully.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Email send failed.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <>
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#f5f3ff] via-[#f8f7fc] to-[#f1eff8] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-plus-jakarta)] text-3xl font-extrabold tracking-tight text-[#0f172a] sm:text-[2rem]">
            My application
          </h1>
          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                "Start over? This will clear your current session.",
              );
              if (!ok) return;
              resetSession();
              clearStepProgress();
              setCurrentStep(0);
              setMaxUnlocked(1);
              setFileLabel(null);
              setFileError(null);
              setTrackerNotice(null);
            }}
            className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748b] transition-all duration-150 hover:bg-[#f8fafc] active:scale-[0.97]"
          >
            Reset Pages
          </button>
        </div>

        <ApplicationStepper
          labels={steps}
          currentStep={currentStep}
          maxUnlocked={stepperMaxUnlocked}
          onStepClick={(idx) => setCurrentStep(idx)}
          resumeReady={resumeReady}
        />

        <section className="app-card overflow-hidden">
          <div key={currentStep} className="applyfy-step-enter">
          {currentStep === 0 ? (
            <>
              <h2 className="text-2xl font-bold text-[#0f172a]">Input</h2>
              <p className="mt-2 text-sm text-[#64748b]">
                Upload your resume and add a job URL or paste the job description.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="resume-file"
                    className="mb-2 block text-sm font-semibold text-[#0f172a]"
                  >
                    Resume file
                  </label>
                  <input
                    ref={inputRef}
                    id="resume-file"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="sr-only"
                    onChange={(e) => void onFileChange(e.target.files)}
                  />
                  <div
                    className={`flex min-h-[190px] flex-col justify-center rounded-2xl border border-dashed border-[#e2e8f0] bg-[#fafafa] p-6 text-center transition-colors hover:border-[#cbd5e1] ${
                      resumeDropHover ? "applyfy-resume-dropzone-drag" : ""
                    }`}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resumeDragDepth.current += 1;
                      setResumeDropHover(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resumeDragDepth.current -= 1;
                      if (resumeDragDepth.current <= 0) {
                        resumeDragDepth.current = 0;
                        setResumeDropHover(false);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      resumeDragDepth.current = 0;
                      setResumeDropHover(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void onFileChange(e.dataTransfer.files);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="applyfy-btn-primary mx-auto rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#0f172a] shadow-sm hover:bg-[#f8fafc]"
                    >
                      Choose file
                    </button>
                    <p className="mt-3 text-xs text-[#94a3b8]">
                      PDF, Word (.docx), or plain text (.txt / .md)
                    </p>
                    {fileLabel ? (
                      <div className="mt-4 flex items-center justify-center gap-2 md:justify-start">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm ring-2 ring-emerald-200/80"
                          aria-hidden
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        <p className="text-left text-sm font-medium text-[#0f172a]">
                          <span className="text-[#64748b]">Selected:</span>{" "}
                          {fileLabel}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[#94a3b8]">No file selected</p>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="job-link"
                    className="mb-2 block text-sm font-semibold text-[#0f172a]"
                  >
                    Job URL or description
                  </label>
                  <input
                    id="job-link"
                    type="text"
                    autoComplete="off"
                    placeholder="https://…"
                    value={jobLink}
                    onChange={(e) => setJobLink(e.target.value)}
                    className="w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition-shadow focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
                  />
                  <p className="mt-2 text-xs text-[#94a3b8]">
                    Paste a job URL — or paste the job description text directly
                    if the link doesn&apos;t work
                  </p>
                  {jobPasteFallback.active ? (
                    <div className="mt-4 rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-4">
                      <p className="text-sm text-[#0f172a]">
                        {jobPasteFallback.message}
                      </p>
                      <label
                        htmlFor="job-posting-paste"
                        className="mt-3 block text-xs font-semibold text-[#64748b]"
                      >
                        Job description
                      </label>
                      <textarea
                        id="job-posting-paste"
                        value={jobPosting}
                        onChange={(e) => setJobPosting(e.target.value)}
                        rows={10}
                        placeholder="Paste the full job description here…"
                        className="mt-2 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Optional company + role hints */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="job-company-hint"
                    className="mb-1.5 block text-sm font-semibold text-[#0f172a]"
                  >
                    Company name{" "}
                    <span className="font-normal text-[#94a3b8]">(optional)</span>
                  </label>
                  <input
                    id="job-company-hint"
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. Google, Stripe, Shopify"
                    value={jobCompanyHint}
                    onChange={(e) => setJobCompanyHint(e.target.value)}
                    className="w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition-shadow focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="job-role-hint"
                    className="mb-1.5 block text-sm font-semibold text-[#0f172a]"
                  >
                    Job title{" "}
                    <span className="font-normal text-[#94a3b8]">(optional)</span>
                  </label>
                  <input
                    id="job-role-hint"
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. Software Engineer, Product Manager"
                    value={jobRoleHint}
                    onChange={(e) => setJobRoleHint(e.target.value)}
                    className="w-full rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition-shadow focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-xs text-[#94a3b8]">
                Used to label this application in your tracker. If left blank
                we&apos;ll try to extract them from the job posting.
              </p>

              {fileError ? (
                <p className="mt-4 text-sm text-[#ef4444]">{fileError}</p>
              ) : null}
              {analyzeError ? (
                <div
                  className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4"
                  role="alert"
                >
                  <p className="text-sm font-medium text-[#b91c1c]">
                    {analyzeError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleInputNext()}
                    className="mt-3 inline-flex items-center rounded-[10px] border border-[#fecaca] bg-white px-4 py-2 text-sm font-medium text-[#b91c1c] transition-all hover:bg-[#fef2f2] active:scale-[0.97]"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {loadingAnalyze ? (
                <div
                  className="mt-4 space-y-2"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="text-sm text-[#0f172a]">
                    {ANALYZE_STATUS_MESSAGES[analyzeStatusIdx]}
                  </p>
                  {analyzeSlowHint ? (
                    <p className="text-sm text-[#64748b]">
                      Still working — this can take up to 45 seconds for detailed
                      analysis...
                    </p>
                  ) : null}
                </div>
              ) : null}

              <TrustDataBar />
              <div className="mt-6 flex justify-end">
                <PrimaryNextButton
                  label={loadingAnalyze ? "Analyzing..." : "Run analysis"}
                  onClick={handleInputNext}
                  loading={loadingAnalyze}
                  variant="runAnalysis"
                />
              </div>
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <div className="mb-2">
                <h2 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-extrabold tracking-tight text-[#0f172a] sm:text-[1.75rem]">
                  Analyze
                </h2>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#64748b]">
                  ATS alignment, quick wins, keywords, strengths, and gaps for
                  this job.
                </p>
              </div>
              {!baselineAnalysis ? (
                <p className="mt-6 text-sm text-[#64748b]">
                  Run step 1 first to generate analysis.
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  {resumeSourceOfTruth === "optimized" &&
                  optimizationAppliedAt ? (
                    <div className="flex flex-col gap-2 rounded-2xl border border-[#ddd6fe] bg-gradient-to-r from-[#ede9fe]/90 to-white px-5 py-4 text-sm text-[#4c1d95] sm:flex-row sm:items-center sm:justify-between">
                      <p>
                        Showing analysis of your optimized resume · Last updated{" "}
                        {new Date(optimizationAppliedAt).toLocaleString()}
                        {reanalyzeAfterOptimizeNeeded && loadingAnalyze
                          ? " · Updating scores…"
                          : ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => undoResumeOptimization()}
                        className="shrink-0 text-left text-sm font-semibold text-[#7c3aed] underline decoration-[#7c3aed]/35 underline-offset-2 transition hover:text-[#6d28d9]"
                      >
                        Undo optimization
                      </button>
                    </div>
                  ) : null}

                  <section
                    className="animate-section-in relative overflow-hidden rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#faf8ff] via-white to-[#f5f3ff] p-7 shadow-[0_12px_40px_-12px_rgba(124,58,237,0.2)] ring-1 ring-[#ede9fe]/80"
                    style={{ animationDelay: "0ms" }}
                  >
                    <div
                      className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#7c3aed]/[0.07] blur-3xl"
                      aria-hidden
                    />
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7c3aed]/80">
                      ATS score
                    </p>
                    <div className="relative mt-2 flex flex-wrap items-end gap-3">
                      <span
                        className="text-[clamp(3rem,8vw,3.5rem)] font-extrabold leading-none tracking-tight drop-shadow-sm transition-colors duration-500"
                        style={{ color: atsScoreVisual.text }}
                      >
                        {atsCountDisplay}
                      </span>
                      <span className="mb-1.5 text-lg font-semibold tabular-nums text-[#94a3b8]">
                        /100
                      </span>
                      <svg
                        className="mb-2 h-7 w-7 transition-colors duration-500"
                        style={{ color: atsScoreVisual.icon }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <p className="relative mt-2 text-sm text-[#64748b]">
                      Keyword &amp; phrasing fit with this posting
                    </p>
                    <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-[#ede9fe]/80">
                      <div
                        className="h-full rounded-full ease-out"
                        style={{
                          width: `${atsProgress}%`,
                          transition: "width 800ms ease-out",
                          background: atsScoreVisual.bar,
                        }}
                      />
                    </div>
                  </section>

                  <section
                    className="animate-section-in rounded-2xl border border-[#e9e3f5] bg-gradient-to-b from-white to-[#faf8ff] p-7 shadow-[0_8px_30px_-10px_rgba(124,58,237,0.1)]"
                    style={{ animationDelay: "80ms" }}
                  >
                    <h3 className="mb-1 font-[family-name:var(--font-plus-jakarta)] text-base font-bold text-[#0f172a]">
                      Quick wins
                    </h3>
                    <p className="mb-5 text-xs text-[#64748b]">
                      High-impact tweaks hiring systems and recruiters notice first.
                    </p>
                    <div className="grid gap-3">
                      {(isPro
                        ? baselineAnalysis.quickWins
                        : baselineAnalysis.quickWins.slice(0, 3)
                      ).map((w, i) => (
                        <div
                          key={`qw-${i}`}
                          className="applyfy-quick-win-card rounded-xl border border-[#ddd6fe]/80 border-l-[3px] border-l-[#7c3aed] bg-white/90 px-4 py-3.5 text-sm leading-relaxed text-[#1e293b] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c4b5fd] hover:shadow-[0_8px_24px_-8px_rgba(124,58,237,0.15)]"
                          style={{ animationDelay: `${i * 150}ms` }}
                        >
                          <span className="mr-2 inline-flex align-middle text-[#7c3aed]">
                            <svg
                              className="inline h-4 w-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path d="M13 3L4 14h7v7l9-11h-7V3z" />
                            </svg>
                          </span>
                          {w}
                        </div>
                      ))}
                    </div>
                    {!isPro && baselineAnalysis.quickWins.length > 3 ? (
                      <div className="relative mt-4 overflow-hidden rounded-xl border border-[#ddd6fe]/80 bg-[#faf8ff] px-4 py-5 text-center">
                        <p className="text-sm font-medium text-[#0f172a]">
                          +{baselineAnalysis.quickWins.length - 3} more quick
                          wins on Pro
                        </p>
                        <Link
                          href="/pricing"
                          className="mt-2 inline-block text-sm font-semibold text-[#7c3aed] underline"
                        >
                          View plans
                        </Link>
                      </div>
                    ) : null}
                  </section>

                  {analyzeKeywordChips.length > 0 ? (
                    <section
                      className="animate-section-in rounded-2xl border border-[#e8e0f5] bg-white p-7 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.06)]"
                      style={{ animationDelay: "160ms" }}
                    >
                      <h3 className="mb-1 font-[family-name:var(--font-plus-jakarta)] text-base font-bold text-[#0f172a]">
                        ATS keywords
                      </h3>
                      <p className="mb-4 text-xs text-[#64748b]">
                        <span className="font-medium text-emerald-800">Green</span>{" "}
                        = exact phrase on your resume; gaps stay clearly flagged.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {analyzeKeywordChips.map((k, i) => (
                          <span
                            key={`kw-${k.skill}-${i}`}
                            className={`group/chip animate-pill-in relative inline-flex cursor-default items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
                              k.found
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-[#fecdd3] bg-[#fff1f2] text-[#b91c1c]"
                            }`}
                            style={{
                              animationDelay: `${50 * i}ms`,
                            }}
                            title={
                              k.found
                                ? "Match: exact keyword phrase appears in your resume (case-insensitive)."
                                : "No match: this exact phrase is not in your resume — add it only if accurate."
                            }
                          >
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-[#e2e8f0] bg-[#0f172a] px-3 py-2 text-[11px] font-normal leading-snug text-white shadow-lg group-hover/chip:block">
                              {k.found
                                ? "Match reason: the exact keyword phrase appears in your resume text (case-insensitive). Synonyms do not count."
                                : "Match reason: this exact phrase is not found in your resume. Add it verbatim only if your experience supports it."}
                            </span>
                            {k.found ? (
                              <svg
                                className="h-3 w-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="h-3 w-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                            {k.skill}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-[#64748b]">
                        <span className="font-medium text-emerald-800">Green</span>{" "}
                        = exact phrase on your resume (case-insensitive).{" "}
                        <span className="font-medium text-[#b91c1c]">Red</span> = not
                        found verbatim. Synonyms do not count.
                      </p>
                    </section>
                  ) : null}

                  <section
                    className="animate-section-in rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/50 to-white p-7 shadow-[0_4px_20px_-6px_rgba(5,150,105,0.08)]"
                    style={{ animationDelay: "240ms" }}
                  >
                    <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[#0f172a]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md ring-2 ring-emerald-200/80">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      Matched strengths
                    </h3>
                    <p className="mb-3 text-xs leading-relaxed text-[#64748b]">
                      One line per matched keyword only (exact phrase on your
                      resume). No extra labels beyond those keywords.
                    </p>
                    {baselineAnalysis.matchedStrengths.length > 0 ? (
                      <>
                        <ul className="space-y-2">
                          {(isPro
                            ? baselineAnalysis.matchedStrengths
                            : baselineAnalysis.matchedStrengths.slice(0, 2)
                          ).map((s, i) => (
                            <li
                              key={`ms-${i}`}
                              className="list-none rounded-xl border border-emerald-100 border-l-[3px] border-l-emerald-500 bg-white py-3 pl-4 pr-4 text-sm leading-relaxed shadow-sm transition-shadow duration-200 hover:border-emerald-200 hover:shadow-md"
                            >
                              <StrengthEmDashLine text={s} />
                            </li>
                          ))}
                        </ul>
                        {!isPro &&
                        baselineAnalysis.matchedStrengths.length > 2 ? (
                          <div className="relative mt-4 overflow-hidden rounded-xl border border-emerald-100/80 bg-emerald-50/40 px-4 py-6 text-center">
                            <div
                              className="pointer-events-none select-none blur-sm"
                              aria-hidden
                            >
                              <p className="text-sm text-emerald-900">
                                Additional strengths hidden on Free…
                              </p>
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 px-3">
                              <p className="text-sm font-medium text-[#0f172a]">
                                +{baselineAnalysis.matchedStrengths.length - 2}{" "}
                                more matched strengths
                              </p>
                              <Link
                                href="/pricing"
                                className="text-sm font-semibold text-[#7c3aed] underline"
                              >
                                Upgrade to Pro to see all
                              </Link>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm leading-relaxed text-[#64748b]">
                        No job keywords from this analysis appear literally on
                        your resume yet.
                      </p>
                    )}
                  </section>

                  {isPro ? (
                    <div className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <AtsScoreHistory />
                        <ReadinessChecklist analysis={baselineAnalysis} />
                      </div>
                      <FollowUpEmailCta
                        jobTitle={
                          sanitizeJobTitle(jobMeta.title) || "Role"
                        }
                        company={
                          sanitizeCompany(jobMeta.company) || "Company"
                        }
                      />
                    </div>
                  ) : null}

                  {isFree ? (
                    <section
                      className="animate-section-in rounded-2xl border border-dashed border-[#c4b5fd] bg-[#faf8ff] p-8 text-center shadow-sm"
                      style={{ animationDelay: "320ms" }}
                    >
                      <p className="text-base font-semibold text-[#0f172a]">
                        {baselineAnalysis.resumeGaps.length} gap
                        {baselineAnalysis.resumeGaps.length === 1 ? "" : "s"}{" "}
                        found — upgrade to see details
                      </p>
                      <p className="mt-2 text-sm text-[#64748b]">
                        Pro unlocks full gap analysis, fixes, and the Resume
                        Editor.
                      </p>
                      <Link
                        href="/pricing"
                        className="mt-5 inline-flex rounded-xl bg-[#7c3aed] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
                      >
                        View plans
                      </Link>
                    </section>
                  ) : (
                    <section
                      className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-6"
                      style={{ animationDelay: "320ms" }}
                    >
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#0f172a]">
                        <svg
                          className="h-5 w-5 shrink-0 text-[#ef4444]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                        </svg>
                        Gaps
                      </h3>
                      <div className="space-y-4">
                        {baselineAnalysis.resumeGaps.map((g, i) => (
                          <div
                            key={`gap-${g.skill}-${i}`}
                            className="rounded-xl border border-[#e2e8f0] border-l-[3px] border-l-[#ef4444] bg-white p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md"
                          >
                            <h4 className="text-sm font-semibold text-[#0f172a]">
                              {g.skill}
                            </h4>
                            <p className="mt-2 text-sm text-[#64748b]">
                              <span className="font-bold text-[#ef4444]">
                                Reality:{" "}
                              </span>
                              {g.reality}
                            </p>
                            <p className="mt-2 text-sm text-[#0f172a]">
                              <span className="font-bold text-[#7c3aed]">
                                Fix:{" "}
                              </span>
                              {g.fix}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section
                    className="animate-section-in relative overflow-hidden rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#ede9fe]/90 via-white to-[#f5f3ff] p-8 shadow-[0_16px_48px_-16px_rgba(124,58,237,0.22)] ring-1 ring-[#c4b5fd]/30"
                    style={{ animationDelay: "400ms" }}
                  >
                    <div
                      className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#7c3aed]/15 blur-3xl"
                      aria-hidden
                    />
                    <p className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-[#0f172a]">
                      Ready to fix these gaps?
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-[#475569]">
                      Your resume has{" "}
                      <span className="font-semibold text-[#0f172a]">
                        {missingKeywordCount}
                      </span>{" "}
                      keyword{missingKeywordCount === 1 ? "" : "s"} missing and{" "}
                      <span className="font-semibold text-[#0f172a]">
                        {strongerBulletsCount}
                      </span>{" "}
                      bullet
                      {strongerBulletsCount === 1 ? "" : "s"} that can be
                      stronger. The Resume Editor will rewrite them in one
                      click.
                    </p>
                    {isFree ? (
                      <Link
                        href="/pricing"
                        className="applyfy-btn-primary mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-8 text-sm font-semibold text-white shadow-[0_8px_24px_-4px_rgba(124,58,237,0.45)] transition-all duration-200 hover:brightness-[1.05] active:scale-[0.98] sm:w-auto"
                      >
                        Upgrade to unlock Match &amp; Resume Editor
                        <span aria-hidden>→</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(2);
                          setMaxUnlocked((m) => Math.max(m, 3));
                        }}
                        className="applyfy-btn-primary mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-8 text-sm font-semibold text-white shadow-[0_8px_24px_-4px_rgba(124,58,237,0.45)] transition-all duration-200 hover:brightness-[1.05] active:scale-[0.98] sm:w-auto"
                      >
                        <span>View Match</span>
                        <span aria-hidden>→</span>
                      </button>
                    )}
                  </section>
                </div>
              )}

              <TrustDataBar />
              <StepFooterNav
                onBack={goBackOneStep}
                next={
                  isFree && baselineAnalysis && !loadingAnalyze ? (
                    <Link
                      href="/pricing"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#c4b5fd] bg-[#faf8ff] px-6 text-sm font-semibold text-[#6d28d9] transition hover:border-[#7c3aed] hover:bg-[#7c3aed] hover:text-white"
                    >
                      Upgrade for Match &amp; Resume Editor
                      <span aria-hidden>→</span>
                    </Link>
                  ) : (
                    <PrimaryNextButton
                      onClick={() => {
                        if (!baselineAnalysis) return;
                        setCurrentStep(2);
                        setMaxUnlocked(3);
                      }}
                      disabled={!baselineAnalysis || loadingAnalyze}
                    />
                  )
                }
              />
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <h2 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-extrabold text-[#0f172a]">
                Match
              </h2>
              {!baselineAnalysis ? (
                <p className="mt-6 text-sm text-[#64748b]">
                  Run the Analyze step first to view your match.
                </p>
              ) : (
                <GatedFeature
                  requiredTier="pro"
                  hidePlaceholder
                  className="min-h-[280px]"
                  title="Match score"
                  description="Upgrade to Pro for your full match breakdown, keyword table, and context tips."
                >
                  <div className="mt-6 space-y-6">
                    <section
                      className="animate-section-in rounded-2xl border border-[#e8e0f5] bg-white p-6 shadow-[0_8px_32px_-12px_rgba(124,58,237,0.1)] sm:p-8"
                      style={{ animationDelay: "0ms" }}
                    >
                      <MatchScoreArcAndBreakdown
                        analysis={matchDisplayAnalysis ?? baselineAnalysis}
                      />
                      {whyLines.length > 0 ? (
                        <div className="mt-8 border-t border-[#f1f5f9] pt-6">
                          <h4 className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                            Quick context
                          </h4>
                          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#64748b]">
                            {whyLines.map((line, i) => (
                              <li key={`w-${i}`}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>

                    {skillMatchTableRows.length > 0 ? (
                      <section
                        className="animate-section-in rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-6"
                        style={{ animationDelay: "80ms" }}
                      >
                        <h3 className="mb-4 text-sm font-bold text-[#0f172a]">
                          Keyword match
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b-2 border-[#e2e8f0]">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                                  Skill
                                </th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                                  Status &amp; reason
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {skillMatchTableRows.map((row, i) => (
                                <tr
                                  key={`rq-${i}-${row.skill}`}
                                  className={`border-b border-[#f1f5f9] transition-colors last:border-b-0 hover:bg-[#f8fafc] ${
                                    row.present ? "bg-[#f0fdf4]" : "bg-white"
                                  }`}
                                >
                                  <td className="align-top px-4 py-3">
                                    <div className="flex items-start gap-2">
                                      {row.present ? (
                                        <span
                                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-white shadow-sm"
                                          aria-hidden
                                        >
                                          <svg
                                            className="h-3 w-3"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        </span>
                                      ) : (
                                        <span
                                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#ef4444] text-[#ef4444]"
                                          aria-hidden
                                        >
                                          <svg
                                            className="h-2.5 w-2.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={3}
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M6 18L18 6M6 6l12 12"
                                            />
                                          </svg>
                                        </span>
                                      )}
                                      <span
                                        className={`font-semibold ${row.present ? "text-[#0f172a]" : "text-[#0f172a]"}`}
                                      >
                                        {row.skill}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="align-top px-4 py-3 text-sm leading-relaxed text-[#64748b]">
                                    {row.evidence ||
                                      (row.present
                                        ? "Present on your resume."
                                        : "Not clearly shown on your resume.")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ) : null}
                  </div>
                </GatedFeature>
              )}

              <TrustDataBar />
              <StepFooterNav
                onBack={goBackOneStep}
                next={
                  <PrimaryNextButton
                    onClick={() => {
                      if (!baselineAnalysis) return;
                      setCurrentStep(3);
                      setMaxUnlocked(4);
                    }}
                    disabled={!baselineAnalysis || loadingAnalyze}
                  />
                }
              />
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <GatedFeature
                requiredTier="pro"
                hidePlaceholder
                className="min-h-[280px]"
                title="Resume Editor"
                description="Upgrade to Pro to rewrite bullets with AI, refresh your ATS score, and sync everything for this job."
              >
                <div className="-mx-6 max-w-none sm:-mx-8">
                  <LiveResumeEditorExperience
                    variant="embedded"
                    onEmbeddedBack={goBackOneStep}
                    onEmbeddedContinue={() => {
                      setCurrentStep(4);
                      setMaxUnlocked(5);
                    }}
                  />
                </div>
              </GatedFeature>
              <TrustDataBar />
            </>
          ) : null}

          {currentStep === 4 ? (
            <>
              {analysis ? (
                <GatedFeature
                  requiredTier="pro"
                  hidePlaceholder
                  className="min-h-[240px]"
                  title="Cover letter"
                  description="Upgrade to Pro for AI cover letters, tone and length options, and PDF, DOCX, and TXT downloads."
                >
                  <CoverLetterPanel />
                </GatedFeature>
              ) : (
                <p className="text-sm text-[#64748b]">
                  Run prior steps first to generate your cover letter.
                </p>
              )}
              {loadingCoverLetter ? (
                <Spinner label="Generating fresh cover letter..." />
              ) : null}
              {coverLetterError && coverLetterError !== "MISSING_JOB_META" ? (
                <p className="mt-4 text-sm text-[#ef4444]">{coverLetterError}</p>
              ) : null}
              <TrustDataBar />
              <StepFooterNav
                onBack={goBackOneStep}
                next={
                  <PrimaryNextButton
                    onClick={() => {
                      if (!analysis || !coverLetter || loadingCoverLetter)
                        return;
                      setCurrentStep(5);
                      setMaxUnlocked(6);
                    }}
                    disabled={!analysis || !coverLetter || loadingCoverLetter}
                  />
                }
              />
            </>
          ) : null}

          {currentStep === 5 ? (
            <>
              {analysis ? (
                <GatedFeature
                  requiredTier="pro"
                  hidePlaceholder
                  className="min-h-[240px]"
                  title="Interview prep"
                  description="Upgrade to Pro for tailored questions, STAR stories, and risk-area prep for this role."
                >
                  <InterviewPrepPanel prep={analysis.interviewPrep} />
                </GatedFeature>
              ) : (
                <p className="text-sm text-[#64748b]">
                  Run prior steps first to generate interview prep.
                </p>
              )}
              <div className="mt-8 rounded-2xl border border-[#ddd6fe] bg-gradient-to-br from-[#faf8ff] via-white to-[#f5f3ff] p-6 shadow-[0_12px_40px_-14px_rgba(124,58,237,0.18)] ring-1 ring-[#ede9fe]/80">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-[#0f172a]">
                      Save this application
                    </h3>
                    <p className="mt-1.5 text-sm text-[#64748b]">
                      Store this role, score, cover letter, and interview prep in Tracker.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveToTracker}
                    disabled={
                      !isPro ||
                      !analysis ||
                      !coverLetter ||
                      !jobPosting.trim()
                    }
                    className="applyfy-btn-primary shrink-0 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-4px_rgba(124,58,237,0.45)] transition-all duration-200 hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save to Tracker
                  </button>
                </div>
                {trackerNotice ? (
                  <p className="mt-4 text-sm font-semibold text-[#6d28d9]">
                    {trackerNotice}
                  </p>
                ) : null}
              </div>
              <div className="mt-6 rounded-2xl border border-[#e8e0f5] bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
                <h3 className="font-[family-name:var(--font-plus-jakarta)] text-base font-bold text-[#0f172a]">
                  Save results
                </h3>
                <p className="mt-1 text-sm text-[#64748b]">
                  Download everything in one file or send to your email.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={downloadResultsPdf}
                    disabled={!analysis || !coverLetter || loadingCoverLetter}
                    className="applyfy-btn-primary rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-4px_rgba(124,58,237,0.4)] transition-all duration-200 hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Download PDF
                  </button>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="you@example.com"
                    className="min-w-[220px] rounded-[10px] border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
                  />
                  <button
                    type="button"
                    onClick={() => void emailResults()}
                    disabled={
                      sendingEmail ||
                      !analysis ||
                      !coverLetter ||
                      loadingCoverLetter
                    }
                    className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748b] transition-all hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingEmail ? "Sending..." : "Email results"}
                  </button>
                </div>
                {sendingEmail ? <Spinner label="Sending results email..." /> : null}
                {saveError ? (
                  <p className="mt-3 text-sm text-[#ef4444]">{saveError}</p>
                ) : null}
                {saveSuccess ? (
                  <p className="mt-3 text-sm font-medium text-[#6d28d9]">{saveSuccess}</p>
                ) : null}
              </div>
              <TrustDataBar />
              <StepFooterNav onBack={goBackOneStep} />
            </>
          ) : null}
          </div>
        </section>
      </div>
    </main>
    {saveModalOpen ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
        role="presentation"
        onClick={() => setSaveModalOpen(false)}
      >
        <div
          role="dialog"
          aria-modal
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold text-[#0f172a]">One more thing before saving</h2>
          <p className="mt-1.5 text-sm text-[#64748b]">
            We couldn&apos;t reliably identify the company or job title from the posting.
            Fill them in so your tracker stays clean.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0f172a]">
                Company name
              </label>
              <input
                type="text"
                value={saveModalCompany}
                onChange={(e) => { setSaveModalCompany(e.target.value); setSaveModalError(null); }}
                placeholder="e.g. Google, Stripe, Shopify"
                className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0f172a]">
                Job title
              </label>
              <input
                type="text"
                value={saveModalRole}
                onChange={(e) => { setSaveModalRole(e.target.value); setSaveModalError(null); }}
                placeholder="e.g. Software Engineer, Product Manager"
                className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)]"
              />
            </div>
            {saveModalError ? (
              <p className="text-sm text-[#ef4444]">{saveModalError}</p>
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSaveModalOpen(false)}
              className="rounded-[10px] border border-[#e2e8f0] bg-transparent px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveModalConfirm}
              className="applyfy-btn-primary rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-[1.05]"
            >
              Save to Tracker
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
