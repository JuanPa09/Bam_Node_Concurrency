# 3. Nodos de escalamiento — Balanceador TCP de Capa 4

**Problema:** Node.js corre en un único hilo de V8, y la concurrencia masiva lo satura.
**Solución:** escalar horizontalmente con varios **procesos independientes** (cada uno con su V8, heap y Event Loop) y un **balanceador TCP** que reparte las conexiones con **Round-Robin**.

```
              Cliente
                 │
       Balanceador :8080   ── idx % total_nodos
        ┌────────┼────────┐
   Nodo 3001  Nodo 3002  Nodo 3003
```

- **Proxy TCP puro** (módulo `net`): no lee cabeceras HTTP, solo une los sockets con `pipe()` en ambos sentidos.
- **Tolerancia a fallos:** si el nodo elegido está caído, el balanceador **reintenta con el siguiente** en vez de devolver error. Solo si todos están caídos responde `Error: no hay nodos disponibles`. El balanceador nunca se cae por un nodo.

## Ejecutar (como en el PDF: 5 terminales)

```bash
npm run node -- 3001     # Terminal 1
npm run node -- 3002     # Terminal 2
npm run node -- 3003     # Terminal 3
npm run balancer         # Terminal 4
npm run test:stress      # Terminal 5 (6 peticiones; o: npm run test:stress -- 30)
```

### Atajo: todo en una terminal

```bash
npm run cluster          # levanta 3 nodos + balanceador como procesos separados
npm run test:stress      # en otra terminal
```

## Resultado esperado

```
Req 1: Respuesta desde Nodo-3001
Req 2: Respuesta desde Nodo-3002
Req 3: Respuesta desde Nodo-3003
Req 4: Respuesta desde Nodo-3001
Req 5: Respuesta desde Nodo-3002
Req 6: Respuesta desde Nodo-3003

6 peticiones en ~520 ms (cada nodo tarda 500 ms por petición)
```

El orden de impresión puede variar porque las respuestas llegan en paralelo, pero el reparto es 2/2/2.

**Prueba de tolerancia a fallos:** detén un nodo con Ctrl+C y vuelve a correr `test:stress`. En el log del balanceador verás `Nodo 3003 caído (ECONNREFUSED), probando el siguiente` y todas las peticiones seguirán respondiendo.

Los puertos se pueden cambiar con `NODES=4001,4002 BALANCER_PORT=9090`.

## Archivos

- [`src/worker-node.ts`](src/worker-node.ts): nodo TCP. Toma el puerto de `process.argv[2]`, simula 500 ms de trabajo y cierra el socket con `end()`.
- [`src/balancer.ts`](src/balancer.ts): proxy Round-Robin con reintento.
- [`src/stress-test.ts`](src/stress-test.ts): abre N conexiones simultáneas y resume el reparto.
- [`src/cluster.ts`](src/cluster.ts): lanzador opcional con `child_process`.
