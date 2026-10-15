/**
 * Interrupción de pila dinámica (Laboratorio 3 · Fase 3).
 *
 * 1. Se cargan 5000 reportes lentos con prioridad 1.
 * 2. start() los despacha sin bloquear (un reporte por vuelta del Event Loop).
 * 3. A los 2 s llegan 3 transferencias VIP con prioridad 10 vía setTimeout.
 *    Que el timer se dispare a tiempo prueba que el Event Loop NO está
 *    colapsado; y las VIP se procesan antes que los reportes pendientes.
 *
 *   node src/app.ts
 */
import { PriorityQueue } from './priority-queue.ts';
import { simulateWork } from './workload.ts';

const started = performance.now();
const elapsed = () => `${((performance.now() - started) / 1000).toFixed(2)} s`;
let processed = 0;

const queue = new PriorityQueue<Record<string, unknown>>(
  (task) => {
    simulateWork(task.data);
    processed++;

    if (task.priority > 5) {
      console.log(`[URGENTE] Procesado: ${task.id} (${elapsed()}) · reportes aún en espera: ${queue.length}`);
    } else if (processed % 1000 === 0) {
      console.log(`  ${processed} tareas procesadas (${elapsed()})`);
    }
  },
  () => console.log(`\nCola vaciada: ${processed} tareas en ${elapsed()}.`),
);

console.log('Cargando 5000 reportes lentos...');
for (let i = 0; i < 5000; i++) {
  queue.add(`Rep-${i}`, { mock: true }, 1);
}

queue.start();

setTimeout(() => {
  console.log(`\n--- LLEGA TRÁFICO VIP (${elapsed()}) · reportes pendientes: ${queue.length} ---`);
  queue.add('Transf-A', { user: 'CEO' }, 10);
  queue.add('Transf-B', { user: 'CFO' }, 10);
  queue.add('Transf-C', { user: 'CTO' }, 10);
  queue.start(); // idempotente: si la cola ya se vació, la reactiva
}, 2000);
