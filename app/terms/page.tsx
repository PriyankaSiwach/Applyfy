import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Applyfy",
};

const LAST_UPDATED = "April 12, 2026";
const CONTACT_EMAIL = "applyfy0@gmail.com";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-6 py-16 transition-colors duration-300">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#7c3aed]">Legal</p>
          <h1 className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[40px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-[var(--text-secondary)]">

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">1. Acceptance of terms</h2>
            <p className="mt-2">
              By accessing or using Applyfy (&quot;the Service&quot;), you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">2. Description of service</h2>
            <p className="mt-2">
              Applyfy is an AI-powered job application tool that analyzes resumes against job postings, generates cover letters, match scores, and interview preparation materials. The Service is provided &quot;as is&quot; for personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">3. Eligibility</h2>
            <p className="mt-2">
              You must be at least 13 years old to use Applyfy. By using the Service, you represent that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">4. Accounts</h2>
            <p className="mt-2">
              You are responsible for maintaining the security of your account credentials and for all activities that occur under your account. Notify us immediately at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#7c3aed] underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
              if you suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">5. Acceptable use</h2>
            <p className="mt-2">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Use the Service to submit false, misleading, or fraudulent information to employers.</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from the Service in bulk.</li>
              <li>Use the Service to violate any applicable law or regulation.</li>
              <li>Share your account with others or resell access to the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">6. AI-generated content</h2>
            <p className="mt-2">
              Applyfy uses large language models to generate suggestions, rewrites, cover letters, and interview questions. This content is provided as a starting point and may contain errors or inaccuracies. You are solely responsible for reviewing, editing, and verifying any AI-generated content before submitting it to employers. Applyfy is not liable for outcomes resulting from AI-generated output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">7. Subscription and billing</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Paid subscriptions are billed monthly through Stripe.</li>
              <li>You may cancel anytime via the Stripe Customer Portal. Access continues through the end of the billing period.</li>
              <li>Refunds are offered within 7 days of initial purchase if you are not satisfied. Contact us to request one.</li>
              <li>We reserve the right to change pricing with 30 days&apos; notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">8. Intellectual property</h2>
            <p className="mt-2">
              All original content, design, and code of the Service is owned by Applyfy. You retain ownership of any resume text or content you submit. By submitting content, you grant us a limited, non-exclusive license to process it for the purpose of delivering the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">9. Disclaimer of warranties</h2>
            <p className="mt-2">
              The Service is provided &quot;as is&quot; without warranty of any kind. We do not guarantee that the Service will be uninterrupted, error-free, or that AI-generated content will be accurate or suitable for any particular purpose.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">10. Limitation of liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, Applyfy shall not be liable for any indirect, incidental, or consequential damages arising out of your use of the Service, including but not limited to loss of employment opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">11. Termination</h2>
            <p className="mt-2">
              We reserve the right to suspend or terminate your account for violations of these Terms. You may delete your account at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">12. Governing law</h2>
            <p className="mt-2">
              These Terms are governed by the laws of the State of New York, United States, without regard to conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">13. Contact</h2>
            <p className="mt-2">
              Questions about these Terms?{" "}
              <Link href="/contact" className="font-medium text-[#7c3aed] underline underline-offset-2">Contact us</Link>{" "}
              or email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#7c3aed] underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
