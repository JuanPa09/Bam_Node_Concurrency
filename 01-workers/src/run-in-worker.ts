import { Worker } from 'node:worker_threads';

export interface PrimeResult {
  primes: number;
  elapsedMs: number;
}

const WORKER_FILE = new URL('./prime-worker.ts', import.meta.url);

/**
 * Lanza un worker thread para contar primos y resuelve con su resultado.
 * Node 24 ejecuta el .ts del worker directamente (type stripping nativo).
 */
export function countPrimesInWorker(limit: number): Promise<PrimeResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_FILE, { workerData: { limit } });
    worker.once('message', (result: PrimeResult) => resolve(result));
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`El worker terminó con código ${code}`));
    });
  });
}
