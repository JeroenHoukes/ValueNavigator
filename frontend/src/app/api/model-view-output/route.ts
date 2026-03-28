import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";
import {
  PROJECT_MODEL_VIEW_EXTRA_COLUMNS,
  PROJECT_MODEL_VIEW_SELECT_SQL
} from "@/lib/projectModelViewSql";
import {
  DEFAULT_VALUE_DASHBOARD_SOURCE_ID,
  getValueDashboardSourceConfig,
  isValueDashboardSourceId
} from "@/lib/valueDashboardSources";

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

  const url = new URL(request.url);
  const rawSource = url.searchParams.get("source");
  const sourceId =
    rawSource && isValueDashboardSourceId(rawSource)
      ? rawSource
      : rawSource === null || rawSource === ""
        ? DEFAULT_VALUE_DASHBOARD_SOURCE_ID
        : null;

  if (sourceId === null) {
    return NextResponse.json(
      {
        error:
          "Invalid source. Use one of: milestone, fnmodelorg, portfolio, project, product."
      },
      { status: 400 }
    );
  }

  const config = getValueDashboardSourceConfig(sourceId);
  if (!config) {
    return NextResponse.json({ error: "Unknown source." }, { status: 400 });
  }

  try {
    const pool = await getDbWithToken(token);
    const queryText =
      sourceId === "project"
        ? PROJECT_MODEL_VIEW_SELECT_SQL
        : `SELECT * FROM ${config.quotedFrom}`;
    const result = await pool.request().query(queryText);
    const rows = result.recordset as Record<string, unknown>[];
    let columns: string[] =
      rows.length > 0 ? Object.keys(rows[0]) : [];

    if (rows.length === 0) {
      if (config.kind === "tvf" && config.objectIdForMetadata) {
        const colResult = await pool
          .request()
          .input("obj", config.objectIdForMetadata)
          .query(
            `SELECT c.name AS name FROM sys.columns c
             WHERE c.object_id = OBJECT_ID(@obj)
             ORDER BY c.column_id`
          );
        columns = (
          colResult.recordset as { name: string }[]
        ).map((r) => r.name);
      } else if (config.informationSchema) {
        const { schema, table } = config.informationSchema;
        const colResult = await pool
          .request()
          .input("schema", schema)
          .input("table", table)
          .query(
            `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
             ORDER BY ORDINAL_POSITION`
          );
        columns = (
          colResult.recordset as { name: string }[]
        ).map((r) => r.name);
        if (sourceId === "project") {
          for (const c of PROJECT_MODEL_VIEW_EXTRA_COLUMNS) {
            if (!columns.includes(c)) columns.push(c);
          }
        }
      }
    }

    await pool.close();
    return NextResponse.json({ rows, columns });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error loading data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
