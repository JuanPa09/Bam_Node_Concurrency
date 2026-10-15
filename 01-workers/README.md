# 1. Workers — Event Loop vs `worker_threads`

Node.js ejecuta el JavaScript en un solo hilo. Una tarea de CPU larga **secuestra el Event Loop** y el servidor deja de responder a todos. Un `worker_thread` ejecuta esa tarea en otro hilo, con su propio Event Loop y heap, y el hilo principal sigue libre.

La carga de CPU es real: **contar los números primos hasta 30 millones** por división de prueba (unos 5 s), no un bucle vacío.

## Rutas

| Ruta | Qué hace |
|------|----------|
| `GET /` | `{ "message": "Hello World" }` |
| `GET /health` | Estado del servidor |
| `GET /fast` | Responde al instante: es el *termómetro* del Event Loop |
| `GET /slow-io` | Espera 4 s con un timer (I/O): **no** bloquea |
| `GET /heavy-cpu-block?limit=N` | Cuenta primos en el hilo principal: **bloquea** |
| `GET /heavy-cpu-worker?limit=N` | Misma cuenta en un worker thread: **no** bloquea |

## Ejecutar

```bash
npm start              # servidor en http://localhost:3000
```

En otra terminal, el termómetro dispara la ruta pesada y mide `/fast` cada 250 ms:

```bash
npm run probe -- block    # /fast queda congelada hasta que termina el cálculo
npm run probe -- worker   # /fast sigue respondiendo en ~1 ms
```

## Resultado esperado

```
== block
/heavy-cpu-block terminó en 5684 ms
  /fast respondió en  5667 ms
Peor latencia de /fast: 5667 ms -> Event Loop BLOQUEADO

== worker
  /fast respondió en     1 ms
  /fast respondió en     1 ms
/heavy-cpu-worker terminó en 4505 ms
Peor latencia de /fast: 7 ms -> Event Loop libre
```

También se puede probar a mano: llamar a `/heavy-cpu-block` en una terminal y a `/fast` en otra.

## Archivos

- [`src/server.ts`](src/server.ts): servidor Express con las rutas.
- [`src/primes.ts`](src/primes.ts): la carga CPU-bound.
- [`src/prime-worker.ts`](src/prime-worker.ts): código que corre dentro del worker thread.
- [`src/run-in-worker.ts`](src/run-in-worker.ts): lanza el worker y devuelve una Promise con el resultado.
- [`scripts/probe.ts`](scripts/probe.ts): termómetro de latencia.
