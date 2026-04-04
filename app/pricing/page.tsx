"use client";

import Link from "next/link";
import { useState } from "react";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { PricingComparisonTable } from "./PricingComparisonTable";
import { PricingTierFeatures } from "./PricingTierFeatures";

const faqs = [
  {
    q: "Can I really use Applyfy for free forever?",
    a: "Yes. Free never expires. You get 2 analyses/month, ATS score, keyword match, cover letter, and 3 interview questions — no credit card needed.",
  },
  {
    q: "What's the difference between Pro and Pro+?",
    a: "Pro gives you everything to apply confidently — unlimited analyses, full gap analysis, all rewrites, cover letter downloads, and interview prep. Pro+ adds your personal AI career team: an interview simulator that scores your answers, a salary negotiation coach, LinkedIn optimizer, career coach chat, and bulk apply mode for when you're applying aggressively.",
  },
  {
    q: "Is the interview simulator actually useful?",
    a: "Yes — you type or paste your answer to a behavioral question, and the AI scores it 1–10 on clarity, specificity, and use of the STAR method. It tells you exactly what was strong and what was missing. It's like a mock interview you can do at midnight.",
  },
  {
    q: "Can I cancel my Pro or Pro+ subscription anytime?",
    a: "Absolutely. Cancel from your account settings — no forms, no phone calls. You keep access until the end of your billing period.",
  },
  {
    q: "Is my resume data safe?",
    a: "Your resume and job data are processed securely and never stored on our servers after your session ends. We don't sell or share your information.",
  },
  {
    q: "What does the salary negotiation coach actually do?",
    a: "Paste the job offer and the job description, and it generates a word-for-word negotiation script — what to say, what to ask for, and what the market rate is for that role and location. Most users recover the annual cost of Pro+ in a single negotiation.",
  },
  {
    q: "Do you offer refunds?",
    a: "If you're not happy within the first 7 days of upgrading, contact us and we'll refund you — no questions asked.",
  },
] as const;

