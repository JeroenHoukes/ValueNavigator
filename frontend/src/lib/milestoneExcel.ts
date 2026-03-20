import * as XLSX from "xlsx";

const SHEET_NAME = "milestone";

function toExportCell(v: unknown): string | number | "" {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function inferMilestoneKeyColumn(columns: string[]): string {
  const candidates = [
    "id",
    "Id",
    "ID",
    "MilestoneId",
    "MilestoneID",
    "milestoneId"
  ];
  for (const c of candidates) {
    if (columns.includes(c)) return c;
  }
  return columns[0] ?? "id";
}

export function hasMilestoneKey(
  row: Record<string, unknown>,
  keyColumn: string
): boolean {
  const v = row[keyColumn];
  if (v === null || v === undefined) return false;
  return String(v).trim() !== "";
}

export function milestoneRowToInsertValues(
  row: Record<string, unknown>,
  keyColumn: string
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === keyColumn) continue;
    if (v === null || v === undefined || String(v).trim() === "") continue;
    values[k] = v;
  }
  return values;
}

export function milestoneRowToUpdateValues(
  row: Record<string, unknown>,
  keyColumn: string
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === keyColumn) continue;
    values[k] =
      v === null || v === undefined || String(v).trim() === "" ? null : v;
  }
  return values;
}

export function isMilestoneRowEmpty(
  row: Record<string, unknown>,
  keyColumn: string
): boolean {
  if (hasMilestoneKey(row, keyColumn)) return false;
  for (const [k, v] of Object.entries(row)) {
    if (k === keyColumn) continue;
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      return false;
    }
  }
  return true;
}

export function buildMilestoneExportRows(
  rows: Record<string, unknown>[],
  columnOrder: string[]
): Record<string, string | number | "">[] {
  return rows.map((row) => {
    const out: Record<string, string | number | ""> = {};
    for (const col of columnOrder) {
      out[col] = toExportCell((row as Record<string, unknown>)[col]);
    }
    return out;
  });
}

export function downloadMilestoneExcel(
  rows: Record<string, unknown>[],
  columnOrder: string[],
  filename?: string
): void {
  const data = buildMilestoneExportRows(rows, columnOrder);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  const name =
    filename ??
    `milestone_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}

export function parseMilestoneWorkbook(buffer: ArrayBuffer): {
  rows: Record<string, unknown>[];
  error?: string;
} {
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const first = workbook.SheetNames[0];
    if (!first) return { rows: [], error: "Workbook has no sheets." };
    const sheet = workbook.Sheets[first];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true
    });
    if (!json.length) return { rows: [], error: "First sheet is empty." };
    return { rows: json };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to read Excel file."
    };
  }
}

export { SHEET_NAME };
