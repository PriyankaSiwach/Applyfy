"use client";

import { useEffect, useId, useRef, useState } from "react";

function scoreGradientId(score: number): string {
  const pct = Math.min(100, Math.max(0, score));
  if (pct < 50) return "arcGradLow";
  if (pct < 70) return "arcGradMid";
  return "arcGradHigh";
}

function centerColor(score: number): string {
  const pct = Math.min(100, Math.max(0, score));
  if (pct < 50) return "#ef4444";
  if (pct < 70) return "#f59e0b";
  if (pct < 85) return "#1a56db";
  return "#10b981";
}

export function ScoreArc({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 52;
  const c = 2 * Math.PI * r;
  const targetOffset = c - (pct / 100) * c;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dashOffset, setDashOffset] = useState(c);
  const [visible, setVisible] = useState(false);
  const gradId = scoreGradientId(score);
  const labelColor = centerColor(score);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = requestAnimationFrame(() => {
      setDashOffset(targetOffset);
    });
    return () => cancelAnimationFrame(t);
  }, [visible, targetOffset]);

  return (
    <div ref={wrapRef} className="relative mx-auto h-[168px] w-[168px]">
      <svg
        width="168"
        height="168"
        viewBox="0 0 120 120"
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id="arcGradLow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="arcGradMid" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="arcGradHigh" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a56db" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.5s ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span
          className="text-[36px] font-bold tabular-nums leading-none"
          style={{ color: labelColor }}
        >
          {pct}%
        </span>
        <span className="mt-1 text-xs font-medium text-[#94a3b8]">Match score</span>
      </div>
    </div>
  );
}

/** Same ring as match score, but displays `n/10` and “Overall” (score 0–10). */
export function ScoreArcOutOfTen({ score }: { score: number }) {
  const idSuffix = useId().replace(/:/g, "");
  const s = Math.min(10, Math.max(0, score));
  const pct = s * 10;
  const r = 52;
  const c = 2 * Math.PI * r;
  const targetOffset = c - (pct / 100) * c;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dashOffset, setDashOffset] = useState(c);
  const [visible, setVisible] = useState(false);
  const gradId = `${scoreGradientId(pct)}-${idSuffix}`;
  const labelColor = centerColor(pct);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = requestAnimationFrame(() => {
      setDashOffset(targetOffset);
    });
    return () => cancelAnimationFrame(t);
  }, [visible, targetOffset]);

  return (
    <div ref={wrapRef} className="relative mx-auto h-[168px] w-[168px]">
      <svg
        width="168"
        height="168"
        viewBox="0 0 120 120"
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={`arcGradLow-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id={`arcGradMid-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id={`arcGradHigh-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1a56db" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 1.5s ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <div className="flex items-baseline gap-0.5">
          <span
            className="text-[36px] font-bold tabular-nums leading-none"
            style={{ color: labelColor }}
          >
            {s}
          </span>
          <span className="text-lg font-semibold tabular-nums text-[#94a3b8]">
            /10
          </span>
        </div>
        <span className="mt-1 text-xs font-medium text-[#94a3b8]">Overall</span>
      </div>
    </div>
  );
}
