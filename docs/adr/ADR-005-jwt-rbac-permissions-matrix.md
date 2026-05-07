# ADR-005: Autenticación JWT stateless + RBAC con permissions matrix

## Status

Accepted

## Context

SIADLP es un sistema multi-rol con cuatro perfiles típicos:

- **Administrador:** acceso completo, gestión de usuarios y catálogos maestros.
- **Supervisor:** opera despacho, hojas de carga, reportes; no toca usuarios ni catálogos críticos.
- **Chofer:** registra entregas en ruta desde un dispositivo móvil; lectura limitada del resto.
- **Vendedor:** crea pedidos para clientes asignados; no ve despacho ni reportes financieros.

La autorización debe ser **granular** (no basta con "es admin / no es admin": un supervisor puede confirmar pedidos pero no eliminarlos) y **auditable** (se debe poder responder "¿quién puede hacer X?" mirando la base, no el código).

El backend NestJS expone una API REST consumida por un frontend SPA Next.js. Cada request del frontend lleva un token de autenticación; el backend debe validarlo en milisegundos y resolver las acciones permitidas para ese usuario. El sistema corre en Railway con réplicas potencialmente escalables horizontalmente, así que la solución de autenticación no puede depender de estado en memoria de un proceso específico ni de un store local.

## Decision

Usar **JWT stateless** para autenticación y un modelo **RBAC con matriz de permisos** para autorización.

**Auth (JWT):**

- Login emite un JWT firmado con `HS256` (secret en env, jamás commiteado) con expiry de **1 hora**.
- El payload contiene `sub` (userId), `rol`, `permisos[]` (lista de strings `modulo.accion` resueltos en login).
- Cada request a endpoints protegidos pasa por `JwtAuthGuard` (NestJS) que valida firma y expiry.
- Sin sesiones server-side, sin store compartido. La validación es CPU-only.

**Autz (RBAC matriz):**

Cuatro tablas: `Rol`, `Permiso(modulo, accion)`, `RolPermiso(rolId, permisoId)`, `Usuario(rolId)`. Un permiso es un par `(modulo, accion)`, ej: `pedidos.crear`, `despacho.iniciar_ruta`, `usuarios.eliminar`. Un guard `PermisosGuard` lee el decorator `@RequierePermisos('pedidos.crear')` del handler y verifica que el JWT contenga ese string en `permisos[]`.

**Hardening implementado:**

- Hash de contraseñas con **bcrypt cost 12** (recomendación OWASP 2024 para hardware moderno).
- Mensaje genérico **"Credenciales inválidas"** tanto en usuario inexistente como en password incorrecto (anti user-enumeration).
- **Rate limit de 5 intentos por minuto** en el endpoint de login (`@nestjs/throttler`).
- `ValidationPipe` global con `whitelist: true, forbidNonWhitelisted: true` (rechaza payloads con campos extra).
- `helmet` para headers de seguridad por defecto.

## Implementation notes

- El `JwtAuthGuard` extiende `AuthGuard('jwt')` de `@nestjs/passport` y se aplica globalmente con `APP_GUARD`. Endpoints públicos se marcan con un decorator `@Public()` que el guard inspecciona vía `Reflector`.
- El `PermisosGuard` lee la metadata del decorator `@RequierePermisos('modulo.accion')` y compara contra el array `permisos` del JWT decodificado.
- Login resuelve los permisos del rol del usuario (`SELECT ... FROM rol_permisos JOIN permisos`) **una vez** y los embebe en el JWT — no hay query de permisos por request.
- El frontend persiste el JWT en `localStorage` (decisión consciente: el backend no usa cookies). El store Zustand expone `permisos` para renderizar UI condicional.
- Logout es client-side (borrar el token); el servidor no mantiene estado, así que no hay endpoint de logout que revoque nada.

## Consequences

### Positive

- **Stateless real:** cualquier réplica valida cualquier token sin DB lookup ni store compartido. Escala horizontal trivial.
- **Granularidad alta:** se pueden agregar permisos nuevos (`reportes.exportar_excel`, `pedidos.cancelar`) sin tocar código de guards — solo el handler que los requiere.
- **Auditable:** la pregunta "¿qué puede hacer el rol Supervisor?" se responde con un `SELECT` sobre `rol_permisos JOIN permisos`. La autorización es un dato, no código.
- **Extensible:** un permiso nuevo se inserta vía seed/migration; el guard funciona sin redeploy si se sigue la convención `modulo.accion`.
- **Performance:** validar un JWT son microsegundos; consultar permisos en cada request sería un round-trip a DB innecesario por cada hit.
- **Compatible con el frontend:** el JWT viaja en `Authorization: Bearer <token>` y el frontend lo persiste en Zustand para reconstruir UI condicional (mostrar/ocultar acciones según `permisos`).
- **Trazabilidad:** combinado con `RegistroAuditoria`, queda registro de qué usuario hizo qué acción en qué módulo con qué IP — coherente con la matriz de permisos.

### Negative

- **Revocación antes de expiry:** si un usuario es deshabilitado, su JWT sigue válido hasta que expire (máximo 1h). Un token blacklist en Redis lo resolvería pero está fuera del scope MVP.
- **Tamaño del JWT:** la lista `permisos[]` viaja en cada request; en roles con muchos permisos el header crece. Mitigado porque los roles del sistema tienen <30 permisos cada uno.
- **Cambio de permisos requiere re-login:** si a un rol se le agrega un permiso, los usuarios con sesión activa deben re-loguearse para verlo (consecuencia esperada del modelo stateless).
- **Secret rotation:** rotar el JWT secret invalida todas las sesiones simultáneamente. Se asume rotación poco frecuente y manual.

## Alternatives considered

- **Sesiones server-side con cookie + session store:** escalable solo si se monta Redis o equivalente compartido entre réplicas. Para un MVP en Railway con 1–2 réplicas es overkill.
- **OAuth2 con provider externo (Auth0, Clerk, Supabase Auth):** excelente para sistemas con login social o B2B, sobreingeniería para auth interna corporativa con cuatro roles.
- **ABAC (Attribute-Based Access Control):** modelo más expresivo (políticas con atributos del usuario, recurso y entorno), pero la complejidad de implementar un evaluador de policies (estilo OPA) no se justifica para el tamaño del dominio.
- **RBAC plano sin matriz (solo roles, sin permisos granulares):** simple pero rígido. Cada vez que un rol necesita una acción nueva hay que tocar código del guard. La matriz es marginalmente más compleja y radicalmente más flexible.
- **JWE (JWT cifrado) en lugar de JWT firmado:** el payload contendría datos sensibles cifrados. No agrega valor aquí porque el payload no contiene PII; solo userId, rol y permisos (que el cliente legítimamente puede ver para renderizar UI condicional).

## References

- RFC 7519 — JSON Web Token — https://datatracker.ietf.org/doc/html/rfc7519
- OWASP Password Storage Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Authentication Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- NestJS Authentication — https://docs.nestjs.com/security/authentication
- NIST SP 800-162 — Guide to Attribute Based Access Control (ABAC) — https://csrc.nist.gov/pubs/sp/800/162/final
- Schema relevante — `Usuario`, `Rol`, `Permiso`, `RolPermiso` en `apps/backend/prisma/schema.prisma`
