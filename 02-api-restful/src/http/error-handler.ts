import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from './api-error.ts';

/** Rutas no registradas -> 404 con el mismo formato que el resto de errores. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No existe la ruta ${req.method} ${req.originalUrl}`));
};

/** Errores que lanza express.json() al leer el cuerpo. */
function bodyParserError(err: unknown): ApiError | null {
  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') {
    return ApiError.badRequest('MALFORMED_JSON', 'El cuerpo de la solicitud no es un JSON válido');
  }
  if (type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud excede el tamaño permitido');
  }
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const apiError = err instanceof ApiError ? err : bodyParserError(err);

  if (apiError) {
    res.status(apiError.status).json(apiError);
    return;
  }

  // Error inesperado: se registra en el servidor pero no se filtra al cliente.
  console.error('[api] Error no controlado:', err instanceof Error ? err.message : err);
  res.status(500).json(new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno'));
};
