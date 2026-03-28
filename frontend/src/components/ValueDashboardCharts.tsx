"use client";

import type { ComponentProps } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  buildPortfolioRevenueByRev,
  topPortfolioPieSlices
} from "@/lib/valueDashboardAggregates";

type OutputRow = Record<string, unknown>;

const PIE_COLORS = [
  "#d4af37",
  "#6366f1",
  "#38bdf8",
  "#34d399",
  "#f472b6",
  "#94a3b8"
];

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type Props = { rows: OutputRow[] };

export function ValueDashboardCharts({ rows }: Props) {
  const { ranks, missingColumns } = buildPortfolioRevenueByRev(rows);
  const barData = ranks.map((r) => ({
    portfolio:
      r.portfolio.length > 42
        ? `${r.portfolio.slice(0, 40)}…`
        : r.portfolio,
    portfolioFull: r.portfolio,
    revenue: r.revenue,
    rank: r.rank
  }));

  const pieData = topPortfolioPieSlices(ranks, 5);
  const chartHeight = Math.min(560, Math.max(220, barData.length * 26 + 80));
  const leftMargin = 8 + Math.min(200, Math.max(100, ...barData.map((d) => d.portfolio.length * 7)));

  if (missingColumns.length > 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Charts</p>
        <p className="mt-1 text-xs max-w-3xl">
          Portfolio revenue charts need these columns in FnModelOrg output (any
          common casing):{" "}
          <span className="font-mono text-slate-300">value</span>,{" "}
          <span className="font-mono text-slate-300">dashboardrev</span>, and a
          portfolio column (
          <span className="font-mono text-slate-300">portfolio</span>,{" "}
          <span className="font-mono text-slate-300">PortfolioName</span>, …).
          Missing:{" "}
          <span className="font-mono text-amber-200/90">
            {missingColumns.join(", ")}
          </span>
          .
        </p>
      </section>
    );
  }

  if (ranks.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Charts</p>
        <p className="mt-1 text-xs">
          No rows with{" "}
          <span className="font-mono text-slate-300">dashboardrev</span> ={" "}
          <span className="font-mono text-slate-300">rev</span>, so portfolio
          revenue cannot be ranked.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-semibold text-slate-100 mb-1">
            Portfolio revenue (ranked)
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Sum of <span className="font-mono">value</span> where{" "}
            <span className="font-mono">dashboardrev</span> ={" "}
            <span className="font-mono">rev</span>, grouped by portfolio.
          </p>
          <div style={{ height: chartHeight }} className="w-full min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={barData}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal />
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={{ stroke: "#475569" }}
                  tickLine={{ stroke: "#475569" }}
                  tickFormatter={(v) => formatCompact(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="portfolio"
                  width={leftMargin}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={{ stroke: "#475569" }}
                  tickLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px"
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={
                    ((value: unknown) => [
                      formatCompact(
                        typeof value === "number"
                          ? value
                          : Number(value ?? 0)
                      ),
                      "Revenue"
                    ]) as NonNullable<
                      ComponentProps<typeof Tooltip>["formatter"]
                    >
                  }
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as
                      | { portfolioFull?: string }
                      | undefined;
                    return p?.portfolioFull ?? "";
                  }}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="var(--color-brand, #6366f1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 border-t border-slate-800 pt-3">
            {ranks.slice(0, 12).map((r) => (
              <li key={`${r.rank}-${r.portfolio}`}>
                <span className="text-slate-600">#{r.rank}</span>{" "}
                <span className="text-slate-300">{r.portfolio}</span>{" "}
                <span className="font-mono text-slate-400 tabular-nums">
                  {formatCompact(r.revenue)}
                </span>
              </li>
            ))}
            {ranks.length > 12 && (
              <li className="text-slate-600">
                +{ranks.length - 12} more in chart above
              </li>
            )}
          </ol>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="font-semibold text-slate-100 mb-1">
            Revenue share (top 5 + other)
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Same filter:{" "}
            <span className="font-mono">dashboardrev = rev</span>.
          </p>
          <div className="h-72 w-full min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={88}
                  label={({ name, percent }) =>
                    `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px"
                  }}
                  formatter={
                    ((value: unknown) =>
                      formatCompact(
                        typeof value === "number"
                          ? value
                          : Number(value ?? 0)
                      )) as NonNullable<
                      ComponentProps<typeof Tooltip>["formatter"]
                    >
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) =>
                    value.length > 18 ? `${value.slice(0, 16)}…` : value
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
