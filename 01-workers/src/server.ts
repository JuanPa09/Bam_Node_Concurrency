/**
 * Entregable 1: Event Loop vs worker_threads.
 *
 * - /fast             responde al instante: es el "termómetro" del Event Loop.
 * - /slow-io          espera 4 s con un timer (I/O): el Event Loop sigue libre.
 * - /heavy-cpu-block  cuenta primos en el hilo principal: congela el servidor.
 * - /heavy-cpu-worker la misma cuenta en un worker thread: el servidor sigue vivo.
 */
import express, { type Request } from 'express';
import { countPrimes, DEFAULT_LIMIT } from './primes.ts';
import { countPrimesInWorker } from './run-in-worker.ts';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_LIMIT = 100_000_000;

const app = express();

/** Lee ?limit= de la query, acotado para no colgar la máquina. */
function readLimit(req: Request): number {
  const raw = Number(req.query.limit);
  if (!Number.isInteger(raw) || raw < 2) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

app.get('/', (_req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});

app.get('/fast', (_req, res) => {
  res.json({ message: 'Respuesta inmediata: el Event Loop está libre' });
});

app.get('/slow-io', async (_req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 4000));
  res.json({ message: 'I/O simulado resuelto después de 4 s (sin bloquear)' });
});

app.get('/heavy-cpu-block', (req, res) => {
  const limit = readLimit(req);
  const started = performance.now();
  const primes = countPrimes(limit);
  const elapsedMs = Math.round(performance.now() - started);
  console.log(`[block]  ${primes} primos <= ${limit} en ${elapsedMs} ms (Event Loop BLOQUEADO)`);
  res.json({ mode: 'main-thread', limit, primes, elapsedMs });
});

app.get('/heavy-cpu-worker', async (req, res) => {
  const limit = readLimit(req);
  const result = await countPrimesInWorker(limit);
  console.log(`[worker] ${result.primes} primos <= ${limit} en ${result.elapsedMs} ms (Event Loop libre)`);
  res.json({ mode: 'worker-thread', limit, ...result });
});

app.listen(PORT, () => {
  console.log(`Workers demo en http://localhost:${PORT}`);
});
