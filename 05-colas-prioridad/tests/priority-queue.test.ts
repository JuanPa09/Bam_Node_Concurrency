import { describe, expect, it } from 'vitest';
import { PriorityQueue, type Task } from '../src/priority-queue.ts';

function drain<T>(queue: PriorityQueue<T>): string[] {
  const ids: string[] = [];
  for (let task = queue.next(); task; task = queue.next()) ids.push(task.id);
  return ids;
}

describe('PriorityQueue (heap)', () => {
  it('extrae primero la mayor prioridad', () => {
    const q = new PriorityQueue(() => {});
    q.add('baja', null, 1);
    q.add('urgente', null, 10);
    q.add('media', null, 5);
    expect(drain(q)).toEqual(['urgente', 'media', 'baja']);
  });

  it('a igual prioridad respeta el orden de llegada (FIFO)', () => {
    const q = new PriorityQueue(() => {});
    for (const id of ['a', 'b', 'c', 'd', 'e']) q.add(id, null, 3);
    q.add('vip', null, 10);
    expect(drain(q)).toEqual(['vip', 'a', 'b', 'c', 'd', 'e']);
  });

  it('ordena correctamente miles de tareas aleatorias', () => {
    const q = new PriorityQueue<number>(() => {});
    for (let i = 0; i < 5000; i++) q.add(`t${i}`, i, 1 + Math.floor(Math.random() * 10));
    const priorities: number[] = [];
    for (let task = q.next(); task; task = q.next()) priorities.push(task.priority);
    expect(priorities).toHaveLength(5000);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it('length y next() con cola vacía', () => {
    const q = new PriorityQueue(() => {});
    expect(q.length).toBe(0);
    expect(q.next()).toBeUndefined();
  });
});

describe('despacho no bloqueante', () => {
  it('las tareas urgentes que llegan a mitad del proceso se adelantan', async () => {
    const order: string[] = [];
    let resolveDone: () => void;
    const done = new Promise<void>((resolve) => (resolveDone = resolve));

    const q = new PriorityQueue<null>(
      (task: Task<null>) => order.push(task.id),
      () => resolveDone(),
    );
    for (let i = 0; i < 1000; i++) q.add(`Rep-${i}`, null, 1);
    q.start();

    // Un timer solo se ejecuta si el Event Loop está libre entre tareas.
    setTimeout(() => q.add('VIP', null, 10), 0);
    await done;

    const vipAt = order.indexOf('VIP');
    expect(vipAt).toBeGreaterThan(0);
    expect(vipAt).toBeLessThan(999); // no esperó a que terminaran los reportes
  });

  it('start() es idempotente mientras procesa', async () => {
    let calls = 0;
    let resolveDone: () => void;
    const done = new Promise<void>((resolve) => (resolveDone = resolve));
    const q = new PriorityQueue<null>(() => calls++, () => resolveDone());
    for (let i = 0; i < 10; i++) q.add(`t${i}`, null);
    q.start();
    q.start();
    await done;
    expect(calls).toBe(10);
  });
});
