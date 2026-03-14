"use client";

import { useState, useEffect } from "react";
import {
  type Block,
  type SavedScenario,
  BLOCK_VALUE_FIELDS,
  availableBlocks,
  getDefaultValues,
  loadScenarios,
  saveScenarios
} from "@/lib/scenarioConfig";

export type { BlockValues, SavedScenario } from "@/lib/scenarioConfig";

export function ScenarioBuilderDnD({ openScenarioId = null }: { openScenarioId?: string | null }) {
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<Block[]>([]);
  const [scenarioName, setScenarioName] = useState("My scenario");
  const [scenarioStartDate, setScenarioStartDate] = useState("");
  const [scenarioDurationWeeks, setScenarioDurationWeeks] = useState<number | "">(4);
  const [scenarioHorizonYears, setScenarioHorizonYears] = useState<number | "">(5);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSavedScenarios(loadScenarios());
  }, []);

  useEffect(() => {
    if (!openScenarioId) return;
    const scenarios = loadScenarios();
    const scenario = scenarios.find((s) => s.id === openScenarioId);
    if (scenario) {
      setCurrentScenarioId(scenario.id);
      setScenarioName(scenario.name);
      setScenarioStartDate(scenario.startDate ?? "");
      setScenarioDurationWeeks(scenario.durationWeeks ?? 4);
      setScenarioHorizonYears(scenario.horizonYears ?? 5);
      setPipeline(scenario.pipeline.map((b, i) => ({ ...b, id: `${b.type}-${i}-${scenario.id}` })));
      setExpandedIndex(null);
      setSavedScenarios(scenarios);
    }
  }, [openScenarioId]);

  function loadScenarioById(id: string | null) {
    if (!id) {
      setCurrentScenarioId(null);
      setPipeline([]);
      setScenarioName("My scenario");
      setScenarioStartDate("");
      setScenarioDurationWeeks(4);
      setScenarioHorizonYears(5);
      setExpandedIndex(null);
      return;
    }
    const scenario = savedScenarios.find((s) => s.id === id);
    if (scenario) {
      setCurrentScenarioId(scenario.id);
      setScenarioName(scenario.name);
      setScenarioStartDate(scenario.startDate ?? "");
      setScenarioDurationWeeks(scenario.durationWeeks ?? 4);
      setScenarioHorizonYears(scenario.horizonYears ?? 5);
      setPipeline(scenario.pipeline.map((b, i) => ({ ...b, id: `${b.type}-${i}-${scenario.id}` })));
      setExpandedIndex(null);
    }
  }

  function updateBlockValues(index: number, key: string, value: string | number) {
    setPipeline((prev) => {
      const next = [...prev];
      const block = next[index];
      next[index] = {
        ...block,
        values: { ...(block.values ?? getDefaultValues(block.type)), [key]: value }
      };
      return next;
    });
  }

  function onDragStart(e: React.DragEvent<HTMLDivElement>, block: Block) {
    e.dataTransfer.setData("application/json", JSON.stringify(block));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const block = JSON.parse(data) as Block;
    setPipeline((prev) => [
      ...prev,
      {
        ...block,
        id: `${block.id}-${prev.length}`,
        values: block.values ?? getDefaultValues(block.type)
      }
    ]);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function removeFromPipeline(index: number) {
    setPipeline((prev) => prev.filter((_, i) => i !== index));
  }

  function blockValuesSummary(block: Block): string {
    const fields = BLOCK_VALUE_FIELDS[block.type];
    const values = block.values ?? getDefaultValues(block.type);
    const parts = fields
      .map((f) => {
        const v = values[f.key];
        if (v === undefined || v === "") return null;
        const label = f.label.replace(/\s*\([^)]*\)\s*$/, "").trim(); // drop parenthetical like (€M)
        return `${label}: ${v}`;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "";
  }

  function handleSave() {
    setSaveStatus("saving");
    try {
      const scenarios = loadScenarios();
      const name = scenarioName.trim() || "My scenario";
      const payload: SavedScenario = {
        id: currentScenarioId ?? crypto.randomUUID(),
        name,
        pipeline: pipeline.map((b, i) => ({ ...b, id: `${b.id}-${i}` })),
        savedAt: new Date().toISOString(),
        startDate: scenarioStartDate || undefined,
        durationWeeks: scenarioDurationWeeks === "" ? undefined : Number(scenarioDurationWeeks),
        horizonYears: scenarioHorizonYears === "" ? undefined : Number(scenarioHorizonYears)
      };
      if (currentScenarioId) {
        const idx = scenarios.findIndex((s) => s.id === currentScenarioId);
        if (idx >= 0) scenarios[idx] = payload;
        else scenarios.push(payload);
      } else {
        scenarios.push(payload);
      }
      saveScenarios(scenarios);
      setSavedScenarios(scenarios);
      if (!currentScenarioId) setCurrentScenarioId(payload.id);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-semibold mb-2">Building Blocks</h3>
        <p className="text-xs text-slate-400 mb-3">
          Drag blocks into the scenario pipeline to define your forecast logic.
        </p>
        <div className="space-y-2">
          {availableBlocks.map((b) => (
            <div
              key={b.id}
              draggable
              onDragStart={(e) => onDragStart(e, b)}
              className="cursor-move rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-brand"
            >
              <p className="font-medium">{b.label}</p>
              <p className="text-xs text-slate-400">{b.type}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="md:col-span-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-4"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h3 className="font-semibold">Scenario Pipeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Drop blocks here in the order they should be applied.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="load-scenario" className="text-xs text-slate-400 whitespace-nowrap">
                Load scenario:
              </label>
              <select
                id="load-scenario"
                value={currentScenarioId ?? ""}
                onChange={(e) => loadScenarioById(e.target.value || null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand min-w-[140px]"
              >
                <option value="">New scenario</option>
                {savedScenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Scenario name"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand w-40"
            />
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">Start (Gantt):</span>
              <input
                type="date"
                value={scenarioStartDate}
                onChange={(e) => setScenarioStartDate(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">Weeks:</span>
              <input
                type="number"
                min={1}
                value={scenarioDurationWeeks}
                onChange={(e) => setScenarioDurationWeeks(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="4"
                className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">Horizon (y):</span>
              <input
                type="number"
                min={1}
                max={30}
                value={scenarioHorizonYears}
                onChange={(e) => setScenarioHorizonYears(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="5"
                className="w-14 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </label>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving" || pipeline.length === 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStatus === "saving" ? "Saving…" : currentScenarioId ? "Save changes" : "Save scenario"}
            </button>
          </div>
        </div>
        {saveStatus === "saved" && (
          <p className="text-sm text-green-400 mb-3">Scenario saved.</p>
        )}
        {saveStatus === "error" && (
          <p className="text-sm text-red-400 mb-3">Failed to save. Try again.</p>
        )}

        {pipeline.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-500">
            Drag blocks from the left to start building a scenario.
          </div>
        ) : (
          <ol className="space-y-2">
            {pipeline.map((b, index) => {
              const fields = BLOCK_VALUE_FIELDS[b.type];
              const values = b.values ?? getDefaultValues(b.type);
              const isExpanded = expandedIndex === index;
              const summary = blockValuesSummary(b);
              return (
                <li
                  key={b.id}
                  className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIndex((prev) => (prev === index ? null : index))
                        }
                        className="text-slate-400 hover:text-white transition-colors"
                        aria-expanded={isExpanded}
                        title={isExpanded ? "Collapse" : "Edit values"}
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                      <div>
                        <p className="font-medium">
                          Step {index + 1}: {b.label}
                        </p>
                        <p className="text-xs text-slate-400">{b.type}</p>
                        {summary && (
                          <p className="text-xs text-slate-300 mt-0.5 truncate max-w-md" title={summary}>
                            {summary}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromPipeline(index)}
                      className="text-xs text-slate-400 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-700 bg-slate-900/60 px-3 py-3 space-y-3">
                      <p className="text-xs text-slate-400 font-medium">
                        Enter values for this block
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {fields.map((field) => (
                          <label key={field.key} className="block">
                            <span className="text-xs text-slate-400 block mb-1">
                              {field.label}
                            </span>
                            {field.kind === "number" ? (
                              <input
                                type="number"
                                step="any"
                                placeholder={field.placeholder}
                                value={values[field.key] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateBlockValues(
                                    index,
                                    field.key,
                                    v === "" ? "" : Number(v)
                                  );
                                }}
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                              />
                            ) : (
                              <input
                                type="text"
                                placeholder={field.placeholder}
                                value={String(values[field.key] ?? "")}
                                onChange={(e) =>
                                  updateBlockValues(index, field.key, e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
