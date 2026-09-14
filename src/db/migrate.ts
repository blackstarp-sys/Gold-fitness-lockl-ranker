import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

dotenv.config({ override: true });

if (fs.existsSync('.env')) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
      if (envConfig[k]) {
        process.env[k] = envConfig[k];
      }
    }
  } catch (e) {}
}

const { Pool } = pg;

function getMigrationConnectionString(): string {
  let dbUrl = process.env.DATABASE_URL || '';
  dbUrl = dbUrl.trim();
  while (
    (dbUrl.startsWith('"') && dbUrl.endsWith('"')) ||
    (dbUrl.startsWith("'") && dbUrl.endsWith("'"))
  ) {
    dbUrl = dbUrl.slice(1, -1).trim();
  }

  // If pointing to Supabase pooler on port 6543 (transaction pooler),
  // switch to port 5432 (session pooler) for DDL / migrations
  if (dbUrl.includes('.pooler.supabase.com:6543')) {
    console.log('[MIGRATION] Switching from transaction pooler (6543) to session pooler (5432) for DDL operations...');
    dbUrl = dbUrl.replace(':6543', ':5432').replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
  }

  return dbUrl;
}

async function main() {
  const connectionString = getMigrationConnectionString();
  if (!connectionString) {
    console.error('[MIGRATION] DATABASE_URL is required for database migrations.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  const client = await pool.connect();

  try {
    console.log('[MIGRATION] Connected to PostgreSQL. Running safe-to-rerun migrations...');

    // 1. Run baseline schema statements if any tables are missing
    const baselinePath = path.resolve('database/baseline/0000_silly_the_fury.sql');
    if (fs.existsSync(baselinePath)) {
      const sqlContent = fs.readFileSync(baselinePath, 'utf8');
      const statements = sqlContent
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (stmtErr: any) {
          // Ignore if already exists
        }
      }
    }

    // 2. Apply column migrations safely (IF NOT EXISTS)
    const ddlStatements = [
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT \'user\';',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "selected_google_account_id" text;',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "selected_google_location_id" text;',
      'ALTER TABLE "business_locations" ADD COLUMN IF NOT EXISTS "place_id" text;',
      'ALTER TABLE "business_locations" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false;',
      'ALTER TABLE "google_business_accounts" ADD COLUMN IF NOT EXISTS "role" text;',
    ];

    for (const ddl of ddlStatements) {
      try {
        await client.query(ddl);
      } catch (err: any) {
        console.warn(`[MIGRATION DDL NOTICE] ${err.message}`);
      }
    }

    // 3. Verify the 5 required tables and their records
    const requiredTables = [
      'users',
      'business_locations',
      'reviews',
      'scheduled_posts',
      'google_business_accounts'
    ];

    console.log('\n--- Verifying Required Schema Tables ---');
    for (const tableName of requiredTables) {
      const tableCheck = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists;`,
        [tableName]
      );

      if (!tableCheck.rows[0]?.exists) {
        throw new Error(`Migration verification failed: Table "${tableName}" does not exist.`);
      }

      const countRes = await client.query(`SELECT count(*)::int as cnt FROM "${tableName}";`);
      const rowCount = countRes.rows[0]?.cnt ?? 0;
      console.log(`✓ Table "${tableName}" verified (total rows: ${rowCount})`);
    }

    // Verify key columns on users
    const userColumns = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users';`
    );
    const userColNames = new Set(userColumns.rows.map((r: any) => r.column_name));
    for (const col of ['role', 'selected_google_account_id', 'selected_google_location_id']) {
      if (!userColNames.has(col)) {
        throw new Error(`Missing expected column "${col}" on table "users"`);
      }
    }
    console.log('✓ Verified column extensions on "users" (role, selected_google_account_id, selected_google_location_id)');

    // Verify key columns on business_locations
    const locColumns = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'business_locations';`
    );
    const locColNames = new Set(locColumns.rows.map((r: any) => r.column_name));
    for (const col of ['place_id', 'is_primary', 'google_account_id']) {
      if (!locColNames.has(col)) {
        throw new Error(`Missing expected column "${col}" on table "business_locations"`);
      }
    }
    console.log('✓ Verified column extensions on "business_locations" (place_id, is_primary, google_account_id)');

    console.log('\nAll migrations and schema verifications completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[MIGRATION FAILED]', err.message);
  process.exit(1);
});
