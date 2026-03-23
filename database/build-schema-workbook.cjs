/**
 * Builds database/ValueNavigator-schema.xlsx from documented schema in repo + known relationships.
 * Run from repo root: node database/build-schema-workbook.cjs
 * Requires: frontend/node_modules/xlsx (npm install in frontend first).
 */

const path = require("path");
const fs = require("fs");

const xlsxPath = path.join(__dirname, "..", "frontend", "node_modules", "xlsx");
let XLSX;
try {
  XLSX = require(xlsxPath);
} catch {
  console.error("Install xlsx in frontend: cd frontend && npm install");
  process.exit(1);
}

const generated = new Date().toISOString().slice(0, 19) + "Z";

const readmeRows = [
  ["Value Navigator – database schema workbook (generated)"],
  [""],
  ["Generated (UTC)", generated],
  ["Source", "Inferred from ValueNavigator repository (SQL scripts + Next.js API routes)."],
  [""],
  ["Disclaimer"],
  [
    "This workbook is NOT a live introspection of Azure SQL. Column lists for dynamic tables (table_ai, table_ai2, milestone) reflect how the app uses them; run the Queries sheet in SSMS/Azure Data Studio for authoritative INFORMATION_SCHEMA / sys.foreign_keys output."
  ],
  [""],
  ["Repo references"],
  ["database/01-schema-and-usp.sql", "dbo.Scenarios + dbo.usp_RunForecastScenario"],
  ["frontend/src/app/api/*.ts", "table_ai, table_ai2, lookup_ai, dbo.milestone"],
  ["frontend/src/lib/aiData2Excel.ts", "Expected Excel/import columns for table_ai2"],
  [""],
  ["How to refresh"],
  [
    "1. Open the Queries sheet, copy each T-SQL block into Azure Data Studio connected to ValueNavigator."
  ],
  ["2. Paste results into new sheets or replace Tables/Relationships manually."],
  [""]
];

const tablesRows = [
  [
    "Schema",
    "Table",
    "Column",
    "DataType",
    "Nullable",
    "Key",
    "Notes / source"
  ],
  [
    "dbo",
    "Scenarios",
    "Id",
    "NVARCHAR(50)",
    "NOT NULL",
    "PK",
    "database/01-schema-and-usp.sql"
  ],
  [
    "dbo",
    "Scenarios",
    "Name",
    "NVARCHAR(256)",
    "NOT NULL",
    "",
    "database/01-schema-and-usp.sql"
  ],
  [
    "dbo",
    "Scenarios",
    "Description",
    "NVARCHAR(MAX)",
    "NULL",
    "",
    "database/01-schema-and-usp.sql"
  ],
  [
    "dbo",
    "Scenarios",
    "HorizonYears",
    "INT",
    "NOT NULL",
    "",
    "database/01-schema-and-usp.sql"
  ],
  [
    "dbo",
    "Scenarios",
    "DiscountRate",
    "DECIMAL(10,4)",
    "NOT NULL",
    "",
    "database/01-schema-and-usp.sql"
  ],
  [
    "dbo",
    "Scenarios",
    "CreatedAt",
    "DATETIME2",
    "NOT NULL",
    "",
    "DEFAULT SYSUTCDATETIME()"
  ],
  [
    "dbo",
    "Scenarios",
    "UpdatedAt",
    "DATETIME2",
    "NOT NULL",
    "",
    "DEFAULT SYSUTCDATETIME()"
  ],
  ["dbo", "usp_RunForecastScenario", "(procedure)", "—", "—", "—", "Stored proc; see 01-schema-and-usp.sql"],
  ["", "", "", "", "", "", ""],
  [
    "dbo",
    "milestone",
    "(dynamic)",
    "—",
    "—",
    "PK inferred in app: id / MilestoneId / MilestoneID",
    "API: SELECT * FROM dbo.milestone; RLS may apply per Entra user"
  ],
  ["", "", "", "", "", "", ""],
  [
    "dbo",
    "InvRecurringCost",
    "MilestoneFromID",
    "(unknown)",
    "—",
    "FK",
    "Observed FK name FK_InvRecurringCost_MilestoneFrom → dbo.milestone (SQL error from app)"
  ],
  [
    "dbo",
    "InvRecurringCost",
    "(other columns)",
    "—",
    "—",
    "",
    "Not defined in repo; introspect live DB"
  ],
  ["", "", "", "", "", "", ""],
  ["dbo", "table_ai", "(dynamic)", "—", "—", "PK: first column or id", "API: SELECT * FROM table_ai"],
  ["", "", "", "", "", "", ""],
  [
    "dbo",
    "table_ai2",
    "id",
    "(unknown)",
    "—",
    "PK",
    "Used in bulk-delete / Excel import"
  ],
  ["dbo", "table_ai2", "Col1", "(unknown)", "NULL?", "", "aiData2Excel + grid"],
  ["dbo", "table_ai2", "Col2", "(unknown)", "NULL?", "", "aiData2Excel + grid"],
  ["dbo", "table_ai2", "TenantID", "(unknown)", "NULL?", "", "aiData2Excel + grid"],
  [
    "dbo",
    "table_ai2",
    "LookupId",
    "(unknown)",
    "NULL?",
    "FK?",
    "JOIN lookup_ai ON LookupId; casing variants LookupID / lookupID"
  ],
  [
    "dbo",
    "table_ai2",
    "LookupName",
    "(computed/join)",
    "—",
    "",
    "Not a physical column: from LEFT JOIN lookup_ai for display"
  ],
  [
    "dbo",
    "table_ai2",
    "LastUpdate",
    "(unknown)",
    "NULL?",
    "",
    "Hidden in grid; may exist in DB"
  ],
  ["", "", "", "", "", "", ""],
  ["dbo", "lookup_ai", "LookupId", "(unknown)", "NOT NULL?", "PK?", "lookup-ai API SELECT DISTINCT"],
  ["dbo", "lookup_ai", "LookupName", "(unknown)", "NOT NULL?", "", "lookup-ai API"],
  ["", "", "", "", "", "", ""],
  [
    "dbo",
    "Project",
    "(unknown)",
    "—",
    "—",
    "",
    "VN.session.sql only; not used by Next.js API in repo"
  ]
];

