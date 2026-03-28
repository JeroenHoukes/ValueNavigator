"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatApiErrorBody } from "@/lib/apiErrorMessage";

type TableAiRow = {
  [key: string]: unknown;
};

export type RowBlankFilterMode =
  | "none"
  | "any-column-empty"
  | "all-data-empty";

/** Fired after a successful row update or delete so the parent can offer undo. */
export type EditableGridUndoPayload =
  | {
      type: "update";
      keyColumn: string;
      keyValue: unknown;
      previousRow: Record<string, unknown>;
    }
  | { type: "delete"; keyColumn: string; row: Record<string, unknown> };

type Props = {
  columns: string[];
  rows: TableAiRow[];
  accessToken?: string | null;
  endpoint?: string;
  keyColumn?: string;
  onDataChanged?: () => void;
  selectColumns?: Record<
    string,
    {
      options: { value: string; label: string }[];
    }
  >;
  /**
   * When the user picks a select-backed label column, also set the paired FK id column
   * (often hidden). Maps label column name → id column name. If omitted, LookupName still
   * syncs to LookupId / LookupID / lookupID when those columns exist.
   */
  selectIdBindings?: Record<string, string>;
  hiddenColumns?: string[];
  /** Shown in the grid but excluded from add-row payload and row edit payload (e.g. computed/join columns). */
  readOnlyColumns?: string[];
  enableRowSelection?: boolean;
  onSelectionChange?: (selectedIds: unknown[]) => void;
  rowIdColumn?: string;
  /** When true, a column filter of exactly `(blank)` (case-insensitive) keeps only rows with an empty cell in that column. */
  enableBlankTokenFilter?: boolean;
  /** Row-level blank filter; key column is excluded from empty checks. */
  rowBlankFilter?: RowBlankFilterMode;
  /** Placeholder text on per-column filter inputs. */
  columnFilterPlaceholder?: string;
  onMutationSuccess?: (payload: EditableGridUndoPayload) => void;
  /** When set, errors are shown via this callback (e.g. modal) instead of inline text. */
  onErrorMessage?: (message: string) => void;
  /** Called after a successful add, update, or delete (for success popups). */
  onSuccessMessage?: (message: string) => void;
  /** When true, show sort/filter grid only (no add, edit, delete, or actions column). */
  readOnly?: boolean;
};

