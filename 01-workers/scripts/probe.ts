/**
 * Termómetro del Event Loop.
 *
 * Dispara una petición pesada (/heavy-cpu-block o /heavy-cpu-worker) y,
 * mientras se resuelve, consulta /fast cada 250 ms midiendo su latencia.
 *
 *   npm run probe -- block    -> /fast se congela hasta que termina el cálculo
 *   npm run probe -- worker   -> /fast sigue respondiendo en pocos ms
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const mode = process.argv[2] === 'block' ? 'block' : 'worker';

async function timed(path: string): Promise<number> {
  const started = performance.now();
  const res = await fetch(`${BASE_URL}${path}`);
  await res.json();
  return Math.round(performance.now() - started);
}

console.log(`Disparando /heavy-cpu-${mode} y midiendo /fast cada 250 ms...\n`);

let heavyDone = false;
const heavy = timed(`/heavy-cpu-${mode}`).then((ms) => {
  heavyDone = true;
  console.log(`\n/heavy-cpu-${mode} terminó en ${ms} ms`);
});

const latencies: number[] = [];
while (!heavyDone) {
  const ms = await timed('/fast');
  latencies.push(ms);
  console.log(`  /fast respondió en ${String(ms).padStart(5)} ms`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await heavy;

const worst = Math.max(...latencies);
console.log(`Peor latencia de /fast: ${worst} ms -> ${worst > 1000 ? 'Event Loop BLOQUEADO' : 'Event Loop libre'}`);
