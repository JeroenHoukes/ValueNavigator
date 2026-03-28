import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";
import { omitProjectModelViewVirtualColumns } from "@/lib/projectModelViewSql";
import {
  getBearerToken,
  isSafeSqlIdentifier,
  requireTokenAndBodySource
} from "@/lib/valueDashboardTableApiServer";

export async function POST(request: Request) {
  const token = getBearerToken(request);

  try {
    const payload = (await request.json().catch(() => null)) as
      | {
          source?: string;
          ids?: unknown[];
          keyColumn?: string;
          values?: Record<string, unknown>;
        }
      | null;

    const src = requireTokenAndBodySource(token, payload?.source);
    if ("error" in src) return src.error;
    const { config } = src;

    const ids = Array.isArray(payload?.ids) ? payload?.ids : [];
    const keyColumn = payload?.keyColumn?.trim() ?? "";
    let values = payload?.values;

    if (config.id === "project") {
      values = omitProjectModelViewVirtualColumns(values);
    }

    if (!ids.length) {
      return NextResponse.json(
        { error: "ids array is required and must not be empty." },
        { status: 400 }
      );
    }
    if (!keyColumn || !isSafeSqlIdentifier(keyColumn)) {
      return NextResponse.json(
        { error: "Invalid or missing keyColumn." },
        { status: 400 }
      );
    }
    if (
      !values ||
      typeof values !== "object" ||
      !Object.keys(values).length
    ) {
      return NextResponse.json(
        { error: "values object is required and must not be empty." },
        { status: 400 }
      );
    }

    const valKeys = Object.keys(values);
    for (const c of valKeys) {
      if (!isSafeSqlIdentifier(c)) {
        return NextResponse.json(
          { error: `Invalid column name: ${c}` },
          { status: 400 }
        );
      }
      if (c === keyColumn) {
        return NextResponse.json(
          { error: "Cannot bulk-update the primary key column." },
          { status: 400 }
        );
      }
    }

    const pool = await getDbWithToken(token!);
    try {
      let requestBuilder = pool.request();
      valKeys.forEach((col, index) => {
        const paramName = `p${index}`;
        requestBuilder = requestBuilder.input(
          paramName,
          (values as Record<string, unknown>)[col]
        );
      });
      const idParams: string[] = [];
      ids.forEach((id, index) => {
        const paramName = `id${index}`;
        idParams.push(`@${paramName}`);
        requestBuilder = requestBuilder.input(paramName, id as unknown);
      });
      const setSql = valKeys.map((c, index) => `[${c}] = @p${index}`).join(", ");
      const inClause = idParams.join(", ");
      const quoted = config.quotedFrom;
      await requestBuilder.query(
        `UPDATE ${quoted} SET ${setSql} WHERE [${keyColumn}] IN (${inClause});`
      );
      return NextResponse.json({ ok: true, updated: ids.length });
    } finally {
      try {
        await pool.close();
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error in bulk update.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
