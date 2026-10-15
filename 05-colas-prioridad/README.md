# 5. Colas y prioridad — Despacho no bloqueante

**Problema:** un bucle sincrónico sobre miles de tareas estrangula el Event Loop, y las peticiones urgentes quedan esperando.
**Solución:**

1. Una **cola de prioridad** (1 = baja … 10 = urgente) donde lo crítico sale primero.
2. Un **worker loop** que procesa *una* tarea por vuelta y se reagenda con `setImmediate`. Entre tarea y tarea, Node atiende timers, I/O y HTTP, y las tareas urgentes que llegan a mitad del proceso se adelantan.

### Mejora sobre el PDF: heap binario

El PDF reordena el arreglo completo con `sort()` en cada `add()`, lo que cuesta O(n log n) por inserción, y la diapositiva advierte que en producción se necesita un heap. Aquí la cola **es** un heap binario: insertar y extraer cuestan O(log n). A igual prioridad se respeta el orden de llegada (FIFO).

## Ejecutar

```bash
npm start       # demo del PDF: 5000 reportes + 3 transferencias VIP a los 2 s
npm test        # pruebas del heap y del despacho no bloqueante
npm run http    # variante con servidor HTTP real
```

## Resultado esperado

```
Cargando 5000 reportes lentos...
  1000 tareas procesadas (0.71 s)
  2000 tareas procesadas (1.41 s)

--- LLEGA TRÁFICO VIP (2.00 s) · reportes pendientes: 2159 ---
[URGENTE] Procesado: Transf-A (2.00 s) · reportes aún en espera: 2161
[URGENTE] Procesado: Transf-B (2.00 s) · reportes aún en espera: 2160
[URGENTE] Procesado: Transf-C (2.00 s) · reportes aún en espera: 2159
  3000 tareas procesadas (2.11 s)
  ...
Cola vaciada: 5003 tareas en 3.54 s.
```

Dos señales lo validan:

1. El `setTimeout` de 2 s **se dispara a tiempo** (2.00 s): el Event Loop no estaba colapsado.
2. Las VIP se procesan **al instante**, adelantando a los más de 2000 reportes pendientes.

## Variante HTTP

`npm run http` encola 5000 reportes y abre un servidor en el puerto 3000 que sigue respondiendo mientras procesa:

```bash
curl localhost:3000/stats                       # {"pending":4320,"processed":680,"processing":true}
curl -X POST "localhost:3000/vip?id=Transf-X"   # responde en ~1 ms
# log del servidor: [URGENTE] Transf-X procesada tras 1 ms en cola · pendientes: 4310
curl -X POST "localhost:3000/reports?count=5000"
```

## Archivos

- [`src/priority-queue.ts`](src/priority-queue.ts): `PriorityQueue` con `add`, `next`, `length`, `start` y el loop con `setImmediate`.
- [`src/app.ts`](src/app.ts): el ejecutable del PDF.
- [`src/http-demo.ts`](src/http-demo.ts): la variante HTTP.
- [`src/workload.ts`](src/workload.ts): esfuerzo sincrónico simulado por tarea (serialización JSON).
