/**
 * Carga CPU-bound real: cuenta los números primos menores o iguales a `limit`
 * por división de prueba. Es deliberadamente ingenua (sin criba) para que
 * consuma CPU de forma sostenida y el bloqueo del Event Loop sea visible.
 */
export function countPrimes(limit: number): number {
  let count = 0;
  for (let n = 2; n <= limit; n++) {
    if (isPrime(n)) count++;
  }
  return count;
}

function isPrime(n: number): boolean {
  if (n < 4) return n > 1;
  if (n % 2 === 0) return false;
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false;
  }
  return true;
}

/** Límite por defecto: tarda unos segundos en una laptop moderna. */
export const DEFAULT_LIMIT = 30_000_000;
