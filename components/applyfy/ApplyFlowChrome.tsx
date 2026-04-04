"use client";

import { FlowNextButton } from "@/components/applyfy/FlowNextButton";
import { FlowStepBar } from "@/components/applyfy/FlowStepBar";

export function ApplyFlowChrome({
  children,
  hideFlowNext,
}: {
  children: React.ReactNode;
  hideFlowNext?: boolean;
}) {
  return (
    <>
      <FlowStepBar />
      {children}
      {!hideFlowNext ? <FlowNextButton /> : null}
    </>
  );
}
