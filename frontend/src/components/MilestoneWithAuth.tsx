"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChangeEvent } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { sqlScope } from "@/config/msalConfig";
import {
  EditableAiGrid,
  type EditableGridUndoPayload,
  type RowBlankFilterMode
} from "@/components/EditableAiGrid";
import {
  downloadMilestoneExcel,
  parseMilestoneWorkbook,
  milestoneRowToInsertValues,
  milestoneRowToUpdateValues,
  isMilestoneRowEmpty,
  inferMilestoneKeyColumn,
  hasMilestoneKey
} from "@/lib/milestoneExcel";
import { formatApiErrorBody } from "@/lib/apiErrorMessage";
import { TopNoticeBar } from "@/components/TopNoticeBar";

type MilestoneUndoState =
  | {
      kind: "update";
      keyColumn: string;
      keyValue: unknown;
      previousRow: Record<string, unknown>;
    }
  | { kind: "delete"; keyColumn: string; row: Record<string, unknown> }
  | { kind: "bulk-delete"; keyColumn: string; rows: Record<string, unknown>[] };

function rowToRestoreInsertValues(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v === undefined ? null : v;
  }
  return out;
}

type MilestoneRow = { [key: string]: unknown };

export function MilestoneWithAuth() {
  const { instance, accounts, inProgress } = useMsal();
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImport, setExcelImport] = useState<{
    status: "idle" | "running" | "done" | "error";
    message?: string;
    detail?: string;
  }>({ status: "idle" });
  const [selectedIds, setSelectedIds] = useState<unknown[]>([]);
  const [rowBlankFilter, setRowBlankFilter] =
    useState<RowBlankFilterMode>("none");
  const [lastUndo, setLastUndo] = useState<MilestoneUndoState | null>(null);
  const [notice, setNotice] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  const isAuthenticated = accounts.length > 0;
  const isLoginInProgress =
    inProgress === InteractionStatus.Login ||
    inProgress === InteractionStatus.Startup;

  const loadData = useCallback(() => {
    if (!isAuthenticated || !accounts[0]) {
      setLoading(false);
      setAccessToken(null);
      setRows([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    instance
      .acquireTokenSilent({
        scopes: [sqlScope],
        account: accounts[0]
      })
      .then((response) => {
        if (cancelled) return;
        setAccessToken(response.accessToken);
        return fetch("/api/milestone", {
          headers: { Authorization: `Bearer ${response.accessToken}` }
        });
      })
      .then((dataRes) => {
        if (!dataRes) return;
        if (cancelled) return;
        if (!dataRes.ok) {
          if (dataRes.status === 401) {
            setError(
              "Not authorized to access the database. Ensure your Entra ID user is added to the Azure SQL database."
            );
          } else {
            setError(dataRes.statusText || "Failed to load data.");
          }
          setLoading(false);
          return;
        }
        return dataRes.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data === undefined) return;
        setRows(Array.isArray(data) ? (data as MilestoneRow[]) : []);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Failed to get token or load data.");
        setAccessToken(null);
        setRows([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accounts, instance]);

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [loadData]);

  const handleLogin = () => {
    instance
      .loginRedirect({ scopes: ["User.Read", sqlScope] })
      .catch(console.error);
  };

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
        <h2 className="text-2xl font-semibold">Milestones (dbo.milestone)</h2>
        <p className="text-slate-300 max-w-2xl">
          Sign in with your Entra ID to view and edit rows in the milestone
          table. The database will show only rows you are allowed to see.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Milestones (dbo.milestone)</h2>
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
          <p className="font-semibold mb-1">Error loading data</p>
          <p className="font-mono break-all text-xs">{error}</p>
        </div>
        <p className="text-slate-400 text-sm">
          Signed in as{" "}
          <span className="font-mono">{accounts[0]?.username}</span>. Ensure
          this user exists in the Azure SQL database and has SELECT (and
          appropriate write permissions) on dbo.milestone.
        </p>
      </div>
    );
  }

  const columns =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const keyColumn = inferMilestoneKeyColumn(columns);
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

  const handleExcelExport = () => {
    downloadMilestoneExcel(rows as Record<string, unknown>[], orderedColumns);
  };

  const handleExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accessToken) return;

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
          const res = await fetch("/api/milestone", {
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

        const res = await fetch("/api/milestone", {
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
      loadData();
    } catch (err) {
      setExcelImport({
        status: "error",
        message: err instanceof Error ? err.message : "Import failed."
      });
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Milestones (dbo.milestone)</h2>
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
            <span className="text-sm text-slate-400">
              Signed in as{" "}
              <span className="font-mono">{accounts[0]?.username}</span>
            </span>
          </div>
        </div>
        <p className="text-slate-300 max-w-2xl">
          Data from the ValueNavigator database on Azure SQL (
          <span className="font-mono">leefserver.database.windows.net</span>)
          for your user (<span className="font-mono">dbo.milestone</span>).
        </p>
        <p className="text-xs text-slate-500 max-w-3xl">
          <span className="font-medium text-slate-400">Excel:</span> Export uses
          the current grid columns. To insert, leave the key column (
          <span className="font-mono">{keyColumn}</span>) empty; to update, keep
          it set. Import applies rows from the first sheet.
        </p>
        {excelImport.status !== "idle" && excelImport.status !== "running" && (
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
        {excelImport.status === "running" && (
          <p className="text-sm text-slate-400">Importing spreadsheet…</p>
        )}
      </header>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm">
          <span className="text-slate-200">
            <span className="font-semibold">{selectedIds.length}</span> row
            {selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={async () => {
              if (selectedIds.length === 0 || !accessToken) return;
              const deleteCount = selectedIds.length;
              const rowsSnapshot = rows.filter((r) =>
                selectedIds.some(
                  (id) =>
                    id === (r as Record<string, unknown>)[keyColumn]
                )
              );
              // eslint-disable-next-line no-alert
              if (
                !window.confirm(
                  `Delete ${selectedIds.length} selected row${
                    selectedIds.length > 1 ? "s" : ""
                  }? You can undo once with “Undo last action”.`
                )
              ) {
                return;
              }
              try {
                const res = await fetch("/api/milestone/bulk-delete", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    ids: selectedIds,
                    keyColumn
                  })
                });
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
                  rows: rowsSnapshot.map((r) => ({ ...(r as Record<string, unknown>) }))
                });
                setSelectedIds([]);
                setNotice({
                  variant: "success",
                  message: `${deleteCount} row${
                    deleteCount === 1 ? "" : "s"
                  } deleted successfully.`
                });
                loadData();
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
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
        <label htmlFor="milestone-blank-filter" className="text-slate-400">
          Blank cells
        </label>
        <select
          id="milestone-blank-filter"
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
          In a column filter, type{" "}
          <span className="font-mono text-slate-400">(blank)</span> to show
          only rows empty in that column.
        </span>
      </div>
      {lastUndo && (
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
              if (!lastUndo || !accessToken) return;
              const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
              };
              try {
                if (lastUndo.kind === "update") {
                  const values: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(lastUndo.previousRow)) {
                    if (k === lastUndo.keyColumn) continue;
                    values[k] = v === undefined ? null : v;
                  }
                  const res = await fetch("/api/milestone", {
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
                  const res = await fetch("/api/milestone", {
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
                    const res = await fetch("/api/milestone", {
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
                loadData();
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
      <EditableAiGrid
        columns={orderedColumns}
        rows={rows}
        accessToken={accessToken}
        endpoint="/api/milestone"
        keyColumn={keyColumn}
        onDataChanged={loadData}
        hiddenColumns={["LastUpdate", "LastUpd", "lastupd"]}
        enableRowSelection
        onSelectionChange={setSelectedIds}
        rowIdColumn={keyColumn}
        enableBlankTokenFilter
        rowBlankFilter={rowBlankFilter}
        columnFilterPlaceholder="Filter… or (blank)"
        onMutationSuccess={(payload: EditableGridUndoPayload) => {
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
        }}
        onErrorMessage={(message) => {
          setNotice({
            variant: "error",
            message: `Could not complete action\n\n${message}`
          });
        }}
        onSuccessMessage={(message) => {
          setNotice({ variant: "success", message });
        }}
      />
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
