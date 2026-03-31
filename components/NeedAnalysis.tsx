import Link from "next/link";

export function NeedAnalysis() {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-card p-8 text-center shadow-md">
      <p className="text-sm text-gray-600">
        Run an analysis first: upload your resume and add the job listing URL on
        the Analyze page.
      </p>
      <Link
        href="/analyze"
        className="mt-5 inline-flex rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
      >
        Go to Analyze
      </Link>
    </div>
  );
}
