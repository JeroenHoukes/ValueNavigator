/**
 * Connects to Azure SQL (ValueNavigator) with SQL authentication and writes
 * database/ValueNavigator-schema-Azure.xlsx from live INFORMATION_SCHEMA / catalog views.
 *
 * Prerequisites:
 *   - npm install in frontend (provides mssql + xlsx)
 *   - AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD
 *     set in the environment OR in frontend/.env.local (loaded automatically)
 *   - Your client IP allowed on the Azure SQL firewall (or run from an allowed network)
 *
 * Usage (repo root):
 *   node database/introspect-azure-schema.cjs
 *
 * Or from frontend (after npm install):
 *   npm run schema:azure
 */

const path = require("path");
const fs = require("fs");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", "frontend", ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const sql = require(path.join(__dirname, "..", "frontend", "node_modules", "mssql"));
const XLSX = require(path.join(__dirname, "..", "frontend", "node_modules", "xlsx"));

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Missing environment variable: ${name}`);
    console.error(
      "Set it in frontend/.env.local or export it before running this script."
    );
    process.exit(1);
  }
  return String(v).trim();
}

function autosizeSheet(ws) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const widths = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      const len = cell?.v != null ? String(cell.v).length : 0;
      widths[C] = Math.min(90, Math.max(widths[C] || 0, len));
    }
  }
  ws["!cols"] = widths.map((w) => ({ wch: (w || 8) + 2 }));
}

function jsonToSheet(name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  autosizeSheet(ws);
  return { name: name.slice(0, 31), ws };
}

async function main() {
  const server = requireEnv("AZURE_SQL_SERVER");
  const database = requireEnv("AZURE_SQL_DATABASE");
  const user = requireEnv("AZURE_SQL_USER");
  const password = requireEnv("AZURE_SQL_PASSWORD");

  const config = {
    server,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    connectionTimeout: 30000,
    requestTimeout: 120000
  };

  console.log(`Connecting to ${server} / ${database} …`);

  let pool;
  try {
    pool = await sql.connect(config);
  } catch (err) {
    console.error("Connection failed:", err.message || err);
    console.error(
      "Check credentials, firewall rules, and that the server name includes .database.windows.net if applicable."
    );
    process.exit(1);
  }

  const generated = new Date().toISOString();

  const queries = [
    {
      name: "Tables",
      sql: `
SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY TABLE_SCHEMA, TABLE_NAME;`
    },
    {
      name: "Columns",
      sql: `
SELECT
  TABLE_SCHEMA,
  TABLE_NAME,
  COLUMN_NAME,
  ORDINAL_POSITION,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  NUMERIC_PRECISION,
  NUMERIC_SCALE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;`
    },
    {
      name: "PrimaryKeys",
      sql: `
SELECT
  tc.TABLE_SCHEMA,
  tc.TABLE_NAME,
  kcu.COLUMN_NAME,
  tc.CONSTRAINT_NAME,
  kcu.ORDINAL_POSITION
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
  AND tc.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.ORDINAL_POSITION;`
    },
    {
      name: "ForeignKeys",
      sql: `
SELECT
  fk.name AS fk_name,
  OBJECT_SCHEMA_NAME(fk.parent_object_id) AS from_schema,
  OBJECT_NAME(fk.parent_object_id) AS from_table,
  cp.name AS from_column,
  OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS to_schema,
  OBJECT_NAME(fk.referenced_object_id) AS to_table,
  cr.name AS to_column,
  fk.delete_referential_action_desc AS on_delete,
  fk.update_referential_action_desc AS on_update
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns cp
  ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.columns cr
  ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
ORDER BY from_schema, from_table, fk.name, fkc.constraint_column_id;`
    }
  ];

  const wb = XLSX.utils.book_new();

  const readme = [
    ["Value Navigator – Azure SQL schema (live introspection)"],
    [""],
    ["Generated (UTC)", generated],
    ["Server", server],
    ["Database", database],
    [""],
    ["Sheets"],
    ["Tables", "All user-visible tables and views (INFORMATION_SCHEMA.TABLES)"],
    ["Columns", "All columns"],
    ["PrimaryKeys", "Primary key columns"],
    ["ForeignKeys", "Foreign key relationships (sys.foreign_keys)"],
    [""],
    ["Regenerate"],
    ["From repo root: node database/introspect-azure-schema.cjs"],
    ["Or: cd frontend && npm run schema:azure"]
  ];
  const readmeWs = XLSX.utils.aoa_to_sheet(readme);
  autosizeSheet(readmeWs);
  XLSX.utils.book_append_sheet(wb, readmeWs, "Readme");

  try {
    for (const { name, sql: q } of queries) {
      console.log(`Querying ${name}…`);
      const result = await pool.request().query(q);
      const rows = result.recordset || [];
      console.log(`  → ${rows.length} row(s)`);
      const { name: sheetName, ws } = jsonToSheet(name, rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  } finally {
    await pool.close();
  }

  const outFile = path.join(__dirname, "ValueNavigator-schema-Azure.xlsx");
  XLSX.writeFile(wb, outFile);
  console.log("Wrote", outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