const relationshipsRows = [
  [
    "Relationship type",
    "Name / note",
    "From (schema.table.column)",
    "To (schema.table.column)",
    "Evidence"
  ],
  [
    "Foreign key (SQL Server)",
    "FK_InvRecurringCost_MilestoneFrom",
    "dbo.InvRecurringCost.MilestoneFromID",
    "dbo.milestone.(PK)",
    "DELETE conflict error surfaced by milestone API"
  ],
  [
    "Logical / app join",
    "(unnamed)",
    "table_ai2.LookupId (or LookupID / lookupID)",
    "lookup_ai.LookupId",
    "GET /api/ai-data2: LEFT JOIN lookup_ai l ON t.LookupId = l.LookupId"
  ],
  [
    "Procedure contract",
    "usp_RunForecastScenario @ScenarioId",
    "parameter @ScenarioId",
    "dbo.Scenarios.Id (intended)",
    "README / forecast API; optional link in proc script"
  ]
];

const queriesRows = [
  ["Run these against database ValueNavigator (Azure SQL) to export the real schema."],
  [""],
  ["Title", "T-SQL"],
  [
    "All tables (summary)",
    `SELECT s.name AS [schema], t.name AS [table]
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
ORDER BY s.name, t.name;`
  ],
  [
    "Columns",
    `SELECT
  c.TABLE_SCHEMA,
  c.TABLE_NAME,
  c.COLUMN_NAME,
  c.DATA_TYPE,
  c.CHARACTER_MAXIMUM_LENGTH,
  c.IS_NULLABLE,
  c.COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS c
ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION;`
  ],
  [
    "Foreign keys",
    `SELECT
  fk.name AS fk_name,
  OBJECT_SCHEMA_NAME(fk.parent_object_id) AS from_schema,
  OBJECT_NAME(fk.parent_object_id) AS from_table,
  cp.name AS from_column,
  OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS to_schema,
  OBJECT_NAME(fk.referenced_object_id) AS to_table,
  cr.name AS to_column,
  fk.delete_referential_action_desc,
  fk.update_referential_action_desc
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
ORDER BY from_schema, from_table, fk.name;`
  ],
  [
    "Primary keys",
    `SELECT
  tc.TABLE_SCHEMA,
  tc.TABLE_NAME,
  kcu.COLUMN_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.ORDINAL_POSITION;`
  ]
];

function sheetFromAoA(name, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = rows.reduce((max, row) => {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      max[i] = Math.min(80, Math.max(max[i] || 0, len));
    });
    return max;
  }, {});
  ws["!cols"] = Object.keys(colWidths).map((i) => ({
    wch: colWidths[i] + 2
  }));
  return { name, ws };
}

const wb = XLSX.utils.book_new();
[
  sheetFromAoA("Readme", readmeRows),
  sheetFromAoA("Tables", tablesRows),
  sheetFromAoA("Relationships", relationshipsRows),
  sheetFromAoA("Queries", queriesRows)
].forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)));

const outFile = path.join(__dirname, "ValueNavigator-schema.xlsx");
XLSX.writeFile(wb, outFile);
console.log("Wrote", outFile);
