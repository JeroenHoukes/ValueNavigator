import { NextResponse } from "next/server";

/**
 * Map SQL Server delete failures (FK / reference constraints) to a stable API shape.
 */
export function milestoneDeleteErrorResponse(error: unknown): NextResponse {
  const raw = error instanceof Error ? error.message : String(error);
  const isFk =
    /REFERENCE constraint|FOREIGN KEY constraint|conflicted with the REFERENCE/i.test(
      raw
    );
  if (isFk) {
    const constraint =
      raw.match(/"((?:FK|fk)_[^"]+)"/)?.[1] ??
      raw.match(/constraint\s+"([^"]+)"/i)?.[1] ??
      null;
    const refTable = raw.match(/table\s+"([^"]+)"/i)?.[1] ?? null;
    const refColumn = raw.match(/column\s+'([^']+)'/i)?.[1] ?? null;
    let error =
      "This milestone cannot be deleted while other records still reference it.";
    if (refTable) {
      error += ` Related data is in ${refTable}`;
      if (refColumn) error += ` (${refColumn})`;
      error += ".";
    }
    error +=
      " Remove or reassign those rows first, or ask a DBA if a different delete rule is needed.";
    return NextResponse.json(
      {
        ok: false,
        code: "FOREIGN_KEY_VIOLATION" as const,
        error,
        details: raw,
        constraint,
        referencedTable: refTable,
        referencedColumn: refColumn
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: false, error: raw }, { status: 500 });
}
