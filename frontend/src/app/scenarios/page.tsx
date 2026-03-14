"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "value-navigator-scenarios";

interface StoredScenario {
  id: string;
  name: string;
  savedAt: string;
  pipeline: unknown[];
}

function getStoredScenarios(): StoredScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function deleteScenario(id: string): StoredScenario[] {
  const next = getStoredScenarios().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

export default function SavedScenariosPage() {
  const [scenarios, setScenarios] = useState<StoredScenario[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setScenarios(getStoredScenarios());
  }, []);

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredScenarios =
    normalizedQuery === ""
      ? scenarios
      : scenarios.filter((s) => s.name.toLowerCase().includes(normalizedQuery));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Saved Scenarios</h2>
          <p className="text-slate-400 text-sm mt-1">
            View and open your saved scenarios, or create a new one.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {scenarios.length > 0 && (
            <div className="max-w-xs w-full">
              <input
                id="scenario-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search scenarios…"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          )}
          <Link
            href="/scenarios/builder"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 whitespace-nowrap"
          >
            Build new scenario
          </Link>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400 mb-4">No saved scenarios yet.</p>
          <Link
            href="/scenarios/builder"
            className="text-brand hover:underline text-sm font-medium"
          >
            Create your first scenario →
          </Link>
        </div>
      ) : filteredScenarios.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400 text-sm">
            No scenarios match your search. Try a different name.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredScenarios.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col"
            >
              <h3 className="font-semibold text-white truncate" title={s.name}>
                {s.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Saved {formatDate(s.savedAt)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {s.pipeline.length} block{s.pipeline.length === 1 ? "" : "s"} in pipeline
              </p>
              <div className="mt-3 pt-3 border-t border-slate-800 flex gap-2">
                <Link
                  href={`/scenarios/builder?open=${encodeURIComponent(s.id)}`}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Open
                </Link>
                <Link
                  href={`/scenarios/${encodeURIComponent(s.id)}/edit`}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Run forecast
                </Link>
                <button
                  type="button"
                  onClick={() => setScenarios(deleteScenario(s.id))}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50 hover:border-red-900"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
