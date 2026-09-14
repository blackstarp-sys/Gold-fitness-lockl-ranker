import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import * as schema from './schema.ts';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

dotenv.config({ override: true });

// Load .env with priority
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

if (!process.env.DATABASE_URL && fs.existsSync('.env.example')) {
  try {
    const exampleConfig = dotenv.parse(fs.readFileSync('.env.example'));
    if (exampleConfig.DATABASE_URL) {
      process.env.DATABASE_URL = exampleConfig.DATABASE_URL;
    }
  } catch (e) {}
}

const { Pool } = pg;

declare global {
  var _pgliteInstance: PGlite | undefined;
  var _pgliteDb: any | undefined;
  var _postgresPool: pg.Pool | undefined;
  var _remoteDb: any | undefined;
  var _activeDb: any | undefined;
  var _dbStorageMode: 'remote' | 'local_embedded' | undefined;
}

/**
 * Ensures baseline schema statements are executed on a query executor.
 */
async function executeBaselineSchema(executor: (sqlText: string) => Promise<any>): Promise<void> {
  const baselinePath = path.resolve('database/baseline/0000_silly_the_fury.sql');
  if (!fs.existsSync(baselinePath)) {
    return;
  }
  const sqlContent = fs.readFileSync(baselinePath, 'utf8');
  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await executor(stmt);
    } catch (stmtErr: any) {
      // Ignore if table/type/constraint already exists
    }
  }
}

/**
 * Ensures the in-memory PGlite database is initialized and has all tables.
 */
