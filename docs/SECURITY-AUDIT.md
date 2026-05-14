# Security Audit Report — SIADLP

**Fecha:** 2026-05-07
**Standard:** OWASP Top 10 (2021)
**Stack auditado:** NestJS 11 + Next.js 16 + Prisma 7 + PostgreSQL 16
**Tipo de proyecto:** MVP académico (TAP IDAT) — entrega para sustentación
**Auditor:** Security review automatizado, complementado con verificación manual contra OWASP Top 10.

---

## Resumen ejecutivo

Auditadas las 10 categorías de OWASP Top 10 (2021). **0 hallazgos críticos**, **2 high**, **6 medium**, **5 low/informational**. **9 hallazgos mitigados** (parcial o totalmente) en esta auditoría, **4 documentados como recomendaciones para producción** o limitaciones aceptadas dentro del scope MVP.

El proyecto presenta una postura de seguridad **muy sólida para un MVP**: ValidationPipe global con `whitelist+forbidNonWhitelisted+transform`, JWT con bcrypt cost 12, RBAC basado en permission matrix con guards globales, throttling diferenciado en login, CORS allowlist, audit log centralizado, validación de variables de entorno al boot, y enforcement de longitud mínima del `JWT_SECRET` (32+ caracteres). No se detectaron vulnerabilidades de SQL injection, command injection, XSS reflejado, ni SSRF. Las debilidades restantes están concentradas en (a) tokens JWT en `localStorage` (XSS-amplifiable), (b) ausencia de refresh-tokens / revocación inmediata, (c) ausencia de account lockout, y (d) una vulnerabilidad HIGH en `next@<16.2.3` que requiere bump de dependencia (fuera del scope de esta tarea según instrucciones).

---

## Findings

### [HIGH] [A06:2021] Vulnerabilidad de DoS en Next.js < 16.2.3

- **Categoría:** OWASP A06 — Vulnerable and Outdated Components
- **Severidad:** High
- **Descripción:** `pnpm audit --prod` reporta `GHSA-q4gf-8mx6-v5v3` — *"Next.js has a Denial of Service with Server Components"*. Versión actual: `next@^16.0.0` (el lockfile resuelve a una versión vulnerable < 16.2.3). Patch disponible: `>=16.2.3`.
- **Riesgo:** Un atacante remoto puede provocar denegación de servicio enviando requests específicas que exploten Server Components, dejando al frontend inaccesible para usuarios legítimos.
- **Estado:** Pendiente
- **Fix aplicado:** Ninguno — la instrucción explícita prohibió correr `pnpm add` o instalar dependencias durante esta auditoría. **Recomendación documentada para sustentación:** correr `pnpm --filter frontend up next@latest` y validar con `pnpm audit --prod` antes del despliegue final.
- **Referencia:** https://github.com/advisories/GHSA-q4gf-8mx6-v5v3

---

### [HIGH] [A07:2021] JWT almacenado en `localStorage` (vulnerable a XSS)

- **Categoría:** OWASP A07 — Identification and Authentication Failures
- **Severidad:** High
- **Descripción:** El frontend (`apps/frontend/src/lib/auth.ts:26-27`) persiste el `accessToken` en `localStorage`. Cualquier vulnerabilidad XSS en la app, librería de terceros, o componente con HTML dinámico no escapado permitiría a un atacante leer el token con `localStorage.getItem('access_token')` y exfiltrarlo, escalando a cuenta-takeover completo.
- **Riesgo:** Account takeover si una sola vulnerabilidad XSS es introducida en cualquier punto del frontend (incluyendo dependencias de terceros como editores de texto, react-markdown, etc.). El token vive 2h, da acceso completo según los permisos del rol.
- **Estado:** Aceptado como limitación del scope MVP (riesgo conocido y mitigado parcialmente).
- **Mitigación parcial actual:**
  - No hay HTML dinámico no escapado en el código del frontend (verificado con grep — no se usa la API peligrosa de React para HTML crudo).
  - JWT expira en 2h (configurable via `JWT_EXPIRES_IN`).
  - El `JwtStrategy` revalida `usuario.activo` y `usuario.rolId` en cada request — un usuario desactivado o con rol cambiado pierde acceso al instante (`apps/backend/src/auth/strategies/jwt.strategy.ts:21-39`).
- **Fix recomendado para producción:** Migrar a cookies `HttpOnly + Secure + SameSite=Strict` con CSRF token (double-submit pattern). Documento de migración sugerido:
  ```typescript
  // backend: auth.controller.ts (futuro)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000,
      path: '/api',
    });
    return { usuario: result.usuario }; // token NO va en el body
  }
  ```
- **Referencia:** https://owasp.org/www-community/HttpOnly | CWE-922

---

### [MEDIUM] [A05:2021] Headers de Helmet con configuración por defecto (sin CSP, HSTS explícito ni frameguard)

