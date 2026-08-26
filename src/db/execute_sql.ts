import fs from 'fs';
import { db } from './index.ts';
import { sql } from 'drizzle-orm';

async function main() {
  const sqlString = fs.readFileSync('drizzle/0002_bumpy_rockslide.sql', 'utf-8');
  console.log('Running SQL...');
  await db.execute(sql.raw(sqlString));
  console.log('SQL complete!');
  process.exit(0);
}
main().catch(console.error);
