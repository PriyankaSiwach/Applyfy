import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Applyfy",
};

const LAST_UPDATED = "April 12, 2026";
const CONTACT_EMAIL = "applyfy0@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">Legal</p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[40px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-[15px] leading-relaxed text-[var(--text-secondary)]">

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">1. Who we are</h2>
            <p className="mt-2">
              Applyfy (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) is an AI-powered job application tool built and operated by Priyanka Siwach. You can reach us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#7c3aed] underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">2. What data we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Resume text:</strong> Submitted by you for analysis. Processed in-session and not stored permanently on our servers.</li>
              <li><strong>Job posting text or URL:</strong> Used only to generate your analysis. Not stored beyond the active session.</li>
              <li><strong>Account information:</strong> Name and email address collected via Clerk (our authentication provider) when you sign up.</li>
              <li><strong>Subscription data:</strong> Managed by Stripe. We store a Stripe customer ID in your account metadata to link your subscription status.</li>
              <li><strong>Usage metadata:</strong> Anonymous counters (e.g., number of analyses used) stored in your account metadata to enforce plan limits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">3. How we use your data</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To deliver the core service: resume analysis, scoring, cover letter generation, and interview prep.</li>
              <li>To authenticate your account and enforce subscription plan limits.</li>
              <li>To process payments securely through Stripe.</li>
              <li>We do <strong>not</strong> use your resume or job data to train AI models.</li>
              <li>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">4. Third-party services</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>OpenAI:</strong> Resume text and job descriptions are sent to OpenAI&apos;s API to generate analysis, cover letters, and interview prep. OpenAI&apos;s API data usage policy applies. We do not enable training on API submissions.</li>
              <li><strong>Clerk:</strong> Handles authentication and stores your name, email, and account metadata.</li>
              <li><strong>Stripe:</strong> Handles all payment processing. We never see or store your full payment card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">5. Data retention</h2>
            <p className="mt-2">
              Resume and job description text are processed in memory and not persisted after the session ends. Account metadata (name, email, subscription status) is retained for as long as your account exists. You may request deletion at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">6. Cookies</h2>
            <p className="mt-2">
              We use essential session cookies required for authentication (managed by Clerk). We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">7. Your rights</h2>
            <p className="mt-2">
              You may request access to, correction of, or deletion of your personal data by emailing{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#7c3aed] underline underline-offset-2">{CONTACT_EMAIL}</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">8. Security</h2>
            <p className="mt-2">
              All data is transmitted over HTTPS. We use industry-standard security practices and rely on Clerk and Stripe — both SOC 2 compliant — for sensitive authentication and payment data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">9. Changes to this policy</h2>
            <p className="mt-2">
              We may update this policy. Continued use of Applyfy after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">10. Contact</h2>
            <p className="mt-2">
              Questions about this policy? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#7c3aed] underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
              or visit our <Link href="/contact" className="font-medium text-[#7c3aed] underline underline-offset-2">contact page</Link>.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
