import type { ConnectionPool } from "mssql";

/** Case-insensitive: does `values` already set this logical column? */
export function valuesHasColumnCI(
  values: Record<string, unknown>,
  name: string
): boolean {
  const n = name.toLowerCase();
  return Object.keys(values).some((k) => k.toLowerCase() === n);
}

/** Columns that RLS often expects to match SUSER_SNAME() / session identity */
const RLS_USER_COLUMN_NAMES = new Set([
  "username",
  "user_name"
]);

export function pickProjectRlsUserColumn(columnNames: string[]): string | null {
  for (const c of columnNames) {
    if (RLS_USER_COLUMN_NAMES.has(c.toLowerCase())) return c;
  }
  return null;
}

function firstCellString(row: Record<string, unknown> | undefined): string {
  if (!row) return "";
  for (const v of Object.values(row)) {
    if (v !== null && v !== undefined) return String(v);
  }
  return "";
}

/**
 * One batch (single connection borrow): session login + dbo.project columns.
 * If the table has UserName / user_name and the client omitted it, set it to
 * SUSER_SNAME() so RLS WITH CHECK predicates on the insert row can pass.
 */
export async function mergeProjectInsertRlsColumns(
  pool: ConnectionPool,
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await pool.request().query(`
    SELECT SUSER_SNAME() AS login;

    SELECT c.name AS col
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.project');
  `);

  const sets = result.recordsets as Record<string, unknown>[][];
  const login = firstCellString(sets[0]?.[0]);

  const colRows = (sets[1] ?? []) as Record<string, unknown>[];
  const names = colRows.map((r) => String(r.col ?? ""));
  const userCol = pickProjectRlsUserColumn(names);

  const out: Record<string, unknown> = { ...values };
  if (userCol && login !== "" && !valuesHasColumnCI(out, userCol)) {
    out[userCol] = login;
  }
  return out;
}