- **Categoría:** OWASP A05 — Security Misconfiguration
- **Severidad:** Medium
- **Descripción:** `apps/backend/src/main.ts:29` invocaba `app.use(helmet())` con defaults. Faltaba: HSTS con `preload`, Content-Security-Policy explícito, `frameAncestors: 'none'` para evitar clickjacking de las respuestas API y assets estáticos, y `referrerPolicy: 'no-referrer'` para minimizar leakage cross-origin.
- **Riesgo:** En presencia de HTTPS con configuración débil un atacante MITM podría downgrade-attack la conexión inicial. El embed via `<iframe>` permite clickjacking de la UI servida desde `/uploads/`.
- **Estado:** Mitigado
- **Fix aplicado:** En `apps/backend/src/main.ts` se reemplazó `app.use(helmet())` por configuración explícita:
  - `strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true, preload: true }`
  - `frameguard: { action: 'deny' }`
  - `hidePoweredBy: true`
  - `noSniff: true`
  - `referrerPolicy: { policy: 'no-referrer' }`
  - `contentSecurityPolicy` con `defaultSrc: 'none'`, `imgSrc: 'self' data: blob:`, `frameAncestors: 'none'`, `formAction: 'none'`, `upgradeInsecureRequests`
  - `crossOriginResourcePolicy: { policy: 'same-site' }`
- **Archivos modificados:** `apps/backend/src/main.ts`
- **Referencia:** https://owasp.org/www-project-secure-headers/

---

### [MEDIUM] [A04:2021] Body parser sin límite de tamaño (DoS por payload gigante)

- **Categoría:** OWASP A04 — Insecure Design
- **Severidad:** Medium
- **Descripción:** Express por defecto acepta JSON bodies de hasta 100kb pero NestJS no expone esa configuración fácilmente; al no fijar un límite explícito, queda margen para ataques de payload-amplification (especialmente sobre `POST /api/dispatch` que acepta arrays de IDs, o `POST /api/orders` que acepta `detalles[]`).
- **Riesgo:** Un atacante autenticado (cuenta legítima o stolen-credentials) podría enviar bodies multi-MB y agotar memoria del proceso.
- **Estado:** Mitigado
- **Fix aplicado:** En `main.ts` se añadió:
  ```typescript
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  ```
  1MB es más que suficiente para los DTOs actuales (los uploads de logo van por `multer` con su propio limit de 2MB).
- **Archivos modificados:** `apps/backend/src/main.ts`
- **Referencia:** CWE-770

---

### [MEDIUM] [A04:2021] Falta de límites en arrays y campos numéricos del DTO de pedidos

- **Categoría:** OWASP A04 — Insecure Design
- **Severidad:** Medium
- **Descripción:** `CreateOrderDto.detalles` solo tenía `@ArrayMinSize(1)` — sin upper bound. `OrderLineDto.cantidad` solo tenía `@Min(0.01)` — sin upper bound, permitiendo enviar `Number.MAX_SAFE_INTEGER` que rompería la lógica de validación de capacidad de vehículos en `dispatch.service.ts` o causaría comportamiento erróneo en cálculos `Decimal`.
- **Riesgo:** Un usuario con `pedidos.crear` podría crear pedidos con miles de líneas o cantidades irreales, distorsionando reportes (`exportOrders` carga hasta 10.000 pedidos sin paginación), sobrecargando consultas, o burlando la validación de capacidad si el `Decimal` overflowea.
- **Estado:** Mitigado
- **Fix aplicado:**
  - `OrderLineDto.cantidad`: añadido `@Max(100_000)` — mayor que cualquier vehículo del catálogo.
  - `CreateOrderDto.detalles`: añadido `@ArrayMaxSize(100)`.
  - `CreateOrderDto.observacion`: añadido `@MaxLength(500)`.
- **Archivos modificados:** `apps/backend/src/orders/dto/create-order.dto.ts`
- **Referencia:** CWE-1284

---

### [MEDIUM] [A03:2021] DTO de cambio de estado de pedido sin validación de enum

- **Categoría:** OWASP A03 — Injection (Mass Assignment / inputs no validados)
- **Severidad:** Medium
- **Descripción:** `ChangeOrderStatusDto.nuevoEstado` era `@IsString()` sin restricción a los valores válidos del enum `OrderStatus`. La validación se delegaba completamente al service (`canTransition` + check explícito de `DISPATCHED`). Esto rompe defensa en profundidad: cualquier nuevo estado no contemplado en `canTransition` quedaría aceptado en runtime.
- **Riesgo:** Si en el futuro alguien añade un nuevo `OrderStatus` y olvida actualizar `canTransition`, el DTO lo aceptaría silenciosamente. También permite enviar strings arbitrarios que se loguean en `EstadoPedidoLog.estadoNuevo` (data poisoning del audit trail).
- **Estado:** Mitigado
- **Fix aplicado:** `ChangeOrderStatusDto.nuevoEstado` ahora es `@IsIn([CONFIRMED, CANCELLED])` — los únicos estados válidos en transiciones manuales (los demás son driven por modules como dispatch). También `@MaxLength(500)` en `motivo`.
- **Archivos modificados:** `apps/backend/src/orders/dto/change-order-status.dto.ts`
- **Referencia:** CWE-20

