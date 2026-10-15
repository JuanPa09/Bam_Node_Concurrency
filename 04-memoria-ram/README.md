# 4. Memoria RAM — Streams y contrapresión

**Problema:** V8 limita el heap (~1.5 GB por defecto) y un string no puede pasar de ~512 MB. Cargar un archivo gigante de una vez (`fs.readFile`) termina en crash.
**Solución:** procesarlo por **chunks de 64 KB** con streams, respetando la **contrapresión (backpressure)**. El consumo de RAM se mantiene fijo (~30 MB) sin importar el tamaño del archivo.

## Ejecutar

```bash
npm run seed        # 1) genera data/big.csv: 10 millones de filas (~865 MB)
npm run pipeline    # 2) big.csv -> FormateadorCsv -> final.txt, midiendo el heap
npm run naive       # 3) (comparación) el mismo trabajo cargando todo en memoria: crash
npm run clean       # borra los archivos generados (~1.8 GB)
```

Para una prueba rápida: `npm run seed -- 1000000` (1 millón de filas).

> Se necesitan ~2 GB libres en disco. `data/` está en `.gitignore`.

## Resultados obtenidos

**Seed:** el `while` deja de escribir cuando `write()` devuelve `false` y continúa en el evento `drain`:

```
Sembrado masivo completado: 10.000.000 filas, 864.7 MB en 9.3 s (13827 pausas por drain).
```

**Pipeline:** el heap se mantiene en decenas de MB mientras procesa casi 1 GB:

```
[+] Consumo RAM (heap): 11.10 MB
[+] Consumo RAM (heap): 19.76 MB
[+] Consumo RAM (heap): 10.05 MB
...
Procesamiento completado sin crashear en 4.0 s.
  Chunks procesados: 13.835
  Archivo final:     979.1 MB
  Pico de heap:      31.58 MB
```

**Naive:** con el mismo archivo, solo leerlo sube el RSS a ~936 MB, y luego muere:

```
Archivo leído completo     heap     7.5 MB · rss   936.6 MB
✖ Crash al cargar todo en memoria: ERR_STRING_TOO_LONG Cannot create a string longer than 0x1fffffe8 characters
```

## Archivos

- [`src/seed.ts`](src/seed.ts): escritura masiva con `write()` → `false` → `once('drain')`.
- [`src/etl.ts`](src/etl.ts): `FormateadorCsv extends Transform`; reemplaza `,` por ` | ` en cada chunk.
- [`src/pipeline.ts`](src/pipeline.ts): `pipeline()` de `node:stream/promises` más el profiler de RAM cada 500 ms. Se usa `pipeline()` y no `.pipe()` encadenado porque propaga los errores y destruye todos los streams si uno falla.
- [`src/naive.ts`](src/naive.ts): el anti-patrón, para comparar.
