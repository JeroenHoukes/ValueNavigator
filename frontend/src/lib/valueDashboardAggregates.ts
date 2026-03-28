/** Case-insensitive column resolution for FnModelOrg / model output views. */

const VALUE_KEYS = ["value", "Value"];
const DASHBOARD_REV_KEYS = ["dashboardrev", "DashboardRev", "dashboardRev"];
const PORTFOLIO_KEYS = [
  "portfolio",
  "Portfolio",
  "portfolioname",
  "PortfolioName",
  "portfolio_name",
  "portfolioId",
  "PortfolioId",
  "Portfolio_ID"
];

const PROJECT_KEYS = [
  "project",
  "Project",
  "ProjectName",
  "projectName",
  "project_name",
  "projectId",
  "ProjectId",
  "Project_Id",
  "Initiative",
  "initiative"
];

const PRODUCT_KEYS = [
  "product",
  "Product",
  "ProductName",
  "productName",
  "product_name",
  "productId",
  "ProductId",
  "Product_Id",
  "SKU",
  "sku"
];

const KPI_KEYS = [
  "KPI",
  "kpi",
  "Kpi",
  "KPIName",
  "kpiName",
  "KpiName",
  "kpi_name"
];

const YEAR_KEYS = [
  "Year",
  "year",
  "Yr",
  "yr",
  "FiscalYear",
  "fiscalYear",
  "FY",
  "CalendarYear",
  "calendarYear",
  "ModelYear",
  "modelYear"
];

/** Normalize a cell to a 4-digit year label, or null if not parseable. */
export function normalizeYearLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const y = Math.trunc(value);
    if (y >= 1900 && y <= 2200) return String(y);
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return String(value.getFullYear());
  }
  const s = String(value).trim();
  if (!s) return null;
  const four = s.match(/^(\d{4})\b/);
  if (four) return four[1];
  const n = Number(s);
  if (Number.isFinite(n)) {
    const y = Math.trunc(n);
    if (y >= 1900 && y <= 2200) return String(y);
  }
  return null;
}

