/**
 * Aplica los scripts de db/ en orden (001_, 002_, ...) contra DATABASE_URL.
 * Los scripts son idempotentes, así que se puede correr cuantas veces se quiera.
 *
 *   npm run db:migrate
 *
 * Alternativa manual: pegar cada archivo en el SQL Editor de Supabase.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.ts';
import { createPool } from '../src/db.ts';

const DB_DIR = new URL('../db/', import.meta.url);

const pool = createPool(loadConfig());
const files = readdirSync(DB_DIR).filter((f) => f.endsWith('.sql')).sort();

try {
  for (const file of files) {
    const sql = readFileSync(new URL(file, DB_DIR), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`  ✔ ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  const { rows } = await pool.query<{ users: string; cards: string }>(
    `SELECT (SELECT count(*) FROM users) AS users,
            (SELECT count(*) FROM credit_cards WHERE deleted_at IS NULL) AS cards`,
  );
  console.log(`\nListo. users: ${rows[0]?.users}, tarjetas vigentes: ${rows[0]?.cards}`);
} catch (error) {
  console.error('✖ Error al aplicar scripts:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
