/** Puertos del clúster. Se pueden cambiar con variables de entorno. */
export const BALANCER_PORT = Number(process.env.BALANCER_PORT ?? 8080);

export const NODE_PORTS: number[] = (process.env.NODES ?? '3001,3002,3003')
  .split(',')
  .map((port) => Number(port.trim()))
  .filter((port) => Number.isInteger(port) && port > 0);