export function EditableAiGrid({
  columns,
  rows,
  accessToken,
  endpoint = "/api/ai-data",
  keyColumn,
  onDataChanged,
  selectColumns,
  selectIdBindings,
  hiddenColumns,
  readOnlyColumns,
  enableRowSelection,
  onSelectionChange,
  rowIdColumn,
  enableBlankTokenFilter,
  rowBlankFilter = "none",
  columnFilterPlaceholder = "Filter...",
  onMutationSuccess,
  onErrorMessage,
  onSuccessMessage,
  readOnly = false
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reportUserError(message: string) {
    if (onErrorMessage) {
      onErrorMessage(message);
    } else {
      setError(message);
    }
  }
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {}
  );
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const effectiveKeyColumn = keyColumn ?? columns[0];
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<unknown[]>([]);

  const [newRow, setNewRow] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      initial[col] = "";
    }
    return initial;
  });

  const visibleColumns =
    hiddenColumns && hiddenColumns.length > 0
      ? columns.filter((c) => !hiddenColumns.includes(c))
      : columns;

  const readOnlySet = useMemo(() => {
    const s = new Set<string>();
    for (const c of readOnlyColumns ?? []) s.add(c);
    return s;
  }, [readOnlyColumns]);

  const resolvedSelectIdBindings = useMemo(() => {
    const m: Record<string, string> = { ...(selectIdBindings ?? {}) };
    const lookupIdCol = columns.includes("LookupId")
      ? "LookupId"
      : columns.includes("LookupID")
        ? "LookupID"
        : columns.includes("lookupID")
          ? "lookupID"
          : null;
    if (
      lookupIdCol &&
      columns.includes("LookupName") &&
      m["LookupName"] === undefined
    ) {
      m["LookupName"] = lookupIdCol;
    }
    return m;
  }, [selectIdBindings, columns]);

  const idColumn = rowIdColumn ?? "id";

  function getRowId(row: TableAiRow): unknown {
    const anyRow = row as Record<string, unknown>;
    return anyRow[idColumn];
  }

  function updateCell(column: string, value: string) {
    setNewRow((prev) => {
      const next = { ...prev, [column]: value };
      const idCol = resolvedSelectIdBindings[column];
      if (idCol) next[idCol] = value;
      return next;
    });
  }

  async function handleSave() {
    setError(null);

    const values: Record<string, unknown> = {};
    for (const col of columns) {
      if (col === effectiveKeyColumn) continue;
      if (readOnlySet.has(col)) continue;
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
          | { error?: string; details?: string }
          | null;
        reportUserError(formatApiErrorBody(body, "Failed to insert row."));
        return;
      }

      setNewRow((prev) => {
        const cleared: Record<string, string> = {};
        for (const col of columns) cleared[col] = "";
        return cleared;
      });

      onSuccessMessage?.("Row added successfully.");

      if (onDataChanged) {
        startTransition(() => {
          onDataChanged();
        });
      }
    } catch (e) {
      reportUserError(
        e instanceof Error ? e.message : "Unexpected error while adding row."
      );
    }
  }

  function startEdit(rowIndex: number) {
    const row = filteredRows[rowIndex] as Record<string, unknown>;
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
    setEditingRow((prev) => {
      const next = { ...prev, [column]: value };
      const idCol = resolvedSelectIdBindings[column];
      if (idCol) next[idCol] = value;
      return next;
    });
  }

  async function saveEdit() {
    if (editingRowIndex === null) return;
    setError(null);

    const row = filteredRows[editingRowIndex] as Record<string, unknown>;
    const keyValue = row[effectiveKeyColumn];
    if (keyValue === undefined) {
      reportUserError(
        `Key column "${effectiveKeyColumn}" not found on the selected row.`
      );
      return;
    }

    const previousRow: Record<string, unknown> = { ...row };

    const values: Record<string, unknown> = {};
    for (const col of columns) {
      if (col === effectiveKeyColumn) continue;
      if (readOnlySet.has(col)) continue;
      const raw = (editingRow[col] ?? "").trim();
      if (raw !== "") values[col] = raw;
    }

    if (Object.keys(values).length === 0) {
      reportUserError("No editable columns were changed.");
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
          | { error?: string; details?: string }
          | null;
        reportUserError(formatApiErrorBody(body, "Failed to update row."));
        return;
      }

      setEditingRowIndex(null);
      setEditingRow({});
      onMutationSuccess?.({
        type: "update",
        keyColumn: effectiveKeyColumn,
        keyValue,
        previousRow
      });
      onSuccessMessage?.("Row updated successfully.");
      if (onDataChanged) {
        startTransition(() => {
          onDataChanged();
        });
      }
    } catch (e) {
      reportUserError(
        e instanceof Error ? e.message : "Unexpected error while updating row."
      );
    }
  }

  async function deleteRow(rowIndex: number) {
    // Confirm before deleting
    // eslint-disable-next-line no-alert
    if (!window.confirm("Are you sure you want to delete this row?")) {
      return;
    }
    setError(null);
    const row = filteredRows[rowIndex] as Record<string, unknown>;
    const keyValue = row[effectiveKeyColumn];
    if (keyValue === undefined) {
      reportUserError(
        `Key column "${effectiveKeyColumn}" not found on the selected row.`
      );
      return;
    }

    const rowSnapshot: Record<string, unknown> = { ...row };

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
          | { error?: string; details?: string }
          | null;
        reportUserError(formatApiErrorBody(body, "Failed to delete row."));
        return;
      }

      onMutationSuccess?.({
        type: "delete",
        keyColumn: effectiveKeyColumn,
        row: rowSnapshot
      });
      onSuccessMessage?.("Row deleted successfully.");

      if (editingRowIndex === rowIndex) {
        setEditingRowIndex(null);
        setEditingRow({});
      }

      if (onDataChanged) {
        startTransition(() => {
          onDataChanged();
        });
      }
    } catch (e) {
      reportUserError(
        e instanceof Error ? e.message : "Unexpected error while deleting row."
      );
    }
  }

  function updateColumnFilter(column: string, value: string) {
    setColumnFilters((prev) => ({ ...prev, [column]: value }));
  }

  function toggleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function getCellText(row: TableAiRow, col: string): string {
    const value = (row as Record<string, unknown>)[col];
    if (value === null || value === undefined) return "";
    const raw =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    // For select-backed columns (e.g. LookupName), filter/sort by label text
    // that the user sees instead of the stored internal value (lookup id).
    const selectConfig = selectColumns?.[col];
    if (selectConfig && raw !== "") {
      const match = selectConfig.options.find((opt) => opt.value === raw);
      if (match) return match.label;
    }

    return raw;
  }

  function isBlankTokenFilter(raw: string): boolean {
    const t = raw.trim().toLowerCase();
    return t === "(blank)" || t === "[blank]";
  }

  const filteredRows = rows
    .filter((row) => {
      if (rowBlankFilter === "any-column-empty") {
        const cols = visibleColumns.filter((c) => c !== effectiveKeyColumn);
        const anyEmpty = cols.some(
          (col) => getCellText(row, col).trim() === ""
        );
        if (!anyEmpty) return false;
      }
      if (rowBlankFilter === "all-data-empty") {
        const cols = visibleColumns.filter((c) => c !== effectiveKeyColumn);
        if (cols.length === 0) return true;
        const allEmpty = cols.every(
          (col) => getCellText(row, col).trim() === ""
        );
        if (!allEmpty) return false;
      }

      for (const col of visibleColumns) {
        const rawFilter = (columnFilters[col] ?? "").trim();
        if (!rawFilter) continue;
        const colFilter = rawFilter.toLowerCase();
        const display = getCellText(row, col);
        const text = display.toLowerCase();

        if (enableBlankTokenFilter && isBlankTokenFilter(rawFilter)) {
          if (display.trim() !== "") return false;
          continue;
        }

        if (!text.includes(colFilter)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      const av = getCellText(a, sortColumn);
      const bv = getCellText(b, sortColumn);
      if (sortDirection === "asc") return av.localeCompare(bv);
      return bv.localeCompare(av);
    });

  useEffect(() => {
    if (!enableRowSelection) return;
    const visibleIdSet = new Set(filteredRows.map((row) => getRowId(row)));
    const nextSelected = selectedIds.filter((id) => visibleIdSet.has(id));
    const changed =
      nextSelected.length !== selectedIds.length ||
      nextSelected.some((id, idx) => id !== selectedIds[idx]);

    if (changed) {
      setSelectedIds(nextSelected);
      onSelectionChange?.(nextSelected);
    }
  }, [enableRowSelection, filteredRows, selectedIds, onSelectionChange]);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              {enableRowSelection && (
                <th
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800"
                >
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={
                      filteredRows.length > 0 &&
                      filteredRows.every((row) =>
                        selectedIds.includes(getRowId(row))
                      )
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = filteredRows.map((row) =>
                          getRowId(row)
                        );
                        setSelectedIds(allIds);
                        onSelectionChange?.(allIds);
                      } else {
                        setSelectedIds([]);
                        onSelectionChange?.([]);
                      }
                    }}
                  />
                </th>
              )}
              {!readOnly && (
                <th
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800"
                >
                  Actions
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800 align-top"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    <span>{col}</span>
                    {sortColumn === col && (
                      <span aria-hidden>
                        {sortDirection === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </button>
                  <input
                    type="text"
                    value={columnFilters[col] ?? ""}
                    onChange={(e) => updateColumnFilter(col, e.target.value)}
                    placeholder={columnFilterPlaceholder}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-white placeholder:text-slate-500"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!readOnly && (
              <tr className="bg-slate-900/60">
                {enableRowSelection && (
                  <td className="px-3 py-2 border-t border-slate-700 align-top" />
                )}
                <td className="px-3 py-2 border-t border-slate-700 align-top">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Saving..." : "Save"}
                  </button>
                </td>
                {visibleColumns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 border-t border-slate-700 align-top"
                  >
                    {readOnlySet.has(col) ? (
                      <span className="text-slate-600 text-xs">—</span>
                    ) : selectColumns && selectColumns[col] ? (
                      <select
                        value={newRow[col] ?? ""}
                        onChange={(e) => updateCell(col, e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                      >
                        <option value="">Select {col}</option>
                        {selectColumns[col].options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newRow[col] ?? ""}
                        onChange={(e) => updateCell(col, e.target.value)}
                        placeholder={`New ${col}`}
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                      />
                    )}
                  </td>
                ))}
              </tr>
            )}
            {filteredRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/10"
                }
              >
                {enableRowSelection && (
                  <td className="px-3 py-2 align-top text-slate-100 border-b border-slate-800/60 whitespace-nowrap">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${rowIndex + 1}`}
                      checked={selectedIds.includes(getRowId(row))}
                      onChange={(e) => {
                        const id = getRowId(row);
                        setSelectedIds((prev) => {
                          let next: unknown[];
                          if (e.target.checked) {
                            next = prev.includes(id)
                              ? prev
                              : [...prev, id];
                          } else {
                            next = prev.filter((x) => x !== id);
                          }
                          onSelectionChange?.(next);
                          return next;
                        });
                      }}
                    />
                  </td>
                )}
                {!readOnly && (
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
                )}
                {visibleColumns.map((col) => {
                  const isEditing = editingRowIndex === rowIndex;
                  const value = (row as Record<string, unknown>)[col];
                  let display =
                    value === null || value === undefined
                      ? ""
                      : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value);

                  const selectConfig = selectColumns?.[col];
                  if (selectConfig && display !== "") {
                    const match = selectConfig.options.find(
                      (opt) => opt.value === display
                    );
                    if (match) display = match.label;
                  }
                  return (
                    <td
                      key={col}
                      className="px-3 py-2 align-top text-slate-100 border-b border-slate-800/60 whitespace-nowrap"
                    >
                      {isEditing ? (
                        readOnlySet.has(col) ? (
                          <span className="text-slate-400 text-xs">{display}</span>
                        ) : selectColumns && selectColumns[col] ? (
                          <select
                            value={editingRow[col] ?? ""}
                            onChange={(e) =>
                              updateEditingCell(col, e.target.value)
                            }
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                          >
                            <option value="">Select {col}</option>
                            {selectColumns[col].options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editingRow[col] ?? ""}
                            onChange={(e) =>
                              updateEditingCell(col, e.target.value)
                            }
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                          />
                        )
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && !onErrorMessage && (
        <p className="text-xs text-red-300 max-w-md break-all">{error}</p>
      )}
    </div>
  );
}

