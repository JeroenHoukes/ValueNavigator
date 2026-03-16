import { NextResponse } from "next/server";
import { getDb, getDbWithToken } from "@/lib/db";

function getAccessToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export async function GET(request: Request) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid Authorization token." }, { status: 401 });
  }
  try {
    const pool = await getDbWithToken(token);
    const result = await pool.request().query("SELECT * FROM table_ai");
    await pool.close();
    return NextResponse.json(result.recordset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error loading table_ai.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getAccessToken(request);
  try {
    const pool = token ? await getDbWithToken(token) : await getDb();

    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    const values =
      payload && typeof payload === "object" && "values" in payload
        ? (payload as { values?: Record<string, unknown> }).values
        : undefined;

    if (values && Object.keys(values).length > 0) {
      const columns = Object.keys(values);
      let dbRequest = pool.request();

      const placeholders: string[] = [];
      columns.forEach((col, index) => {
        const paramName = `p${index}`;
        placeholders.push(`@${paramName}`);
        dbRequest = dbRequest.input(paramName, (values as Record<string, unknown>)[col]);
      });

      const columnsSql = columns.map((c) => `[${c}]`).join(", ");
      const valuesSql = placeholders.join(", ");

      await dbRequest.query(
        `INSERT INTO table_ai (${columnsSql}) VALUES (${valuesSql});`
      );
    } else {
      await pool.request().query("INSERT INTO table_ai DEFAULT VALUES;");
    }
    if (token) await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error inserting row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

