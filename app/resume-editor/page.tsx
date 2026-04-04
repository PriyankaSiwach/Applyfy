"use client";

import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { LiveResumeEditorExperience } from "@/components/applyfy/LiveResumeEditorExperience";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

export default function ResumeEditorPage() {
  const { baselineAnalysis } = useApplyfy();

  return (
    <ApplyFlowChrome hideFlowNext>
      <div className="flex min-h-[calc(100dvh-7rem)] flex-1 flex-col bg-[#F8FAFC] px-4 py-6 sm:px-6 dark:bg-[var(--bg-base)]">
        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
          {!baselineAnalysis ? (
            <div className="mx-auto mt-8 w-full max-w-lg">
              <NeedAnalysis />
            </div>
          ) : (
            <LiveResumeEditorExperience variant="page" />
          )}
        </div>
      </div>
    </ApplyFlowChrome>
  );
}
