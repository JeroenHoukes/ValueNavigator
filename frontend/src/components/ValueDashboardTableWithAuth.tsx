"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EditableAiGrid,
  type EditableGridUndoPayload,
  type RowBlankFilterMode
} from "@/components/EditableAiGrid";
import { TopNoticeBar } from "@/components/TopNoticeBar";
import { useModelOutputRows } from "@/hooks/useModelOutputRows";
import { formatApiErrorBody } from "@/lib/apiErrorMessage";
import {
  downloadValueTableSourceExcel,
  hasMilestoneKey,
  inferMilestoneKeyColumn,
  isMilestoneRowEmpty,
  milestoneRowToInsertValues,
  milestoneRowToUpdateValues,
  parseMilestoneWorkbook
} from "@/lib/milestoneExcel";
import {
  isProjectLookupIdColumn,
  isProjectModelViewVirtualColumn,
  normalizeProjectModelViewRowsForGrid,
  PROJECT_LOOKUP_SELECT_BINDINGS
} from "@/lib/projectModelViewSql";
import {
  VALUE_DASHBOARD_SOURCES,
  getValueDashboardSourceConfig,
  type ValueDashboardSourceId
} from "@/lib/valueDashboardSources";

type TableUndoState =
  | {
      kind: "update";
      keyColumn: string;
      keyValue: unknown;
      previousRow: Record<string, unknown>;
    }
  | { kind: "delete"; keyColumn: string; row: Record<string, unknown> }
  | { kind: "bulk-delete"; keyColumn: string; rows: Record<string, unknown>[] };

type BulkUpdateUndo = {
  keyColumn: string;
  items: { keyValue: unknown; values: Record<string, unknown> }[];
};

function rowToRestoreInsertValues(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v === undefined ? null : v;
  }
  return out;
}

