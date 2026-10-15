import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { AppConfig } from './config.ts';

/**
 * Pool de conexiones hacia Supabase (Session pooler, puerto 5432).
 *
 * Supabase exige TLS. Si se configura DATABASE_CA_CERT (el certificado que se
 * descarga en Project Settings -> Database -> SSL), se verifica la cadena
 * completa. Sin él, la conexión sigue cifrada pero sin verificar el emisor.
 */
export function createPool(config: AppConfig): pg.Pool {
  const ssl = config.DATABASE_CA_CERT
    ? { ca: readFileSync(config.DATABASE_CA_CERT, 'utf8') }
    : { rejectUnauthorized: false };

  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    console.error('[db] Error en una conexión inactiva del pool:', err.message);
  });

  return pool;
}
