"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChangeEvent } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { sqlScope } from "@/config/msalConfig";
import { EditableAiGrid } from "@/components/EditableAiGrid";
import { TopNoticeBar } from "@/components/TopNoticeBar";
import { formatApiErrorBody } from "@/lib/apiErrorMessage";
import {
  downloadTableAi2Excel,
  parseTableAi2Workbook,
  rowToInsertValues,
  rowToUpdateValues,
  isRowEmpty,
  parseId
} from "@/lib/aiData2Excel";

type TableAiRow = { [key: string]: unknown };
type UndoItem = { id: unknown; values: Record<string, unknown> };

export function AIData2WithAuth() {
  const { instance, accounts, inProgress } = useMsal();
  const [rows, setRows] = useState<TableAiRow[]>([]);
  const [lookupOptions, setLookupOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<unknown[]>([]);
  const [bulkCol1, setBulkCol1] = useState<string>("");
  const [bulkCol2, setBulkCol2] = useState<string>("");
  const [bulkLookupId, setBulkLookupId] = useState<string>("");
  const [lastBulkUndoItems, setLastBulkUndoItems] = useState<UndoItem[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImport, setExcelImport] = useState<{
    status: "idle" | "running" | "done" | "error";
    message?: string;
    detail?: string;
  }>({ status: "idle" });
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
        return Promise.all([
          fetch("/api/ai-data2", {
            headers: { Authorization: `Bearer ${response.accessToken}` }
          }),
          fetch("/api/lookup-ai", {
          headers: { Authorization: `Bearer ${response.accessToken}` }
          })
        ]);
      })
      .then((result) => {
        if (!result) return;
        const [dataRes, lookupRes] = result as [Response, Response];
        if (cancelled) return;
        if (!dataRes?.ok) {
          if (dataRes?.status === 401) {
            setError(
              "Not authorized to access the database. Ensure your Entra ID user is added to the Azure SQL database."
            );
          } else {
            setError(dataRes?.statusText || "Failed to load data.");
          }
          setLoading(false);
          return;
        }
        if (!lookupRes?.ok) {
          setError(lookupRes?.statusText || "Failed to load lookup values.");
          setLoading(false);
          return;
        }
        return Promise.all([dataRes.json(), lookupRes.json()]);
      })
      .then((payload) => {
        if (cancelled) return;
        if (!payload) return;
        const [data, lookups] = payload as [unknown, unknown];

        let options: { value: string; label: string }[] = [];
        if (Array.isArray(lookups)) {
          options = lookups
            .filter(
              (x): x is { LookupId: unknown; LookupName: unknown } =>
                x !== null &&
                typeof x === "object" &&
                "LookupId" in x &&
                "LookupName" in x
            )
            .map((x) => ({
              value: String((x as { LookupId: unknown }).LookupId ?? ""),
              label: String((x as { LookupName: unknown }).LookupName ?? "")
            }));
        }
        setLookupOptions(options);

        const normalizedRows: TableAiRow[] = Array.isArray(data)
          ? (data as TableAiRow[]).map((row) => {
              const anyRow = row as Record<string, unknown>;
              const idValue =
                (anyRow.LookupId as unknown) ??
                (anyRow.LookupID as unknown) ??
                (anyRow.lookupID as unknown);

              return {
                ...row,
                // Store the lookup ID in the LookupName field so the grid can
                // use it as the select's value while still showing the label via options.
                LookupName:
                  idValue !== null && idValue !== undefined
                    ? String(idValue)
                    : ""
              };
            })
          : [];
        setRows(normalizedRows);
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
        <h2 className="text-2xl font-semibold">AI Data 2 (table_ai2)</h2>
        <p className="text-slate-300 max-w-2xl">
          Sign in with your Entra ID to view and edit data from table_ai2. The
          database will show only rows you are allowed to see.
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
        <h2 className="text-2xl font-semibold">AI Data 2 (table_ai2)</h2>
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
          <p className="font-semibold mb-1">Error loading data</p>
          <p className="font-mono break-all text-xs">{error}</p>
        </div>
        <p className="text-slate-400 text-sm">
          Signed in as{" "}
          <span className="font-mono">{accounts[0]?.username}</span>. Ensure
          this user exists in the Azure SQL database and has SELECT on
          table_ai2.
        </p>
      </div>
    );
  }

  const columns =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
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

  const lookupIdColumnName = columns.includes("lookupID")
    ? "lookupID"
    : columns.includes("LookupID")
    ? "LookupID"
    : columns.includes("LookupId")
    ? "LookupId"
    : "lookupID";

  const handleExcelExport = () => {
    downloadTableAi2Excel(
      rows as Record<string, unknown>[],
      lookupOptions,
      lookupIdColumnName
    );
  };

  const handleExcelImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accessToken) return;

    setExcelImport({ status: "running", message: "Importing…" });
    try {
      const buf = await file.arrayBuffer();
      const { rows: parsedRows, error: parseErr } = parseTableAi2Workbook(buf);
      if (parseErr) {
        setExcelImport({ status: "error", message: parseErr });
        setNotice({
          variant: "error",
          message: `Excel import\n\n${parseErr}`
        });
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
        if (isRowEmpty(row)) {
          skipped++;
          continue;
        }

        const id = parseId(row.id);

        if (id === null) {
          const values = rowToInsertValues(
            row,
            lookupOptions,
            lookupIdColumnName
          );
          if (Object.keys(values).length === 0) {
            skipped++;
            continue;
          }
          const res = await fetch("/api/ai-data2", {
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

        const values = rowToUpdateValues(
          row,
          lookupOptions,
          lookupIdColumnName
        );
        if (Object.keys(values).length === 0) {
          skipped++;
          continue;
        }

        const res = await fetch("/api/ai-data2", {
          method: "PUT",
          headers,
          body: JSON.stringify({
            keyColumn: "id",
            keyValue: id,
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

      const summary = `Import finished: ${inserted} inserted, ${updated} updated, ${skipped} skipped.${failed.length ? ` ${failed.length} row(s) failed.` : ""}`;
      setExcelImport({
        status: "done",
        message: summary,
        detail
      });
      setNotice({ variant: "success", message: summary });
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      setExcelImport({
        status: "error",
        message: msg
      });
      setNotice({
        variant: "error",
        message: `Excel import\n\n${msg}`
      });
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">AI Data 2 (table_ai2)</h2>
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
          for your user (table_ai2).
        </p>
        <p className="text-xs text-slate-500 max-w-3xl">
          <span className="font-medium text-slate-400">Excel:</span> Export
          downloads the first sheet format (columns: id, Col1, Col2, TenantID,
          lookupID, LookupName). Edit or add rows: leave{" "}
          <span className="font-mono">id</span> empty to insert; keep{" "}
          <span className="font-mono">id</span> to update. You may set lookup by{" "}
          <span className="font-mono">lookupID</span> or by{" "}
          <span className="font-mono">LookupName</span> label. Then use Import
          Excel to apply changes.
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
            Bulk update for{" "}
            <span className="font-semibold">{selectedIds.length}</span>{" "}
            selected row{selectedIds.length > 1 ? "s" : ""}:
          </span>
          <input
            type="text"
            value={bulkCol1}
            onChange={(e) => setBulkCol1(e.target.value)}
            placeholder="New Col1 (optional)"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
          />
          <input
            type="text"
            value={bulkCol2}
            onChange={(e) => setBulkCol2(e.target.value)}
            placeholder="New Col2 (optional)"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
          />
          <select
            value={bulkLookupId}
            onChange={(e) => setBulkLookupId(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
          >
            <option value="">LookupName (optional)</option>
            {lookupOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={
              bulkCol1.trim() === "" &&
              bulkCol2.trim() === "" &&
              bulkLookupId === ""
            }
            onClick={async () => {
              if (selectedIds.length === 0 || !accessToken) return;
              const bulkCount = selectedIds.length;
              const updates: Record<string, unknown> = {};
              if (bulkCol1.trim() !== "") updates.Col1 = bulkCol1.trim();
              if (bulkCol2.trim() !== "") updates.Col2 = bulkCol2.trim();
              if (bulkLookupId !== "") updates.lookupID = bulkLookupId;
              if (!Object.keys(updates).length) return;

              const undoItems: UndoItem[] = selectedIds
                .map((id) => {
                  const row = rows.find((r) => (r as { id?: unknown }).id === id);
                  if (!row) return null;
                  const anyRow = row as Record<string, unknown>;
                  const prevValues: Record<string, unknown> = {};
                  for (const key of Object.keys(updates)) {
                    if (key === "lookupID") {
                      prevValues.lookupID =
                        anyRow.lookupID ?? anyRow.LookupID ?? anyRow.LookupId ?? null;
                    } else {
                      prevValues[key] = anyRow[key] ?? null;
                    }
                  }
                  return { id, values: prevValues };
                })
                .filter((x): x is UndoItem => x !== null);
              try {
                const res = await fetch("/api/ai-data2/bulk-lookup", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    ids: selectedIds,
                    updates
                  })
                });
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
                setLastBulkUndoItems(undoItems);
                setBulkCol1("");
                setBulkCol2("");
                setBulkLookupId("");
                setSelectedIds([]);
                setNotice({
                  variant: "success",
                  message: `Bulk update applied to ${bulkCount} row${
                    bulkCount === 1 ? "" : "s"
                  } successfully.`
                });
                loadData();
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
              if (selectedIds.length === 0 || !accessToken) return;
              const deleteCount = selectedIds.length;
              // eslint-disable-next-line no-alert
              if (
                !window.confirm(
                  `Delete ${deleteCount} selected row${
                    deleteCount > 1 ? "s" : ""
                  }? This cannot be undone.`
                )
              ) {
                return;
              }
              try {
                const res = await fetch("/api/ai-data2/bulk-delete", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({ ids: selectedIds })
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
                setSelectedIds([]);
                setLastBulkUndoItems(null);
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
      {lastBulkUndoItems && lastBulkUndoItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm">
          <span className="text-amber-100">
            Last bulk update applied to {lastBulkUndoItems.length} row
            {lastBulkUndoItems.length > 1 ? "s" : ""}.
          </span>
          <button
            type="button"
            onClick={async () => {
              if (!accessToken || !lastBulkUndoItems?.length) return;
              try {
                const res = await fetch("/api/ai-data2/bulk-undo", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                  },
                  body: JSON.stringify({
                    items: lastBulkUndoItems,
                    lookupIdColumnName
                  })
                });
                if (!res.ok) {
                  const uBody = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    details?: string;
                  };
                  setNotice({
                    variant: "error",
                    message: `Undo failed\n\n${formatApiErrorBody(uBody, "Undo failed.")}`
                  });
                  return;
                }
                setLastBulkUndoItems(null);
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
            Undo last bulk update
          </button>
        </div>
      )}
      <EditableAiGrid
        columns={orderedColumns}
        rows={rows}
        accessToken={accessToken}
        endpoint="/api/ai-data2"
        keyColumn="id"
        onDataChanged={loadData}
        selectColumns={{
          LookupName: { options: lookupOptions }
        }}
        hiddenColumns={["LookupId", "LookupID", "lookupID", "LastUpdate"]}
        enableRowSelection
        onSelectionChange={setSelectedIds}
        rowIdColumn="id"
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

