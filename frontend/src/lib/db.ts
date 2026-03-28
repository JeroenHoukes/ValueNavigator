import sql from "mssql";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getConfig(): sql.config {
  const server = process.env.AZURE_SQL_SERVER;
  const database = process.env.AZURE_SQL_DATABASE;
  const user = process.env.AZURE_SQL_USER;
  const password = process.env.AZURE_SQL_PASSWORD;

  if (!server || !database || !user || !password) {
    throw new Error(
      "Missing Azure SQL environment variables. Please set AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, and AZURE_SQL_PASSWORD."
    );
  }

  return {
    server,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

export async function getDb(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = sql.connect(getConfig());
  }

  try {
    const pool = await poolPromise;
    return pool;
  } catch (err) {
    poolPromise = null;
    throw err;
  }
}

const server = process.env.AZURE_SQL_SERVER;
const database = process.env.AZURE_SQL_DATABASE;

/**
 * Connect to Azure SQL using the signed-in user's Entra ID access token.
 * The database will see the connection as that user (for RLS / per-user data).
 */
export async function getDbWithToken(accessToken: string): Promise<sql.ConnectionPool> {
  if (!server || !database) {
    throw new Error("Missing AZURE_SQL_SERVER or AZURE_SQL_DATABASE.");
  }
  const configWithToken = {
    server,
    database,
    authentication: {
      type: "azure-active-directory-access-token" as const,
      options: { token: accessToken }
    },
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    // max > 1 avoids "Connection is closed" when a handler runs multiple
    // sequential requests on the same token-scoped pool.
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
  };
  return sql.connect(configWithToken as sql.config);
}

