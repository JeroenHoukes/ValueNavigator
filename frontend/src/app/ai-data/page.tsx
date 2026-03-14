import { getDb } from "@/lib/db";
import { EditableAiGrid } from "@/components/EditableAiGrid";

export const dynamic = "force-dynamic";

type TableAiRow = {
  [key: string]: unknown;
};

async function fetchTableAi(): Promise<TableAiRow[]> {
  const pool = await getDb();
  const result = await pool.request().query("SELECT * FROM table_ai");
  return result.recordset as TableAiRow[];
}

export default async function AIDataPage() {
  let rows: TableAiRow[] = [];
  let error: string | null = null;

  try {
    rows = await fetchTableAi();
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Unknown error while loading table_ai.";
  }

  const columns =
    rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">AI Data (table_ai)</h2>
          <p className="text-slate-300 max-w-2xl">
            Live data from the <span className="font-mono">table_ai</span>{" "}
            table in the ValueNavigator database on Azure SQL (
            <span className="font-mono">leefserver.database.windows.net</span>
            ).
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-100">
          <p className="font-semibold mb-1">Error loading data</p>
          <p className="font-mono break-all text-xs">{error}</p>
        </div>
      ) : (
        <EditableAiGrid columns={columns} rows={rows} />
      )}
    </div>
  );
}

