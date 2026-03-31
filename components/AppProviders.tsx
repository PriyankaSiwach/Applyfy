"use client";

import { ApplyfyProvider } from "@/components/applyfy/ApplyfyProvider";
import { CopyToast } from "@/components/CopyToast";
import { SiteHeader } from "@/components/SiteHeader";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ApplyfyProvider>
      <SiteHeader />
      {children}
      <CopyToast />
    </ApplyfyProvider>
  );
}
