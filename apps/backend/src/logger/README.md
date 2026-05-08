# Logger Module — Pino structured logging

Production-grade logging para SIADLP-Tap. Reemplaza el logger por defecto de NestJS
por [Pino](https://getpino.io/) vía [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino).

## Por qué Pino

| Criterio                  | Logger default Nest          | Pino                                          |
| ------------------------- | ---------------------------- | --------------------------------------------- |
| **Performance**           | ~1-2k logs/seg, sync         | ~30k+ logs/seg, async-first                   |
| **Output**                | Texto plano                  | JSON nativo (sin overhead de format strings)  |
| **Estructura**            | Strings concatenados         | Campos tipados — agregadores los indexan      |
| **Redacción**             | Manual                       | Built-in vía `redact.paths`                   |
| **Correlation IDs**       | No                           | Built-in vía `req.id`                         |
| **Adopción**              | Nest-only                    | Estándar de Node.js (Fastify, NestJS, Express)|

En Railway, **stdout JSON** es lo que el agregador parsea. Texto plano se queda
como una blob no indexable. Por eso JSON estructurado no es opcional en producción.

## Cómo se ven los logs

### Development (`NODE_ENV !== 'production'`)

`pino-pretty` formatea con colores, timestamps cortos y oculta headers ruidosos:

```
[14:23:11.842] INFO  (auth/AuthService): login.success
    userId: 1
    correo: "admin@siadlp.test"
    permisosCount: 12
    req: {
      "id": "8c8d8b6a-...",
      "method": "POST",
      "url": "/api/auth/login"
    }

[14:23:12.005] INFO  (HTTP): POST /api/auth/login 201 (163ms)
```

### Production (`NODE_ENV === 'production'`)

JSON puro, una línea por evento, listo para indexar:

```json
{"level":30,"time":1730731391842,"pid":12,"hostname":"web.1","context":"AuthService","userId":1,"correo":"admin@siadlp.test","permisosCount":12,"req":{"id":"8c8d8b6a-1a2b-4c3d-8e7f-abcdef012345","method":"POST","url":"/api/auth/login"},"msg":"login.success"}
{"level":30,"time":1730731392005,"pid":12,"hostname":"web.1","req":{"id":"8c8d8b6a-1a2b-4c3d-8e7f-abcdef012345","method":"POST","url":"/api/auth/login"},"res":{"statusCode":201},"responseTime":163,"msg":"POST /api/auth/login 201 (163ms)"}
```

Ambas líneas comparten el mismo `req.id` — eso es **correlation**.

### Test (`NODE_ENV === 'test'`)

`level: 'silent'` y `enabled: false`. **Cero output** durante Jest.

## Cómo agregar logs a tu service

```ts
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(
    @InjectPinoLogger(MyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async doSomething(userId: number): Promise<void> {
    // Convención: primer arg = contexto estructurado, segundo arg = "event name"
    // ¿Por qué? Permite query agregada por event name (e.g. `msg = "order.created"`)
    // y campos arbitrarios como filtros (`userId = 42 AND msg = "order.failed"`).
    this.logger.info({ userId }, 'something.started');

    try {
      // ... lógica ...
      this.logger.info({ userId, durationMs: 42 }, 'something.completed');
    } catch (err) {
      // err se serializa con el errSerializer custom (stack, cause, code)
      this.logger.error({ err, userId }, 'something.failed');
      throw err;
    }
  }
}
```

### En tests, mockear PinoLogger

```ts
import { getLoggerToken } from 'nestjs-pino';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    MyService,
    { provide: getLoggerToken(MyService.name), useValue: loggerMock },
  ],
}).compile();
```

## Request ID propagation

Cada request HTTP recibe un `id` único. Pino lo agrega automáticamente a:

1. El log automático de `pino-http` (request completada)
2. Cualquier log que un service haga durante esa request
   (vía `AsyncLocalStorage` de Node — pino-http engancha el contexto)

### Cliente puede enviar el suyo

Si la request llega con header `X-Request-Id: <valor>`, lo respetamos.
Útil cuando un API gateway upstream (Cloudflare, Railway proxy) ya generó un
trace id que queremos correlacionar end-to-end.

Si no viene, generamos un `randomUUID()` (Node 14.17+).

```bash
# Cliente envía su propio correlation id
curl -H "X-Request-Id: my-trace-id-123" https://api.example.com/api/auth/login
```

Buscar todos los logs de esa request en el agregador:

```
req.id = "my-trace-id-123"
```

## Campos redactados (security)

Los siguientes paths se reemplazan por `[REDACTED]` automáticamente, en
**cualquier nivel de profundidad** del objeto logueado:

| Path                            | Por qué                                       |
| ------------------------------- | --------------------------------------------- |
| `req.headers.authorization`     | JWT / API key                                 |
| `req.headers.cookie`            | Session cookies                               |
| `req.headers["set-cookie"]`     | Auth cookies set en respuesta                 |
| `req.headers["x-api-key"]`      | API keys                                      |
| `req.headers["x-auth-token"]`   | Tokens custom                                 |
| `req.headers["proxy-authorization"]` | Proxy auth                              |
| `password`                      | Cualquier `password` plano                    |
| `contrasena`                    | Variante en español del proyecto              |
| `contrasenaActual`              | Change-password DTO                           |
| `contrasenaNueva`               | Change-password DTO                           |
| `token`                         | JWTs / API tokens                             |
| `accessToken`                   | Login response                                |
| `refreshToken`                  | OAuth refresh                                 |
| `authorization`                 | Header header at any nesting                  |
| `*.password`, `*.contrasena`    | Sub-objetos (e.g. `dto.user.password`)        |
| `*.token`, `*.accessToken`      | Sub-objetos                                   |

Adicionalmente, `reqSerializer` redacta a nivel de serializer (defense in depth).

> **Importante:** la redacción es a nivel del **path**. Si loguás
> `{ user: { contrasena: 'plain' } }`, el `*.contrasena` lo cubre.
> Pero `{ pwd: 'plain' }` con un alias custom NO se redacta. Si introducís
> nuevos campos sensibles, agregalos a `redact.paths` en `logger.module.ts`.

## Health checks no se loguean

Los paths que empiezan con `/health` o `/api/health` están en `autoLogging.ignore`.
Si los logueáramos, Railway haría 1 ping cada 5s × 2 instancias = 17,280 logs/día
sin valor de señal.

Si necesitás debuggear un health check, podés loguear desde el handler — pero el
log "request completed" automático no aparece.

## Niveles de log

- **debug** (10): solo dev — detalle interno
- **info** (30): eventos normales — `login.success`, `order.created`
- **warn** (40): recuperable — `login.failed`, `rate_limit_hit`
- **error** (50): fallas — exceptions, 5xx, integraciones rotas
- **fatal** (60): proceso debe morir — DB down al boot, config inválida

`customLogLevel` mapea automáticamente:

- 5xx → `error`
- 4xx → `warn`
- 2xx/3xx → `info`

## Variables de entorno

| Variable      | Default                       | Efecto                                  |
| ------------- | ----------------------------- | --------------------------------------- |
| `NODE_ENV`    | `development`                 | Decide pretty vs JSON vs silent         |
| `LOG_LEVEL`   | `info` (prod) / `debug` (dev) | Filtra niveles bajos                    |

Para silenciar temporalmente en dev: `LOG_LEVEL=warn pnpm dev`.
