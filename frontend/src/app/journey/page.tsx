"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  type JourneyStep,
  type SavedJourney,
  type JourneyStepMetrics,
  STEP_METRIC_FIELDS,
  createStep,
  defaultStepMetrics,
  loadJourneys,
  saveJourneys
} from "@/lib/journeyConfig";
import { useAppActions } from "@/contexts/AppActionsContext";

function CustomerJourneyContent() {
  const searchParams = useSearchParams();
  const openJourneyId = searchParams.get("open");
  const [journeyName, setJourneyName] = useState("My customer journey");
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedJourney[]>([]);
  const [currentJourneyId, setCurrentJourneyId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { registerJourneyActions, unregisterJourneyActions } = useAppActions();

  useEffect(() => {
    setSavedList(loadJourneys());
  }, []);

  useEffect(() => {
    if (!openJourneyId) return;
    const list = loadJourneys();
    const j = list.find((x) => x.id === openJourneyId);
    if (j) {
      setJourneyName(j.name);
      setSteps(j.steps.map((s) => ({ ...s, id: s.id || `step-${Date.now()}` })));
      setCurrentJourneyId(j.id);
      setExpandedId(null);
      setSavedList(list);
    }
  }, [openJourneyId]);

  function addStep() {
    setSteps((prev) => [...prev, createStep(`Step ${prev.length + 1}`, prev.length)]);
  }

  function addStepWithData(name: string, volume?: number) {
    setSteps((prev) => [...prev, createStep(name, prev.length, { volume })]);
  }

  useEffect(() => {
    registerJourneyActions({ addStep: addStepWithData });
    return () => unregisterJourneyActions();
  }, [registerJourneyActions, unregisterJourneyActions]);

  function removeStep(index: number) {
    const removed = steps[index];
    setSteps((prev) => prev.filter((_, i) => i !== index));
    if (expandedId === removed.id) setExpandedId(null);
  }

  function updateStepName(index: number, name: string) {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  }

  function updateStepMetrics(index: number, key: keyof JourneyStepMetrics, value: number | "") {
    setSteps((prev) => {
      const next = prev.map((s, i) => ({ ...s, metrics: { ...defaultStepMetrics(), ...s.metrics } }));
      const step = next[index];
      const metrics = { ...step.metrics!, [key]: value };
      if (key === "proportionBaseStepIndex" && typeof value === "number" && value >= index) {
        metrics.proportionBaseStepIndex = Math.max(0, index - 1);
      }
      next[index] = { ...step, metrics };

      if (index > 0 && (key === "proportionOfFirstStepPct" || key === "proportionBaseStepIndex")) {
        const baseIdx = Math.min(metrics.proportionBaseStepIndex ?? 0, index - 1);
        const baseStepVolume = next[baseIdx]?.metrics?.volume;
        if (typeof baseStepVolume === "number" && metrics.proportionOfFirstStepPct !== undefined && metrics.proportionOfFirstStepPct !== "") {
          next[index] = {
            ...next[index],
            metrics: {
              ...next[index].metrics!,
              volume: Math.round((Number(metrics.proportionOfFirstStepPct) / 100) * baseStepVolume)
            }
          };
        }
      }

      if (key === "volume" && index < next.length) {
        for (let i = index + 1; i < next.length; i++) {
          const s = next[i].metrics!;
          const baseIdx = Math.min(typeof s.proportionBaseStepIndex === "number" ? s.proportionBaseStepIndex : 0, i - 1);
          if (baseIdx === index && s.proportionOfFirstStepPct !== undefined && s.proportionOfFirstStepPct !== "") {
            const baseVol = next[index].metrics?.volume;
            if (typeof baseVol === "number") {
              next[i] = {
                ...next[i],
                metrics: { ...s, volume: Math.round((Number(s.proportionOfFirstStepPct) / 100) * baseVol) }
              };
            }
          }
        }
      }

      return next;
    });
  }

  function reorderSteps(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setSteps((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(fromIndex)) return;
    reorderSteps(fromIndex, toIndex);
    setDraggedIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  function loadJourneyById(id: string | null) {
    if (!id) {
      setJourneyName("My customer journey");
      setSteps([]);
      setCurrentJourneyId(null);
      setExpandedId(null);
      return;
    }
    const j = savedList.find((x) => x.id === id);
    if (j) {
      setJourneyName(j.name);
      setSteps(j.steps.map((s) => ({ ...s, id: s.id || `step-${Date.now()}` })));
      setCurrentJourneyId(j.id);
      setExpandedId(null);
    }
  }

  function getBaseStepVolume(baseIndex: number): number | null {
    if (baseIndex < 0 || baseIndex >= steps.length) return null;
    const v = steps[baseIndex].metrics?.volume;
    return typeof v === "number" ? v : null;
  }

  function getStepVolumeNumber(step: JourneyStep, index: number): number | null {
    if (index === 0) {
      const v = step.metrics?.volume;
      return typeof v === "number" ? v : null;
    }
    const pct = step.metrics?.proportionOfFirstStepPct;
    if (pct === undefined || pct === "") return null;
    const baseIndex = Math.min(
      typeof step.metrics?.proportionBaseStepIndex === "number" ? step.metrics.proportionBaseStepIndex : 0,
      index - 1
    );
    const baseVolume = getBaseStepVolume(baseIndex);
    if (baseVolume == null) return null;
    return Math.round((Number(pct) / 100) * baseVolume);
  }

  const maxVolume = steps.length
    ? Math.max(
        ...steps.map((s, i) => getStepVolumeNumber(s, i) ?? 0),
        1
      )
    : 1;

  /** Volume for the step being edited = (selected base step's volume × proportion %) / 100. Base step can be Step 1, 2, 3, etc. */
  function getStepVolumeDisplay(step: JourneyStep, index: number): string {
    if (index === 0) {
      const v = step.metrics?.volume;
      if (v === undefined || v === "") return "—";
      return String(v);
    }
    const pct = step.metrics?.proportionOfFirstStepPct;
    const baseIndex = Math.min(
      typeof step.metrics?.proportionBaseStepIndex === "number" ? step.metrics.proportionBaseStepIndex : 0,
      index - 1
    );
    const baseLabel = baseIndex + 1;
    const baseVolume = getBaseStepVolume(baseIndex);
    if (pct === undefined || pct === "") {
      return `of step ${baseLabel}`;
    }
    if (baseVolume == null) return `${pct}% of step ${baseLabel} (—)`;
    const absolute = Math.round((Number(pct) / 100) * baseVolume);
    return `${pct}% of step ${baseLabel} (${absolute})`;
  }

  function handleSave() {
    setSaveStatus("saving");
    try {
      const list = loadJourneys();
      const payload: SavedJourney = {
        id: currentJourneyId ?? crypto.randomUUID(),
        name: journeyName.trim() || "My customer journey",
        steps: steps.map((s) => ({ ...s, metrics: { ...defaultStepMetrics(), ...s.metrics } })),
        savedAt: new Date().toISOString()
      };
      const idx = list.findIndex((j) => j.id === payload.id);
      if (idx >= 0) list[idx] = payload;
      else list.push(payload);
      saveJourneys(list);
      setSavedList(list);
      setCurrentJourneyId(payload.id);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }

  function handleDeleteJourney() {
    if (!currentJourneyId) return;
    const list = loadJourneys().filter((j) => j.id !== currentJourneyId);
    saveJourneys(list);
    setSavedList(list);
    loadJourneyById(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Customer journey</h2>
        <p className="text-slate-400 text-sm mt-1">
          Build your journey with drag-and-drop steps and add volume, revenue, costs, growth and satisfaction per step.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="load-journey" className="text-sm text-slate-400">
              Load:
            </label>
            <select
              id="load-journey"
              value={currentJourneyId ?? ""}
              onChange={(e) => loadJourneyById(e.target.value || null)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand min-w-[160px]"
            >
              <option value="">New journey</option>
              {savedList.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={journeyName}
            onChange={(e) => setJourneyName(e.target.value)}
            placeholder="Journey name"
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand w-48"
          />
          <button
            type="button"
            onClick={addStep}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
          >
            Add step
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={steps.length === 0}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save journey"}
          </button>
          {currentJourneyId && (
            <button
              type="button"
              onClick={handleDeleteJourney}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50 hover:border-red-900"
            >
              Delete journey
            </button>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-400">Save failed</span>
          )}
        </div>

        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-slate-500 text-sm">
            No steps yet. Click &quot;Add step&quot; to add journey steps, then drag to reorder and expand to enter volume, revenue, costs, growth and satisfaction.
          </div>
        ) : (
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li
                key={step.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`rounded-lg border bg-slate-800 overflow-hidden transition-opacity ${
                  draggedIndex === index ? "opacity-50" : "border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span
                    className="cursor-grab touch-none text-slate-500 hover:text-slate-300 shrink-0"
                    title="Drag to reorder"
                    aria-label="Drag to reorder"
                  >
                    ⋮⋮
                  </span>
                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) => updateStepName(index, e.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-1 text-sm font-medium text-white placeholder-slate-500 focus:outline-none"
                    placeholder="Step name"
                  />
                  <div className="flex shrink-0 items-center justify-start gap-2">
                    <div
                      className="h-2 w-20 rounded-full bg-slate-700 overflow-hidden shrink-0"
                      title={`Volume: ${getStepVolumeNumber(step, index) ?? "—"}`}
                      role="img"
                      aria-label={`Volume bar ${getStepVolumeNumber(step, index) ?? 0} of ${maxVolume}`}
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-200"
                        style={{
                          width: `${maxVolume > 0 && getStepVolumeNumber(step, index) != null
                            ? Math.min(100, (getStepVolumeNumber(step, index)! / maxVolume) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-slate-400" title={index === 0 ? "Volume" : "Proportion · volume"}>
                      {index === 0 ? "Vol:" : "Prop:"} {getStepVolumeDisplay(step, index)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === step.id ? null : step.id)}
                      className="rounded px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                      {expandedId === step.id ? "Hide details" : "Details"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-slate-400 hover:text-red-400 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {expandedId === step.id && (
                  <div className="border-t border-slate-700 bg-slate-900/60 px-3 py-4">
                    <p className="text-xs text-slate-400 mb-3">Metrics (aligned with building blocks)</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {index > 0 && (
                        <>
                          <label className="block">
                            <span className="text-xs text-slate-400 block mb-1">Proportion calculated from</span>
                            <select
                              value={Math.min(
                                Math.max(0, step.metrics?.proportionBaseStepIndex ?? 0),
                                index - 1
                              )}
                              onChange={(e) =>
                                updateStepMetrics(index, "proportionBaseStepIndex", Number(e.target.value))
                              }
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                            >
                              {Array.from({ length: index }, (_, i) => (
                                <option key={i} value={i}>
                                  Step {i + 1}
                                  {steps[i]?.name ? ` (${steps[i].name})` : ""}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-slate-500 mt-0.5 block">
                              Volume is calculated as % of this step&apos;s volume
                            </span>
                          </label>
                          <label className="block">
                            <span className="text-xs text-slate-400 block mb-1">Proportion %</span>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              max={100}
                              placeholder="e.g. 25"
                              value={step.metrics?.proportionOfFirstStepPct ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateStepMetrics(index, "proportionOfFirstStepPct", v === "" ? "" : Number(v));
                              }}
                              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                            <span className="text-xs text-slate-500 mt-0.5 block">
                              % of selected step&apos;s volume that goes through this step
                            </span>
                          </label>
                        </>
                      )}
                      {STEP_METRIC_FIELDS.map(({ key, label, placeholder }) => {
                        const isVolumeFromProportion = index > 0 && key === "volume" &&
                          step.metrics?.proportionOfFirstStepPct !== undefined &&
                          step.metrics?.proportionOfFirstStepPct !== "" &&
                          getBaseStepVolume(Math.min(step.metrics?.proportionBaseStepIndex ?? 0, index - 1)) != null;
                        return (
                          <label key={key} className="block">
                            <span className="text-xs text-slate-400 block mb-1">
                              {label}
                              {isVolumeFromProportion && " (from proportion)"}
                            </span>
                            <input
                              type="number"
                              step="any"
                              placeholder={placeholder}
                              readOnly={isVolumeFromProportion}
                              value={step.metrics?.[key] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateStepMetrics(index, key, v === "" ? "" : Number(v));
                              }}
                              className={`w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand ${isVolumeFromProportion ? "opacity-90" : ""}`}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function CustomerJourneyPage() {
  return (
    <Suspense fallback={<div className="text-slate-400">Loading...</div>}>
      <CustomerJourneyContent />
    </Suspense>
  );
}