export function resolveColumnKey(
  columns: string[],
  candidates: string[]
): string | null {
  const lowerToActual = new Map<string, string>();
  for (const c of columns) {
    lowerToActual.set(c.toLowerCase(), c);
  }
  for (const cand of candidates) {
    const hit = lowerToActual.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export function parseAggregateNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  const s = String(value).trim().replace(/,/g, "");
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRevFlag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export type PortfolioRevenueRank = {
  rank: number;
  portfolio: string;
  revenue: number;
};

export type PortfolioRevenueResult = {
  ranks: PortfolioRevenueRank[];
  missingColumns: ("value" | "dashboardrev" | "portfolio")[];
};

/**
 * Sum `value` by portfolio where dashboardrev equals `rev` (case-insensitive).
 */
export function buildPortfolioRevenueByRev(
  rows: Record<string, unknown>[]
): PortfolioRevenueResult {
  const cols =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const valueKey = resolveColumnKey(cols, VALUE_KEYS);
  const revKey = resolveColumnKey(cols, DASHBOARD_REV_KEYS);
  const portfolioKey = resolveColumnKey(cols, PORTFOLIO_KEYS);

  const missing: ("value" | "dashboardrev" | "portfolio")[] = [];
  if (!valueKey) missing.push("value");
  if (!revKey) missing.push("dashboardrev");
  if (!portfolioKey) missing.push("portfolio");
  if (missing.length) return { ranks: [], missingColumns: missing };

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (normalizeRevFlag(row[revKey!]) !== "rev") continue;
    const label = String(row[portfolioKey!] ?? "").trim() || "(unspecified)";
    const add = parseAggregateNumber(row[valueKey!]);
    totals.set(label, (totals.get(label) ?? 0) + add);
  }

  const sorted = [...totals.entries()]
    .map(([portfolio, revenue]) => ({ portfolio, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const ranks: PortfolioRevenueRank[] = sorted.map((r, i) => ({
    rank: i + 1,
    portfolio: r.portfolio,
    revenue: r.revenue
  }));

  return { ranks, missingColumns: [] };
}

export type PortfolioValueTotal = {
  portfolio: string;
  total: number;
};

export type PortfolioValueTotalsResult = {
  points: PortfolioValueTotal[];
  missingColumns: ("value" | "portfolio")[];
};

/** Distinct non-empty KPI cell values (case-insensitive dedupe), sorted. */
export function listUniqueKpiValues(
  rows: Record<string, unknown>[]
): { kpiKey: string | null; values: string[] } {
  const cols =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const kpiKey = resolveColumnKey(cols, KPI_KEYS);
  if (!kpiKey) return { kpiKey: null, values: [] };

  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of rows) {
    const raw = String(row[kpiKey] ?? "").trim();
    if (raw === "") continue;
    const lower = raw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    values.push(raw);
  }
  values.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  return { kpiKey, values };
}

export type BuildPortfolioValueTotalsOptions = {
  /** When set, only rows whose KPI column equals this (case-insensitive trim). */
  kpiEquals?: string | null;
};

/** Sum `value` for every row, grouped by portfolio (optional KPI filter). */
export function buildPortfolioValueTotals(
  rows: Record<string, unknown>[],
  options?: BuildPortfolioValueTotalsOptions
): PortfolioValueTotalsResult {
  const cols =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const valueKey = resolveColumnKey(cols, VALUE_KEYS);
  const portfolioKey = resolveColumnKey(cols, PORTFOLIO_KEYS);
  const kpiKey = resolveColumnKey(cols, KPI_KEYS);

  const missing: ("value" | "portfolio")[] = [];
  if (!valueKey) missing.push("value");
  if (!portfolioKey) missing.push("portfolio");
  if (missing.length) return { points: [], missingColumns: missing };

  const filterRaw = options?.kpiEquals?.trim();
  const filterLower = filterRaw ? filterRaw.toLowerCase() : "";

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (filterLower && kpiKey) {
      const cell = String(row[kpiKey] ?? "").trim().toLowerCase();
      if (cell !== filterLower) continue;
    }
    const label = String(row[portfolioKey!] ?? "").trim() || "(unspecified)";
    const add = parseAggregateNumber(row[valueKey!]);
    totals.set(label, (totals.get(label) ?? 0) + add);
  }

  const points = [...totals.entries()]
    .map(([portfolio, total]) => ({ portfolio, total }))
    .sort((a, b) => b.total - a.total);

  return { points, missingColumns: [] };
}

export type PortfolioYearSeriesResult = {
  /** Years sorted ascending (numeric). */
  yearsSorted: string[];
  /** All portfolios that appear after aggregation. */
  portfoliosSorted: string[];
  /** One row per year: { year, [portfolio]: sum } for every portfolio. */
  chartRows: Record<string, string | number>[];
  missingColumns: ("value" | "portfolio" | "year")[];
};

/**
 * Sum `value` by year and portfolio (optional KPI filter). Rows without a
 * parseable year are skipped.
 */
export function buildPortfolioYearSeries(
  rows: Record<string, unknown>[],
  options?: BuildPortfolioValueTotalsOptions
): PortfolioYearSeriesResult {
  const cols =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const valueKey = resolveColumnKey(cols, VALUE_KEYS);
  const portfolioKey = resolveColumnKey(cols, PORTFOLIO_KEYS);
  const yearKey = resolveColumnKey(cols, YEAR_KEYS);
  const kpiKey = resolveColumnKey(cols, KPI_KEYS);

  const missing: ("value" | "portfolio" | "year")[] = [];
  if (!valueKey) missing.push("value");
  if (!portfolioKey) missing.push("portfolio");
  if (!yearKey) missing.push("year");
  if (missing.length) {
    return {
      yearsSorted: [],
      portfoliosSorted: [],
      chartRows: [],
      missingColumns: missing
    };
  }

  const filterRaw = options?.kpiEquals?.trim();
  const filterLower = filterRaw ? filterRaw.toLowerCase() : "";

  const matrix = new Map<string, Map<string, number>>();
  const portfolioSet = new Set<string>();

  for (const row of rows) {
    if (filterLower && kpiKey) {
      const cell = String(row[kpiKey] ?? "").trim().toLowerCase();
      if (cell !== filterLower) continue;
    }
    const year = normalizeYearLabel(row[yearKey!]);
    if (!year) continue;

    const portfolio =
      String(row[portfolioKey!] ?? "").trim() || "(unspecified)";
    const add = parseAggregateNumber(row[valueKey!]);
    portfolioSet.add(portfolio);

    if (!matrix.has(year)) matrix.set(year, new Map());
    const pm = matrix.get(year)!;
    pm.set(portfolio, (pm.get(portfolio) ?? 0) + add);
  }

  const yearsSorted = [...matrix.keys()].sort(
    (a, b) => Number(a) - Number(b)
  );
  const portfoliosSorted = [...portfolioSet].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const chartRows: Record<string, string | number>[] = yearsSorted.map(
    (y) => {
      const row: Record<string, string | number> = { year: y };
      const pm = matrix.get(y)!;
      for (const p of portfoliosSorted) {
        row[p] = pm.get(p) ?? 0;
      }
      return row;
    }
  );

  return {
    yearsSorted,
    portfoliosSorted,
    chartRows,
    missingColumns: []
  };
}

export function hasProjectColumnInRows(
  rows: Record<string, unknown>[]
): boolean {
  if (rows.length === 0) return false;
  const cols = Object.keys(rows[0] as Record<string, unknown>);
  return resolveColumnKey(cols, PROJECT_KEYS) !== null;
}

export function hasProductColumnInRows(
  rows: Record<string, unknown>[]
): boolean {
  if (rows.length === 0) return false;
  const cols = Object.keys(rows[0] as Record<string, unknown>);
  return resolveColumnKey(cols, PRODUCT_KEYS) !== null;
}

/** Distinct labels for a column (empty cells → "(unspecified)"), sorted. */
export function listDistinctColumnLabels(
  rows: Record<string, unknown>[],
  columnKey: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const raw = String(row[columnKey] ?? "").trim() || "(unspecified)";
    const lower = raw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(raw);
  }
  out.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  return out;
}

export function resolveProjectColumnKey(
  rows: Record<string, unknown>[]
): string | null {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0] as Record<string, unknown>);
  return resolveColumnKey(cols, PROJECT_KEYS);
}