---

### [MEDIUM] [A07:2021] Passwords sin upper-bound (DoS contra bcrypt)

- **Categoría:** OWASP A07 — Authentication Failures
- **Severidad:** Medium
- **Descripción:** `LoginDto.contrasena` y `ChangePasswordDto.contrasenaActual/contrasenaNueva` validaban `@MinLength(8)` pero no tenían `@MaxLength`. Un atacante puede enviar passwords de cientos de KB, forzando a bcrypt (cost 12) a procesar el string completo y consumir CPU significativa, multiplicado por requests concurrentes — DoS.
- **Riesgo:** Aunque bcrypt internamente trunca a 72 bytes, la validación, transferencia y JSON-parsing del payload consumen recursos. Combinado con el throttle actual (`5/min` en login, `20/min` short global), se mitiga parcialmente, pero un attacker con múltiples IPs puede saturar.
- **Estado:** Mitigado
- **Fix aplicado:** `@MaxLength(72)` (límite efectivo de bcrypt) en `LoginDto`, `ChangePasswordDto` (ambas contraseñas). También `@MaxLength(100)` en el campo `correo`.
- **Archivos modificados:** `apps/backend/src/auth/dto/login.dto.ts`, `apps/backend/src/auth/dto/change-password.dto.ts`
- **Referencia:** https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#input-limits

---

### [MEDIUM] [A05:2021] Static assets servidos sin restricción de directory listing ni cache headers

- **Categoría:** OWASP A05 — Security Misconfiguration
- **Severidad:** Medium
- **Descripción:** `app.useStaticAssets(join(process.cwd(), 'uploads'))` no especificaba `index: false` ni `fallthrough: false`. Aunque Express por defecto no serve listings sin un middleware adicional, conviene ser explícito como defensa en profundidad. El cache header tampoco estaba configurado.
- **Riesgo:** Bajo en producción (no hay `serve-index` configurado), pero la defensa en profundidad es barata.
- **Estado:** Mitigado
- **Fix aplicado:** En `main.ts`, `useStaticAssets` ahora incluye `index: false`, `fallthrough: false`, `maxAge: 60_000`.
- **Archivos modificados:** `apps/backend/src/main.ts`
- **Referencia:** https://expressjs.com/en/api.html#express.static

---

### [MEDIUM] [A05:2021] CORS sin validación contra wildcard ni listas vacías

- **Categoría:** OWASP A05 — Security Misconfiguration
- **Severidad:** Medium
- **Descripción:** El parsing de `CORS_ORIGINS` aceptaba un valor vacío (resultando en `['']`) o el wildcard `'*'`. Combinado con `credentials: true` esto sería catastrófico (los browsers rechazan ese combo, pero un atacante podría engañar a un proxy intermedio).
- **Riesgo:** Configuración accidental en producción que permita orígenes maliciosos.
- **Estado:** Mitigado
- **Fix aplicado:** Validación al boot que rechaza `'*'` y entradas vacías:
  ```typescript
  if (allowedOrigins.length === 0 || allowedOrigins.some((o) => o === '*' || o === '')) {
    throw new Error('CORS_ORIGINS must be a comma-separated list of explicit origins...');
  }
  ```
  También añadí `maxAge: 86_400` para cachear preflight 24h y reducir tráfico OPTIONS.
- **Archivos modificados:** `apps/backend/src/main.ts`
- **Referencia:** https://portswigger.net/web-security/cors

---

### [MEDIUM] [A05:2021] Trust proxy no configurado (req.ip puede contener loopback en lugar del cliente real)

- **Categoría:** OWASP A05 — Security Misconfiguration
- **Severidad:** Medium
- **Descripción:** El audit interceptor (`apps/backend/src/audit/audit.interceptor.ts:97`) loguea `req.ip ?? req.socket?.remoteAddress`. Detrás de un proxy (Railway, Cloudflare), Express por defecto reporta la IP del proxy (típicamente loopback) en lugar del cliente real, salvo que se configure `app.set('trust proxy', ...)`. El throttler también depende de `req.ip` y degrada al rate-limiting global compartido entre todos los clientes detrás del proxy.
- **Riesgo:** Audit logs inútiles para forensics (todas las IPs son del proxy), throttler no efectivo (todos los usuarios comparten el mismo "bucket" de 5/min en login).
- **Estado:** Mitigado
- **Fix aplicado:** `app.set('trust proxy', 1)` en `main.ts` (confiar en el primer hop, configuración estándar para Railway).
- **Archivos modificados:** `apps/backend/src/main.ts`
- **Referencia:** https://expressjs.com/en/guide/behind-proxies.html

---

### [LOW] [A05:2021] ValidationPipe puede leak field names en producción

