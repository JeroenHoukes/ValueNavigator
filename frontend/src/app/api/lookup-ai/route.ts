import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";

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
      .query("SELECT DISTINCT LookupId, LookupName FROM lookup_ai ORDER BY LookupName");
    await pool.close();
    return NextResponse.json(result.recordset);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error loading lookup_ai.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

