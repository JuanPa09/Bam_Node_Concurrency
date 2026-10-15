/**
 * Atajo opcional: levanta los 3 nodos y el balanceador en una sola terminal,
 * cada uno como PROCESO independiente (child_process), con su salida
 * etiquetada. Ctrl+C los detiene a todos.
 *
 * El PDF lo hace con 4 terminales; esto es equivalente y más cómodo.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NODE_PORTS } from './config.ts';

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

function launch(label: string, args: string[]): ChildProcess {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (chunk: Buffer) =>
    chunk
      .toString()
      .trimEnd()
      .split('\n')
      .forEach((line) => console.log(`[${label}] ${line}`));
  child.stdout?.on('data', prefix);
  child.stderr?.on('data', prefix);
  return child;
}

const children = NODE_PORTS.map((port) => launch(`nodo ${port}`, [here('./worker-node.ts'), String(port)]));

// Dar un momento a los nodos para abrir sus puertos antes del balanceador.
setTimeout(() => children.push(launch('balancer', [here('./balancer.ts')])), 300);

function stopAll(): void {
  children.forEach((child) => child.kill());
  process.exit(0);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
