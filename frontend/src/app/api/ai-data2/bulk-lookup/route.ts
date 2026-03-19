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
          column?: string;
          value?: unknown;
        }
      | null;

    const ids = Array.isArray(payload?.ids) ? payload?.ids : [];
    const column = payload?.column;
    const value = payload?.value;

    if (!ids.length || !column || value === undefined || value === null) {
      return NextResponse.json(
        { error: "ids, column, and value are required." },
        { status: 400 }
      );
    }

    const allowedColumns = new Set(["Col1", "Col2", "lookupID"]);
    if (!allowedColumns.has(column)) {
      return NextResponse.json(
        { error: "Invalid column for bulk update." },
        { status: 400 }
      );
    }

    const pool = await getDbWithToken(token);
    let requestBuilder = pool.request().input("val", value as unknown);

    const idParams: string[] = [];
    ids.forEach((id, index) => {
      const paramName = `id${index}`;
      idParams.push(`@${paramName}`);
      requestBuilder = requestBuilder.input(paramName, id as unknown);
    });

    const inClause = idParams.join(", ");
    await requestBuilder.query(
      `UPDATE table_ai2 SET [${column}] = @val WHERE id IN (${inClause});`
    );

    await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in bulk update.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

