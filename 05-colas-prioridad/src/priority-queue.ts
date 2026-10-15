/**
 * Cola de prioridad no bloqueante (Laboratorio 3 · Fases 1 y 2).
 *
 * Diferencia con el PDF: en lugar de reordenar el arreglo completo con sort()
 * en cada add() (O(n log n)), se usa un HEAP binario: insertar y extraer
 * cuestan O(log n). Es la estructura que la diapositiva recomienda para
 * producción. A igual prioridad se respeta el orden de llegada (FIFO).
 *
 * Escala de prioridad: 1 (baja) a 10 (urgente).
 */

export interface Task<T> {
  id: string;
  data: T;
  priority: number;
}

interface Entry<T> extends Task<T> {
  /** Orden de llegada, para desempatar prioridades iguales. */
  seq: number;
}

export type TaskHandler<T> = (task: Task<T>) => void;

export class PriorityQueue<T = unknown> {
  readonly #heap: Entry<T>[] = [];
  readonly #handler: TaskHandler<T>;
  #seq = 0;
  #processing = false;
  #onDrained: (() => void) | undefined;

  constructor(handler: TaskHandler<T>, onDrained?: () => void) {
    this.#handler = handler;
    this.#onDrained = onDrained;
  }

  get length(): number {
    return this.#heap.length;
  }

  get isProcessing(): boolean {
    return this.#processing;
  }

  add(id: string, data: T, priority = 1): void {
    this.#heap.push({ id, data, priority, seq: this.#seq++ });
    this.#siftUp(this.#heap.length - 1);
  }

  /** Extrae la tarea de mayor prioridad (o undefined si está vacía). */
  next(): Task<T> | undefined {
    const top = this.#heap[0];
    const last = this.#heap.pop();
    if (top === undefined || last === undefined) return undefined;
    if (this.#heap.length > 0) {
      this.#heap[0] = last;
      this.#siftDown(0);
    }
    return { id: top.id, data: top.data, priority: top.priority };
  }

  /** Arranca el despacho. Protegido por bandera para no duplicar el loop. */
  start(): void {
    if (this.#processing) return;
    this.#processing = true;
    this.#processLoop();
  }

  /**
   * Procesa UNA tarea por vuelta del Event Loop. Tras cada tarea se reagenda
   * con setImmediate (fase "check"): entre una y otra Node atiende timers,
   * I/O y peticiones HTTP, y las tareas urgentes que lleguen se insertan en
   * el heap y salen primero en la siguiente vuelta.
   */
  #processLoop(): void {
    const task = this.next();

    if (task === undefined) {
      this.#processing = false;
      this.#onDrained?.();
      return;
    }

    this.#handler(task);
    setImmediate(() => this.#processLoop());
  }

  // --- Heap binario ---------------------------------------------------

  /** true si a debe salir antes que b. */
  #before(a: Entry<T>, b: Entry<T>): boolean {
    return a.priority !== b.priority ? a.priority > b.priority : a.seq < b.seq;
  }

  #swap(i: number, j: number): void {
    const tmp = this.#heap[i]!;
    this.#heap[i] = this.#heap[j]!;
    this.#heap[j] = tmp;
  }

  #siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#before(this.#heap[i]!, this.#heap[parent]!)) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  #siftDown(index: number): void {
    const size = this.#heap.length;
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let best = i;
      if (left < size && this.#before(this.#heap[left]!, this.#heap[best]!)) best = left;
      if (right < size && this.#before(this.#heap[right]!, this.#heap[best]!)) best = right;
      if (best === i) return;
      this.#swap(i, best);
      i = best;
    }
  }
}
