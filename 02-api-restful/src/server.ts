import { buildApp } from './app.ts';
import { PgCardRepository } from './cards/card.repository.ts';
import { CardService } from './cards/card.service.ts';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';

const config = loadConfig();
const pool = createPool(config);

const app = buildApp({
  cardService: new CardService(new PgCardRepository(pool), config.CARD_FINGERPRINT_SECRET),
  pingDatabase: async () => {
    await pool.query('SELECT 1');
  },
});

const server = app.listen(config.PORT, () => {
  console.log(`API de tarjetas en http://localhost:${config.PORT}/api/v1/credit-cards`);
});

/** Apagado ordenado: deja de aceptar conexiones y cierra el pool. */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recibido, cerrando...`);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