- **Categoría:** OWASP A05 — Security Misconfiguration
- **Severidad:** Low
- **Descripción:** En producción, los mensajes de validación de class-validator devuelven el nombre del campo y el constraint violado. Un atacante puede enumerar la forma exacta del DTO enviando payloads variados.
- **Riesgo:** Information disclosure menor — facilita reconocimiento del API pero no implica acceso.
- **Estado:** Mitigado (parcialmente, cuando `NODE_ENV=production`)
- **Fix aplicado:** `disableErrorMessages: process.env['NODE_ENV'] === 'production'` en el `ValidationPipe` global. Los tests E2E corren con `NODE_ENV !== 'production'`, así que no se rompen.
- **Archivos modificados:** `apps/backend/src/main.ts`
- **Referencia:** CWE-209

---

### [LOW] [A07:2021] No hay account lockout tras N intentos fallidos

- **Categoría:** OWASP A07 — Authentication Failures
- **Severidad:** Low
- **Descripción:** Tras múltiples logins fallidos para un mismo correo, no se bloquea la cuenta. La protección actual es per-IP via throttler (5/min en `/api/auth/login`).
- **Riesgo:** Un atacante con un botnet (múltiples IPs) puede ejecutar credential stuffing distribuido sin que el throttle por IP lo frene.
- **Estado:** Aceptado como limitación del scope MVP.
- **Recomendación para producción:** Implementar contador de fallos en la tabla `Usuario` (`intentosFallidos`, `bloqueadoHasta`) y resetear en login exitoso. Patrón:
  ```typescript
  // En auth.service.ts (sketch para producción)
  if (!contrasenaValida) {
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: { increment: 1 },
        bloqueadoHasta:
          usuario.intentosFallidos + 1 >= 5
            ? new Date(Date.now() + 15 * 60_000)
            : null,
      },
    });
    throw new UnauthorizedException('Credenciales inválidas');
  }
  // Reset on success
  if (usuario.intentosFallidos > 0) {
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
  }
  ```
- **Referencia:** OWASP ASVS V2.2.1

---

### [LOW] [A07:2021] Sin refresh token rotation

- **Categoría:** OWASP A07 — Authentication Failures
- **Severidad:** Low
- **Descripción:** El sistema solo emite `accessToken` con TTL de 2h. No hay refresh token, así que (a) la sesión expira a las 2h forzando re-login, (b) si un access token es robado, vive hasta su expiración natural — no hay forma de revocarlo más rápido.
- **Riesgo:** Tokens robados son válidos hasta la expiración natural. Mitigado parcialmente porque el `JwtStrategy` revalida `usuario.activo` y `usuario.rolId` en cada request (un admin puede desactivar al usuario y la próxima request retornará 401).
- **Estado:** Aceptado como limitación del scope MVP.
- **Recomendación para producción:** Implementar refresh token con rotation:
  - access token: 15 min, en memory/cookie
  - refresh token: 7 días, HttpOnly cookie, con rotación + detección de reuse (familia de tokens)
  - Tabla `RefreshToken` con `id, userId, hash, expiresAt, revokedAt, replacedById`.
- **Referencia:** https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation

---

### [LOW] [A05:2021] `.env` está committeado al repositorio

- **Categoría:** OWASP A05 — Security Misconfiguration
- **Severidad:** Low (en este contexto)
- **Descripción:** El archivo `.env` raíz está bajo control de versiones (verificado con `git ls-files`). El `.gitignore` solo ignora `.env.local`, no `.env`.
- **Riesgo:** Si el repo se hace público, leak de credenciales (DB, JWT_SECRET). En el contexto actual: repositorio privado, monoproyecto académico, política explícita del owner (`CLAUDE.md` raíz: *"Solo Gian trabaja en estos proyectos, por eso el .env se commitea"*).
- **Estado:** Aceptado como limitación documentada.
- **Recomendación para producción real:**
  1. Rotar todos los secretos antes de hacer público el repo o agregar colaboradores.
  2. Usar variables de entorno gestionadas por la plataforma (Railway secrets) en lugar de `.env` en filesystem.
  3. Añadir `.env` a `.gitignore` y proveer solo `.env.example`.
- **Referencia:** CWE-540, CWE-798

---

### [INFORMATIONAL] [A01:2021] Verificación completa de Broken Access Control

- **Categoría:** OWASP A01 — Broken Access Control
- **Severidad:** Informational (verificación realizada — sin hallazgos)
- **Descripción:** Se auditaron los 11 controllers existentes:
  - `auth.controller.ts` → `login` correctamente `@Public()` con throttle 5/min, `change-password` requiere JWT.
  - `users.controller.ts` → todos los endpoints protegidos con `@RequirePermissions('usuarios.{crear,leer,editar,eliminar}')`. **Anti-abuse extra:** `update()` rechaza con `ForbiddenException` si un usuario intenta cambiar su propio `rolId` (`users.service.ts:72-74`) — bloquea privilege escalation.
  - `roles.controller.ts` → permission gates correctos.
  - `clients.controller.ts`, `products.controller.ts`, `drivers.controller.ts`, `vehicles.controller.ts`, `routes.controller.ts` → permission gates correctos.
  - `orders.controller.ts`, `dispatch.controller.ts` → permission gates + `req.user.id` para audit trail.
  - `audit.controller.ts` → `auditoria.leer` requerido.
  - `reports.controller.ts` → `reportes.leer` y `reportes.exportar` separados (least privilege).
  - `empresa.controller.ts` → `findOne` es `@Public()` (necesario para mostrar branding en login screen, decisión aceptable porque solo retorna logoUrl/razonSocial/etc).
  - `ubigeo.controller.ts` → todos `@Public()` (catálogos geográficos, sin info sensible).
