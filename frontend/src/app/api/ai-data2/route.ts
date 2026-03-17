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
    return NextResponse.json(
      { error: "Missing or invalid Authorization token." },
      { status: 401 }
    );
  }
  try {
    const pool = await getDbWithToken(token);
    const result = await pool
      .request()
      .query(
        "SELECT t.*, l.LookupName FROM table_ai2 t LEFT JOIN lookup_ai l ON t.LookupId = l.LookupId"
      );
    await pool.close();
    return NextResponse.json(result.recordset);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error loading table_ai2.";
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

    let values =
      payload && typeof payload === "object" && "values" in payload
        ? (payload as { values?: Record<string, unknown> }).values
        : undefined;

    // LookupName is a joined/display-only column and does not exist
    // in table_ai2, so never try to insert/update it.
    if (values && "LookupName" in values) {
      const { LookupName, ...rest } = values as Record<string, unknown>;
      values = rest;
    }

    if (values && Object.keys(values).length > 0) {
      const columns = Object.keys(values);
      let dbRequest = pool.request();

      const placeholders: string[] = [];
      columns.forEach((col, index) => {
        const paramName = `p${index}`;
        placeholders.push(`@${paramName}`);
        dbRequest = dbRequest.input(
          paramName,
          (values as Record<string, unknown>)[col]
        );
      });

      const columnsSql = columns.map((c) => `[${c}]`).join(", ");
      const valuesSql = placeholders.join(", ");

      await dbRequest.query(
        `INSERT INTO table_ai2 (${columnsSql}) VALUES (${valuesSql});`
      );
    } else {
      await pool.request().query("INSERT INTO table_ai2 DEFAULT VALUES;");
    }
    if (token) await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error inserting row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const token = getAccessToken(request);
  try {
    const pool = token ? await getDbWithToken(token) : await getDb();

    const payload = (await request.json().catch(() => null)) as
      | {
          keyColumn?: string;
          keyValue?: unknown;
          values?: Record<string, unknown>;
        }
      | null;

    const keyColumn = payload?.keyColumn;
    const keyValue = payload?.keyValue;
    let values = payload?.values;

    if (values && "LookupName" in values) {
      const { LookupName, ...rest } = values as Record<string, unknown>;
      values = rest;
    }

    if (!keyColumn || keyValue === undefined || !values || !Object.keys(values).length) {
      return NextResponse.json(
        { error: "Missing keyColumn, keyValue, or values for update." },
        { status: 400 }
      );
    }

    const columns = Object.keys(values);
    let dbRequest = pool.request();

    columns.forEach((col, index) => {
      const paramName = `p${index}`;
      dbRequest = dbRequest.input(
        paramName,
        (values as Record<string, unknown>)[col]
      );
    });

    dbRequest = dbRequest.input("key", keyValue as unknown);

    const setSql = columns.map((c, index) => `[${c}] = @p${index}`).join(", ");
    const query = `UPDATE table_ai2 SET ${setSql} WHERE [${keyColumn}] = @key;`;

    await dbRequest.query(query);
    if (token) await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error updating row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const token = getAccessToken(request);
  try {
    const pool = token ? await getDbWithToken(token) : await getDb();

    const payload = (await request.json().catch(() => null)) as
      | {
          keyColumn?: string;
          keyValue?: unknown;
        }
      | null;

    const keyColumn = payload?.keyColumn;
    const keyValue = payload?.keyValue;

    if (!keyColumn || keyValue === undefined) {
      return NextResponse.json(
        { error: "Missing keyColumn or keyValue for delete." },
        { status: 400 }
      );
    }

    const dbRequest = pool.request().input("key", keyValue as unknown);
    const query = `DELETE FROM table_ai2 WHERE [${keyColumn}] = @key;`;

    await dbRequest.query(query);
    if (token) await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error deleting row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

