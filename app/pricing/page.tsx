"use client";

import Link from "next/link";
import { useState } from "react";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import { PricingComparisonTable } from "./PricingComparisonTable";
import { PricingTierFeatures } from "./PricingTierFeatures";

const faqs = [
  {
    q: "Can I really use Applyfy for free?",
    a: "Yes. Free includes 3 resume+job analyses, ATS score, quick wins (top 3), full keyword chips, two visible matched strengths, and a tracker view (up to 3 saved jobs, view-only). Resume Editor, Match, Cover letter, and Interview prep require Pro.",
  },
  {
    q: "What's the difference between Pro and Premium?",
    a: "Pro unlocks unlimited analyses, full Analyze (gaps, readiness, score history, follow-up email), Resume Editor, Match, Cover letter downloads, and core Interview prep. Premium adds the Interview Simulator with scoring, Salary Negotiation Coach, unlimited “more questions,” and the Interview follow-up email generator.",
  },
  {
    q: "Is the interview simulator actually useful?",
    a: "Yes — you answer a behavioral question in your own words and get scores for clarity, specificity, and STAR structure, plus concrete improvement notes.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Use Manage subscription (Stripe Customer Portal) from the header when you have an active subscription. You keep access through the end of the billing period.",
  },
  {
    q: "Is my resume data safe?",
    a: "Your resume and job data are processed securely. We don't sell your information.",
  },
  {
    q: "What does the salary negotiation coach do?",
    a: "Paste your offer details and context; it generates a practical negotiation script and framing you can adapt — Premium only.",
  },
  {
    q: "Do you offer refunds?",
    a: "If you're not happy within the first 7 days of upgrading, contact us for a refund.",
  },
] as const;

