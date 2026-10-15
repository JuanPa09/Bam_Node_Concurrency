# Entregables Node.js — Cohorte Flutter Acelera TI

Cinco ejercicios sobre el rendimiento de Node.js, cada uno en su propia carpeta e independiente de los demás.

| # | Carpeta | Tema | Comando principal |
|---|---------|------|-------------------|
| 1 | [`01-workers`](01-workers) | Event Loop vs `worker_threads` | `npm run start -w 01-workers` |
| 2 | [`02-api-restful`](02-api-restful) | API de tarjetas de crédito (TypeScript + PostgreSQL/Supabase) | `npm run dev -w 02-api-restful` |
| 3 | [`03-nodos-escalamiento`](03-nodos-escalamiento) | Balanceador TCP Round-Robin entre procesos | `npm run cluster -w 03-nodos-escalamiento` |
| 4 | [`04-memoria-ram`](04-memoria-ram) | Streams y backpressure con archivos de ~1 GB | `npm run pipeline -w 04-memoria-ram` |
| 5 | [`05-colas-prioridad`](05-colas-prioridad) | Cola de prioridad no bloqueante | `npm run start -w 05-colas-prioridad` |

Cada carpeta tiene su propio README con qué demuestra, cómo ejecutarlo y qué observar.

## Requisitos

- **Node.js 24 o superior.** El código es TypeScript y se ejecuta directo con `node archivo.ts` gracias al *type stripping* nativo de Node: no hay paso de compilación ni ts-node.
- Solo para el ejercicio 2: un proyecto de Supabase (PostgreSQL).

## Instalación

```bash
npm install          # instala las dependencias de las 5 carpetas (npm workspaces)
npm run typecheck    # verifica los tipos (TypeScript estricto) en todas las carpetas
npm test             # pruebas de la API y de la cola de prioridad
```

Los comandos también se pueden correr desde dentro de cada carpeta, por ejemplo `cd 02-api-restful && npm run dev`.

## Decisiones comunes

- **TypeScript estricto** (`strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`) configurado en [`tsconfig.base.json`](tsconfig.base.json) y heredado por cada carpeta.
- **ES Modules** (`"type": "module"`), imports con extensión `.ts`.
- **`node --env-file=.env`** en lugar de dotenv.
- **Vitest** para las pruebas.