export const initLocalPglite = async (): Promise<{ pglite: PGlite | null; db: any }> => {
  let pglite = global._pgliteInstance;
  if (!pglite) {
    try {
      pglite = new PGlite();
      global._pgliteInstance = pglite;
      global._pgliteDb = drizzlePglite(pglite, { schema });
    } catch (err) {
      console.warn('[DATABASE] Fallback PGlite error:', err);
      return { pglite: null, db: global._remoteDb || global._activeDb };
    }
  }

  try {
    const check = await pglite.query<{ cnt: number }>(
      "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableCount = check.rows[0]?.cnt || 0;

    if (tableCount < 20) {
      console.log('[DATABASE] Initializing schema in local database...');
      await executeBaselineSchema((sql) => pglite!.exec(sql));
      console.log('[DATABASE] Local database schema initialized successfully.');
    }
  } catch (initErr: any) {
    console.warn('[DATABASE] Warning during local PGlite table verification:', initErr?.message);
  }

  return { pglite: global._pgliteInstance || null, db: global._pgliteDb };
};

/**
 * Ensures remote database schema exists
 */
async function ensureRemoteSchema(pool: pg.Pool): Promise<void> {
  try {
    const check = await pool.query<{ cnt: string | number }>(
      "SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableCount = Number(check.rows[0]?.cnt || 0);
    if (tableCount < 20) {
      console.log('[DATABASE] Initializing schema in remote PostgreSQL database...');
      await executeBaselineSchema((sql) => pool.query(sql));
      console.log('[DATABASE] Remote PostgreSQL database schema initialized successfully.');
    }
  } catch (err: any) {
    console.warn('[DATABASE] Remote schema verification notice:', err?.message);
  }
}

/**
 * Cleans and normalizes connection strings
 */
function cleanConnectionString(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let str = raw.trim();

  while (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }

  while (str.startsWith('DATABASE_URL=')) {
    str = str.slice('DATABASE_URL='.length).trim();
    while (
      (str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))
    ) {
      str = str.slice(1, -1).trim();
    }
  }

  return str;
}

export const createPool = (): pg.Pool | null => {
  if (global._postgresPool) {
    return global._postgresPool;
  }

  let connectionString = cleanConnectionString(process.env.DATABASE_URL);

  if (!connectionString) {
    const sqlHost = process.env.SQL_HOST;
    if (!sqlHost || sqlHost === 'base' || sqlHost === 'localhost' || sqlHost === '127.0.0.1') {
      return null;
    }
  }

  let poolConfig: pg.PoolConfig;

  if (connectionString) {
    let url: URL;
    try {
      url = new URL(connectionString);
    } catch (err: any) {
      console.warn(`[DATABASE] Invalid DATABASE_URL format: ${err.message}`);
      return null;
    }

    let targetHost = url.hostname.trim();
    let targetPort = url.port ? parseInt(url.port, 10) : 5432;
    let targetUser = decodeURIComponent(url.username);

    // Direct Supabase hostname mapping to IPv4 pooler
    const supabaseDirectMatch = targetHost.match(/^db\.([a-z0-9_-]+)\.supabase\.co$/i);
    if (supabaseDirectMatch) {
      const projectRef = supabaseDirectMatch[1];
      const poolerHost = process.env.SUPABASE_POOLER_HOST || 'aws-0-ap-south-1.pooler.supabase.com';
      targetHost = poolerHost;
      targetPort = 6543;
      if (!targetUser.includes('.')) {
        targetUser = `${targetUser}.${projectRef}`;
      }
      console.log(`[DATABASE] Routing Supabase direct connection through IPv4 pooler: ${targetHost}:${targetPort} (user: ${targetUser})`);
    }

    let password = decodeURIComponent(url.password);
    // Remove accidental placeholder brackets [PASSWORD]
    if (password.startsWith('[') && password.endsWith(']')) {
      password = password.slice(1, -1);
    } else if (password.endsWith(']')) {
      password = password.slice(0, -1);
    } else if (password.startsWith('[')) {
      password = password.slice(1);
    }

    poolConfig = {
      user: targetUser,
      password: password,
      host: targetHost,
      port: targetPort,
      database: url.pathname.replace(/^\//, '') || 'postgres',
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    };
  } else {
    const sqlHost = process.env.SQL_HOST!;
    poolConfig = {
      host: sqlHost,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME || 'postgres',
      max: 10,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    };
  }

  try {
    global._postgresPool = new Pool(poolConfig);
    global._postgresPool.on('error', (err) => {
      console.warn('[DATABASE] Idle SQL client notice:', err?.message || err);
    });
    return global._postgresPool;
  } catch (poolErr: any) {
    console.warn('[DATABASE] Could not initialize remote connection pool:', poolErr?.message);
    return null;
  }
};

// Initialize local in-memory PGlite fallback safely
try {
  const localInstance = new PGlite();
  global._pgliteInstance = localInstance;
  global._pgliteDb = drizzlePglite(localInstance, { schema });
  global._activeDb = global._pgliteDb;
  global._dbStorageMode = 'local_embedded';
} catch (err) {
  console.warn('[DATABASE] Local in-memory DB fallback unavailable:', err);
}

// Background check & baseline schema ensure for local fallback
if (global._pgliteInstance) {
  initLocalPglite().catch((err) => {
    console.warn('[DATABASE] PGlite initialization error:', err);
  });
}

// Try remote pool connection
const remotePool = createPool();
if (remotePool) {
  global._remoteDb = drizzleNodePg(remotePool, { schema });
  global._activeDb = global._remoteDb;
  global._dbStorageMode = 'remote';

  // Probe remote pool with short timeout
  remotePool
    .query('SELECT 1 as ping')
    .then(async () => {
      console.log('[DATABASE] Successfully connected to remote PostgreSQL database.');
      await ensureRemoteSchema(remotePool);
      global._activeDb = global._remoteDb;
      global._dbStorageMode = 'remote';
    })
    .catch((err) => {
      console.error(`[DATABASE] Remote database probe failed (${err.message}).`);
      // If DATABASE_URL is explicitly configured, never silently fall back to an empty local database
      if (!process.env.DATABASE_URL && global._pgliteDb) {
        console.log('[DATABASE] Falling back to local storage (no explicit DATABASE_URL).');
        global._activeDb = global._pgliteDb;
        global._dbStorageMode = 'local_embedded';
      }
    });
} else {
  console.log('[DATABASE] No remote DATABASE_URL configured. Using local storage.');
}

// Periodic background probe to reconnect if credentials or pooler become available
setInterval(async () => {
  if (global._remoteDb && global._postgresPool && global._dbStorageMode !== 'remote') {
    try {
      await global._postgresPool.query('SELECT 1 as ping');
      console.log('[DATABASE] Remote PostgreSQL database has become available! Switching to remote.');
      await ensureRemoteSchema(global._postgresPool);
      global._activeDb = global._remoteDb;
      global._dbStorageMode = 'remote';
    } catch (e) {
      // still offline, remain on current mode
    }
  }
}, 30000);

/**
 * Returns current storage mode ('remote' | 'local_embedded')
 */
export function getDbStorageMode(): 'remote' | 'local_embedded' {
  if (process.env.DATABASE_URL || process.env.NODE_ENV === 'production') {
    return 'remote';
  }
  return global._dbStorageMode || 'local_embedded';
}

/**
 * Exported `db` proxy:
 * Dynamically delegates to the active database (remote PostgreSQL or local persistent PGlite).
 * Production requests with DATABASE_URL must not silently fall back to an empty local database.
 */
export const db: any = new Proxy(
  {},
  {
    get(target, prop) {
      const active = global._activeDb || global._remoteDb || global._pgliteDb;
      if (!active) {
        throw new Error('Database is not initialized yet.');
      }
      const val = active[prop];
      if (typeof val === 'function') {
        return val.bind(active);
      }
      return val;
    },
  }
);
