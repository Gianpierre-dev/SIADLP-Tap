import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Lista de headers sensibles que NUNCA deben aparecer en los logs.
 * Se redactan a nivel serializer (defense in depth — `redact` también los cubre).
 */
const SENSITIVE_HEADERS = new Set<string>([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
]);

/**
 * Sanitiza el objeto de headers de una request HTTP, reemplazando los headers
 * sensibles por '[REDACTED]'. Devuelve una copia — NO muta el original.
 */
function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return out;
}

/**
 * Serializer de request para pino-http.
 *
 * Reemplaza el serializer por defecto para:
 *   - Redactar Authorization, Cookie y otros headers sensibles
 *   - Capturar request id (correlation), método, URL y peer info
 *   - Omitir el body del request (puede contener passwords / PII)
 */
export function reqSerializer(
  req: IncomingMessage & {
    id?: string;
    raw?: IncomingMessage;
    body?: unknown;
    remoteAddress?: string;
    remotePort?: number;
  },
): Record<string, unknown> {
  const raw = req.raw ?? req;
  return {
    id: req.id,
    method: raw.method,
    url: raw.url,
    headers: sanitizeHeaders(raw.headers),
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort,
  };
}

/**
 * Serializer de response — el por defecto de pino es suficiente, pero lo
 * envolvemos para mantener un shape consistente y evitar que cambios upstream
 * filtren información extra.
 */
export function resSerializer(
  res: ServerResponse & { statusCode?: number; raw?: ServerResponse },
): Record<string, unknown> {
  const raw = res.raw ?? res;
  return {
    statusCode: raw.statusCode,
    headers: typeof raw.getHeaders === 'function' ? raw.getHeaders() : {},
  };
}

/**
 * Serializer de error que captura stack traces estructurados.
 *
 * Pino tiene un serializer por defecto para `err`, pero lo enriquecemos para:
 *   - Aplanar el stack en líneas (más legible en agregadores)
 *   - Capturar `cause` (Error chains de Node 16.9+)
 *   - Capturar propiedades extra que algunos errores agregan (e.g. Prisma's `code`)
 */
export function errSerializer(
  err: Error & {
    cause?: unknown;
    code?: string | number;
    statusCode?: number;
  },
): Record<string, unknown> {
  const stack = err.stack ? err.stack.split('\n').map((s) => s.trim()) : [];

  const out: Record<string, unknown> = {
    type: err.name,
    message: err.message,
    stack,
  };

  if (err.code !== undefined) out['code'] = err.code;
  if (err.statusCode !== undefined) out['statusCode'] = err.statusCode;

  if (err.cause instanceof Error) {
    out['cause'] = errSerializer(err.cause);
  } else if (err.cause !== undefined) {
    out['cause'] = err.cause;
  }

  return out;
}
