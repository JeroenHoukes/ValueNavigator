import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";
import { milestoneDeleteErrorResponse } from "@/lib/sqlDeleteErrors";
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
        }
      | null;

    const src = requireTokenAndBodySource(token, payload?.source);
    if ("error" in src) return src.error;
    const { config } = src;

    const ids = Array.isArray(payload?.ids) ? payload?.ids : [];
    const keyColumn = payload?.keyColumn?.trim() ?? "";

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

    const pool = await getDbWithToken(token!);
    try {
      let requestBuilder = pool.request();
      const idParams: string[] = [];
      ids.forEach((id, index) => {
        const paramName = `id${index}`;
        idParams.push(`@${paramName}`);
        requestBuilder = requestBuilder.input(paramName, id as unknown);
      });
      const inClause = idParams.join(", ");
      const quoted = config.quotedFrom;
      await requestBuilder.query(
        `DELETE FROM ${quoted} WHERE [${keyColumn}] IN (${inClause});`
      );
      return NextResponse.json({ ok: true, deleted: ids.length });
    } finally {
      try {
        await pool.close();
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    return milestoneDeleteErrorResponse(error);
  }
}
