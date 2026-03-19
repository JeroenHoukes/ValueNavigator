"use client";

import { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { sqlScope } from "@/config/msalConfig";
import { EditableAiGrid } from "@/components/EditableAiGrid";

type TableAiRow = { [key: string]: unknown };

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">AI Data 2 (table_ai2)</h2>
          <span className="text-sm text-slate-400">
            Signed in as{" "}
            <span className="font-mono">{accounts[0]?.username}</span>
          </span>
        </div>
        <p className="text-slate-300 max-w-2xl">
          Data from the ValueNavigator database on Azure SQL (
          <span className="font-mono">leefserver.database.windows.net</span>)
          for your user (table_ai2).
        </p>
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
              const updates: Record<string, unknown> = {};
              if (bulkCol1.trim() !== "") updates.Col1 = bulkCol1.trim();
              if (bulkCol2.trim() !== "") updates.Col2 = bulkCol2.trim();
              if (bulkLookupId !== "") updates.lookupID = bulkLookupId;
              if (!Object.keys(updates).length) return;
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
                if (!res.ok) {
                  console.error("Bulk update failed", await res.text());
                  return;
                }
                setBulkCol1("");
                setBulkCol2("");
                setBulkLookupId("");
                setSelectedIds([]);
                loadData();
              } catch (err) {
                console.error("Bulk update error", err);
              }
            }}
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Apply to selected
          </button>
        </div>
      )}
      <EditableAiGrid
        columns={orderedColumns}
        rows={rows}
        accessToken={accessToken}
        endpoint="/api/ai-data2"
        onDataChanged={loadData}
        selectColumns={{
          LookupName: { options: lookupOptions }
        }}
        hiddenColumns={["LookupId", "LookupID", "lookupID", "LastUpdate"]}
        enableRowSelection
        onSelectionChange={setSelectedIds}
        rowIdColumn="id"
      />
    </div>
  );
}

