/** Detalle de un problema puntual dentro de la solicitud. */
export interface ErrorIssue {
  field: string;
  rule?: string;
  message: string;
}

/**
 * Error con significado HTTP. Los controladores y servicios lo lanzan y el
 * middleware de errores lo traduce a una respuesta uniforme:
 *
 *   { "error": { "code": "...", "message": "...", "issues": [...] } }
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: ErrorIssue[] | undefined;

  constructor(status: number, code: string, message: string, issues?: ErrorIssue[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  static badRequest(code: string, message: string, issues?: ErrorIssue[]): ApiError {
    return new ApiError(400, code, message, issues);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string): ApiError {
    return new ApiError(409, code, message);
  }

  toJSON(): { error: { code: string; message: string; issues?: ErrorIssue[] } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.issues ? { issues: this.issues } : {}),
      },
    };
  }
}