export default function PricingPage() {
  const { setTier } = useSubscription();
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [priceBump, setPriceBump] = useState(false);

  function selectBilling(next: boolean) {
    if (next === yearly) return;
    setYearly(next);
    setPriceBump(true);
    window.setTimeout(() => setPriceBump(false), 200);
  }

  const proMonthly = "14.99";
  const proYearly = "11.99";
  const proPlusMonthly = "29.00";
  const proPlusYearly = "23.99";

  const proDisplay = yearly ? proYearly : proMonthly;
  const proPlusDisplay = yearly ? proPlusYearly : proPlusMonthly;

  const proSaveYearly = (14.99 * 12 - 143.88).toFixed(2);
  const proPlusSaveYearly = (29 * 12 - 287.88).toFixed(2);

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200 ease-out">
      <div className="mx-auto max-w-[1100px] px-6 py-[80px]">
        <div className="opacity-0 [animation:fade-in-up_0.5s_ease-out_forwards]">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
            Pricing
          </p>
          <h1 className="mt-3 text-center font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)]">
            Simple, honest pricing.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-center text-lg text-[var(--text-secondary)]">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto mt-8 flex justify-center opacity-0 [animation:fade-in-up_0.5s_ease-out_forwards] [animation-delay:80ms] [animation-fill-mode:forwards]">
          <div
            className="inline-flex rounded-full border border-[var(--border)] p-1 transition-all duration-200 ease-out"
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              onClick={() => selectBilling(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ease-out ${
                !yearly ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => selectBilling(true)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ease-out ${
                yearly ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"
              }`}
            >
              Yearly
              <span className="ml-2 rounded-full bg-[var(--green)] px-2 py-0.5 text-[10px] font-bold text-white">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-[1100px] flex-col items-stretch gap-5 lg:flex-row lg:items-stretch lg:justify-center lg:py-4">
          {/* Free */}
          <div
            className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-9 opacity-0 [animation:home-reveal_0.55s_ease-out_forwards]"
            style={{ animationDelay: "0ms" }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Free forever</p>
            <p className="mt-2 font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)]">
              $0
              <span className="text-[16px] font-normal text-[var(--text-muted)]">/month</span>
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
              See where you stand. No credit card needed.
            </p>
            <Link
              href="/my-application"
              className="mt-6 flex h-12 w-full shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card-hover)] text-[15px] font-semibold text-[var(--text-primary)] transition-all duration-200 ease-out hover:border-[var(--border-hover)] hover:brightness-[0.98] dark:hover:brightness-110"
            >
              Get started free
            </Link>
            <div className="my-7 h-px shrink-0 bg-[var(--border)]" />
            <p className="mb-4 shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              What&apos;s included
            </p>
            <PricingTierFeatures tier="free" variant="free" />
          </div>

          {/* Pro */}
          <div
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-visible rounded-[24px] border-2 border-[var(--brand)] bg-gradient-to-br from-[#f5f3ff] to-[#ede9fe] p-9 opacity-0 shadow-[0_0_80px_rgba(107,140,255,0.15),0_24px_60px_rgba(0,0,0,0.18)] [animation:home-reveal_0.55s_ease-out_forwards] dark:from-[#1a1f3a] dark:to-[#16102e] lg:scale-[1.04]"
            style={{ animationDelay: "100ms" }}
          >
            <div
              className="absolute -top-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-[18px] py-[5px] text-[12px] font-bold text-white"
              style={{ background: "var(--gradient-hero)" }}
            >
              Most Popular
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">Pro</p>
            <p
              className={`mt-2 font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)] transition-all duration-200 ease-out ${
                priceBump ? "scale-90 opacity-60" : "scale-100 opacity-100"
              }`}
            >
              ${proDisplay}
              <span className="text-[16px] font-normal text-[var(--text-muted)]">/month</span>
            </p>
            {yearly ? (
              <p className="mt-1 text-[13px] font-medium text-[var(--green)]">
                Billed $143.88/year · You save ${proSaveYearly}
              </p>
            ) : null}
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
              Everything you need to apply with confidence.
            </p>
            <button
              type="button"
              onClick={() => setTier("pro")}
              className="mt-6 flex h-12 w-full shrink-0 items-center justify-center rounded-xl text-[15px] font-bold text-white shadow-[0_4px_20px_var(--brand-glow)] transition-all duration-200 ease-out hover:-translate-y-px hover:opacity-90"
              style={{ background: "var(--gradient-hero)" }}
            >
              Start Pro
            </button>
            <div className="my-7 h-px shrink-0 bg-[var(--border)]" />
            <p className="mb-4 shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              What&apos;s included
            </p>
            <PricingTierFeatures tier="pro" variant="pro" />
          </div>

          {/* Pro+ */}
          <div
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[rgba(245,158,11,0.4)] bg-gradient-to-br from-[#fdf8f0] to-[#fef3e2] p-9 opacity-0 shadow-[0_0_60px_rgba(245,158,11,0.08),0_20px_40px_rgba(0,0,0,0.15)] [animation:home-reveal_0.55s_ease-out_forwards] dark:from-[#1a1410] dark:to-[#1f1020]"
            style={{ animationDelay: "200ms" }}
          >
            <div className="absolute right-4 top-4 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-2.5 py-0.5 text-[11px] font-bold text-[#f59e0b]">
              ✦ Best value
            </div>
            <p className="pr-24 text-[12px] font-bold uppercase tracking-[0.1em] text-[#f59e0b]">For serious job hunters</p>
            <p
              className={`mt-2 font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)] transition-all duration-200 ease-out ${
                priceBump ? "scale-90 opacity-60" : "scale-100 opacity-100"
              }`}
            >
              ${proPlusDisplay}
              <span className="text-[16px] font-normal text-[var(--text-muted)]">/month</span>
            </p>
            {yearly ? (
              <p className="mt-1 text-[13px] font-medium text-[var(--green)]">
                Billed $287.88/year · You save ${proPlusSaveYearly}
              </p>
            ) : null}
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
              Your personal AI career team. Land the role you actually want.
            </p>
            <button
              type="button"
              onClick={() => setTier("pro_plus")}
              className="mt-6 flex h-12 w-full shrink-0 items-center justify-center rounded-xl border-none bg-[#0d0f14] text-[15px] font-bold text-white transition-all duration-200 ease-out hover:-translate-y-px hover:opacity-85 dark:bg-white dark:text-[#0d0f14]"
            >
              Start Pro+
            </button>
            <div className="my-7 h-px shrink-0 bg-[var(--border)]" />
            <p className="mb-4 shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              What&apos;s included
            </p>
            <PricingTierFeatures tier="pro_plus" variant="proplus" />
          </div>
        </div>

        <PricingComparisonTable />

        <div className="mx-auto mt-12 flex max-w-[900px] flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {[
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ),
              label: "Secure checkout",
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              ),
              label: "Cancel anytime",
            },
            {
              icon: (
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2l2.09 6.26L20 10l-5.91 3.74L12 20l-2.09-6.26L4 10l5.91-3.74L12 2z" />
                </svg>
              ),
              label: "No hidden fees",
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
              label: "Your data never stored",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[var(--brand)]">{item.icon}</span>
              <span className="text-[14px] text-[var(--text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>

        <h2 className="mt-20 text-center font-[family-name:var(--font-plus-jakarta)] text-[32px] font-extrabold text-[var(--text-primary)]">
          Questions? We&apos;ve got answers.
        </h2>
        <div className="mx-auto mt-8 max-w-[720px]">
          {faqs.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q} className="mb-2.5 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] last:mb-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15px] font-semibold text-[var(--text-primary)] transition-colors duration-200 ease-out hover:bg-[var(--bg-card-hover)]"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                >
                  {item.q}
                  <svg
                    className={`h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ease-out ${
                      open ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-[14px] leading-relaxed text-[var(--text-secondary)] transition-opacity duration-300 ease-out">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section
          className="relative mt-20 overflow-hidden rounded-[24px] px-6 py-[72px] text-center text-white"
          style={{ background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />
          <div className="relative z-[1]">
            <h3 className="font-[family-name:var(--font-plus-jakarta)] text-[44px] font-extrabold leading-tight">
              Stop applying blindly. Start landing interviews.
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-lg text-[rgba(255,255,255,0.8)]">
              Join thousands of job seekers who went from ghosted to hired.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/my-application"
                className="inline-flex rounded-xl bg-white px-9 py-[14px] text-base font-bold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
                style={{ color: "var(--brand)" }}
              >
                Start for free →
              </Link>
              <Link
                href="#compare"
                className="inline-flex rounded-xl border-2 border-[rgba(255,255,255,0.4)] px-9 py-[14px] text-base font-bold text-white transition-all duration-200 ease-out hover:border-white"
              >
                See Pro features
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-[rgba(255,255,255,0.55)]">
              No credit card required · Cancel anytime · Takes 2 minutes
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
