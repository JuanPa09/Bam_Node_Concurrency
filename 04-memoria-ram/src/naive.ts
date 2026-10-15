/**
 * El PROBLEMA (para comparar con pipeline.ts): cargar el archivo completo.
 *
 * fs.readFile trae todo el archivo a memoria, toString() lo copia al heap de
 * V8 y replace() crea otra copia del mismo tamaño. Según el tamaño del
 * archivo, el proceso muere de una de dos formas:
 *
 *   - ERR_STRING_TOO_LONG: V8 no admite strings de más de ~512 MB.
 *   - "JavaScript heap out of memory": el heap (limitado aquí a 256 MB con
 *     --max-old-space-size) no alcanza para las copias.
 *
 * pipeline.ts procesa el MISMO archivo con ~30 MB de heap.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { BIG_CSV, FINAL_TXT, heapMb } from './paths.ts';

const log = (step: string) =>
  console.log(
    `${step.padEnd(26)} heap ${heapMb().toFixed(1).padStart(7)} MB · ` +
      `rss ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1).padStart(7)} MB`,
  );

try {
  log('Inicio');
  const buffer = await readFile(BIG_CSV);
  log('Archivo leído completo');
  const text = buffer.toString('utf8');
  log('Convertido a string');
  const mutated = text.replace(/,/g, ' | ');
  log('Reemplazo aplicado');
  await writeFile(FINAL_TXT, mutated);
  log('Escrito (el archivo era pequeño)');
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  console.error(`\n✖ Crash al cargar todo en memoria: ${code ?? ''} ${(err as Error).message}`);
  console.error('  Por eso se procesa por streams: npm run pipeline');
  process.exitCode = 1;
}
