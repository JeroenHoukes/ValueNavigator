import { NextResponse } from "next/server";
import { getDbWithToken } from "@/lib/db";

function getAccessToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in row) return row[k];
    const lower = k.toLowerCase();
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase() === lower) return row[rk];
    }
  }
  return undefined;
}

function toOptions(
  recordset: Record<string, unknown>[],
  idKeys: string[],
  labelKeys: string[]
): { value: string; label: string }[] {
  return recordset.map((r) => {
    const idRaw = idKeys.map((k) => pickStr(r, k)).find((v) => v !== undefined);
    const labelRaw = labelKeys
      .map((k) => pickStr(r, k))
      .find((v) => v !== undefined);
    return {
      value:
        idRaw !== null && idRaw !== undefined ? String(idRaw) : "",
      label:
        labelRaw !== null && labelRaw !== undefined ? String(labelRaw) : ""
    };
  });
}

export async function GET(request: Request) {
  const token = getAccessToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization token." },
      { status: 401 }
    );
  }

  let pool: Awaited<ReturnType<typeof getDbWithToken>> | null = null;
  try {
    pool = await getDbWithToken(token);
    // One batch = one connection borrow. Sequential pool.request() calls with
    // pool max: 1 often yield "Connection is closed" on the 2nd query.
    const result = await pool.request().query(`
      SELECT FamilyID, ProdFamilyName
      FROM dbo.productfamily
      ORDER BY ProdFamilyName;

      SELECT PillarID, PillarName
      FROM dbo.Pillar
      ORDER BY PillarName;

      SELECT StrategyID, StrategyName
      FROM dbo.Strategy
      ORDER BY StrategyName;
    `);

    const sets = result.recordsets as Record<string, unknown>[][];
    const family = (sets[0] ?? []) as Record<string, unknown>[];
    const pillar = (sets[1] ?? []) as Record<string, unknown>[];
    const strategy = (sets[2] ?? []) as Record<string, unknown>[];

    return NextResponse.json({
      family: toOptions(family, ["FamilyID"], ["ProdFamilyName"]),
      pillar: toOptions(pillar, ["PillarID"], ["PillarName"]),
      strategy: toOptions(strategy, ["StrategyID"], ["StrategyName"])
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error loading project lookups.";
    return NextResponse.json({ error: message }, { status: 500 });
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
