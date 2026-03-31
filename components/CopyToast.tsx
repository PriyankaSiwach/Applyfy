"use client";

import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";

export function CopyToast() {
  const { copyFeedback } = useApplyfy();
  if (!copyFeedback) return null;
  return (
    <p
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#2E3E65] px-4 py-2 text-sm font-medium text-white"
      role="status"
    >
      {copyFeedback}
    </p>
  );
}
