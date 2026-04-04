"use client";

import { useMemo } from "react";

export function FollowUpEmailCta({
  jobTitle,
  company,
}: {
  jobTitle: string;
  company: string;
}) {
  const href = useMemo(() => {
    const subject = `Follow up — ${jobTitle} at ${company}`;
    const body = `Hi,

I'm following up on my application for ${jobTitle}. I remain very interested in ${company} and would welcome an update when convenient.

Thank you for your time.`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [jobTitle, company]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <p className="font-semibold text-[var(--text-primary)]">Follow-up email</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        One-click draft ~7 days after you apply. Opens your mail app with a polite follow-up.
      </p>
      <a
        href={href}
        className="mt-4 inline-flex rounded-[10px] bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_16px_var(--brand-glow)] transition hover:opacity-90"
        style={{ background: "var(--gradient-hero)" }}
      >
        Open follow-up email draft
      </a>
    </div>
  );
}
