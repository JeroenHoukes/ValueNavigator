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
  endpoint?: string;
  keyColumn?: string;
};

export function EditableAiGrid({
  columns,
  rows,
  accessToken,
  endpoint = "/api/ai-data",
  keyColumn
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const effectiveKeyColumn = keyColumn ?? columns[0];
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, string>>({});

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
      if (col === effectiveKeyColumn) continue;
      const v = (newRow[col] ?? "").trim();
      if (v !== "") values[col] = v;
    }

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(endpoint, {
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

  function startEdit(rowIndex: number) {
    const row = rows[rowIndex] as Record<string, unknown>;
    const initial: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col];
      initial[col] =
        value === null || value === undefined
          ? ""
          : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    }
    setEditingRowIndex(rowIndex);
    setEditingRow(initial);
    setError(null);
  }

  function updateEditingCell(column: string, value: string) {
    setEditingRow((prev) => ({ ...prev, [column]: value }));
  }

  async function saveEdit() {
    if (editingRowIndex === null) return;
    setError(null);

    const row = rows[editingRowIndex] as Record<string, unknown>;
    const keyValue = row[effectiveKeyColumn];
    if (keyValue === undefined) {
      setError(
        `Key column "${effectiveKeyColumn}" not found on the selected row.`
      );
      return;
    }

    const values: Record<string, unknown> = {};
    for (const col of columns) {
      if (col === effectiveKeyColumn) continue;
      const raw = (editingRow[col] ?? "").trim();
      if (raw !== "") values[col] = raw;
    }

    if (Object.keys(values).length === 0) {
      setError("No editable columns were changed.");
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch(endpoint, {
        method: "PUT",
        headers,
        body: JSON.stringify({ keyColumn: effectiveKeyColumn, keyValue, values })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error || "Failed to update row.");
        return;
      }

      setEditingRowIndex(null);
      setEditingRow({});
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unexpected error while updating row."
      );
    }
  }

  async function deleteRow(rowIndex: number) {
    setError(null);
    const row = rows[rowIndex] as Record<string, unknown>;
    const keyValue = row[effectiveKeyColumn];
    if (keyValue === undefined) {
      setError(
        `Key column "${effectiveKeyColumn}" not found on the selected row.`
      );
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ keyColumn: effectiveKeyColumn, keyValue })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error || "Failed to delete row.");
        return;
      }

      if (editingRowIndex === rowIndex) {
        setEditingRowIndex(null);
        setEditingRow({});
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unexpected error while deleting row."
      );
    }
  }

  const filteredRows =
    filter.trim() === ""
      ? rows
      : rows.filter((row) =>
          columns.some((col) => {
            const value = (row as Record<string, unknown>)[col];
            if (value === null || value === undefined) return false;
            const text =
              typeof value === "object" ? JSON.stringify(value) : String(value);
            return text.toLowerCase().includes(filter.toLowerCase());
          })
        );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rows..."
          className="w-full max-w-xs rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder:text-slate-500"
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Clear filter
          </button>
        )}
      </div>
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
              <th
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/10"
                }
              >
                {columns.map((col) => {
                  const isEditing = editingRowIndex === rowIndex;
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
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingRow[col] ?? ""}
                          onChange={(e) =>
                            updateEditingCell(col, e.target.value)
                          }
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                        />
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 align-top text-slate-100 border-b border-slate-800/60 whitespace-nowrap">
                  {editingRowIndex === rowIndex ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={isPending}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRowIndex(null);
                          setEditingRow({});
                        }}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(rowIndex)}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(rowIndex)}
                        className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
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
              <td className="px-3 py-2 border-t border-slate-700 align-top" />
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

