import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";
import { milestoneDeleteErrorResponse } from "@/lib/sqlDeleteErrors";
import { mergeProjectInsertRlsColumns } from "@/lib/projectTableInsertServer";
import { omitProjectModelViewVirtualColumns } from "@/lib/projectModelViewSql";
import {
  getWritableTableFromQuery,
  isSafeSqlIdentifier
} from "@/lib/valueDashboardTableApiServer";

export async function POST(request: Request) {
  const parsed = getWritableTableFromQuery(request);
  if ("error" in parsed) return parsed.error;
  const { token, config } = parsed;

  let pool: Awaited<ReturnType<typeof getDbWithToken>> | null = null;
  try {
    pool = await getDbWithToken(token);

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

    if (config.id === "project") {
      values = omitProjectModelViewVirtualColumns(values);
      if (!values || Object.keys(values).length === 0) {
        return NextResponse.json(
          {
            error:
              "Add at least one field before saving. Empty inserts are not allowed for dbo.project."
          },
          { status: 400 }
        );
      }
      values = await mergeProjectInsertRlsColumns(pool, values);
    }

    const quoted = config.quotedFrom;

    if (values && Object.keys(values).length > 0) {
      const cols = Object.keys(values);
      for (const c of cols) {
        if (!isSafeSqlIdentifier(c)) {
          return NextResponse.json(
            { error: `Invalid column name: ${c}` },
            { status: 400 }
          );
        }
      }
      let dbRequest = pool.request();
      const placeholders: string[] = [];
      cols.forEach((col, index) => {
        const paramName = `p${index}`;
        placeholders.push(`@${paramName}`);
        dbRequest = dbRequest.input(
          paramName,
          (values as Record<string, unknown>)[col]
        );
      });
      const columnsSql = cols.map((c) => `[${c}]`).join(", ");
      const valuesSql = placeholders.join(", ");
      await dbRequest.query(
        `INSERT INTO ${quoted} (${columnsSql}) VALUES (${valuesSql});`
      );
    } else {
      await pool.request().query(`INSERT INTO ${quoted} DEFAULT VALUES;`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error inserting row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function PUT(request: Request) {
  const parsed = getWritableTableFromQuery(request);
  if ("error" in parsed) return parsed.error;
  const { token, config } = parsed;

  try {
    const pool = await getDbWithToken(token);

    const payload = (await request.json().catch(() => null)) as
      | {
          keyColumn?: string;
          keyValue?: unknown;
          values?: Record<string, unknown>;
        }
      | null;

    const keyColumn = payload?.keyColumn?.trim() ?? "";
    const keyValue = payload?.keyValue;
    let values = payload?.values;

    if (config.id === "project") {
      values = omitProjectModelViewVirtualColumns(values);
    }

    if (
      !keyColumn ||
      !isSafeSqlIdentifier(keyColumn) ||
      keyValue === undefined ||
      !values ||
      !Object.keys(values).length
    ) {
      await pool.close();
      return NextResponse.json(
        { error: "Missing keyColumn, keyValue, or values for update." },
        { status: 400 }
      );
    }

    const columns = Object.keys(values);
    for (const c of columns) {
      if (!isSafeSqlIdentifier(c)) {
        await pool.close();
        return NextResponse.json(
          { error: `Invalid column name: ${c}` },
          { status: 400 }
        );
      }
    }

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
    const quoted = config.quotedFrom;
    const query = `UPDATE ${quoted} SET ${setSql} WHERE [${keyColumn}] = @key;`;
    await dbRequest.query(query);
    await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error updating row.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const parsed = getWritableTableFromQuery(request);
  if ("error" in parsed) return parsed.error;
  const { token, config } = parsed;

  let pool: Awaited<ReturnType<typeof getDbWithToken>> | null = null;
  try {
    pool = await getDbWithToken(token);

    const payload = (await request.json().catch(() => null)) as
      | {
          keyColumn?: string;
          keyValue?: unknown;
        }
      | null;

    const keyColumn = payload?.keyColumn?.trim() ?? "";
    const keyValue = payload?.keyValue;

    if (!keyColumn || !isSafeSqlIdentifier(keyColumn) || keyValue === undefined) {
      return NextResponse.json(
        { error: "Missing keyColumn or keyValue for delete." },
        { status: 400 }
      );
    }

    const quoted = config.quotedFrom;
    const dbRequest = pool.request().input("key", keyValue as unknown);
    await dbRequest.query(
      `DELETE FROM ${quoted} WHERE [${keyColumn}] = @key;`
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return milestoneDeleteErrorResponse(error);
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {
        /* ignore */
      }
    }
  }
}
