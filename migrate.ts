import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './src/db/index.ts';
import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function runMigrate() {
  console.log('Running migrations...');
  const pool = new pg.Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_ADMIN_USER,
      password: process.env.SQL_ADMIN_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 1,
  });
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const migrationDb = drizzle(pool);
  
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  console.log('Migrations complete!');
  process.exit(0);
}

runMigrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
