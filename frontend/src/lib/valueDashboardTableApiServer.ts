import { NextResponse } from "next/server";
import {
  getValueDashboardSourceConfig,
  isValueDashboardSourceId,
  type ValueDashboardSourceConfig
} from "@/lib/valueDashboardSources";

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export function isSafeSqlIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/** Resolve writable table from `?source=` (CRUD route). */
export function getWritableTableFromQuery(request: Request):
  | { token: string; config: ValueDashboardSourceConfig }
  | { error: NextResponse } {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing or invalid Authorization token." },
        { status: 401 }
      )
    };
  }
  const url = new URL(request.url);
  const raw = url.searchParams.get("source");
  if (!raw || !isValueDashboardSourceId(raw)) {
    return {
      error: NextResponse.json(
        { error: "Invalid or missing source query parameter." },
        { status: 400 }
      )
    };
  }
  const config = getValueDashboardSourceConfig(raw);
  if (!config || config.kind !== "table") {
    return {
      error: NextResponse.json(
        {
          error:
            "This source is not a writable table (function results are read-only)."
        },
        { status: 400 }
      )
    };
  }
  return { token, config };
}

export function requireTokenAndBodySource(
  token: string | null,
  sourceRaw: unknown
):
  | { config: ValueDashboardSourceConfig }
  | { error: NextResponse } {
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Missing or invalid Authorization token." },
        { status: 401 }
      )
    };
  }
  const raw =
    typeof sourceRaw === "string" ? sourceRaw.trim() : "";
  if (!raw || !isValueDashboardSourceId(raw)) {
    return {
      error: NextResponse.json({ error: "Invalid source." }, { status: 400 })
    };
  }
  const config = getValueDashboardSourceConfig(raw);
  if (!config || config.kind !== "table") {
    return {
      error: NextResponse.json(
        { error: "Source is not a writable table." },
        { status: 400 }
      )
    };
  }
  return { config };
}
