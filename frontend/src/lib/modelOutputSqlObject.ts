/**
 * Value Dashboard reads from a table, view, or table-valued function.
 * Override with AZURE_SQL_MODEL_OUTPUT_OBJECT if needed.
 *
 * Set AZURE_SQL_MODEL_OUTPUT_OBJECT to a 1–3 part name, e.g. dbo.FnModelOrg
 * (no brackets; only letters, digits, underscore, $).
 *
 * Table-valued functions are invoked as Name() when
 * AZURE_SQL_MODEL_OUTPUT_IS_TABLE_VALUED_FUNCTION is true, or when the base
 * name starts with "Fn" (case-insensitive).
 */
const DEFAULT_MODEL_OUTPUT_OBJECT = "dbo.FnModelOrg";

function quoteSegment(segment: string): string {
  return `[${segment.replace(/\]/g, "]]")}]`;
}

function parseModelOutputSpec(): string[] {
  const spec =
    process.env.AZURE_SQL_MODEL_OUTPUT_OBJECT?.trim() ||
    DEFAULT_MODEL_OUTPUT_OBJECT;
  const parts = spec
    .split(".")
    .map((p) => p.replace(/^\[|\]$/g, "").trim())
    .filter((p) => p.length > 0);
  if (parts.length < 1 || parts.length > 3) {
    throw new Error(
      `AZURE_SQL_MODEL_OUTPUT_OBJECT must look like dbo.MyTable (got: ${spec})`
    );
  }
  for (const p of parts) {
    if (!/^[\w$]+$/i.test(p)) {
      throw new Error(`Invalid SQL identifier segment: ${p}`);
    }
  }
  return parts;
}

/** Returns quoted name for SELECT * FROM … (supports up to 3 segments, e.g. db.schema.object). */
export function getQuotedModelOutputObject(): string {
  return parseModelOutputSpec().map(quoteSegment).join(".");
}

/** True → use [schema].[Fn](...) in SELECT; false → use as table/view. */
export function modelOutputUsesTableValuedFunctionCall(): boolean {
  const raw =
    process.env.AZURE_SQL_MODEL_OUTPUT_IS_TABLE_VALUED_FUNCTION?.trim() ??
    "";
  const lowered = raw.toLowerCase();
  if (lowered === "0" || lowered === "false" || lowered === "no") {
    return false;
  }
  if (lowered === "1" || lowered === "true" || lowered === "yes") {
    return true;
  }
  const parts = parseModelOutputSpec();
  const base = parts[parts.length - 1];
  return /^fn/i.test(base);
}

/** Fragment after FROM: quoted object, with () for table-valued functions. */
export function getModelOutputFromClause(): string {
  const quoted = getQuotedModelOutputObject();
  return modelOutputUsesTableValuedFunctionCall()
    ? `${quoted}()`
    : quoted;
}

/**
 * Unquoted a.b or a.b.c for OBJECT_ID(@obj) (segments already validated).
 */
export function getModelOutputObjectIdString(): string {
  const parts = parseModelOutputSpec();
  if (parts.length === 1) return `dbo.${parts[0]}`;
  return parts.join(".");
}

/**
 * Schema + table name for INFORMATION_SCHEMA.COLUMNS (current database only).
 * For one-part names, schema defaults to dbo. For three-part, uses schema.object (2nd and 3rd).
 */
export function getModelOutputInformationSchemaNames(): {
  schema: string;
  table: string;
} {
  const parts = parseModelOutputSpec();
  if (parts.length === 1) return { schema: "dbo", table: parts[0] };
  if (parts.length === 2) return { schema: parts[0], table: parts[1] };
  return { schema: parts[1], table: parts[2] };
}
