import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';
import * as dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: pg.Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    let connectionString = process.env.DATABASE_URL?.trim();

    if (!connectionString) {
      // Check fallback only if SQL_HOST is present and not invalid
      const sqlHost = process.env.SQL_HOST;
      if (!sqlHost || sqlHost === 'base' || sqlHost === 'localhost' || sqlHost === '127.0.0.1') {
        throw new Error('DATABASE_URL is not configured');
      }
    }

    if (connectionString) {
      // Remove any wrapping quotes that may have been added in environment settings
      if (
        (connectionString.startsWith('"') && connectionString.endsWith('"')) ||
        (connectionString.startsWith("'") && connectionString.endsWith("'"))
      ) {
        connectionString = connectionString.slice(1, -1).trim();
      }
    }

    let poolConfig: pg.PoolConfig;

    if (connectionString) {
      let url: URL;
      try {
        url = new URL(connectionString);
      } catch (err: any) {
        throw new Error(`Invalid DATABASE_URL format: ${err.message}`);
      }

      const hostname = url.hostname.trim();

      // Guard against invalid hostnames
      if (!hostname || hostname === 'base' || (hostname.includes('base') && !hostname.includes('.')) || hostname === 'undefined') {
        throw new Error('Invalid database hostname configuration: hostname cannot be "base" or "undefined"');
      }

      if (process.env.NODE_ENV === 'production' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        throw new Error('Invalid database hostname configuration: localhost is not allowed in production');
      }

      if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
        throw new Error('Invalid database hostname configuration: host must be a database host, not an HTTP URL');
      }

      // Safe startup diagnostics (never logging password or full connection string)
      console.log('[DATABASE]', {
        hostname: url.hostname,
        port: url.port || '5432',
        database: url.pathname.replace(/^\//, ''),
      });

      let password = decodeURIComponent(url.password);
      // Clean accidental placeholder brackets if user pasted [PASSWORD]
      if (password.startsWith('[') && password.endsWith(']')) {
        password = password.slice(1, -1);
      } else if (password.endsWith(']')) {
        password = password.slice(0, -1);
      } else if (password.startsWith('[')) {
        password = password.slice(1);
      }

      poolConfig = {
        user: decodeURIComponent(url.username),
        password: password,
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 5432,
        database: url.pathname.replace(/^\//, '') || 'postgres',
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    } else {
      const sqlHost = process.env.SQL_HOST!;
      console.log('[DATABASE CONFIG]', {
        host: sqlHost,
        port: '5432',
        database: process.env.SQL_DB_NAME || 'postgres',
      });

      poolConfig = {
        host: sqlHost,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    }

    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
