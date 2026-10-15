/**
 * Transformador de memoria fija (Laboratorio 2 · Fase 2).
 *
 * Recibe el archivo por fragmentos (chunks de 64 KB), los convierte a texto,
 * reemplaza cada coma por " | " y los empuja al siguiente stream. Nunca tiene
 * más de un chunk en memoria a la vez.
 */
import { Transform, type TransformCallback } from 'node:stream';

export class FormateadorCsv extends Transform {
  chunks = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.chunks++;

    // Buffer binario -> texto -> mutación. Como el separador es un solo
    // carácter, cortar el archivo en chunks nunca parte una coma a la mitad.
    const mutated = chunk.toString('utf8').replace(/,/g, ' | ');

    this.push(mutated);
    callback(); // avisar que este bloque terminó y se puede recibir el siguiente
  }
}
