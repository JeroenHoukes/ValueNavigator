"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type Block,
  type SavedScenario,
  availableBlocks,
  BLOCK_VALUE_FIELDS,
  getDefaultValues,
  loadScenarios,
  saveScenarios
} from "@/lib/scenarioConfig";

const STEPS = [
  { id: 1, title: "Name", description: "Give your scenario a name" },
  { id: 2, title: "Building blocks", description: "Choose blocks for your pipeline" },
  { id: 3, title: "Configure", description: "Enter values for each block" },
  { id: 4, title: "Review & save", description: "Check and save your scenario" }
] as const;

export default function ScenarioWizardPage() {
  const [step, setStep] = useState(1);
  const [scenarioName, setScenarioName] = useState("My scenario");
  const [pipeline, setPipeline] = useState<Block[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function addToPipeline(block: Block) {
    setPipeline((prev) => [
      ...prev,
      {
        ...block,
        id: `${block.id}-${prev.length}-${Date.now()}`,
        values: getDefaultValues(block.type)
      }
    ]);
  }

  function removeFromPipeline(index: number) {
    setPipeline((prev) => prev.filter((_, i) => i !== index));
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

  function handleSave() {
    setSaveStatus("saving");
    try {
      const scenarios = loadScenarios();
      const newScenario: SavedScenario = {
        id: crypto.randomUUID(),
        name: scenarioName.trim() || "My scenario",
        pipeline: pipeline.map((b, i) => ({ ...b, id: `${b.id}-${i}` })),
        savedAt: new Date().toISOString()
      };
      scenarios.push(newScenario);
      saveScenarios(scenarios);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  const canNext =
    (step === 1 && scenarioName.trim()) ||
    (step === 2 && pipeline.length > 0) ||
    step === 3 ||
    step === 4;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold">Scenario wizard</h2>
        <p className="text-slate-400 text-sm mt-1">
          Follow the steps to create a new scenario.
        </p>
      </div>

      {/* Step indicator */}
      <nav aria-label="Wizard steps" className="flex gap-2 flex-wrap">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              step === s.id
                ? "bg-brand text-white"
                : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </nav>

      {/* Step content */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
        {step === 1 && (
          <>
            <h3 className="font-semibold text-lg mb-1">{STEPS[0].title}</h3>
            <p className="text-slate-400 text-sm mb-4">{STEPS[0].description}</p>
            <label className="block">
              <span className="text-sm text-slate-400 block mb-2">Scenario name</span>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. Base case 2025"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-semibold text-lg mb-1">{STEPS[1].title}</h3>
            <p className="text-slate-400 text-sm mb-4">{STEPS[1].description}</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-2">Click a block to add it to the pipeline (in order).</p>
                <div className="flex flex-wrap gap-2">
                  {availableBlocks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => addToPipeline(b)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:border-brand hover:bg-slate-700"
                    >
                      + {b.label}
                    </button>
                  ))}
                </div>
              </div>
              {pipeline.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Pipeline order</p>
                  <ol className="space-y-2">
                    {pipeline.map((b, index) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                      >
                        <span>
                          {index + 1}. {b.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromPipeline(index)}
                          className="text-slate-400 hover:text-red-400 text-xs"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-semibold text-lg mb-1">{STEPS[2].title}</h3>
            <p className="text-slate-400 text-sm mb-4">{STEPS[2].description}</p>
            <div className="space-y-4">
              {pipeline.map((block, index) => {
                const fields = BLOCK_VALUE_FIELDS[block.type];
                const values = block.values ?? getDefaultValues(block.type);
                return (
                  <div
                    key={block.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/80 p-4 space-y-3"
                  >
                    <p className="font-medium text-sm">
                      {index + 1}. {block.label}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {fields.map((field) => (
                        <label key={field.key} className="block">
                          <span className="text-xs text-slate-400 block mb-1">{field.label}</span>
                          {field.kind === "number" ? (
                            <input
                              type="number"
                              step="any"
                              placeholder={field.placeholder}
                              value={values[field.key] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateBlockValues(index, field.key, v === "" ? "" : Number(v));
                              }}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder={field.placeholder}
                              value={String(values[field.key] ?? "")}
                              onChange={(e) => updateBlockValues(index, field.key, e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="font-semibold text-lg mb-1">{STEPS[3].title}</h3>
            <p className="text-slate-400 text-sm mb-4">{STEPS[3].description}</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Name</p>
                <p className="font-medium">{scenarioName || "My scenario"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">Pipeline</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {pipeline.map((b, i) => (
                    <li key={b.id}>
                      {b.label}
                      {b.values && Object.keys(b.values).length > 0 && (
                        <span className="text-slate-500 ml-2">
                          ({Object.entries(b.values)
                            .filter(([, v]) => v !== "" && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")})
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              {saveStatus === "saved" && (
                <p className="text-green-400 text-sm">Scenario saved. You can open it from Scenarios or edit in the builder.</p>
              )}
              {saveStatus === "error" && (
                <p className="text-red-400 text-sm">Failed to save. Try again.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === "saving"}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
              >
                {saveStatus === "saving" ? "Saving…" : "Save scenario"}
              </button>
              {saveStatus === "saved" && (
                <Link
                  href="/scenarios"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  View scenarios
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
