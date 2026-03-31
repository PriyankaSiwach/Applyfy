"use client";

import { ApplyFlowChrome } from "@/components/applyfy/ApplyFlowChrome";
import { CoverLetterPanel } from "@/components/applyfy/CoverLetterPanel";
import { NeedAnalysis } from "@/components/NeedAnalysis";
import { PageShell } from "@/components/PageShell";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

export default function CoverPage() {
  const { analysis } = useApplyfy();

  return (
    <ApplyFlowChrome>
      <PageShell narrow={false}>
        {analysis ? (
          <CoverLetterPanel />
        ) : (
          <NeedAnalysis />
        )}
      </PageShell>
    </ApplyFlowChrome>
  );
}
