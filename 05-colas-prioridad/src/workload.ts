/**
 * Esfuerzo sincrónico simulado por tarea (serialización JSON). Sin él, una
 * máquina rápida terminaría los 5000 reportes antes de que llegue el tráfico
 * VIP y no se vería la interrupción.
 */
const SAMPLE = Array.from({ length: 8_000 }, (_, i) => ({ i, cuenta: `GT-${i}`, monto: i * 1.5 }));

export function simulateWork(data: unknown): void {
  JSON.stringify({ data, SAMPLE });
}
