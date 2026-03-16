"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TableAiRow = {
  [key: string]: unknown;
};

type Props = {
  columns: string[];
  rows: TableAiRow[];
  accessToken?: string | null;
};

export function EditableAiGrid({ columns, rows, accessToken }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newRow, setNewRow] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      initial[col] = "";
    }
    return initial;
  });

  function updateCell(column: string, value: string) {
    setNewRow((prev) => ({ ...prev, [column]: value }));
  }

  async function handleSave() {
    setError(null);

    const values: Record<string, unknown> = {};
    for (const col of columns) {
      const v = (newRow[col] ?? "").trim();
      if (v !== "") values[col] = v;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch("/api/ai-data", {
        method: "POST",
        headers,
        body: JSON.stringify({ values })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error || "Failed to insert row.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unexpected error while adding row."
      );
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/10"
                }
              >
                {columns.map((col) => {
                  const value = (row as Record<string, unknown>)[col];
                  const display =
                    value === null || value === undefined
                      ? ""
                      : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value);
                  return (
                    <td
                      key={col}
                      className="px-3 py-2 align-top text-slate-100 border-b border-slate-800/60 whitespace-nowrap"
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-slate-900/60">
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-2 border-t border-slate-700 align-top"
                >
                  <input
                    type="text"
                    value={newRow[col] ?? ""}
                    onChange={(e) => updateCell(col, e.target.value)}
                    placeholder={`New ${col}`}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save new row"}
        </button>
        {error && (
          <p className="text-xs text-red-300 max-w-md break-all">{error}</p>
        )}
      </div>
      <p className="text-xs text-slate-400 max-w-md">
        Type values for the new row directly in the bottom grid row, then click{" "}
        <span className="font-medium">Save new row</span>. Columns left empty
        will use their default values.
      </p>
    </div>
  );
}

