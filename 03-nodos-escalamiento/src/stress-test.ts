/**
 * Prueba de estrés (Laboratorio 1 · Fase 3).
 * Abre N conexiones simultáneas contra el balanceador y muestra a qué nodo
 * fue cada una y cómo quedó repartida la carga.
 *
 *   node src/stress-test.ts        # 6 peticiones
 *   node src/stress-test.ts 30     # 30 peticiones
 */
import net from 'node:net';
import { BALANCER_PORT } from './config.ts';

const TOTAL = Number(process.argv[2] ?? 6);

function sendPing(i: number): Promise<string> {
  return new Promise((resolve) => {
    let response = '';
    const client = net.createConnection({ port: BALANCER_PORT });
    client.write('Ping\n');
    client.on('data', (chunk) => (response += chunk.toString()));
    client.on('end', () => {
      const text = response.trim();
      console.log(`Req ${i}: ${text}`);
      resolve(text);
    });
    client.on('error', (err) => {
      console.log(`Req ${i}: ERROR ${err.message}`);
      resolve('ERROR');
    });
  });
}

const started = performance.now();
const responses = await Promise.all(Array.from({ length: TOTAL }, (_, i) => sendPing(i + 1)));
const elapsed = Math.round(performance.now() - started);

const perNode = new Map<string, number>();
for (const response of responses) {
  const node = response.match(/Nodo-\d+/)?.[0] ?? response;
  perNode.set(node, (perNode.get(node) ?? 0) + 1);
}

console.log(`\n${TOTAL} peticiones en ${elapsed} ms (cada nodo tarda 500 ms por petición)`);
console.table(Object.fromEntries([...perNode].map(([node, count]) => [node, { peticiones: count }])));
