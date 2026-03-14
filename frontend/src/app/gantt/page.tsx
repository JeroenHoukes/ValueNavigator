"use client";

import { useState, useEffect } from "react";
import { loadScenarios, saveScenarios, type SavedScenario } from "@/lib/scenarioConfig";

const GANTT_IDS_KEY = "value-navigator-gantt-scenario-ids";

function getGanttScenarioIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GANTT_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setGanttScenarioIds(ids: string[]) {
  localStorage.setItem(GANTT_IDS_KEY, JSON.stringify(ids));
}

function parseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function weeksBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() - start.getDate()) / 30
  );
}

function dateToMonthsFrom(start: Date, date: Date): number {
  return (
    (date.getFullYear() - start.getFullYear()) * 12 +
    (date.getMonth() - start.getMonth()) +
    (date.getDate() - start.getDate()) / 30
  );
}

export default function GanttPage() {
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [ganttIds, setGanttIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(1);

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.25;
  const PX_PER_MONTH = 24;

  useEffect(() => {
    setScenarios(loadScenarios());
    setGanttIds(getGanttScenarioIds());
  }, []);

  function addToGantt(id: string) {
    if (!id || ganttIds.includes(id)) return;
    const next = [...ganttIds, id];
    setGanttIds(next);
    setGanttScenarioIds(next);
    setSelectedId("");
  }

  function removeFromGantt(id: string) {
    const next = ganttIds.filter((x) => x !== id);
    setGanttIds(next);
    setGanttScenarioIds(next);
  }

  function updateScenarioDates(
    id: string,
    startDate: string,
    durationWeeks: number | "",
    horizonYears?: number | ""
  ) {
    const list = loadScenarios();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return;
    list[idx] = {
      ...list[idx],
      startDate: startDate || undefined,
      durationWeeks: durationWeeks === "" ? undefined : durationWeeks,
      horizonYears: horizonYears === "" || horizonYears === undefined ? undefined : horizonYears
    };
    saveScenarios(list);
    setScenarios(list);
  }

  const ganttScenarios = ganttIds
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is SavedScenario => s != null);

  const withDates = ganttScenarios.filter(
    (s) => s.startDate && s.durationWeeks != null && s.durationWeeks > 0
  );

  const horizonYears = Math.max(
    1,
    ...ganttScenarios.map((s) => s.horizonYears ?? 5),
    5
  );

  const minStart = withDates.length
    ? new Date(
        Math.min(...withDates.map((s) => parseDate(s.startDate!).getTime()))
      )
    : new Date();

  const maxEnd = new Date(minStart);
  maxEnd.setFullYear(maxEnd.getFullYear() + horizonYears);

  const totalMonths = horizonYears * 12;

  function leftPct(s: SavedScenario): number {
    if (!s.startDate) return 0;
    const start = parseDate(s.startDate);
    const monthsFromStart = dateToMonthsFrom(minStart, start);
    return Math.max(0, Math.min(100, (monthsFromStart / totalMonths) * 100));
  }

  function widthPct(s: SavedScenario): number {
    const weeks = s.durationWeeks ?? 0;
    const durationMonths = weeks * (12 / 52);
    const pct = (durationMonths / totalMonths) * 100;
    return Math.min(100 - leftPct(s), Math.max(0, pct));
  }

  const monthLabelStep = Math.max(1, Math.round(3 / zoom));
  const monthLabels: { label: string; monthIndex: number }[] = [];
  for (let m = 0; m < totalMonths; m++) {
    const d = new Date(minStart.getFullYear(), minStart.getMonth() + m, 1);
    monthLabels.push({
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      monthIndex: m
    });
  }

  const yearLabels: number[] = [];
  for (let y = 0; y < horizonYears; y++) {
    yearLabels.push(minStart.getFullYear() + y);
  }

  const timelineWidthPx = totalMonths * PX_PER_MONTH * zoom;
  const monthWidthPx = PX_PER_MONTH * zoom;
  const yearWidthPx = 12 * monthWidthPx;

  // Year boundary positions (as percentage) for vertical lines — skip 0 and 100%
  const yearLinePositionsPct: number[] = [];
  for (let y = 1; y < horizonYears; y++) {
    yearLinePositionsPct.push((y * 12 / totalMonths) * 100);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Milestone planning (Gantt)</h2>
        <p className="text-slate-400 text-sm mt-1">
          Add scenarios from the scenario builder as initiatives. Set start date and duration (weeks) on each scenario to show it on the chart.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-400">Add initiative:</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand min-w-[200px]"
          >
            <option value="">Select a scenario</option>
            {scenarios
              .filter((s) => !ganttIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {!s.startDate ? " (set start in builder)" : ""}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => addToGantt(selectedId)}
            disabled={!selectedId}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            Add to Gantt
          </button>
          {ganttScenarios.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">Zoom</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="text-xs text-slate-300 tabular-nums min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
        </div>

        {ganttScenarios.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-slate-500 text-sm">
            No initiatives on the Gantt yet. Create scenarios in the Scenario Builder, set a start date and duration (weeks), then add them here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="min-w-0"
              style={{ minWidth: `calc(366px + ${timelineWidthPx}px)` }}
            >
              <div
                className="grid gap-2 text-xs text-slate-400 mb-2 border-b border-slate-700 pb-2"
                style={{
                  gridTemplateColumns: `140px 110px 56px 56px ${timelineWidthPx}px`,
                  gridTemplateRows: "auto auto"
                }}
              >
                <div className="flex flex-col justify-center border-r border-slate-700 pr-2" style={{ gridRow: "span 2" }}>
                  Initiative
                </div>
                <div className="flex flex-col justify-center border-r border-slate-700 pr-2" style={{ gridRow: "span 2" }}>
                  Start
                </div>
                <div className="flex flex-col justify-center border-r border-slate-700 pr-2" style={{ gridRow: "span 2" }}>
                  Weeks
                </div>
                <div className="flex flex-col justify-center border-r border-slate-700 pr-2" style={{ gridRow: "span 2" }}>
                  Horizon (y)
                </div>
                <div
                  className="flex border-l border-slate-700 pl-px"
                  style={{ minWidth: `${timelineWidthPx}px` }}
                >
                  {yearLabels.map((year) => (
                    <span
                      key={year}
                      className="shrink-0 text-center font-medium text-slate-300 border-r border-slate-700 py-1"
                      style={{ width: `${yearWidthPx}px` }}
                    >
                      {year}
                    </span>
                  ))}
                </div>
                <div
                  className="flex border-l border-slate-700 pl-px"
                  style={{ minWidth: `${timelineWidthPx}px` }}
                >
                  {monthLabels.map((item, i) => (
                    <span
                      key={i}
                      className="shrink-0 text-center truncate py-0.5"
                      style={{ width: `${monthWidthPx}px` }}
                      title={`${item.label} (month ${item.monthIndex + 1})`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              {ganttScenarios.map((s) => (
                <div
                  key={s.id}
                  className="grid gap-2 items-center py-1.5 border-b border-slate-800 last:border-0"
                  style={{
                    gridTemplateColumns: `140px 110px 56px 56px ${timelineWidthPx}px`
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-white truncate" title={s.name}>
                      {s.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromGantt(s.id)}
                      className="text-slate-400 hover:text-red-400 shrink-0"
                      title="Remove from Gantt"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    type="date"
                    value={s.startDate ?? ""}
                    onChange={(e) =>
                      updateScenarioDates(s.id, e.target.value, s.durationWeeks ?? "", s.horizonYears)
                    }
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <input
                    type="number"
                    min={1}
                    value={s.durationWeeks ?? ""}
                    onChange={(e) =>
                      updateScenarioDates(
                        s.id,
                        s.startDate ?? "",
                        e.target.value === "" ? "" : Number(e.target.value),
                        s.horizonYears
                      )
                    }
                    placeholder="wks"
                    className="w-14 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={s.horizonYears ?? ""}
                    onChange={(e) =>
                      updateScenarioDates(
                        s.id,
                        s.startDate ?? "",
                        s.durationWeeks ?? "",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="5"
                    title="Timeline horizon in years"
                    className="w-14 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <div className="relative h-7 rounded bg-slate-800/80 overflow-hidden">
                    {yearLinePositionsPct.map((positionPct, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-slate-600 pointer-events-none"
                        style={{ left: `${positionPct}%` }}
                        aria-hidden
                      />
                    ))}
                    {s.startDate && s.durationWeeks ? (
                      <div
                        className="absolute inset-y-1 rounded bg-brand"
                        style={{
                          left: `${leftPct(s)}%`,
                          width: `${widthPct(s)}%`,
                          minWidth: "4px"
                        }}
                        title={`${s.startDate} — ${s.durationWeeks} weeks`}
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                        Set start & weeks above
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
