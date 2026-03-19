import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";

function getAccessToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function POST(request: Request) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization token." },
      { status: 401 }
    );
  }

  try {
    const payload = (await request.json().catch(() => null)) as
      | {
          ids?: unknown[];
          updates?: Record<string, unknown>;
        }
      | null;

    const ids = Array.isArray(payload?.ids) ? payload?.ids : [];
    const updates = payload?.updates;

    if (!ids.length || !updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "ids and updates are required." },
        { status: 400 }
      );
    }

    const allowedColumns = new Set(["Col1", "Col2", "lookupID"]);
    const updateColumns = Object.keys(updates).filter((c) =>
      allowedColumns.has(c)
    );

    if (!updateColumns.length) {
      return NextResponse.json(
        { error: "No valid columns in updates." },
        { status: 400 }
      );
    }

    const valuesByColumn: Record<string, unknown> = {};
    updateColumns.forEach((col) => {
      valuesByColumn[col] = (updates as Record<string, unknown>)[col];
    });

    const nonNullColumns = updateColumns.filter((col) => {
      const v = valuesByColumn[col];
      return v !== undefined && v !== null;
    });

    if (!nonNullColumns.length) {
      return NextResponse.json(
        { error: "No non-null values in updates." },
        { status: 400 }
      );
    }

    const pool = await getDbWithToken(token);
    let requestBuilder = pool.request();

    const setClauses: string[] = [];
    nonNullColumns.forEach((col, index) => {
      const paramName = `val${index}`;
      setClauses.push(`[${col}] = @${paramName}`);
      requestBuilder = requestBuilder.input(paramName, valuesByColumn[col]);
    });

    const idParams: string[] = [];
    ids.forEach((id, index) => {
      const paramName = `id${index}`;
      idParams.push(`@${paramName}`);
      requestBuilder = requestBuilder.input(paramName, id as unknown);
    });

    const inClause = idParams.join(", ");
    await requestBuilder.query(
      `UPDATE table_ai2 SET ${setClauses.join(", ")} WHERE id IN (${inClause});`
    );

    await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in bulk update.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

