"use client";

import { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { sqlScope } from "@/config/msalConfig";
import type { ValueDashboardSourceId } from "@/lib/valueDashboardSources";

export type OutputRow = { [key: string]: unknown };

function parseModelOutputResponse(data: unknown): {
  rows: OutputRow[];
  emptyTableColumns: string[] | null;
} {
  if (Array.isArray(data)) {
    return { rows: data as OutputRow[], emptyTableColumns: null };
  }
  if (data && typeof data === "object" && "rows" in data) {
    const d = data as { rows?: unknown; columns?: unknown };
    const rows = Array.isArray(d.rows) ? (d.rows as OutputRow[]) : [];
    const cols = Array.isArray(d.columns) ? (d.columns as string[]) : [];
    return {
      rows,
      emptyTableColumns: rows.length === 0 && cols.length > 0 ? cols : null
    };
  }
  return { rows: [], emptyTableColumns: null };
}

/**
 * @param dataSource `null` = do not fetch (table page until user picks a source).
 */
export function useModelOutputRows(dataSource: ValueDashboardSourceId | null) {
  const { instance, accounts, inProgress } = useMsal();
  const [rows, setRows] = useState<OutputRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => dataSource !== null);
  const [emptyTableColumns, setEmptyTableColumns] = useState<string[] | null>(
    null
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const isAuthenticated = accounts.length > 0;
  const isLoginInProgress =
    inProgress === InteractionStatus.Login ||
    inProgress === InteractionStatus.Startup;

  const loadData = useCallback(() => {
    if (!isAuthenticated || !accounts[0]) {
      setLoading(false);
      setRows([]);
      setEmptyTableColumns(null);
      setAccessToken(null);
      return;
    }

    if (dataSource === null) {
      setLoading(false);
      setRows([]);
      setEmptyTableColumns(null);
      setError(null);
      setAccessToken(null);
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
        if (cancelled) return null;
        setAccessToken(response.accessToken);
        return fetch(
          `/api/model-view-output?source=${encodeURIComponent(dataSource)}`,
          {
            headers: { Authorization: `Bearer ${response.accessToken}` }
          }
        );
      })
      .then(async (dataRes) => {
        if (cancelled) return;
        if (!dataRes) return;
        if (!dataRes.ok) {
          const body = (await dataRes.json().catch(() => null)) as
            | { error?: string }
            | null;
          if (dataRes.status === 401) {
            setError(
              "Not authorized to access the database. Ensure your Entra ID user is added to the Azure SQL database."
            );
          } else {
            setError(
              body?.error || dataRes.statusText || "Failed to load data."
            );
          }
          setLoading(false);
          setAccessToken(null);
          return;
        }
        return dataRes.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data === undefined) return;
        if (
          data &&
          typeof data === "object" &&
          "error" in data &&
          !("rows" in data)
        ) {
          setError(String((data as { error: unknown }).error));
          setRows([]);
          setEmptyTableColumns(null);
          setLoading(false);
          return;
        }
        const parsed = parseModelOutputResponse(data);
        setRows(parsed.rows);
        setEmptyTableColumns(parsed.emptyTableColumns);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Failed to get token or load data.");
        setRows([]);
        setEmptyTableColumns(null);
        setLoading(false);
        setAccessToken(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accounts, instance, dataSource, reloadNonce]);

  useEffect(() => {
    const cleanup = loadData();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [loadData]);

  const handleLogin = useCallback(() => {
    instance
      .loginRedirect({ scopes: ["User.Read", sqlScope] })
      .catch(console.error);
  }, [instance]);

  const reload = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  return {
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
  };
}
