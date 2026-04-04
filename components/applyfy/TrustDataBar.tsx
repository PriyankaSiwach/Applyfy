/** Trust line at bottom of wizard steps — copy only, no logic. */
export function TrustDataBar() {
  return (
    <p className="mt-10 flex flex-wrap items-center justify-center gap-2 border-t border-[#e2e8f0] pt-6 text-center text-[14px] text-[#94a3b8]">
      <svg
        className="h-4 w-4 shrink-0 text-[#94a3b8]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <span>Your data is processed securely and never stored</span>
    </p>
  );
}
