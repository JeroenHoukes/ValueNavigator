"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortfolioTotalsColumnChart } from "@/components/PortfolioTotalsColumnChart";
import { ValueDashboardCharts } from "@/components/ValueDashboardCharts";
import { useModelOutputRows } from "@/hooks/useModelOutputRows";
import { DEFAULT_VALUE_DASHBOARD_SOURCE_ID } from "@/lib/valueDashboardSources";
import {
  filterRowsByProjectAndProduct,
  listDistinctColumnLabels,
  resolveProductColumnKey,
  resolveProjectColumnKey
} from "@/lib/valueDashboardAggregates";

export function ValueDashboardWithAuth() {
  const {
    rows,
    loading,
    error,
    isAuthenticated,
    isLoginInProgress,
    handleLogin,
    accounts
  } = useModelOutputRows(DEFAULT_VALUE_DASHBOARD_SOURCE_ID);

  const allRows = rows as Record<string, unknown>[];

  const projectKey = useMemo(() => resolveProjectColumnKey(allRows), [allRows]);
  const productKey = useMemo(() => resolveProductColumnKey(allRows), [allRows]);

  const projectOptions = useMemo(
    () => (projectKey ? listDistinctColumnLabels(allRows, projectKey) : []),
    [allRows, projectKey]
  );
  const productOptions = useMemo(
    () => (productKey ? listDistinctColumnLabels(allRows, productKey) : []),
    [allRows, productKey]
  );

  const [projectMode, setProjectMode] = useState<"ALL" | string[]>("ALL");
  const [productMode, setProductMode] = useState<"ALL" | string[]>("ALL");

  const projectsKey = projectOptions.join("\u0001");
  useEffect(() => {
    setProjectMode("ALL");
  }, [projectsKey]);

  const productsKey = productOptions.join("\u0001");
  useEffect(() => {
    setProductMode("ALL");
  }, [productsKey]);

  const filteredRows = useMemo(
    () =>
      filterRowsByProjectAndProduct(
        allRows,
        projectKey,
        productKey,
        projectMode,
        productMode
      ),
    [allRows, projectKey, productKey, projectMode, productMode]
  );

  const showProjectProductFilters =
    projectOptions.length > 0 || productOptions.length > 0;
  const showFilterBar = !loading && !error && allRows.length > 0 && showProjectProductFilters;

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
        <h2 className="text-2xl font-semibold">Value Dashboard</h2>
        <p className="text-slate-300 max-w-2xl">
          Sign in with your Entra ID to view model output charts. The database
          returns only data your user is allowed to see.
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

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Value Dashboard</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/value-dashboard/table"
              className="text-brand hover:underline font-medium"
            >
              Open data table →
            </Link>
            <span className="text-slate-400">
              Signed in as{" "}
              <span className="font-mono">{accounts[0]?.username}</span>
            </span>
          </div>
        </div>
        <p className="text-slate-300 max-w-2xl text-sm">
          Charts use{" "}
          <span className="font-mono">{DEFAULT_VALUE_DASHBOARD_SOURCE_ID}</span>{" "}
          by default (FnModelOrg). Open the data table page to query other
          sources.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 border border-dashed border-slate-700 rounded-xl">
          <p className="text-slate-400">Loading data…</p>
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
          <p className="font-semibold">Error loading data</p>
          <p className="font-mono break-all text-xs">{error}</p>
          <p className="text-red-200/80 text-xs">
            Ensure this user has SELECT on FnModelOrg in Azure SQL.
          </p>
        </div>
      ) : (
        <>
          {showFilterBar && (
            <div
              className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-800/90 bg-slate-950/55 px-3 py-3"
              role="toolbar"
              aria-label="Project and product filters"
            >
              {projectOptions.length > 0 && projectKey && (
                <div className="flex flex-col gap-1 max-w-[16rem]">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Project
                  </span>
                  <select
                    multiple
                    size={Math.min(7, Math.max(3, projectOptions.length))}
                    value={
                      projectMode === "ALL" ? projectOptions : projectMode
                    }
                    onChange={(e) => {
                      const next = Array.from(
                        e.target.selectedOptions,
                        (o) => o.value
                      );
                      if (next.length === projectOptions.length) {
                        setProjectMode("ALL");
                      } else {
                        setProjectMode(next);
                      }
                    }}
                    className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {projectOptions.map((p) => (
                      <option key={p.toLowerCase()} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      className="text-brand hover:underline"
                      onClick={() => setProjectMode("ALL")}
                    >
                      All projects
                    </button>
                    <button
                      type="button"
                      className="text-slate-500 hover:text-slate-300 hover:underline"
                      onClick={() => setProjectMode([])}
                    >
                      None
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">
                    Ctrl/Cmd+click to multi-select. Filters all charts below.
                  </p>
                </div>
              )}

              {productOptions.length > 0 && productKey && (
                <div className="flex flex-col gap-1 max-w-[16rem]">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Product
                  </span>
                  <select
                    multiple
                    size={Math.min(7, Math.max(3, productOptions.length))}
                    value={
                      productMode === "ALL" ? productOptions : productMode
                    }
                    onChange={(e) => {
                      const next = Array.from(
                        e.target.selectedOptions,
                        (o) => o.value
                      );
                      if (next.length === productOptions.length) {
                        setProductMode("ALL");
                      } else {
                        setProductMode(next);
                      }
                    }}
                    className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {productOptions.map((p) => (
                      <option key={`prod-${p.toLowerCase()}`} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      className="text-brand hover:underline"
                      onClick={() => setProductMode("ALL")}
                    >
                      All products
                    </button>
                    <button
                      type="button"
                      className="text-slate-500 hover:text-slate-300 hover:underline"
                      onClick={() => setProductMode([])}
                    >
                      None
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">
                    Ctrl/Cmd+click to multi-select.
                  </p>
                </div>
              )}
            </div>
          )}

          {(projectMode !== "ALL" && projectMode.length === 0) ||
          (productMode !== "ALL" && productMode.length === 0) ? (
            <p className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-700 rounded-lg">
              No project or product selection — choose &quot;All&quot; or select
              at least one value to see charts.
            </p>
          ) : (
            <>
              <PortfolioTotalsColumnChart rows={filteredRows} />

              <ValueDashboardCharts rows={filteredRows} />
            </>
          )}
        </>
      )}
    </div>
  );
}