export default function PricingPage() {
  const { tier, mounted, setTier } = useSubscription();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkoutPlan, setCheckoutPlan] = useState<null | "pro" | "premium">(
    null,
  );

  async function startCheckout(plan: "pro" | "premium") {
    setCheckoutPlan(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        console.error(data.error ?? "Checkout failed");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      /* ignore */
    } finally {
      setCheckoutPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200 ease-out">
      <div className="mx-auto max-w-[1100px] px-6 py-[80px]">
        <div className="opacity-0 [animation:fade-in-up_0.5s_ease-out_forwards]">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
            Pricing
          </p>
          <h1 className="mt-3 text-center font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)]">
            Land the job. Not just the interview.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-center text-lg text-[var(--text-secondary)]">
            Start free. Upgrade when you&apos;re ready. Cancel anytime.
          </p>
        </div>

        <div className="mx-auto mt-12 flex max-w-[1100px] flex-col items-stretch gap-5 lg:flex-row lg:items-stretch lg:justify-center lg:py-4">
          {/* Free */}
          <div
            className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-9 opacity-0 [animation:home-reveal_0.55s_ease-out_forwards]"
            style={{ animationDelay: "0ms" }}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Free forever</p>
            {mounted && tier === "free" ? (
              <p className="mt-2 inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Current plan
              </p>
            ) : null}
            <p className="mt-2 font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)]">
              $0
              <span className="text-[16px] font-normal text-[var(--text-muted)]">/month</span>
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
              See where you stand. No credit card needed.
            </p>
            <Link
              href="/my-application"
              className="mt-6 flex h-12 w-full shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card-hover)] text-[15px] font-semibold text-[var(--text-primary)] transition-all duration-200 ease-out hover:border-[var(--border-hover)] hover:brightness-[0.98]"
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
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-visible rounded-[24px] border-2 border-[var(--brand)] bg-gradient-to-br from-[#f5f3ff] to-[#ede9fe] p-9 opacity-0 shadow-[0_0_80px_rgba(107,140,255,0.15),0_24px_60px_rgba(0,0,0,0.18)] [animation:home-reveal_0.55s_ease-out_forwards] lg:scale-[1.04]"
            style={{ animationDelay: "100ms" }}
          >
            <div
              className="absolute -top-4 left-1/2 z-20 -translate-x-1/2 rounded-full px-[18px] py-[5px] text-[12px] font-bold text-white"
              style={{ background: "var(--gradient-hero)" }}
            >
              Most Popular
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--brand)]">Pro</p>
            {mounted && tier === "pro" ? (
              <p className="mt-2 inline-flex rounded-full border border-[var(--brand)] bg-[var(--brand-tint)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#6d28d9]">
                Current plan
              </p>
            ) : null}
            <p className="mt-2 font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)]">
              $12
              <span className="text-[16px] font-normal text-[var(--text-muted)]">/month</span>
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
              Everything you need to apply with confidence.
            </p>
            <button
              type="button"
              onClick={() => void startCheckout("pro")}
              disabled={checkoutPlan !== null || tier === "pro" || tier === "premium"}
              className="mt-6 flex h-12 w-full shrink-0 items-center justify-center rounded-xl text-[15px] font-bold text-white shadow-[0_4px_20px_var(--brand-glow)] transition-all duration-200 ease-out hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--gradient-hero)" }}
            >
              {checkoutPlan === "pro"
                ? "Redirecting…"
                : tier === "pro" || tier === "premium"
                  ? "Subscribed"
                  : "Subscribe"}
            </button>
            <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">
              Dev:{" "}
              <button
                type="button"
                className="font-semibold text-[var(--brand)] underline"
                onClick={() => setTier("pro")}
              >
                simulate Pro
              </button>
            </p>
            <div className="my-7 h-px shrink-0 bg-[var(--border)]" />
            <p className="mb-4 shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              What&apos;s included
            </p>
            <PricingTierFeatures tier="pro" variant="pro" />
          </div>

          {/* Premium */}
          <div
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-[rgba(245,158,11,0.4)] bg-gradient-to-br from-[#fdf8f0] to-[#fef3e2] p-9 opacity-0 shadow-[0_0_60px_rgba(245,158,11,0.08),0_20px_40px_rgba(0,0,0,0.15)] [animation:home-reveal_0.55s_ease-out_forwards]"
            style={{ animationDelay: "200ms" }}
          >
            <div className="absolute right-4 top-4 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] px-2.5 py-0.5 text-[11px] font-bold text-[#f59e0b]">
              ✦ Best value
            </div>
            <p className="pr-24 text-[12px] font-bold uppercase tracking-[0.1em] text-[#f59e0b]">Premium</p>
            {mounted && tier === "premium" ? (
              <p className="mt-2 inline-flex rounded-full border border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.12)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#b45309]">
                Current plan
              </p>
            ) : null}
            <p className="mt-2 font-[family-name:var(--font-plus-jakarta)] text-[52px] font-extrabold text-[var(--text-primary)]">
              $24
              <span className="text-[16px] font-normal text-[var(--text-muted)]">/month</span>
            </p>
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-secondary)]">
              Simulator, salary coach, and unlimited interview extras.
            </p>
            <button
              type="button"
              onClick={() => void startCheckout("premium")}
              disabled={checkoutPlan !== null || tier === "premium"}
              className="mt-6 flex h-12 w-full shrink-0 items-center justify-center rounded-xl border-none bg-[#0d0f14] text-[15px] font-bold text-white transition-all duration-200 ease-out hover:-translate-y-px hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutPlan === "premium"
                ? "Redirecting…"
                : tier === "premium"
                  ? "Subscribed"
                  : "Subscribe"}
            </button>
            <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">
              Dev:{" "}
              <button
                type="button"
                className="font-semibold text-[#f59e0b] underline"
                onClick={() => setTier("premium")}
              >
                simulate Premium
              </button>
            </p>
            <div className="my-7 h-px shrink-0 bg-[var(--border)]" />
            <p className="mb-4 shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              What&apos;s included
            </p>
            <PricingTierFeatures tier="premium" variant="premium" />
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
