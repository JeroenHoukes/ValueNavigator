import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";

function getAccessToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

type UndoItem = {
  id: unknown;
  values: Record<string, unknown>;
};

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
          items?: UndoItem[];
          lookupIdColumnName?: string;
        }
      | null;

    const items = Array.isArray(payload?.items) ? payload.items : [];
    const lookupIdColumnName =
      payload?.lookupIdColumnName === "LookupID" ||
      payload?.lookupIdColumnName === "LookupId" ||
      payload?.lookupIdColumnName === "lookupID"
        ? payload.lookupIdColumnName
        : "lookupID";

    if (!items.length) {
      return NextResponse.json(
        { error: "items are required for undo." },
        { status: 400 }
      );
    }

    const allowedColumns = new Set([
      "Col1",
      "Col2",
      "lookupID",
      "LookupID",
      "LookupId"
    ]);

    const pool = await getDbWithToken(token);

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item || item.id === undefined || item.id === null) continue;

      const values = item.values ?? {};
      const updateColumns = Object.keys(values).filter((c) => allowedColumns.has(c));
      if (!updateColumns.length) continue;

      let dbRequest = pool.request().input("id", item.id as unknown);
      const setClauses: string[] = [];

      updateColumns.forEach((col, index) => {
        const paramName = `v${i}_${index}`;
        const normalizedColumn = col === "lookupID" ? lookupIdColumnName : col;
        setClauses.push(`[${normalizedColumn}] = @${paramName}`);
        dbRequest = dbRequest.input(
          paramName,
          (values as Record<string, unknown>)[col] ?? null
        );
      });

      await dbRequest.query(
        `UPDATE table_ai2 SET ${setClauses.join(", ")} WHERE [id] = @id;`
      );
    }

    await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error undoing bulk update.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

