"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJourneys, saveJourneys, type SavedJourney } from "@/lib/journeyConfig";

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

function deleteJourney(id: string): SavedJourney[] {
  const next = loadJourneys().filter((j) => j.id !== id);
  saveJourneys(next);
  return next;
}

export default function JourneysListPage() {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);

  useEffect(() => {
    setJourneys(loadJourneys());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Saved Journeys</h2>
          <p className="text-slate-400 text-sm mt-1">
            View and open your saved customer journeys, or create a new one.
          </p>
        </div>
        <Link
          href="/journey"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          New journey
        </Link>
      </div>

      {journeys.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400 mb-4">No saved journeys yet.</p>
          <Link
            href="/journey"
            className="text-brand hover:underline text-sm font-medium"
          >
            Create your first journey →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {journeys.map((j) => (
            <li
              key={j.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col"
            >
              <h3 className="font-semibold text-white truncate" title={j.name}>
                {j.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Saved {formatDate(j.savedAt)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {j.steps.length} step{j.steps.length === 1 ? "" : "s"}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-800 flex gap-2">
                <Link
                  href={`/journey?open=${encodeURIComponent(j.id)}`}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => setJourneys(deleteJourney(j.id))}
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
