"use client";

import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { InterviewPrepPanel } from "@/components/applyfy/InterviewPrepPanel";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { PageShell } from "@/components/PageShell";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { GatedFeature } from "@/components/subscription/GatedFeature";

export default function InterviewPage() {
  const { analysis } = useApplyfy();

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        {analysis ? (
          <GatedFeature
            requiredTier="pro"
            hidePlaceholder
            className="min-h-[240px]"
            title="Interview prep"
            description="Upgrade to Pro for behavioral and technical prep, STAR stories, and risk areas for this role."
          >
            <InterviewPrepPanel prep={analysis.interviewPrep} />
          </GatedFeature>
        ) : (
          <NeedAnalysis />
        )}
      </PageShell>
    </ApplyFlowChrome>
  );
}
