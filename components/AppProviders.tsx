"use client";

import { ApplyfyProvider } from "@/components/applyfy/ApplyfyProvider";
import { CopyToast } from "@/components/CopyToast";
import { SiteHeader } from "@/components/SiteHeader";
import { SubscriptionProvider } from "@/components/subscription/SubscriptionProvider";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SessionTimeoutGuard } from "@/components/SessionTimeoutGuard";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionTimeoutGuard />
      <SubscriptionProvider>
        <ApplyfyProvider>
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col pb-[76px]">{children}</div>
          <CopyToast />
          <UpgradeBanner />
        </ApplyfyProvider>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
