"use client";

import { ApplyfyProvider } from "@/components/applyfy/ApplyfyProvider";
import { CopyToast } from "@/components/CopyToast";
import { SiteHeader } from "@/components/SiteHeader";
import { SubscriptionProvider } from "@/components/subscription/SubscriptionProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <ApplyfyProvider>
          <SiteHeader />
          {children}
          <CopyToast />
        </ApplyfyProvider>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
