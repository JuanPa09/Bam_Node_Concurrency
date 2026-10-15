/**
 * Balanceador de Capa 4 (Laboratorio 1 · Fase 2).
 *
 * Proxy TCP puro: no lee cabeceras HTTP, solo conecta el socket del cliente
 * con el de un nodo y deja que los bytes fluyan en ambos sentidos (pipe).
 *
 * Round-Robin: nodo = NODOS[idx % NODOS.length].
 * Tolerancia a fallos: si el nodo elegido no responde, se reintenta con el
 * siguiente de la lista; solo si todos están caídos se responde con error.
 *
 *   node src/balancer.ts
 */
import net from 'node:net';
import { BALANCER_PORT, NODE_PORTS } from './config.ts';

let idx = 0;

/** Intenta conectar con los nodos a partir de `start`, saltando los caídos. */
function connectToNode(client: net.Socket, start: number, attempt = 0): void {
  if (attempt >= NODE_PORTS.length) {
    console.error('[x] Todos los nodos están caídos');
    client.end('Error: no hay nodos disponibles\n');
    return;
  }

  const targetPort = NODE_PORTS[(start + attempt) % NODE_PORTS.length]!;
  const node = net.createConnection({ port: targetPort });
  let connected = false;

  node.once('connect', () => {
    connected = true;
    console.log(`Enrutando tráfico -> Puerto ${targetPort}${attempt > 0 ? ` (reintento ${attempt})` : ''}`);

    // Tubería bidireccional de datos.
    client.pipe(node);
    node.pipe(client);
  });

  // Manejo preventivo de fallos: el balanceador nunca se cae por un nodo.
  node.on('error', (err: NodeJS.ErrnoException) => {
    if (!connected) {
      console.error(`[!] Nodo ${targetPort} caído (${err.code}), probando el siguiente`);
      connectToNode(client, start, attempt + 1);
    } else {
      console.error(`[!] Nodo ${targetPort} falló durante la respuesta: ${err.message}`);
      client.destroy();
    }
  });
}

const balancer = net.createServer((client) => {
  const start = idx % NODE_PORTS.length;
  idx++;

  // Retener lo que envíe el cliente hasta tener un nodo conectado.
  client.pause();
  client.on('error', (err) => console.error(`[!] Cliente: ${err.message}`));

  connectToNode(client, start);
});

balancer.listen(BALANCER_PORT, () => {
  console.log(`Proxy OK en ${BALANCER_PORT} -> nodos [${NODE_PORTS.join(', ')}]`);
});
