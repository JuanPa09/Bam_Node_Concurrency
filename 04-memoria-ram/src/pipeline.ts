/**
 * Ensamblaje seguro de tuberías (Laboratorio 2 · Fase 3).
 *
 *   data/big.csv  ->  FormateadorCsv  ->  data/final.txt
 *
 * pipeline() conecta los streams, respeta la contrapresión de punta a punta
 * y, si cualquiera falla, destruye todos y libera sus recursos (con .pipe()
 * encadenado un error en medio deja streams abiertos).
 *
 * Mientras corre, un profiler imprime el heap cada 500 ms: debe mantenerse
 * estable (decenas de MB) aunque el archivo pese cientos de MB o GB.
 */
import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { FormateadorCsv } from './etl.ts';
import { BIG_CSV, fileSizeMb, FINAL_TXT, heapMb } from './paths.ts';

const input = createReadStream(BIG_CSV); // highWaterMark por defecto: 64 KB
const transformer = new FormateadorCsv();
const output = createWriteStream(FINAL_TXT);

let peak = 0;
const profiler = setInterval(() => {
  const mb = heapMb();
  peak = Math.max(peak, mb);
  console.log(`[+] Consumo RAM (heap): ${mb.toFixed(2)} MB`);
}, 500);

const started = performance.now();
console.log(`Procesando data/big.csv (${fileSizeMb(statSync(BIG_CSV).size)})...`);

try {
  await pipeline(input, transformer, output);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`\nProcesamiento completado sin crashear en ${seconds} s.`);
  console.log(`  Chunks procesados: ${transformer.chunks.toLocaleString('es')}`);
  console.log(`  Archivo final:     ${fileSizeMb(statSync(FINAL_TXT).size)}`);
  console.log(`  Pico de heap:      ${peak.toFixed(2)} MB`);
} catch (err) {
  console.error('Error de Stream:', err);
  process.exitCode = 1;
} finally {
  clearInterval(profiler);
}
