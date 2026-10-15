/**
 * Variante con HTTP real: demuestra que el servidor sigue respondiendo
 * mientras la cola procesa miles de reportes en segundo plano.
 *
 *   node src/http-demo.ts
 *   curl localhost:3000/stats
 *   curl -X POST "localhost:3000/vip?id=Transf-X"
 *   curl -X POST "localhost:3000/reports?count=5000"
 */
import http from 'node:http';
import { PriorityQueue } from './priority-queue.ts';
import { simulateWork } from './workload.ts';

const PORT = Number(process.env.PORT ?? 3000);
let processed = 0;
let reportCounter = 0;

const queue = new PriorityQueue<{ enqueuedAt: number }>((task) => {
  simulateWork(task.data);
  processed++;
  if (task.priority > 5) {
    const waitedMs = Math.round(performance.now() - task.data.enqueuedAt);
    console.log(`[URGENTE] ${task.id} procesada tras ${waitedMs} ms en cola · pendientes: ${queue.length}`);
  }
});

function enqueueReports(count: number): void {
  for (let i = 0; i < count; i++) {
    queue.add(`Rep-${reportCounter++}`, { enqueuedAt: performance.now() }, 1);
  }
  queue.start();
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/stats') {
    return send(res, 200, { pending: queue.length, processed, processing: queue.isProcessing });
  }

  if (req.method === 'POST' && url.pathname === '/vip') {
    const id = url.searchParams.get('id') ?? `VIP-${Date.now()}`;
    queue.add(id, { enqueuedAt: performance.now() }, 10);
    queue.start();
    return send(res, 202, { accepted: id, pendingBefore: queue.length - 1 });
  }

  if (req.method === 'POST' && url.pathname === '/reports') {
    const count = Math.min(Number(url.searchParams.get('count') ?? 5000) || 5000, 100_000);
    enqueueReports(count);
    return send(res, 202, { enqueued: count, pending: queue.length });
  }

  send(res, 404, { error: 'Ruta no encontrada' });
});

server.listen(PORT, () => {
  console.log(`Cola con HTTP en http://localhost:${PORT} · encolando 5000 reportes...`);
  enqueueReports(5000);
});
