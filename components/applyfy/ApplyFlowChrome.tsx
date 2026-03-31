"use client";

import { FlowNextButton } from "@/components/applyfy/FlowNextButton";
import { FlowStepBar } from "@/components/applyfy/FlowStepBar";

export function ApplyFlowChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FlowStepBar />
      {children}
      <FlowNextButton />
    </>
  );
}
