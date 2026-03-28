/**
 * Model-view query for dbo.project: resolve FK IDs to display names from lookup tables.
 * FamilyID → dbo.productfamily.ProdFamilyName; PillarID → dbo.Pillar.PillarName; StrategyID → dbo.Strategy.StrategyName.
 */
export const PROJECT_MODEL_VIEW_SELECT_SQL = `
SELECT
  p.*,
  fam.[ProdFamilyName],
  pil.[PillarName],
  strat.[StrategyName]
FROM [dbo].[project] p
LEFT JOIN [dbo].[productfamily] fam ON fam.[FamilyID] = p.[FamilyID]
LEFT JOIN [dbo].[Pillar] pil ON pil.[PillarID] = p.[PillarID]
LEFT JOIN [dbo].[Strategy] strat ON strat.[StrategyID] = p.[StrategyID]
`.trim();

/** Joined display columns not on dbo.project (for empty-result metadata). */
export const PROJECT_MODEL_VIEW_EXTRA_COLUMNS = [
  "ProdFamilyName",
  "PillarName",
  "StrategyName"
] as const;

/** Raw ID columns hidden in the UI when paired with PROJECT_MODEL_VIEW_EXTRA_COLUMNS. */
export const PROJECT_LOOKUP_ID_COLUMNS_TO_HIDE = [
  "FamilyID",
  "PillarID",
  "StrategyID"
] as const;

const PROJECT_ID_LOWER = new Set(
  PROJECT_LOOKUP_ID_COLUMNS_TO_HIDE.map((c) => c.toLowerCase())
);

export function isProjectLookupIdColumn(column: string): boolean {
  return PROJECT_ID_LOWER.has(column.toLowerCase());
}

/** Select column → FK id column; matches AI_Data2 LookupName / lookupID pairing. */
export const PROJECT_LOOKUP_SELECT_BINDINGS: Record<string, string> = {
  ProdFamilyName: "FamilyID",
  PillarName: "PillarID",
  StrategyName: "StrategyID"
};

/**
 * For grid selects: store FK id in the joined name columns (value = option id, label from lookup).
 */
export function normalizeProjectModelViewRowsForGrid(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const r = { ...row };
    const fid = r["FamilyID"];
    r["ProdFamilyName"] =
      fid !== null && fid !== undefined ? String(fid) : "";
    const pid = r["PillarID"];
    r["PillarName"] =
      pid !== null && pid !== undefined ? String(pid) : "";
    const sid = r["StrategyID"];
    r["StrategyName"] =
      sid !== null && sid !== undefined ? String(sid) : "";
    return r;
  });
}

/** Joined label columns — not on dbo.project; omit from INSERT/UPDATE. */
const PROJECT_JOIN_DESC_LOWER = new Set(
  PROJECT_MODEL_VIEW_EXTRA_COLUMNS.map((c) => c.toLowerCase())
);

export function isProjectModelViewVirtualColumn(column: string): boolean {
  return PROJECT_JOIN_DESC_LOWER.has(column.toLowerCase());
}

export function omitProjectModelViewVirtualColumns(
  values: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!values) return values;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (isProjectModelViewVirtualColumn(k)) continue;
    out[k] = v;
  }
  return out;
}
