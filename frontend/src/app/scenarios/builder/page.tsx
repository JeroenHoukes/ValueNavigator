"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ScenarioBuilderDnD } from "@/components/ScenarioBuilderDnD";

export default function ScenarioBuilderPage() {
  const searchParams = useSearchParams();
  const openScenarioId = searchParams.get("open");

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Scenario Builder</h2>
      <p className="text-slate-300 max-w-2xl text-sm">
        Design your scenario by dragging financial drivers into the pipeline. When
        you are happy with the structure, you can save and run a forecast against
        the backend API.
      </p>
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-300">
          Prefer a guided flow? Use the scenario wizard to build step by step.
        </p>
        <Link
          href="/scenarios/wizard"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          Open scenario wizard
        </Link>
      </div>
      <ScenarioBuilderDnD openScenarioId={openScenarioId} />
    </div>
  );
}
