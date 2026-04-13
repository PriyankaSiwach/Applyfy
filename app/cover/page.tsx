"use client";

import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { CoverLetterPanel } from "@/components/applyfy/CoverLetterPanel";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { PageShell } from "@/components/PageShell";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { GatedFeature } from "@/components/subscription/GatedFeature";

export default function CoverPage() {
  const { analysis } = useApplyfy();

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        {analysis ? (
          <GatedFeature
            requiredTier="pro"
            hidePlaceholder
            className="min-h-[240px]"
            title="Cover letter"
            description="Upgrade to Pro for AI cover letters and downloads (PDF, DOCX, TXT)."
          >
            <CoverLetterPanel />
          </GatedFeature>
        ) : (
          <NeedAnalysis />
        )}
      </PageShell>
    </ApplyFlowChrome>
  );
}
