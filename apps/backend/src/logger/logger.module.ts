import { randomUUID } from 'crypto';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { DynamicModule } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';

import { reqSerializer, resSerializer, errSerializer } from './serializers';

/**
 * Header HTTP estándar para correlation ID. Si el cliente lo envía lo respetamos
 * (típico cuando hay un API gateway upstream que ya generó el tracing id).
 */
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Paths que NO deben loguear cada request — son polling de readiness/liveness
 * por parte del orquestador (Railway healthcheck) y saturarían el log stream.
 *
 * Filtramos con autoLogging.ignore para evitar el log "request completed" pero
 * los handlers todavía pueden loguear desde dentro si lo necesitan.
 */
const HEALTH_CHECK_PREFIXES = ['/health', '/api/health'];

/**
 * Resuelve la configuración de Pino según el entorno.
 *
 * - test:        silent (no contamina output de Jest)
 * - development: pino-pretty con colores y timestamps legibles
 * - production:  JSON estructurado a stdout (Railway captura stdout y lo envía
 *                a su agregador; mantenerlo en JSON es lo que le permite
 *                indexar campos como `userId`, `requestId`, etc.)
 *
 * Exportada para que callers la puedan usar al armar `LoggerModule.forRoot(...)`
 * fuera de este módulo (ver `LoggerModule.register()` abajo y `AppModule`).
 */
export function buildPinoParams(): Params {
  const env = process.env['NODE_ENV'] ?? 'development';

  if (env === 'test') {
    return {
      pinoHttp: {
        // level "silent" deshabilita absolutamente todo output.
        level: 'silent',
        enabled: false,
      },
    };
  }

  const isProduction = env === 'production';

  return {
    pinoHttp: {
      level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),

      // Correlation id: respeta el del header upstream o genera uno nuevo.
      // pino-http lo expone como `req.id` y lo agrega a cada log de la request.
      genReqId: (req: IncomingMessage): string => {
        const headerValue = req.headers[REQUEST_ID_HEADER];
        if (typeof headerValue === 'string' && headerValue.length > 0) {
          return headerValue;
        }
        return randomUUID();
      },

      // Pretty printing solo en dev. En prod queremos JSON puro.
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,req.headers,res.headers',
              singleLine: false,
            },
          },

      // Redacción a nivel pino — paths con notación dot. Cubre tanto el log
      // automático de pino-http (req/res) como cualquier campo custom que
      // un service loguee con esos nombres.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'req.headers["x-api-key"]',
          'req.headers["x-auth-token"]',
          'req.headers["proxy-authorization"]',
          'res.headers["set-cookie"]',
          'password',
          'contrasena',
          'contrasenaActual',
          'contrasenaNueva',
          'token',
          'accessToken',
          'refreshToken',
          'authorization',
          '*.password',
          '*.contrasena',
          '*.token',
          '*.accessToken',
        ],
        censor: '[REDACTED]',
        remove: false,
      },

      serializers: {
        req: reqSerializer,
        res: resSerializer,
        err: errSerializer,
      },

      autoLogging: {
        // No loguear health checks — saturarían el log stream sin aportar señal.
        ignore: (req: IncomingMessage): boolean => {
          const url = req.url ?? '';
          return HEALTH_CHECK_PREFIXES.some((prefix) => url.startsWith(prefix));
        },
      },

      // Custom message formatting — incluye duración y status para que cada
      // línea de log de request sea autoexplicativa.
      customSuccessMessage: (
        req: IncomingMessage,
        res: ServerResponse,
        responseTime: number,
      ): string => {
        return `${req.method ?? 'UNKNOWN'} ${req.url ?? '/'} ${res.statusCode} (${responseTime}ms)`;
      },

      customErrorMessage: (
        req: IncomingMessage,
        res: ServerResponse,
        err: Error,
      ): string => {
        return `${req.method ?? 'UNKNOWN'} ${req.url ?? '/'} ${res.statusCode} (${err.message})`;
      },

      // Niveles según status — 5xx = error, 4xx = warn, resto = info.
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ): 'error' | 'warn' | 'info' => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    },
  };
}

/**
 * Wrapper module que registra `nestjs-pino` con nuestra configuración.
 *
 * IMPORTANTE — orden de import:
 *   `nestjs-pino` recolecta todos los `@InjectPinoLogger(name)` en un Set
 *   global al cargar los archivos que usan el decorador. `LoggerModule.forRoot()`
 *   lee ese Set en el momento de evaluación del `@Module({ imports: [...] })`.
 *
 *   Por eso `LoggerModule.register()` debe llamarse INLINE en el array `imports`
 *   de `AppModule`, después de que TypeScript ya cargó los archivos con services
 *   decorados. Si encapsuláramos `forRoot()` dentro de un `@Module` decorator
 *   propio, se evaluaría antes que los services y los providers de logger no
 *   estarían registrados → "Cannot resolve PinoLogger:AuthService".
 *
 *   Por la misma razón, `LoggerModule.register()` devuelve un DynamicModule —
 *   no es una clase con decoradores que se evalúan en orden de import.
 */
export class LoggerModule {
  static register(): DynamicModule {
    return PinoLoggerModule.forRoot(buildPinoParams());
  }
}