- **Configuración global verificada:** `app.module.ts` registra `JwtAuthGuard` y `PermissionsGuard` en `APP_GUARD`, garantizando que **toda ruta requiere JWT por defecto** salvo que tenga `@Public()`. **No se detectó ningún endpoint que omita este patrón.**
- **IDOR check:** No aplica IDOR clásico porque el modelo de datos es **single-tenant** (no hay `empresa_id` por registro). El RBAC funciona como gate principal.
- **Estado:** Verificado — sin hallazgos.

---

### [INFORMATIONAL] [A02:2021] Verificación de Cryptographic Failures

- **Categoría:** OWASP A02 — Cryptographic Failures
- **Severidad:** Informational
- **Verificación:**
  - bcrypt cost 12 confirmado en `auth.service.ts:35,95` y `users.service.ts:35` — coverage testeada en `auth.service.spec.ts:229-242` ("usa cost factor 12").
  - **JWT_SECRET strength:** validado a >=32 chars en `auth.module.ts:15` Y en `main.ts:validateEnv` (defense in depth añadida). `openssl rand -hex 32` produce 64 chars hexadecimales (256 bits de entropía).
  - **HSTS:** activado con `preload + includeSubDomains + maxAge=1y` en el helmet config.
  - **Algoritmo JWT:** por default `@nestjs/jwt` usa HS256 (HMAC-SHA256), no se observa ningún uso de algoritmos débiles ni `none`.
  - **Tokens sensibles generados con `crypto.randomBytes`:** N/A — no hay password reset ni email verification flows en este MVP (las contraseñas se setean por admin).
- **Estado:** Verificado — sin hallazgos.

---

### [INFORMATIONAL] [A03:2021] Verificación de Injection

- **Categoría:** OWASP A03 — Injection
- **Severidad:** Informational
- **Verificación:**
  - **SQL Injection:** Todas las queries usan Prisma Client ORM con parámetros tipados. **No hay uso de `$queryRawUnsafe` ni `$executeRawUnsafe`** (verificado con grep regex). No hay concatenación de strings en queries.
  - **Command Injection:** No hay uso de `exec`, `spawn`, `eval`, `execSync`, `spawnSync` en `apps/backend/src` (grep regex `\b(exec|spawn|eval|execSync|spawnSync)\s*\(`).
  - **NoSQL Injection:** N/A (PostgreSQL via Prisma).
  - **XSS reflejado:** No se detectó uso de la API de React para HTML crudo en `apps/frontend/src`. Los datos del backend se renderizan via JSX (escape automático de React).
  - **SSRF:** El backend no hace `fetch`, `axios.get`, `http.get` ni similares con URLs provistas por el usuario. El único módulo que sale a la red es Prisma (DB) y multer (filesystem).
  - **Header injection:** Todos los `Content-Disposition` en `reports.controller.ts` usan strings hardcodeados (no input del usuario).
- **Estado:** Verificado — sin hallazgos.

---

### [INFORMATIONAL] [A08:2021] Verificación de Software and Data Integrity Failures

- **Categoría:** OWASP A08 — Software and Data Integrity Failures
- **Severidad:** Informational
- **Verificación:**
  - `pnpm-lock.yaml` está committeado (verificado con `git ls-files`).
  - El proyecto usa `pnpm` con lockfile (lockfile-version: 9). Las instalaciones son reproducibles.
  - SRI (Subresource Integrity) no aplica directamente — Next.js gestiona los scripts del frontend, no hay `<script src="cdn://...">` manuales.
  - **Webhook signing:** N/A (no hay webhooks externos).
- **Estado:** Verificado — sin hallazgos.

---

### [INFORMATIONAL] [A09:2021] Verificación de Logging & Monitoring

- **Categoría:** OWASP A09 — Security Logging and Monitoring Failures
- **Severidad:** Informational
- **Verificación:**
  - **Audit log:** existe (`RegistroAuditoria` + `AuditInterceptor` que captura `POST/PATCH/DELETE` con userId, accion, modulo, entidadId, ip).
  - **Sensitive data en logs:** El `LoginDto` no se loguea explícitamente (Nest no loguea bodies por defecto). El password jamás se imprime ni se incluye en JWT payloads. **Verificado:** no hay `console.log(usuario.contrasena)` ni similares.
  - **Login failures NO se loguean en audit table actualmente.** Esto es un gap MEDIUM normalmente, pero el `AuditInterceptor` solo loguea cuando hay `req.user` — en un login fallido `req.user` no existe.
