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
          lookupId?: unknown;
        }
      | null;

    const ids = Array.isArray(payload?.ids) ? payload?.ids : [];
    const lookupId = payload?.lookupId;

    if (!ids.length || lookupId === undefined || lookupId === null) {
      return NextResponse.json(
        { error: "ids and lookupId are required." },
        { status: 400 }
      );
    }

    const pool = await getDbWithToken(token);
    let requestBuilder = pool.request().input("lookupId", lookupId as unknown);

    const idParams: string[] = [];
    ids.forEach((id, index) => {
      const paramName = `id${index}`;
      idParams.push(`@${paramName}`);
      requestBuilder = requestBuilder.input(paramName, id as unknown);
    });

    const inClause = idParams.join(", ");
    await requestBuilder.query(
      `UPDATE table_ai2 SET lookupID = @lookupId WHERE id IN (${inClause});`
    );

    await pool.close();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error in bulk lookup update.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

