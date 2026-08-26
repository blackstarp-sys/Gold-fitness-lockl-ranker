import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

let rawUrl = process.env.DATABASE_URL?.trim();
if (rawUrl) {
  if ((rawUrl.startsWith('"') && rawUrl.endsWith('"')) || (rawUrl.startsWith("'") && rawUrl.endsWith("'"))) {
    rawUrl = rawUrl.slice(1, -1).trim();
  }
}

function getDbCredentials() {
  if (rawUrl) {
    const urlObj = new URL(rawUrl);
    let password = decodeURIComponent(urlObj.password);
    if (password.startsWith('[') && password.endsWith(']')) {
      password = password.slice(1, -1);
    } else if (password.endsWith(']')) {
      password = password.slice(0, -1);
    } else if (password.startsWith('[')) {
      password = password.slice(1);
    }

    return {
      host: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port, 10) : 5432,
      user: decodeURIComponent(urlObj.username),
      password: password,
      database: urlObj.pathname.replace(/^\//, '') || 'postgres',
      ssl: { rejectUnauthorized: false },
    };
  }

  const sqlHost = process.env.SQL_HOST;
  const sqlDbName = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

  if (!sqlHost || !sqlDbName || !user || !password) {
    throw new Error("DATABASE_URL or SQL_* environment variables must be configured.");
  }

  return {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false,
  };
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: getDbCredentials(),
  verbose: true,
});