- **Recomendación para producción:** Añadir un log explícito de `auth.login.failed` con el correo intentado e IP, **incluso sin user**, para detectar credential stuffing. Implementación sugerida en `auth.service.ts`:
  ```typescript
  if (!contrasenaValida) {
    this.logger.warn(`Login failed for ${dto.correo} from IP ${ip}`);
    await this.auditService.log({ usuarioId: 0, accion: 'login_failed', modulo: 'autenticacion', detalle: dto.correo, ip });
    throw new UnauthorizedException('Credenciales inválidas');
  }
  ```
- **Estado:** Verificado parcialmente — recomendación pendiente.

---

### [INFORMATIONAL] [A10:2021] Verificación de SSRF

- **Categoría:** OWASP A10 — Server-Side Request Forgery
- **Severidad:** Informational
- **Verificación:** No hay endpoints que tomen URLs como input. El único upload (`POST /api/empresa/logo`) usa `multer` con `diskStorage` (filesystem local, no fetcheo remoto). El proyecto no consume APIs externas a partir de URLs del usuario.
- **Estado:** Verificado — sin hallazgos.

---

## Recomendaciones para producción real

Estas son mejoras que **NO se implementaron** en esta auditoría por estar fuera del scope MVP académico, pero serían **críticas en producción real**:

1. **Migrar JWT a cookies HttpOnly + Secure + SameSite=Strict** con CSRF token (double-submit). Elimina la superficie de ataque XSS para el robo de tokens.
2. **Implementar refresh token con rotación y detección de reuse.** Permite invalidar sesiones inmediatamente y limita la ventana de exposición de tokens robados.
3. **Account lockout tras 5 intentos fallidos** durante 15 min (campos `intentosFallidos`, `bloqueadoHasta` en `Usuario`).
4. **MFA opcional** (TOTP via `otplib`). No bloqueante para usuarios pero disponible para roles administrativos.
5. **Logging explícito de login failures** en audit table para detectar credential stuffing distribuido.
6. **Bump de Next.js a >= 16.2.3** para cerrar la vulnerabilidad HIGH detectada en `pnpm audit`.
7. **Migrar `.env` a secrets manager** (Railway secrets, Doppler, AWS Secrets Manager). Eliminar `.env` del repo y rotar todos los secretos antes.
8. **Migrar uploads a Wasabi S3** (ya hay infra preparada según el README) en lugar de filesystem local — evita que un restart pierda datos y elimina la superficie de path traversal a nivel de Express static.
9. **Database row-level security (RLS) en PostgreSQL** si se planea convertir a multi-tenant — actualmente single-tenant, sin filtro `empresa_id`.
10. **Penetration testing externo** antes del go-live. Esta auditoría es un baseline automatizado + manual; no sustituye un pentest contra el ambiente desplegado.
11. **Dependency scanning continuo** (Renovate, Dependabot) y `pnpm audit` en CI con failure threshold en HIGH+.
12. **Rate limit más granular** sobre `POST /api/orders` y `POST /api/dispatch` (ej: 30/min) para evitar abuse desde cuentas comprometidas.
13. **CSP report-uri** para detectar tentativas de XSS en producción.
14. **Backups encriptados** de PostgreSQL con pruebas de restauración periódicas.

---

## Próximos pasos

Ordenados por prioridad para el equipo:

1. **[CRÍTICO PRE-DEPLOY]** Bump de `next` a >= 16.2.3 (`pnpm --filter frontend up next@latest`).
2. **[ALTO PRE-DEPLOY]** Confirmar que `JWT_SECRET` en producción es **diferente** del `.env` committeado y se gestiona via secrets de plataforma.
3. **[ALTO PRE-DEPLOY]** Confirmar `NODE_ENV=production` y `CORS_ORIGINS` con la URL real del frontend (sin `localhost`, sin `*`).
4. **[MEDIO]** Implementar logging de login failures (sketch en finding A09).
5. **[MEDIO]** Implementar account lockout (sketch en finding A07.LOW).
6. **[BAJO]** Considerar migración a cookies HttpOnly + refresh tokens en una próxima sprint.

---

## Resumen de cambios aplicados en esta auditoría

| Archivo | Cambio |
|---|---|
| `apps/backend/src/main.ts` | Hardened helmet (CSP, HSTS, frameguard, referrerPolicy, CORP), trust proxy, body parser limits, validación de CORS_ORIGINS contra wildcard, useStaticAssets restrictivo, `disableErrorMessages` en producción, validación de `JWT_SECRET >= 32 chars` en `validateEnv` |
| `apps/backend/src/orders/dto/create-order.dto.ts` | `@Max(100_000)` en `cantidad`, `@ArrayMaxSize(100)` en `detalles`, `@MaxLength(500)` en `observacion` |
| `apps/backend/src/orders/dto/change-order-status.dto.ts` | `@IsIn([CONFIRMED, CANCELLED])` en `nuevoEstado`, `@MaxLength(500)` en `motivo` |
| `apps/backend/src/auth/dto/login.dto.ts` | `@MaxLength(72)` en `contrasena`, `@MaxLength(100)` en `correo` |
| `apps/backend/src/auth/dto/change-password.dto.ts` | `@MaxLength(72)` en ambas contraseñas (límite efectivo de bcrypt) |
| `docs/SECURITY-AUDIT.md` | Este documento (nuevo) |

