import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const pool = await getDb();

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error inserting row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

