/**
 * Nodo trabajador TCP (Laboratorio 1 · Fase 1).
 *
 * Cada nodo es un proceso independiente: su propio V8, su propio heap y su
 * propio Event Loop. Solo se comunica por sockets TCP.
 *
 *   node src/worker-node.ts 3001
 */
import net from 'node:net';

const PORT = Number(process.argv[2] ?? 3001);
const NODE_ID = `Nodo-${PORT}`;
const SIMULATED_WORK_MS = 500;

let served = 0;

const server = net.createServer((socket) => {
  served++;
  console.log(`[+] Conexión #${served} recibida en ${NODE_ID}`);

  // Un cliente que corta la conexión no debe tumbar el nodo.
  socket.on('error', (err) => console.error(`[!] ${NODE_ID} socket: ${err.message}`));

  // Simulación de procesamiento pesado.
  setTimeout(() => {
    socket.write(`Respuesta desde ${NODE_ID}\n`);
    socket.end(); // obligatorio: liberar el socket
  }, SIMULATED_WORK_MS);
});

server.listen(PORT, () => {
  console.log(`${NODE_ID} escuchando en el puerto ${PORT} (pid ${process.pid})`);
});