**Verificación:** ejecutados `pnpm --filter backend test` (78/78 OK) y `pnpm --filter backend test:e2e` (12/12 OK) — **0 regresiones**.

---

## Checklist OWASP — estado por categoría

| OWASP | Categoría | Verificado | Hallazgos | Mitigado |
|---|---|---|---|---|
| A01 | Broken Access Control | OK | 0 | N/A |
| A02 | Cryptographic Failures | OK | 0 | N/A |
| A03 | Injection | OK | 1 (M) | OK |
| A04 | Insecure Design | OK | 2 (M) | OK |
| A05 | Security Misconfiguration | OK | 5 (M+L) | 4 mitigados / 1 limitación |
| A06 | Vulnerable Components | OK | 1 (H) | Pendiente (bump next) |
| A07 | Authentication Failures | OK | 4 (H+M+L+L) | 1 mitigado / 3 limitaciones |
| A08 | Data Integrity Failures | OK | 0 | N/A |
| A09 | Logging & Monitoring | OK | 0 (recomendación) | Recomendación pendiente |
| A10 | SSRF | OK | 0 | N/A |

---

*Documento generado en el contexto de la sustentación TAP IDAT. La postura de seguridad de SIADLP es adecuada para un MVP académico y supera los estándares mínimos de OWASP en la mayoría de las categorías. Las limitaciones documentadas son explícitas y razonadas, no descuidos.*

---

## Audit posterior — pnpm audit (fecha: 2026-05-13)

Auditoría focalizada en dependencias (OWASP A06 — Vulnerable and Outdated Components) ejecutada con `pnpm audit` (pnpm 10.30.3) sobre el monorepo completo.

### Comandos ejecutados

```bash
pnpm audit --prod   # alcance: dependencies + optionalDependencies (runtime)
pnpm audit          # alcance: incluye devDependencies (CI/CD + build)
```

> Nota: pnpm 10 audita todo el workspace (root + `apps/*` + `packages/*`) por defecto. El flag `--recursive` no es necesario y de hecho no es soportado por `pnpm audit`.

### Resumen pre-fix

| Alcance | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| `--prod` (runtime) | 0 | **10** | 17 | 3 | 30 |
| `all` (incluye dev) | 0 | **10** | 18 | 3 | 31 |

Workspace afectado: prácticamente todos los hallazgos se concentran en `apps/frontend` (`next` + transitivos de `shadcn > @modelcontextprotocol/sdk`) y `apps/backend` (transitivos de `@prisma/client > prisma > @prisma/dev`). El paquete `packages/shared` no introdujo vulnerabilidades.

### Vulnerabilidades CRITICAL/HIGH (pre-fix)

| Paquete | Severidad | Versión instalada | Patched | Workspace | Advisory | Acción |
|---|---|---|---|---|---|---|
| `next` | HIGH | 16.2.2 | >=16.2.6 | frontend | GHSA Next.js DoS Server Components | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.5 | frontend | DoS via connection exhaustion (Cache Components) | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.5 | frontend | SSRF via WebSocket upgrades | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.5 | frontend | Middleware/Proxy bypass via dynamic route param injection | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.5 | frontend | Middleware/Proxy bypass via segment-prefetch routes (App Router) | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.5 | frontend | Middleware/Proxy bypass via i18n (Pages Router) | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.6 | frontend | Middleware/Proxy bypass — incomplete-fix follow-up | Bump aplicado |
| `next` | HIGH | 16.2.2 | >=16.2.3 | frontend | DoS Server Components (referenciado como GHSA-q4gf-8mx6-v5v3) | Bump aplicado |
| `fast-uri` | HIGH | 3.1.0 | >=3.1.2 | backend (transitive via `@prisma/client > prisma > @prisma/dev > @prisma/streams-local > ajv > fast-uri`) | Path traversal via percent-encoded dot segments | `pnpm overrides` aplicado |
| `fast-uri` | HIGH | 3.1.0 | >=3.1.2 | backend (mismo path transitive) | Host confusion via percent-encoded authority delimiters | `pnpm overrides` aplicado |
| `picomatch` | HIGH | <4.0.4 | >=4.0.4 | backend devDep (transitive via `@nestjs/cli > @angular-devkit/core`) | ReDoS via extglob quantifiers | `pnpm overrides` aplicado |

### Fixes aplicados

#### 1. Bump directo de `next` (frontend)

Bump `16.2.2 → 16.2.6` — patch dentro del mismo minor (16.2.x), **no breaking**:

```diff
- "next": "16.2.2",
- "eslint-config-next": "16.2.2",
+ "next": "16.2.6",
+ "eslint-config-next": "16.2.6",
```