export function resolveProductColumnKey(
  rows: Record<string, unknown>[]
): string | null {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0] as Record<string, unknown>);
  return resolveColumnKey(cols, PRODUCT_KEYS);
}

/**
 * Keep rows whose project/product cells match the multiselect (case-insensitive).
 * `mode === "ALL"` skips that dimension. Empty array when not ALL means no rows match filter intent (caller may show empty).
 */
export function filterRowsByProjectAndProduct(
  rows: Record<string, unknown>[],
  projectKey: string | null,
  productKey: string | null,
  projectMode: "ALL" | string[],
  productMode: "ALL" | string[]
): Record<string, unknown>[] {
  return rows.filter((row) => {
    if (projectKey && projectMode !== "ALL") {
      if (projectMode.length === 0) return false;
      const v =
        String(row[projectKey] ?? "").trim() || "(unspecified)";
      const ok = projectMode.some(
        (p) => p.toLowerCase() === v.toLowerCase()
      );
      if (!ok) return false;
    }
    if (productKey && productMode !== "ALL") {
      if (productMode.length === 0) return false;
      const v =
        String(row[productKey] ?? "").trim() || "(unspecified)";
      const ok = productMode.some(
        (p) => p.toLowerCase() === v.toLowerCase()
      );
      if (!ok) return false;
    }
    return true;
  });
}

export type ProjectDrillPoint = { project: string; total: number };

export type ProjectDrillDownResult = {
  points: ProjectDrillPoint[];
  /** False when no recognizable project column exists on the dataset. */
  hasProjectColumn: boolean;
};

/**
 * Sum `value` by project for rows matching the drill scope (year, portfolio,
 * and the same optional KPI filter as the main chart).
 */
export function buildProjectTotalsForDrillDown(
  rows: Record<string, unknown>[],
  scope: {
    year: string;
    portfolio: string;
    kpiEquals?: string | null;
  }
): ProjectDrillDownResult {
  const cols =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const projectKey = resolveColumnKey(cols, PROJECT_KEYS);
  if (!projectKey) {
    return { points: [], hasProjectColumn: false };
  }

  const valueKey = resolveColumnKey(cols, VALUE_KEYS);
  const portfolioKey = resolveColumnKey(cols, PORTFOLIO_KEYS);
  const yearKey = resolveColumnKey(cols, YEAR_KEYS);
  const kpiKey = resolveColumnKey(cols, KPI_KEYS);

  if (!valueKey || !portfolioKey || !yearKey) {
    return { points: [], hasProjectColumn: true };
  }

  const filterRaw = scope.kpiEquals?.trim();
  const filterLower = filterRaw ? filterRaw.toLowerCase() : "";
  const portfolioLower = scope.portfolio.trim().toLowerCase();
  const yearTarget = scope.year;

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (filterLower && kpiKey) {
      const cell = String(row[kpiKey] ?? "").trim().toLowerCase();
      if (cell !== filterLower) continue;
    }
    const y = normalizeYearLabel(row[yearKey]);
    if (y !== yearTarget) continue;
    const port = String(row[portfolioKey] ?? "").trim().toLowerCase();
    if (port !== portfolioLower) continue;

    const proj =
      String(row[projectKey] ?? "").trim() || "(unspecified project)";
    totals.set(
      proj,
      (totals.get(proj) ?? 0) + parseAggregateNumber(row[valueKey])
    );
  }

  const points = [...totals.entries()]
    .map(([project, total]) => ({ project, total }))
    .sort((a, b) => b.total - a.total);

  return { points, hasProjectColumn: true };
}

export type PieSlice = { name: string; value: number };

/** Top 5 portfolios by revenue plus one "Other" slice. */
export function topPortfolioPieSlices(
  ranks: PortfolioRevenueRank[],
  topN = 5
): PieSlice[] {
  if (ranks.length === 0) return [];
  if (ranks.length <= topN) {
    return ranks.map((r) => ({ name: r.portfolio, value: r.revenue }));
  }
  const head = ranks.slice(0, topN);
  const otherSum = ranks
    .slice(topN)
    .reduce((s, r) => s + r.revenue, 0);
  return [
    ...head.map((r) => ({ name: r.portfolio, value: r.revenue })),
    { name: "Other", value: otherSum }
  ];
}
