/**
 * Archivo que corre DENTRO de un worker thread. Tiene su propio Event Loop y
 * su propio heap de V8, así que el cálculo no bloquea al hilo principal.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { countPrimes } from './primes.ts';

const { limit } = workerData as { limit: number };

const started = performance.now();
const primes = countPrimes(limit);

parentPort?.postMessage({ primes, elapsedMs: Math.round(performance.now() - started) });