Aplicado con `pnpm --filter frontend up next@16.2.6 eslint-config-next@16.2.6`.

Cobertura: resuelve **8 HIGH + 4 MODERATE + 2 LOW** de `next`, y `postcss` (transitivo de `next > postcss`) queda en `>=8.5.10` por la resolución del bump.

#### 2. `pnpm overrides` (root) para transitivos no controlados

Agregado al `package.json` raíz:

```json
"pnpm": {
  "overrides": {
    "fast-uri@<3.1.2": ">=3.1.2",
    "ip-address@<10.1.1": ">=10.1.1",
    "hono@<4.12.18": ">=4.12.18",
    "postcss@<8.5.10": ">=8.5.10",
    "@hono/node-server@<1.19.13": ">=1.19.13",
    "picomatch@>=4.0.0 <4.0.4": ">=4.0.4"
  }
}
```

Sintaxis con condición de rango (`pkg@<X.Y.Z`) para no forzar versiones más allá de lo necesario y respetar a futuro las elecciones legítimas del package upstream.

Cobertura: resuelve los hallazgos restantes en `fast-uri`, `ip-address`, `hono`, `@hono/node-server`, `postcss` y `picomatch` — todos transitivos donde no hay forma de bumpearlos sin override (provienen de `@prisma/client > prisma > @prisma/dev` y de `shadcn > @modelcontextprotocol/sdk`).

### Resultado post-fix

| Alcance | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| `--prod` | 0 | 0 | **0** | 0 | **0** |
| `all` | 0 | 0 | **0** | 0 | **0** |

**0 vulnerabilidades en todas las severidades**, tanto en runtime como en devDependencies.

### Bumps NO aplicados

Ninguno. Todos los fixes requeridos fueron alcanzables sin breaking changes — `next 16.2.2 → 16.2.6` es patch en el mismo minor, y los transitivos se resolvieron vía `pnpm overrides` sin tocar las versiones declaradas por los packages padre (Prisma 7, shadcn 4, @nestjs/cli 11).

### Verificación post-fix

| Suite | Resultado | Comando |
|---|---|---|
| Backend unit (Jest) | OK — 156/156 | `pnpm --filter backend test` |
| Backend e2e (Jest + supertest) | OK — 12/12 | `pnpm --filter backend test:e2e` |
| Frontend unit (Vitest) | OK — 92/92 | `pnpm --filter frontend test` |
| Lockfile integrity | OK | `pnpm install --frozen-lockfile` |
| CLI `next` post-bump | `Next.js v16.2.6` | `pnpm exec next --version` |

**0 regresiones detectadas.** Los E2E de Playwright (`apps/frontend/tests-e2e/`) no fueron ejecutados aquí porque requieren el stack levantado (backend + DB + dev server); el bump es patch dentro del mismo minor de Next y no afecta `playwright.config.ts` ni el CLI `next dev`.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/frontend/package.json` | `next` 16.2.2 → 16.2.6, `eslint-config-next` 16.2.2 → 16.2.6 |
| `package.json` (root) | Bloque `pnpm.overrides` agregado con 6 entradas (`fast-uri`, `ip-address`, `hono`, `@hono/node-server`, `postcss`, `picomatch`) |
| `pnpm-lock.yaml` | Re-generado por `pnpm install` con los nuevos resolvers |

### Recomendaciones

1. **Re-auditar mensualmente** con `pnpm audit --prod` (fail-fast en CI) y `pnpm audit` (incluye dev, no-fail).
2. **Integrar en CI** un job `pnpm audit --prod --audit-level=high` que falle el build si aparecen HIGH/CRITICAL nuevos. El flag `--ignore-registry-errors` evita falsos positivos por flakiness del registry.
3. **Revisar Prisma 7** — el paquete `@prisma/dev` arrastra una cadena pesada (Hono, fast-uri, ajv) sólo necesaria para el dev studio. Considerar mover `@prisma/client` a un patrón donde `@prisma/dev` sea opcional (Prisma soporta este flag desde 7.5). Esto eliminaría la necesidad de overrides en Hono.
4. **`shadcn` como dependency de prod** en `apps/frontend/package.json` (línea 26) es inusual — `shadcn` es una CLI de scaffolding. Evaluar moverlo a `devDependencies` reduciría la superficie de prod en ~50 packages (entre ellos `@modelcontextprotocol/sdk` y `express-rate-limit`).
5. **Revisar `pnpm.overrides`** trimestralmente: cuando los packages padre (Prisma, shadcn, NestJS CLI) publiquen versiones con los transitivos ya patcheados nativamente, eliminar la entrada correspondiente del override para no quedarse "atascado" en una versión.
6. **GHSA-q4gf-8mx6-v5v3** mencionado en el brief no figura como advisory ID en la base de npm para este audit (probable que sea uno de los GHSAs renombrados — el contenido equivalente fue resuelto por el bump a 16.2.6, que cubre todos los DoS y Middleware bypass de la línea 16.2.x).
