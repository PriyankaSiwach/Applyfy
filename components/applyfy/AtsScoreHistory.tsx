"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useApplyfy } from "@/components/applyfy/ApplyfyProvider";
import { FeatureLock } from "@/components/subscription/FeatureLock";
import { useSubscription } from "@/components/subscription/SubscriptionProvider";
import {
  clearAtsHistory,
  readAtsHistory,
  type AtsHistoryEntry,
} from "@/lib/atsHistory";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

function formatAxisDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTooltipWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function AtsScoreHistory() {
  const { analysis } = useApplyfy();
  const { isPro } = useSubscription();
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<AtsHistoryEntry[]>([]);
  const [palette, setPalette] = useState({
    brand: "#6b8cff",
    brandGlow: "rgba(107, 140, 255, 0.15)",
    border: "rgba(148, 163, 184, 0.35)",
  });

  useEffect(() => {
    setMounted(true);
    setEntries(readAtsHistory());
  }, [analysis]);

  useEffect(() => {
    if (!mounted) return;
    setPalette({
      brand: cssVar("--brand", "#6b8cff"),
      brandGlow: cssVar("--brand-glow", "rgba(107, 140, 255, 0.15)"),
      border: cssVar("--border", "rgba(148, 163, 184, 0.35)"),
    });
  }, [mounted]);

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [entries],
  );

  if (!mounted || sorted.length <= 1) {
    return null;
  }

  const labels = sorted.map((e) => formatAxisDate(e.date));

  const lineColor = palette.brand;

  const chartData = {
    labels,
    datasets: [
      {
        label: "ATS score",
        data: sorted.map((e) => e.score),
        borderColor: lineColor,
        borderWidth: 2,
        tension: 0.25,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 7,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: lineColor,
        pointBorderWidth: 2,
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return palette.brandGlow;
          const g = c.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom,
          );
          const glow = palette.brandGlow;
          g.addColorStop(0, glow);
          g.addColorStop(1, "rgba(0,0,0,0)");
          return g;
        },
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        displayColors: false,
        callbacks: {
          title: () => "",
          label: (ctx) => {
            const i = ctx.dataIndex;
            const e = sorted[i];
            if (!e) return "";
            return [
              `Score: ${e.score}`,
              e.jobTitle,
              formatTooltipWhen(e.date),
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: palette.border,
          lineWidth: 1,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          font: { size: 11 },
          color: cssVar("--text-muted", "#64748b"),
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: palette.border,
          lineWidth: 1,
        },
        ticks: {
          stepSize: 20,
          font: { size: 11 },
          color: cssVar("--text-muted", "#64748b"),
        },
      },
    },
  };

  function handleClear() {
    if (!window.confirm("Clear your ATS score history? This cannot be undone.")) {
      return;
    }
    clearAtsHistory();
    setEntries([]);
  }

  const chartBlock = (
    <div className="h-[200px] w-full bg-transparent">
      <Line data={chartData} options={options} />
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-200/90 bg-card p-6">
      <h2 className="text-sm font-bold text-slate-900">Score history</h2>
      <p className="mt-1 text-xs text-slate-500">
        Your ATS scores from recent analyses
      </p>
      <div className="mt-4">
        <FeatureLock
          locked={!isPro}
          description="Upgrade to Pro to see your full score trend and history over time."
          className="rounded-lg"
        >
          {chartBlock}
        </FeatureLock>
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="mt-3 text-[12px] text-[var(--text-muted)] underline-offset-2 transition-colors hover:text-[var(--text-secondary)] hover:underline"
      >
        Clear history
      </button>
    </section>
  );
}
