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
      | { ids?: unknown[] }
      | null;

    const ids = Array.isArray(payload?.ids) ? payload?.ids : [];
    if (!ids.length) {
      return NextResponse.json(
        { error: "ids array is required and must not be empty." },
        { status: 400 }
      );
    }

    const pool = await getDbWithToken(token);
    let requestBuilder = pool.request();

    const idParams: string[] = [];
    ids.forEach((id, index) => {
      const paramName = `id${index}`;
      idParams.push(`@${paramName}`);
      requestBuilder = requestBuilder.input(paramName, id as unknown);
    });

    const inClause = idParams.join(", ");
    await requestBuilder.query(
      `DELETE FROM table_ai2 WHERE id IN (${inClause});`
    );

    await pool.close();
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in bulk delete.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
