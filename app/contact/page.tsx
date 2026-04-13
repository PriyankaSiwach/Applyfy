"use client";

import { useState } from "react";

const CONTACT_EMAIL = "applyfy0@gmail.com";

const subjects = [
  "Subscription Question",
  "Bug Report",
  "General",
] as const;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(subjects[0]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowConfigHelp(false);
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (data.code === "EMAIL_NOT_CONFIGURED" || res.status === 503) {
          setShowConfigHelp(true);
          setError(data.error ?? "Email is not configured.");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setSubject(subjects[0]);
      setMessage("");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setSent(false);
    setError(null);
    setShowConfigHelp(false);
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">
            Contact
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[40px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            Get in touch
          </h1>
          <p className="mt-3 text-[15px] text-[var(--text-secondary)]">
            Send a message — we read every one. Typical reply within 24 hours.
          </p>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">
            Delivered to{" "}
            <span className="font-medium text-[#7c3aed]">{CONTACT_EMAIL}</span>
          </p>
        </div>

        {/* Form / success */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-sm">
          {sent ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ede9fe] to-[#ddd6fe] shadow-inner">
                <svg className="h-8 w-8 text-[#6d28d9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-5 font-[family-name:var(--font-plus-jakarta)] text-xl font-extrabold text-[var(--text-primary)]">
                Email sent
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-secondary)]">
                Thanks for reaching out. We&apos;ll get back to you at the address you provided as soon as we can.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="mt-8 rounded-xl border-2 border-[#c4b5fd] bg-[#faf8ff] px-6 py-2.5 text-sm font-semibold text-[#6d28d9] transition hover:bg-[#7c3aed] hover:text-white"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-primary)]" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    disabled={sending}
                    className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-primary)]" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={sending}
                    className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-primary)]" htmlFor="subject">
                  Subject
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                  className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)] disabled:opacity-60"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-primary)]" htmlFor="message">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  minLength={10}
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind…"
                  disabled={sending}
                  className="w-full resize-none rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[#7c3aed] focus:ring-[3px] focus:ring-[rgba(124,58,237,0.15)] placeholder:text-[var(--text-muted)] disabled:opacity-60"
                />
              </div>

              {showConfigHelp ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-[13px] leading-relaxed text-amber-950">
                  <p className="font-semibold text-amber-950">
                    Server email is not configured
                  </p>
                  <p className="mt-1 text-amber-900/90">
                    {error}
                  </p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[12px] text-amber-900/85">
                    <li>
                      Sign up at{" "}
                      <a
                        href="https://resend.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2"
                      >
                        resend.com
                      </a>{" "}
                      and create an API key.
                    </li>
                    <li>
                      In <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px]">.env.local</code>, set{" "}
                      <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px]">RESEND_API_KEY</code> and a verified{" "}
                      <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px]">RESULTS_FROM_EMAIL</code> (same as the &quot;Email results&quot; feature).
                    </li>
                    <li>
                      Restart <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px]">npm run dev</code>, then try again.
                    </li>
                  </ol>
                </div>
              ) : error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-bold text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                    Sending…
                  </>
                ) : (
                  <>
                    Send message
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>

              <p className="text-center text-[12px] text-[var(--text-muted)]">
                Your message is sent securely from our servers to {CONTACT_EMAIL}.
              </p>
            </form>
          )}
        </div>

      </div>
    </main>
  );
}
