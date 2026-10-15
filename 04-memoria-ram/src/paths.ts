/** Archivos generados (ignorados por git). */
export const BIG_CSV = new URL('../data/big.csv', import.meta.url);
export const FINAL_TXT = new URL('../data/final.txt', import.meta.url);

export function heapMb(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

export function fileSizeMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