function rowIdsMatch(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

const AUDIT_COLUMNS = new Set([
  "LastUpdate",
  "LastUpd",
  "lastupd",
  "UserName",
  "username"
]);

export function ValueDashboardTableWithAuth() {
  const [dataSource, setDataSource] =
    useState<ValueDashboardSourceId | null>(null);

  const {
    rows,
    emptyTableColumns,
    loading,
    error,
    isAuthenticated,
    isLoginInProgress,
    handleLogin,
    accounts,
    accessToken,
    reload
  } = useModelOutputRows(dataSource);

  const [rowBlankFilter, setRowBlankFilter] =
    useState<RowBlankFilterMode>("none");
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImport, setExcelImport] = useState<{
    status: "idle" | "running" | "done" | "error";
    message?: string;
    detail?: string;
  }>({ status: "idle" });
  const [selectedIds, setSelectedIds] = useState<unknown[]>([]);
  const [lastUndo, setLastUndo] = useState<TableUndoState | null>(null);
  const [lastBulkUndo, setLastBulkUndo] = useState<BulkUpdateUndo | null>(null);
  const [notice, setNotice] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  const [bulkColumn1, setBulkColumn1] = useState("");
  const [bulkValue1, setBulkValue1] = useState("");
  const [bulkColumn2, setBulkColumn2] = useState("");
  const [bulkValue2, setBulkValue2] = useState("");
  const [projectLookups, setProjectLookups] = useState<{
    family: { value: string; label: string }[];
    pillar: { value: string; label: string }[];
    strategy: { value: string; label: string }[];
  } | null>(null);

  useEffect(() => {
    setSelectedIds([]);
    setLastUndo(null);
    setLastBulkUndo(null);
    setBulkColumn1("");
    setBulkValue1("");
    setBulkColumn2("");
    setBulkValue2("");
    setExcelImport({ status: "idle" });
  }, [dataSource]);

  useEffect(() => {
    if (dataSource !== "project" || !accessToken) {
      setProjectLookups(null);
      return;
    }
    let cancelled = false;
    setProjectLookups(null);
    fetch("/api/project-lookups", {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          family?: unknown;
          pillar?: unknown;
          strategy?: unknown;
        };
        if (!res.ok) {
          throw new Error(body.error || res.statusText || "Request failed");
        }
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const asOpts = (x: unknown): { value: string; label: string }[] =>
          Array.isArray(x)
            ? x
                .filter(
                  (o): o is { value: unknown; label: unknown } =>
                    o !== null && typeof o === "object" && "value" in o
                )
                .map((o) => ({
                  value: String(o.value ?? ""),
                  label: String((o as { label?: unknown }).label ?? "")
                }))
            : [];
        setProjectLookups({
          family: asOpts(body.family),
          pillar: asOpts(body.pillar),
          strategy: asOpts(body.strategy)
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setProjectLookups({ family: [], pillar: [], strategy: [] });
        setNotice({
          variant: "error",
          message: `Could not load project lookups\n\n${
            err instanceof Error ? err.message : String(err)
          }`
        });
      });
    return () => {
      cancelled = true;
    };
  }, [dataSource, accessToken]);

  const gridRows = useMemo(() => {
    if (dataSource !== "project") return rows;
    return normalizeProjectModelViewRowsForGrid(
      rows as Record<string, unknown>[]
    );
  }, [dataSource, rows]);

  const projectSelectColumns = useMemo(() => {
    if (dataSource !== "project" || !projectLookups) return undefined;
    return {
      ProdFamilyName: { options: projectLookups.family },
      PillarName: { options: projectLookups.pillar },
      StrategyName: { options: projectLookups.strategy }
    };
  }, [dataSource, projectLookups]);

  const projectSelectIdBindings = useMemo(
    () =>
      dataSource === "project" ? PROJECT_LOOKUP_SELECT_BINDINGS : undefined,
    [dataSource]
  );

  const sourceConfig = dataSource
    ? getValueDashboardSourceConfig(dataSource)
    : null;
  const isWritable = sourceConfig?.kind === "table";
  const tableMutationBase =
    dataSource && isWritable
      ? `/api/value-dashboard-table?source=${encodeURIComponent(dataSource)}`
      : "";

  if (isLoginInProgress || (!isAuthenticated && loading)) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Signing in...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Value data table</h2>
        <p className="text-slate-300 max-w-2xl">
          Sign in with your Entra ID, then choose which table or function to
          load.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  const columns =
    dataSource !== null && !loading && !error
      ? rows.length > 0
        ? Object.keys(rows[0] as Record<string, unknown>)
        : emptyTableColumns ?? []
      : [];
  const keyColumn =
    columns.length > 0 ? inferMilestoneKeyColumn(columns) : "id";
  const orderedColumns = [...columns];
  ["UserName", "username", "LastUpdate", "LastUpd", "lastupd"].forEach(
    (name) => {
      const idx = orderedColumns.indexOf(name);
      if (idx >= 0) {
        orderedColumns.splice(idx, 1);
        orderedColumns.push(name);
      }
    }
  );
  const iconIdx = orderedColumns.findIndex((c) => c.toLowerCase() === "icon");
  if (iconIdx >= 0) {
    const [iconCol] = orderedColumns.splice(iconIdx, 1);
    orderedColumns.push(iconCol);
  }

  const bulkColumnOptions = orderedColumns.filter(
    (c) =>
      c !== keyColumn &&
      !AUDIT_COLUMNS.has(c) &&
      !(dataSource === "project" && isProjectModelViewVirtualColumn(c))
  );

  const hiddenProjectIdColumns =
    dataSource === "project"
      ? orderedColumns.filter(isProjectLookupIdColumn)
      : [];

  const showGrid = dataSource !== null && !loading && !error;

  const handleExcelExport = () => {
    if (!dataSource || !isWritable) return;
    downloadValueTableSourceExcel(
      rows as Record<string, unknown>[],
      orderedColumns,
      dataSource
    );
  };

  const handleExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accessToken || !dataSource || !isWritable) return;

    setExcelImport({ status: "running", message: "Importing…" });
    try {
      const buf = await file.arrayBuffer();
      const { rows: parsedRows, error: parseErr } = parseMilestoneWorkbook(buf);
      if (parseErr) {
        setExcelImport({ status: "error", message: parseErr });
        return;
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const failed: string[] = [];

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      };

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const sheetRowNum = i + 2;
        if (isMilestoneRowEmpty(row, keyColumn)) {
          skipped++;
          continue;
        }

        if (!hasMilestoneKey(row, keyColumn)) {
          const values = milestoneRowToInsertValues(row, keyColumn);
          if (Object.keys(values).length === 0) {
            skipped++;
            continue;
          }
          const res = await fetch(tableMutationBase, {
            method: "POST",
            headers,
            body: JSON.stringify({ values })
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            failed.push(
              `Row ${sheetRowNum}: ${body.error ?? res.statusText}`
            );
            continue;
          }
          inserted++;
          continue;
        }

        const keyValue = row[keyColumn];
        const values = milestoneRowToUpdateValues(row, keyColumn);
        if (Object.keys(values).length === 0) {
          skipped++;
          continue;
        }

        const res = await fetch(tableMutationBase, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            keyColumn,
            keyValue,
            values
          })
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          failed.push(
            `Row ${sheetRowNum}: ${body.error ?? res.statusText}`
          );
          continue;
        }
        updated++;
      }

      const detail =
        failed.length > 0
          ? `${failed.slice(0, 8).join("; ")}${
              failed.length > 8 ? ` … +${failed.length - 8} more` : ""
            }`
          : undefined;

      setExcelImport({
        status: "done",
        message: `Import finished: ${inserted} inserted, ${updated} updated, ${skipped} skipped.${failed.length ? ` ${failed.length} row(s) failed.` : ""}`,
        detail
      });
      reload();
    } catch (err) {
      setExcelImport({
        status: "error",
        message: err instanceof Error ? err.message : "Import failed."
      });
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Value data table</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/value-dashboard"
              className="text-brand hover:underline font-medium"
            >
              ← Value Dashboard charts
            </Link>
            <span className="text-slate-400">
              <span className="font-mono">{accounts[0]?.username}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800/90 bg-slate-950/50 px-3 py-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="value-table-data-source"
              className="text-[11px] font-medium uppercase tracking-wide text-slate-500"
            >
              Table / source
            </label>
            <select
              id="value-table-data-source"
              value={dataSource ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDataSource(
                  v === "" ? null : (v as ValueDashboardSourceId)
                );
              }}
              className="min-w-[18rem] max-w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Select a table…</option>
              {VALUE_DASHBOARD_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {showGrid && isWritable && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExcelExport}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              >
                Export Excel
              </button>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelImport}
              />
              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                disabled={excelImport.status === "running"}
                className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
              >
                {excelImport.status === "running" ? "Importing…" : "Import Excel"}
              </button>
            </div>
          )}
        </div>

        <p className="text-slate-300 max-w-3xl text-sm">
          Pick a source to run <span className="font-mono">SELECT *</span>.
          Writable tables support add, edit, delete, Excel import/export,
          multi-select, bulk edit, and bulk delete. Function sources are
          read-only.
        </p>
        {sourceConfig?.kind === "tvf" && showGrid && (
          <p className="text-amber-200/90 text-xs rounded-lg border border-amber-800/80 bg-amber-950/30 px-3 py-2">
            This source is a table-valued function: viewing and export only (no
            database writes from this page).
          </p>
        )}
        {showGrid && isWritable && (
          <p className="text-xs text-slate-500 max-w-3xl">
            <span className="font-medium text-slate-400">Excel:</span> leave key
            column <span className="font-mono">{keyColumn}</span> blank to insert;
            keep it set to update. First sheet only.
          </p>
        )}
        {excelImport.status !== "idle" &&
          excelImport.status !== "running" &&
          isWritable && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                excelImport.status === "error"
                  ? "border-red-700 bg-red-900/30 text-red-100"
                  : "border-emerald-800 bg-emerald-950/40 text-emerald-100"
              }`}
            >
              <p>{excelImport.message}</p>
              {excelImport.detail && (
                <p className="mt-1 font-mono text-xs break-all text-slate-300">
                  {excelImport.detail}
                </p>
              )}
            </div>
          )}
        {excelImport.status === "running" && isWritable && (
          <p className="text-sm text-slate-400">Importing spreadsheet…</p>
        )}
      </header>

      {dataSource === null && (
        <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/40 px-4 py-12 text-center text-slate-400 text-sm">
          No data loaded. Choose a table or function above to view rows.
        </div>
      )}

      {dataSource !== null && loading && (
        <div className="flex items-center justify-center py-16 border border-dashed border-slate-700 rounded-xl">
          <p className="text-slate-400">Loading…</p>
        </div>
      )}

      {dataSource !== null && error && (
        <div className="space-y-3 rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
          <p className="font-semibold">Error loading data</p>
          <p className="font-mono break-all text-xs">{error}</p>
          <p className="text-red-200/80 text-xs">
            Ensure this user has SELECT on the chosen object in Azure SQL. Try
            another source or fix permissions.
          </p>
        </div>
      )}

      {showGrid && (
        <>
          {isWritable && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm">
              <span className="text-slate-200">
                Bulk update for{" "}
                <span className="font-semibold">{selectedIds.length}</span>{" "}
                selected row{selectedIds.length > 1 ? "s" : ""}:
              </span>
              <select
                value={bulkColumn1}
                onChange={(e) => setBulkColumn1(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white max-w-[10rem]"
              >
                <option value="">Column 1…</option>
                {bulkColumnOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={bulkValue1}
                onChange={(e) => setBulkValue1(e.target.value)}
                placeholder="Value 1"
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white w-36"
              />
              <select
                value={bulkColumn2}
                onChange={(e) => setBulkColumn2(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white max-w-[10rem]"
              >
                <option value="">Column 2 (optional)</option>
                {bulkColumnOptions.map((c) => (
                  <option key={`2-${c}`} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={bulkValue2}
                onChange={(e) => setBulkValue2(e.target.value)}
                placeholder="Value 2"
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white w-36"
              />
              <button
                type="button"
                disabled={!bulkColumn1 && !bulkColumn2}
                onClick={async () => {
                  if (
                    selectedIds.length === 0 ||
                    !accessToken ||
                    !dataSource ||
                    !isWritable
                  )
                    return;
                  const updates: Record<string, unknown> = {};
                  if (bulkColumn1) {
                    const v = bulkValue1.trim();
                    updates[bulkColumn1] = v === "" ? null : bulkValue1;
                  }
                  if (bulkColumn2 && bulkColumn2 !== bulkColumn1) {
                    const v = bulkValue2.trim();
                    updates[bulkColumn2] = v === "" ? null : bulkValue2;
                  }
                  if (!Object.keys(updates).length) return;

                  const undoItems: BulkUpdateUndo["items"] = [];
                  for (const id of selectedIds) {
                    const row = rows.find((r) =>
                      rowIdsMatch(
                        (r as Record<string, unknown>)[keyColumn],
                        id
                      )
                    ) as Record<string, unknown> | undefined;
                    if (!row) continue;
                    const prev: Record<string, unknown> = {};
                    for (const col of Object.keys(updates)) {
                      prev[col] =
                        row[col] === undefined ? null : row[col];
                    }
                    undoItems.push({ keyValue: id, values: prev });
                  }
                  if (undoItems.length === 0) return;

                  try {
                    const res = await fetch(
                      "/api/value-dashboard-table/bulk-update",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({
                          source: dataSource,
                          ids: selectedIds,
                          keyColumn,
                          values: updates
                        })
                      }
                    );
                    const errBody = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      details?: string;
                    };
                    if (!res.ok) {
                      setNotice({
                        variant: "error",
                        message: `Bulk update failed\n\n${formatApiErrorBody(errBody, "Bulk update failed.")}`
                      });
                      return;
                    }
                    setLastBulkUndo({ keyColumn, items: undoItems });
                    setBulkColumn1("");
                    setBulkValue1("");
                    setBulkColumn2("");
                    setBulkValue2("");
                    setSelectedIds([]);
                    setNotice({
                      variant: "success",
                      message: `Bulk update applied to ${undoItems.length} row${
                        undoItems.length === 1 ? "" : "s"
                      }.`
                    });
                    reload();
                  } catch (err) {
                    console.error("Bulk update error", err);
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                Apply to selected
              </button>
              <span className="text-slate-600" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (
                    selectedIds.length === 0 ||
                    !accessToken ||
                    !dataSource ||
                    !isWritable
                  )
                    return;
                  const deleteCount = selectedIds.length;
                  const rowsSnapshot = rows.filter((r) =>
                    selectedIds.some((id) =>
                      rowIdsMatch(
                        (r as Record<string, unknown>)[keyColumn],
                        id
                      )
                    )
                  );
                  // eslint-disable-next-line no-alert
                  if (
                    !window.confirm(
                      `Delete ${deleteCount} selected row${
                        deleteCount > 1 ? "s" : ""
                      }? You can undo once with “Undo last action”.`
                    )
                  ) {
                    return;
                  }
                  try {
                    const res = await fetch(
                      "/api/value-dashboard-table/bulk-delete",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({
                          source: dataSource,
                          ids: selectedIds,
                          keyColumn
                        })
                      }
                    );
                    const body = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      details?: string;
                    };
                    if (!res.ok) {
                      const head =
                        res.status === 409 ? "Delete blocked" : "Delete failed";
                      setNotice({
                        variant: "error",
                        message: `${head}\n\n${formatApiErrorBody(body, "Bulk delete failed.")}`
                      });
                      return;
                    }
                    setLastUndo({
                      kind: "bulk-delete",
                      keyColumn,
                      rows: rowsSnapshot.map((r) => ({
                        ...(r as Record<string, unknown>)
                      }))
                    });
                    setLastBulkUndo(null);
                    setSelectedIds([]);
                    setNotice({
                      variant: "success",
                      message: `${deleteCount} row${
                        deleteCount === 1 ? "" : "s"
                      } deleted successfully.`
                    });
                    reload();
                  } catch (err) {
                    console.error("Bulk delete error", err);
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-600"
              >
                Delete selected
              </button>
            </div>
          )}

          {isWritable && lastBulkUndo && lastBulkUndo.items.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm">
              <span className="text-amber-100">
                Last bulk update: {lastBulkUndo.items.length} row
                {lastBulkUndo.items.length > 1 ? "s" : ""}.
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!accessToken || !lastBulkUndo || !dataSource) return;
                  const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                  };
                  try {
                    for (const item of lastBulkUndo.items) {
                      if (!Object.keys(item.values).length) continue;
                      const res = await fetch(tableMutationBase, {
                        method: "PUT",
                        headers,
                        body: JSON.stringify({
                          keyColumn: lastBulkUndo.keyColumn,
                          keyValue: item.keyValue,
                          values: item.values
                        })
                      });
                      if (!res.ok) {
                        const b = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          details?: string;
                        };
                        setNotice({
                          variant: "error",
                          message: `Undo bulk update failed\n\n${formatApiErrorBody(b, "Could not restore values.")}`
                        });
                        return;
                      }
                    }
                    setLastBulkUndo(null);
                    setNotice({
                      variant: "success",
                      message: "Bulk update undone."
                    });
                    reload();
                  } catch (err) {
                    console.error("Undo bulk error", err);
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
              >
                Undo last bulk update
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
            <label
              htmlFor="value-table-blank-filter"
              className="text-slate-400"
            >
              Blank cells
            </label>
            <select
              id="value-table-blank-filter"
              value={rowBlankFilter}
              onChange={(e) =>
                setRowBlankFilter(e.target.value as RowBlankFilterMode)
              }
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
            >
              <option value="none">Show all rows</option>
              <option value="any-column-empty">Any column empty</option>
              <option value="all-data-empty">
                All columns empty (except key: {keyColumn})
              </option>
            </select>
            <span className="text-xs text-slate-500">
              Column filter:{" "}
              <span className="font-mono text-slate-400">(blank)</span> for
              empty cells.
            </span>
          </div>

          {isWritable && lastUndo && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm">
              <span className="text-amber-100">
                {lastUndo.kind === "update" && "Last action: row edit."}
                {lastUndo.kind === "delete" && "Last action: row deleted."}
                {lastUndo.kind === "bulk-delete" &&
                  `Last action: ${lastUndo.rows.length} row${
                    lastUndo.rows.length > 1 ? "s" : ""
                  } deleted.`}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (!lastUndo || !accessToken || !isWritable) return;
                  const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                  };
                  try {
                    if (lastUndo.kind === "update") {
                      const values: Record<string, unknown> = {};
                      for (const [k, v] of Object.entries(
                        lastUndo.previousRow
                      )) {
                        if (k === lastUndo.keyColumn) continue;
                        values[k] = v === undefined ? null : v;
                      }
                      const res = await fetch(tableMutationBase, {
                        method: "PUT",
                        headers,
                        body: JSON.stringify({
                          keyColumn: lastUndo.keyColumn,
                          keyValue: lastUndo.keyValue,
                          values
                        })
                      });
                      if (!res.ok) {
                        const b = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          details?: string;
                        };
                        setNotice({
                          variant: "error",
                          message: `Undo failed\n\n${formatApiErrorBody(b, "Could not restore row.")}`
                        });
                        return;
                      }
                    } else if (lastUndo.kind === "delete") {
                      const res = await fetch(tableMutationBase, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                          values: rowToRestoreInsertValues(lastUndo.row)
                        })
                      });
                      if (!res.ok) {
                        const b = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          details?: string;
                        };
                        setNotice({
                          variant: "error",
                          message: `Undo failed\n\n${formatApiErrorBody(b, "Could not re-insert row.")}`
                        });
                        return;
                      }
                    } else {
                      for (const r of lastUndo.rows) {
                        const res = await fetch(tableMutationBase, {
                          method: "POST",
                          headers,
                          body: JSON.stringify({
                            values: rowToRestoreInsertValues(
                              r as Record<string, unknown>
                            )
                          })
                        });
                        if (!res.ok) {
                          const b = (await res.json().catch(() => ({}))) as {
                            error?: string;
                            details?: string;
                          };
                          setNotice({
                            variant: "error",
                            message: `Undo failed\n\n${formatApiErrorBody(b, "Could not restore deleted rows.")}`
                          });
                          return;
                        }
                      }
                    }
                    setLastUndo(null);
                    setNotice({
                      variant: "success",
                      message: "Undo completed successfully."
                    });
                    reload();
                  } catch (err) {
                    console.error("Undo error", err);
                  }
                }}
                className="inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
              >
                Undo last action
              </button>
            </div>
          )}

          {rows.length === 0 && columns.length > 0 && (
            <div className="rounded-lg border border-amber-800/80 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
              <p className="font-medium text-amber-50">
                No rows in this table yet
              </p>
              <p className="mt-1 text-amber-100/80 text-xs leading-relaxed max-w-3xl">
                The query succeeded but returned zero rows. If you expected
                data, check Azure SQL / RLS with the same account.
              </p>
            </div>
          )}

          {columns.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No rows returned and no column metadata was available. Confirm the
              object name and your SELECT permissions on{" "}
              <span className="font-mono">INFORMATION_SCHEMA</span> /{" "}
              <span className="font-mono">sys.columns</span>.
            </p>
          ) : (
            <EditableAiGrid
              readOnly={!isWritable}
              columns={orderedColumns}
              rows={gridRows}
              accessToken={isWritable ? accessToken : null}
              endpoint={isWritable ? tableMutationBase : undefined}
              keyColumn={keyColumn}
              onDataChanged={isWritable ? reload : undefined}
              selectColumns={projectSelectColumns}
              selectIdBindings={projectSelectIdBindings}
              hiddenColumns={[
                ...hiddenProjectIdColumns,
                "LastUpdate",
                "LastUpd",
                "lastupd"
              ]}
              enableRowSelection={isWritable}
              onSelectionChange={isWritable ? setSelectedIds : undefined}
              rowIdColumn={keyColumn}
              enableBlankTokenFilter
              rowBlankFilter={rowBlankFilter}
              columnFilterPlaceholder="Filter… or (blank)"
              onMutationSuccess={
                isWritable
                  ? (payload: EditableGridUndoPayload) => {
                      if (payload.type === "update") {
                        setLastUndo({
                          kind: "update",
                          keyColumn: payload.keyColumn,
                          keyValue: payload.keyValue,
                          previousRow: { ...payload.previousRow }
                        });
                      } else {
                        setLastUndo({
                          kind: "delete",
                          keyColumn: payload.keyColumn,
                          row: { ...payload.row }
                        });
                      }
                    }
                  : undefined
              }
              onErrorMessage={
                isWritable
                  ? (message) => {
                      setNotice({
                        variant: "error",
                        message: `Could not complete action\n\n${message}`
                      });
                    }
                  : undefined
              }
              onSuccessMessage={
                isWritable
                  ? (message) => {
                      setNotice({ variant: "success", message });
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
      {notice && (
        <TopNoticeBar
          variant={notice.variant}
          message={notice.message}
          onDismiss={clearNotice}
          durationMs={notice.variant === "error" ? 8800 : 4200}
        />
      )}
    </div>
  );
}
