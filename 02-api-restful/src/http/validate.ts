import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from './api-error.ts';

/**
 * Valida req.body o req.params con un esquema de zod. Si falla, responde 400
 * con un issue por campo. En el body deja el valor ya parseado y tipado.
 */
export function validate(part: 'body' | 'params', schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part] ?? {});

    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message,
      }));
      const message =
        part === 'params' ? 'Parámetro de ruta inválido' : 'La solicitud contiene datos inválidos';
      next(ApiError.badRequest('VALIDATION_FAILED', message, issues));
      return;
    }

    if (part === 'body') req.body = result.data;
    next();
  };
}
