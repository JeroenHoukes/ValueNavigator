import * as XLSX from "xlsx";

/** Headers in export / expected on import (case-insensitive, spaces ignored). */
const SHEET_NAME = "table_ai2";

function normalizeHeader(key: string): string | null {
  const k = key.trim().toLowerCase().replace(/\s+/g, "");
  if (k === "id") return "id";
  if (k === "col1") return "Col1";
  if (k === "col2") return "Col2";
  if (k === "tenantid") return "TenantID";
  if (k === "lookupid" || k === "lookup_id") return "lookupID";
  if (k === "lookupname") return "LookupName";
  return null;
}

function normalizeSheetRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    const nk = normalizeHeader(key);
    if (nk) out[nk] = val;
  }
  return out;
}

function parseId(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return Math.trunc(val);
  const s = String(val).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  const s = String(val).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toExportCell(v: unknown): string | number | "" {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Build rows for Excel: human-readable LookupName label + lookupID for round-trip.
 */
export function buildTableAi2ExportRows(
  rows: Record<string, unknown>[],
  lookupOptions: { value: string; label: string }[],
  lookupIdColumn: string
): Record<string, string | number | "" | null>[] {
  return rows.map((row) => {
    const anyRow = row as Record<string, unknown>;
    const lookupRaw =
      anyRow[lookupIdColumn] ??
      anyRow.lookupID ??
      anyRow.LookupID ??
      anyRow.LookupId;
    const label =
      lookupRaw !== null && lookupRaw !== undefined && String(lookupRaw) !== ""
        ? lookupOptions.find((o) => o.value === String(lookupRaw))?.label ?? ""
        : "";
    const idVal = anyRow.id;
    return {
      id:
        idVal !== null && idVal !== undefined && String(idVal) !== ""
          ? typeof idVal === "number"
            ? idVal
            : Number(String(idVal).trim()) || String(idVal)
          : "",
      Col1: toExportCell(anyRow.Col1),
      Col2: toExportCell(anyRow.Col2),
      TenantID:
        anyRow.TenantID !== null && anyRow.TenantID !== undefined
          ? (typeof anyRow.TenantID === "number"
              ? anyRow.TenantID
              : Number(String(anyRow.TenantID).trim())) || ""
          : "",
      lookupID:
        lookupRaw !== null && lookupRaw !== undefined && String(lookupRaw) !== ""
          ? typeof lookupRaw === "number"
            ? lookupRaw
            : Number(String(lookupRaw).trim()) || String(lookupRaw)
          : "",
      LookupName: label
    };
  });
}

export function downloadTableAi2Excel(
  rows: Record<string, unknown>[],
  lookupOptions: { value: string; label: string }[],
  lookupIdColumn: string,
  filename?: string
): void {
  const data = buildTableAi2ExportRows(rows, lookupOptions, lookupIdColumn);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  const name =
    filename ??
    `table_ai2_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}

export type ParsedImportRow = Record<string, unknown>;

export function parseTableAi2Workbook(buffer: ArrayBuffer): {
  rows: ParsedImportRow[];
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
    const rows = json.map((raw) => normalizeSheetRow(raw));
    return { rows };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to read Excel file."
    };
  }
}

/**
 * Resolve lookupID from row: prefer numeric lookupID column; else match LookupName label.
 */
export function resolveLookupIdForImport(
  row: ParsedImportRow,
  lookupOptions: { value: string; label: string }[]
): string | null {
  const direct = row.lookupID;
  if (direct !== null && direct !== undefined && String(direct).trim() !== "") {
    return String(direct).trim();
  }
  const name = row.LookupName;
  if (name === null || name === undefined || String(name).trim() === "") {
    return null;
  }
  const label = String(name).trim();
  const opt = lookupOptions.find(
    (o) =>
      o.label === label ||
      o.label.toLowerCase() === label.toLowerCase()
  );
  return opt ? opt.value : null;
}

export function rowToInsertValues(
  row: ParsedImportRow,
  lookupOptions: { value: string; label: string }[],
  lookupIdColumn: string
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const lid = resolveLookupIdForImport(row, lookupOptions);
  if (row.Col1 !== undefined && row.Col1 !== "")
    values.Col1 = String(row.Col1).trim();
  if (row.Col2 !== undefined && row.Col2 !== "")
    values.Col2 = String(row.Col2).trim();
  const tenant = parseOptionalNumber(row.TenantID);
  if (tenant !== null) values.TenantID = tenant;
  if (lid !== null) values[lookupIdColumn] = lid;
  return values;
}

export function rowToUpdateValues(
  row: ParsedImportRow,
  lookupOptions: { value: string; label: string }[],
  lookupIdColumn: string
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if ("Col1" in row) {
    const v = row.Col1;
    values.Col1 =
      v === null || v === undefined || String(v).trim() === ""
        ? null
        : String(v).trim();
  }
  if ("Col2" in row) {
    const v = row.Col2;
    values.Col2 =
      v === null || v === undefined || String(v).trim() === ""
        ? null
        : String(v).trim();
  }
  if ("TenantID" in row) {
    const v = row.TenantID;
    values.TenantID =
      v === null || v === undefined || String(v).trim() === ""
        ? null
        : parseOptionalNumber(v);
  }
  if ("lookupID" in row || "LookupName" in row) {
    const lid = resolveLookupIdForImport(row, lookupOptions);
    values[lookupIdColumn] = lid;
  }
  return values;
}

export function isRowEmpty(row: ParsedImportRow): boolean {
  const id = parseId(row.id);
  const hasOther =
    (row.Col1 !== undefined && String(row.Col1).trim() !== "") ||
    (row.Col2 !== undefined && String(row.Col2).trim() !== "") ||
    (row.TenantID !== undefined && String(row.TenantID).trim() !== "") ||
    (row.lookupID !== undefined && String(row.lookupID).trim() !== "") ||
    (row.LookupName !== undefined && String(row.LookupName).trim() !== "");
  return id === null && !hasOther;
}

export { parseId, SHEET_NAME };
