/**
 * Sembrado masivo controlado (Laboratorio 2 · Fase 1).
 *
 * Escribe millones de filas en data/big.csv respetando la contrapresión:
 * cuando write() devuelve false el buffer interno está lleno, así que se
 * deja de escribir y se espera el evento 'drain' para continuar.
 *
 *   node src/seed.ts            # 10 millones de filas
 *   node src/seed.ts 1000000    # 1 millón (más rápido para probar)
 */
import { createWriteStream, statSync } from 'node:fs';
import { BIG_CSV, fileSizeMb, heapMb } from './paths.ts';

const TOTAL = Number(process.argv[2] ?? 10_000_000);
const out = createWriteStream(BIG_CSV);
const BASE_DATE = Date.UTC(2026, 0, 1);

/** Una transacción ficticia de ~95 bytes, para que 10 M de filas ronden 1 GB. */
function buildRow(id: number): string {
  const client = `CLI-${String(id % 100_000).padStart(6, '0')}`;
  const amount = (Math.random() * 5000).toFixed(2);
  const date = new Date(BASE_DATE + id * 1000).toISOString();
  return `${id},${client},${amount},${date},GTQ,Compra en comercio afiliado,ACTIVO\n`;
}

let remaining = TOTAL;
let drains = 0;
const started = performance.now();

function writeBlock(): void {
  let ok = true;

  while (remaining > 0 && ok) {
    remaining--;
    const row = buildRow(remaining);

    if (remaining === 0) {
      out.end(row);
    } else {
      ok = out.write(row); // false = buffer lleno (backpressure)
    }
  }

  if (remaining > 0) {
    drains++;
    if (drains % 2000 === 0) {
      const done = (((TOTAL - remaining) / TOTAL) * 100).toFixed(0);
      console.log(`  ${done}% escrito · heap ${heapMb().toFixed(1)} MB · pausas por drain: ${drains}`);
    }
    out.once('drain', writeBlock); // reanudar cuando el disco vacíe el buffer
  }
}

out.on('finish', () => {
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`\nSembrado masivo completado: ${TOTAL.toLocaleString('es')} filas, ` +
    `${fileSizeMb(statSync(BIG_CSV).size)} en ${seconds} s (${drains} pausas por drain).`);
});

console.log(`Generando ${TOTAL.toLocaleString('es')} filas en data/big.csv...`);
writeBlock();
