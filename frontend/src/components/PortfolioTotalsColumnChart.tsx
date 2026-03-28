"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  buildPortfolioYearSeries,
  buildProjectTotalsForDrillDown,
  hasProjectColumnInRows,
  listUniqueKpiValues
} from "@/lib/valueDashboardAggregates";

type OutputRow = Record<string, unknown>;

const BAR_COLORS = [
  "#6366f1",
  "#38bdf8",
  "#34d399",
  "#d4af37",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
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

type DrillSelection = { year: string; portfolio: string };

type Props = { rows: OutputRow[] };

export function PortfolioTotalsColumnChart({ rows }: Props) {
  const [kpiSelection, setKpiSelection] = useState("");
  /** `'ALL'` = every portfolio in the current series; else explicit subset. */
  const [portfolioMode, setPortfolioMode] = useState<"ALL" | string[]>("ALL");
  const [drillDown, setDrillDown] = useState<DrillSelection | null>(null);

  const { kpiKey, values: kpiOptions } = useMemo(
    () => listUniqueKpiValues(rows),
    [rows]
  );

  useEffect(() => {
    if (!kpiSelection) return;
    const stillValid = kpiOptions.some(
      (v) => v.toLowerCase() === kpiSelection.toLowerCase()
    );
    if (!stillValid) setKpiSelection("");
  }, [rows, kpiOptions, kpiSelection]);

  const { yearsSorted, portfoliosSorted, chartRows, missingColumns } =
    useMemo(
      () =>
        buildPortfolioYearSeries(rows, {
          kpiEquals: kpiSelection.trim() || null
        }),
      [rows, kpiSelection]
    );

  const portfoliosKey = portfoliosSorted.join("\u0001");
  useEffect(() => {
    setPortfolioMode("ALL");
  }, [portfoliosKey]);

  useEffect(() => {
    setDrillDown(null);
  }, [kpiSelection, portfoliosKey]);

  const hasProjectColumn = useMemo(
    () => hasProjectColumnInRows(rows),
    [rows]
  );

  const drillResult = useMemo(() => {
    if (!drillDown) return null;
    return buildProjectTotalsForDrillDown(rows, {
      year: drillDown.year,
      portfolio: drillDown.portfolio,
      kpiEquals: kpiSelection.trim() || null
    });
  }, [rows, drillDown, kpiSelection]);

  const drillChartRows = useMemo(() => {
    if (!drillResult?.hasProjectColumn || drillResult.points.length === 0) {
      return null;
    }
    return drillResult.points.map((pt) => ({
      project:
        pt.project.length > 36
          ? `${pt.project.slice(0, 34)}…`
          : pt.project,
      projectFull: pt.project,
      total: pt.total
    }));
  }, [drillResult]);

  const drillLeftMargin =
    drillChartRows && drillChartRows.length > 0
      ? 8 +
        Math.min(
          220,
          Math.max(
            80,
            ...drillChartRows.map((d) => d.project.length * 6.5)
          )
        )
      : 100;

  const drillChartHeight =
    drillChartRows && drillChartRows.length > 0
      ? Math.min(420, Math.max(200, drillChartRows.length * 22 + 72))
      : 200;

  const selectedPortfolios =
    portfolioMode === "ALL" ? portfoliosSorted : portfolioMode;

  const displayRows = useMemo(() => {
    if (selectedPortfolios.length === 0) return [];
    return chartRows.map((row) => {
      const out: Record<string, string | number> = {
        year: row.year
      };
      for (const p of selectedPortfolios) {
        out[p] = row[p] ?? 0;
      }
      return out;
    });
  }, [chartRows, selectedPortfolios]);

  if (missingColumns.length > 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Value by year & portfolio</p>
        <p className="mt-1 text-xs max-w-3xl">
          Need <span className="font-mono text-slate-300">value</span>, a
          portfolio column, and a{" "}
          <span className="font-mono text-slate-300">year</span> column (
          <span className="font-mono">Year</span>,{" "}
          <span className="font-mono">FiscalYear</span>, …). Missing:{" "}
          <span className="font-mono text-amber-200/90">
            {missingColumns.join(", ")}
          </span>
          .
        </p>
      </section>
    );
  }

  const showKpiFilter = kpiKey !== null && kpiOptions.length > 0;

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Value by year & portfolio</p>
        <p className="mt-1 text-xs">No rows to aggregate.</p>
      </section>
    );
  }

  const emptyAfterKpi =
    yearsSorted.length === 0 && Boolean(kpiSelection.trim());
  const noYearData =
    yearsSorted.length === 0 && !kpiSelection.trim();
  const noPortfoliosSelected = selectedPortfolios.length === 0;

  const showFilterBar = showKpiFilter || portfoliosSorted.length > 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-4">
      {showFilterBar && (
        <div
          className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-800/90 bg-slate-950/55 px-3 py-3 shrink-0"
          role="toolbar"
          aria-label="Chart filters"
        >
          {showKpiFilter && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="portfolio-chart-kpi-filter"
                className="text-[11px] font-medium uppercase tracking-wide text-slate-500"
              >
                KPI
              </label>
              <select
                id="portfolio-chart-kpi-filter"
                value={kpiSelection}
                onChange={(e) => setKpiSelection(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">All KPIs</option>
                {kpiOptions.map((v) => (
                  <option key={v.toLowerCase()} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}

          {portfoliosSorted.length > 0 && (
            <div className="flex flex-col gap-1 max-w-[16rem]">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Portfolios
              </span>
              <select
                multiple
                size={Math.min(7, Math.max(3, portfoliosSorted.length))}
                value={
                  portfolioMode === "ALL"
                    ? portfoliosSorted
                    : portfolioMode
                }
                onChange={(e) => {
                  const next = Array.from(
                    e.target.selectedOptions,
                    (o) => o.value
                  );
                  if (next.length === portfoliosSorted.length) {
                    setPortfolioMode("ALL");
                  } else {
                    setPortfolioMode(next);
                  }
                }}
                className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {portfoliosSorted.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => setPortfolioMode("ALL")}
                >
                  All
                </button>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-300 hover:underline"
                  onClick={() => setPortfolioMode([])}
                >
                  None
                </button>
              </div>
              <p className="text-[10px] text-slate-600 leading-snug">
                Ctrl/Cmd+click to multi-select.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="min-w-0">
        <h3 className="font-semibold text-slate-100 mb-1">
          Value by year & portfolio
        </h3>
        <p className="text-xs text-slate-500">
          X-axis: year. Grouped bars: each portfolio&apos;s sum of{" "}
          <span className="font-mono">value</span>
          {showKpiFilter
            ? ", filtered by KPI when selected."
            : "."}{" "}
          {hasProjectColumn
            ? "Click a bar to drill down to projects."
            : "Add a project column (e.g. Project, ProjectName) to enable drill-down."}
        </p>
        {kpiKey === null && (
          <p className="text-xs text-slate-600 mt-1">
            Add a <span className="font-mono">KPI</span> column to enable KPI
            filtering.
          </p>
        )}
      </div>

      {emptyAfterKpi ? (
        <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-700 rounded-lg">
          No rows with KPI{" "}
          <span className="font-mono text-slate-300">{kpiSelection}</span>.
          Choose another value or &quot;All KPIs&quot;.
        </p>
      ) : noYearData ? (
        <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-700 rounded-lg">
          No rows with a parseable year in the year column (expect 1900–2200,
          e.g. <span className="font-mono">2024</span> or{" "}
          <span className="font-mono">2024-01-01</span>).
        </p>
      ) : noPortfoliosSelected ? (
        <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-700 rounded-lg">
          Select at least one portfolio (use &quot;All&quot; or Ctrl/Cmd+click).
        </p>
      ) : (
        <div className="h-[26rem] w-full min-h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayRows}
              margin={{ top: 36, right: 12, left: 8, bottom: 8 }}
            >
              <Legend
                verticalAlign="top"
                align="center"
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) =>
                  value.length > 24 ? `${value.slice(0, 22)}…` : value
                }
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="year"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
                tickLine={{ stroke: "#475569" }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
                tickLine={{ stroke: "#475569" }}
                tickFormatter={(v) => formatCompact(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px"
                }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={
                  ((value: unknown, name: unknown) => [
                    formatCompact(
                      typeof value === "number"
                        ? value
                        : Number(value ?? 0)
                    ),
                    String(name ?? "Σ value")
                  ]) as NonNullable<
                    ComponentProps<typeof Tooltip>["formatter"]
                  >
                }
                labelFormatter={(label) => `Year ${label}`}
              />
              {selectedPortfolios.map((p, i) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={p}
                  fill={BAR_COLORS[i % BAR_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                  style={{
                    cursor: hasProjectColumn ? "pointer" : "default"
                  }}
                  onClick={
                    hasProjectColumn
                      ? (item) => {
                          const payload = (
                            item as { payload?: Record<string, unknown> }
                          ).payload;
                          const yearRaw = payload?.year;
                          if (yearRaw === undefined || yearRaw === null) {
                            return;
                          }
                          setDrillDown({
                            year: String(yearRaw),
                            portfolio: p
                          });
                        }
                      : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {drillDown && (
        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-950/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-slate-100 text-sm">
                Project breakdown
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Portfolio{" "}
                <span className="font-mono text-slate-300">
                  {drillDown.portfolio}
                </span>
                , year{" "}
                <span className="font-mono text-slate-300">
                  {drillDown.year}
                </span>
                {kpiSelection.trim() ? (
                  <>
                    , KPI{" "}
                    <span className="font-mono text-slate-300">
                      {kpiSelection}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrillDown(null)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              Close drill-down
            </button>
          </div>

          {drillResult && !drillResult.hasProjectColumn ? (
            <p className="text-sm text-amber-200/90">
              This dataset has no project column (expected names like{" "}
              <span className="font-mono">Project</span>,{" "}
              <span className="font-mono">ProjectName</span>).
            </p>
          ) : drillResult && drillResult.points.length === 0 ? (
            <p className="text-sm text-slate-400">
              No project rows for this year and portfolio.
            </p>
          ) : drillChartRows ? (
            <div
              style={{ height: drillChartHeight }}
              className="w-full min-h-[200px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={drillChartRows}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    horizontal
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={{ stroke: "#475569" }}
                    tickLine={{ stroke: "#475569" }}
                    tickFormatter={(v) => formatCompact(Number(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="project"
                    width={drillLeftMargin}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
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
                        "Σ value"
                      ]) as NonNullable<
                        ComponentProps<typeof Tooltip>["formatter"]
                      >
                    }
                    labelFormatter={(_, payload) => {
                      const pr = payload?.[0]?.payload as
                        | { projectFull?: string }
                        | undefined;
                      return pr?.projectFull ?? "";
                    }}
                  />
                  <Bar
                    dataKey="total"
                    fill="#34d399"
                    name="Σ value"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
