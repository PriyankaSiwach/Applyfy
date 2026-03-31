"use client";

export function ScoreArc({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative mx-auto h-[140px] w-[140px]">
      <svg
        width="140"
        height="140"
        viewBox="0 0 120 120"
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#4F8EF7"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-[#22A05B]">
          {pct}%
        </span>
      </div>
    </div>
  );
}
