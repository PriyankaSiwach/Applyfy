"use client";

import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { InterviewPrepPanel } from "@/components/applyfy/InterviewPrepPanel";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { PageShell } from "@/components/PageShell";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

export default function InterviewPage() {
  const { analysis } = useApplyfy();

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        {analysis ? (
          <InterviewPrepPanel prep={analysis.interviewPrep} />
        ) : (
          <NeedAnalysis />
        )}
      </PageShell>
    </ApplyFlowChrome>
  );
}
