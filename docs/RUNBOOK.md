# Runbook — SIADLP

> Manual operacional de respuesta a incidentes en producción.
> Cliente: **La Cosecha S.A.C.** · Stack: NestJS 11 + Next.js 16 + PostgreSQL + Prisma · Hosting: Railway.app

---

## Cómo usar este documento

1. **Identificá el síntoma** en la sección 2 (mapa rápido). Si el síntoma exacto no está, andá al más parecido.
2. **Seguí el procedimiento** documentado paso a paso. No saltees verificaciones.
3. **Escalá** si no se resuelve en el tiempo indicado por la severidad (sección 1).
4. **Postmortem obligatorio** en `docs/postmortems/<fecha>-<slug>.md` si el incidente fue user-facing por más de 5 minutos. Plantilla en sección 5.

> Regla de oro: ante la duda, **mitigar primero, diagnosticar después**. El usuario no espera; los logs sí.

---

## 1. Información de contacto y escalación

### 1.1 Niveles de escalación

| Nivel | Rol | SLA de ack | Cuándo se involucra |
|------|------|-----------|----------------------|
| **L1** | On-call developer | 15 min | Primer respondedor — sigue runbook |
| **L2** | Tech Lead (Gianpierre) | 30 min | L1 no resuelve, o requiere cambio de config / código |
| **L3** | CTO / Owner | 1 h | >50% usuarios afectados, downtime > 1 h, posible breach de seguridad |

### 1.2 Severidades

| Sev | Definición | Acción |
|-----|------------|--------|
| **SEV1** | Sistema completamente caído / login imposible / pérdida de datos | Despertar a L1 + L2, comunicación inmediata al cliente |
| **SEV2** | Funcionalidad crítica rota (pedidos, despacho), >25% usuarios afectados | L1 atiende, L2 en standby |
| **SEV3** | Funcionalidad no crítica rota, workaround disponible | L1 horario hábil |
| **SEV4** | Cosmético / latencia degradada sin impacto funcional | Backlog |

### 1.3 Contactos

> **TODO**: completar con contactos reales antes del go-live. Hoy son placeholders del MVP académico.

- **L1 / equipo dev SIADLP**: equipo TAP IDAT — Slack `#siadlp-oncall` (TODO: crear canal)
- **L2 / Tech Lead**: Gianpierre Wong — `gian@example.com` (TODO: confirmar email)
- **L3 / Owner**: por confirmar
- **Soporte cliente**: La Cosecha S.A.C. — contacto comercial (TODO: completar)

### 1.4 Canales y tableros

| Recurso | URL | Notas |
|--------|-----|-------|
| Logs producción | Railway dashboard → service `backend` → tab Logs | TODO: pegar URL real |
| Logs frontend | Railway dashboard → service `frontend` → tab Logs | TODO: pegar URL real |
| Health (liveness) | `https://<backend>/api/health` | Público, sin auth |
| Health (readiness) | `https://<backend>/api/health/ready` | Verifica DB |
| Health (deep) | `https://<backend>/api/health/deep` | DB + memoria + disco |
| Métricas | TODO: pendiente Prometheus / Grafana en Fase 1 post-TAP |
| Audit trail | tabla `registro_auditoria` (vía Prisma Studio o SQL directo) |

---

## 2. Síntomas comunes y procedimientos

Cada caso sigue la estructura: **Síntoma → Diagnóstico → Mitigación → Verificación → Postmortem**.

### 2.1 La aplicación no responde (5xx en todos los endpoints)

- **Síntoma**: usuarios reportan que el sitio "no carga", todas las requests devuelven 502/503/504.
- **Severidad**: SEV1
- **Diagnóstico** (en orden):
  1. Hit al liveness: `curl -i https://<backend>/api/health`
     - Si responde 200 → el proceso está vivo, problema es entre LB/CDN y la app, o un endpoint específico.
     - Si responde 5xx o timeout → el proceso está caído o no acepta conexiones.
  2. Revisar Railway dashboard → service `backend` → ver si está en estado *Crashed* o *Restarting*.
  3. Logs del último deploy: `railway logs --service backend --tail 200` (filtrá por `level=50` para errores, `level=60` para fatal).
  4. ¿Hubo un deploy reciente? `railway status` o el commit graph del dashboard.
- **Mitigación**:
  - **Si el deploy reciente rompió**: rollback inmediato (sección 3.2).
  - **Si el proceso crashea por OOM**: ver logs por `JavaScript heap out of memory`. Reiniciar service desde Railway. Si reincide, escalar a L2 — probable memory leak.
  - **Si readiness falla por DB**: ir al caso 2.2.
- **Verificación**:
  ```bash
  curl -s https://<backend>/api/health/ready | jq
  # Esperado: { "status": "ok", "info": { "database": { "status": "up" } } }
  ```
  Probar login real desde el frontend.
- **Postmortem**: obligatorio si >5 min de downtime.

---

### 2.2 La base de datos está caída

- **Síntoma**: `/api/health/ready` devuelve 503 con `database: { status: "down" }`. Login y cualquier endpoint con DB falla. Logs llenos de `PrismaClientInitializationError` o `Can't reach database server`.
- **Severidad**: SEV1
- **Diagnóstico**:
  1. Verificar estado del servicio Postgres en Railway dashboard. ¿Está running? ¿Hubo un restart automático?
  2. Verificar `DATABASE_URL` en variables de entorno del backend. Si fue rotada y no actualizada, falla.
  3. ¿La DB hit el plan limit de Railway? (storage / connections). Ver dashboard → Postgres → Metrics.
  4. Conexión manual:
     ```bash
     psql "$DATABASE_URL" -c "SELECT 1;"
     ```
- **Mitigación**:
  - **Postgres caído sin causa clara**: restart del service Postgres en Railway. **NO borrar el volumen.**
  - **Connection pool agotado** (síntoma: `too many clients already`): reiniciar el backend libera las conexiones del pool. Considerar bajar `connection_limit` en `DATABASE_URL` (parámetro `?connection_limit=N`).
  - **Storage lleno**: ver caso 2.10.
  - **DB realmente perdida**: restaurar desde backup (sección 3.3). Esto es worst-case y requiere L2/L3.
- **Verificación**:
  ```bash
  curl -s https://<backend>/api/health/ready | jq '.info.database.status'
  # "up"
  psql "$DATABASE_URL" -c "SELECT count(*) FROM usuarios;"
  ```
- **Postmortem**: siempre. La DB caída implica revisar capacity planning y backups.

---

### 2.3 Login no funciona (todos los usuarios afectados)

- **Síntoma**: ningún usuario puede loguear. POST `/api/auth/login` devuelve 401 o 500 para credenciales que ayer funcionaban.
- **Severidad**: SEV1
- **Diagnóstico**:
  1. ¿La DB responde? `curl /api/health/ready`. Si no → caso 2.2.
  2. ¿`JWT_SECRET` cambió en el último deploy? Ver caso 2.4.
  3. Probar login con un usuario seed conocido (admin) directo contra la API:
     ```bash
     curl -i -X POST https://<backend>/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"correo":"admin@siadlp.com","contrasena":"<password>"}'
     ```
     - 401 con `Credenciales inválidas` → contraseña realmente incorrecta o usuario `activo=false`.
     - 500 → error interno, ver logs.
     - 429 → throttler bloqueando (sección 2.5).
  4. Verificar en DB que el usuario admin existe y está activo:
     ```sql
     SELECT id, correo, activo, rol_id FROM usuarios WHERE correo = 'admin@siadlp.com';
     ```
- **Mitigación**:
  - Si `bcrypt.compare` está fallando para todos → puede ser corrupción de hash en DB (raro). Resetear contraseña del admin desde una sesión SQL:
    ```sql
    -- Generar el hash en local: node -e "console.log(require('bcryptjs').hashSync('NUEVA_PWD', 12))"
    UPDATE usuarios SET contrasena = '<HASH_BCRYPT_COST_12>' WHERE correo = 'admin@siadlp.com';
    ```
  - Si es throttler global → ver 2.5.
  - Si es JWT_SECRET nuevo → ver 2.4.
- **Verificación**: login exitoso del admin desde la UI.
- **Postmortem**: obligatorio. Login es función crítica.

---

### 2.4 Tokens JWT rechazados después de un deploy

- **Síntoma**: tras un deploy, todos los usuarios son deslogueados / reciben 401 en cada request. Logs con `JsonWebTokenError: invalid signature` o `Usuario no válido o inactivo`.
- **Severidad**: SEV2
- **Causa raíz típica**: el `JWT_SECRET` cambió entre el deploy anterior y el nuevo (regenerado por accidente, o rotado deliberadamente sin coordinar).
- **Diagnóstico**:
  1. Verificar el valor actual de `JWT_SECRET` en Railway → Variables.
  2. Comparar con el valor del deploy anterior (Railway mantiene historial).
  3. Probar firmar/verificar un token manualmente:
     ```bash
     # En el server con el JWT_SECRET actual cargado:
     node -e "
       const jwt = require('jsonwebtoken');
       const t = jwt.sign({sub:1,correo:'x',rolId:1}, process.env.JWT_SECRET);
       console.log('signed:', t);
       console.log('verified:', jwt.verify(t, process.env.JWT_SECRET));
     "
     ```
- **Mitigación**:
  - **Aceptar el invalidate global**: comunicar al cliente que todos los usuarios deben re-loguear (es ventana de ~2h hasta que los tokens viejos expiren naturalmente). El sistema **no tiene refresh tokens** — esto es esperado dado el scope MVP.
  - **Restaurar el JWT_SECRET anterior** si la rotación fue accidental: pegar el valor previo en Railway Variables y redeployar.
  - **Para rotación planificada sin invalidate global**: ver sección 3.5 (rolling rotation con dual-secret — requiere cambio de código, no soportado en MVP actual).
- **Verificación**: hacer login → recibir un token nuevo → hit `/api/users/me` o cualquier endpoint protegido → 200.
- **Postmortem**: obligatorio si fue accidental. Documentar el procedimiento en sección 3.5 si se planea soportar rotación segura.

---

### 2.5 Throttling agresivo (los usuarios reciben 429)

- **Síntoma**: usuarios reciben `429 Too Many Requests` en operaciones normales. Login específicamente bloqueado.
- **Severidad**: SEV2 si afecta login masivamente, SEV3 si solo es ráfaga puntual.
- **Configuración actual** (`apps/backend/src/app.module.ts`):
  - **Global short**: 20 req / 60s por IP
  - **Global medium**: 300 req / 60s por IP
  - **Login específico** (`auth.controller.ts`): 5 req / 60s por IP
- **Diagnóstico**:
  1. Buscar en logs `ThrottlerException` o status 429:
     ```bash
     railway logs --service backend --tail 500 | grep -E '"statusCode":429|ThrottlerException'
     ```
  2. ¿Es una sola IP o varias? Si es una sola con tráfico anormal → posible bot / brute force (caso 3.7).
  3. Verificar `app.set('trust proxy', 1)` está activo (`main.ts:50`) — si por alguna razón no, todos los clientes detrás del proxy comparten el bucket de la IP del proxy.
- **Mitigación**:
  - **Pico legítimo** (ej: campaña, fin de mes con muchos pedidos): no hay forma de "resetear" el throttler en runtime sin reiniciar el proceso. Si es urgente, **reiniciar el service backend** desde Railway → vacía los buckets en memoria. Considerar subir limits temporalmente vía variable de entorno (TODO: actualmente los valores están hardcoded en `app.module.ts`, hay que cambiar código + redeploy).
  - **Brute force**: ver 3.7.
  - **Falso positivo de un solo usuario** (ej: doble-click frenético): no se puede "whitelistear" — esperar 60s.
- **Verificación**: el usuario afectado puede ejecutar la operación nuevamente sin 429.
- **Postmortem**: solo si fue prolongado. Documentar si los limits actuales son insuficientes para el volumen real.

---

### 2.6 Pedido se queda en estado raro (no transiciona)

- **Síntoma**: un pedido visible en la UI no avanza de estado. Ej: aparece como `ON_ROUTE` desde hace días.
- **Severidad**: SEV3 (datos puntuales)
- **Estados válidos** (`packages/shared/src/enums/order-status.ts`): `REGISTERED → CONFIRMED → DISPATCHED → ON_ROUTE → DELIVERED | ISSUE`. Estados terminales: `DELIVERED`, `CANCELLED`. Desde `ISSUE` puede volver a `CONFIRMED`.
- **Transiciones permitidas** (`packages/shared/src/constants/order-transitions.ts`):
  ```
  REGISTERED  → CONFIRMED, CANCELLED
  CONFIRMED   → DISPATCHED
  DISPATCHED  → ON_ROUTE
  ON_ROUTE    → DELIVERED, ISSUE
  ISSUE       → CONFIRMED
  DELIVERED   → (terminal)
  CANCELLED   → (terminal)
  ```
- **Diagnóstico**:
  ```sql
  -- Pedidos en estado intermedio por más de 2 días
  SELECT id, estado, fecha_creacion, fecha_actualizacion, hoja_carga_id
  FROM pedidos
  WHERE estado IN ('CONFIRMED','DISPATCHED','ON_ROUTE','ISSUE')
    AND fecha_actualizacion < NOW() - INTERVAL '2 days'
  ORDER BY fecha_actualizacion ASC;

  -- Historial del pedido específico
  SELECT estado_anterior, estado_nuevo, motivo, fecha_creacion, usuario_id
  FROM estado_pedido_logs
  WHERE pedido_id = <ID>
  ORDER BY fecha_creacion ASC;
  ```
- **Mitigación**:
  - Si el pedido está `ON_ROUTE` pero la entrega real ya ocurrió → marcar `DELIVERED` desde la UI con el rol correspondiente.
  - Si el pedido está en `DISPATCHED` y la hoja de carga ya está `COMPLETADO` (inconsistencia) → revisar la hoja: `SELECT * FROM hojas_carga WHERE id = <hojaCargaId>;`. Si hay inconsistencia real, requiere fix manual con SQL **y registro en `estado_pedido_logs`** para mantener trazabilidad:
    ```sql
    BEGIN;
    UPDATE pedidos SET estado = 'DELIVERED', fecha_actualizacion = NOW() WHERE id = <ID>;
    INSERT INTO estado_pedido_logs (pedido_id, estado_anterior, estado_nuevo, motivo, usuario_id, fecha_creacion)
    VALUES (<ID>, 'DISPATCHED', 'DELIVERED', 'Fix manual runbook 2.6 — inconsistencia con hoja completada', <USER_ID_OPERADOR>, NOW());
    COMMIT;
    ```
  - **NO uses transiciones que no estén en `ORDER_TRANSITIONS`**. Si necesitás una excepción, documentala antes en el postmortem.
- **Verificación**:
  ```sql
  SELECT id, estado FROM pedidos WHERE id = <ID>;
  SELECT count(*) FROM estado_pedido_logs WHERE pedido_id = <ID>;
  ```
- **Postmortem**: solo si afecta múltiples pedidos o revela un bug real en `OrdersService`.

---

### 2.7 Hoja de carga no se confirma (DESPACHADO no avanza)

- **Síntoma**: el despachador presiona "Confirmar despacho" y la hoja sigue en `PREPARANDO`. O toast de error genérico.
- **Severidad**: SEV2 (bloquea la operación logística del día)
- **Estados de hoja** (`packages/shared/src/enums/dispatch-status.ts`): `PREPARANDO → DESPACHADO → EN_RUTA → COMPLETADO`.
- **Diagnóstico**:
  1. Estado actual de la hoja:
     ```sql
     SELECT id, fecha, estado, total_kg, ruta_id, vehiculo_id, chofer_id
     FROM hojas_carga WHERE id = <ID>;
     ```
  2. Pedidos asignados:
     ```sql
     SELECT id, estado FROM pedidos WHERE hoja_carga_id = <ID>;
     ```
     - Para que `PREPARANDO → DESPACHADO` funcione, los pedidos deben estar en `CONFIRMED`. Si alguno está en `REGISTERED` (no confirmado) o `CANCELLED`, la transacción falla.
  3. Buscar en logs el error específico:
     ```bash
     railway logs --service backend --tail 500 | grep -E 'dispatch|hoja_carga|HojaCarga'
     ```
- **Mitigación**:
  - Confirmar manualmente los pedidos pendientes desde la UI (rol supervisor) antes de reintentar.
  - Quitar de la hoja los pedidos cancelados desde la UI antes de confirmar.
  - Si la hoja tiene 0 pedidos válidos: descartar la hoja y crear una nueva.
- **Verificación**:
  ```sql
  SELECT estado FROM hojas_carga WHERE id = <ID>; -- DESPACHADO
  SELECT estado, count(*) FROM pedidos WHERE hoja_carga_id = <ID> GROUP BY estado; -- todos DISPATCHED
  ```
- **Postmortem**: si la causa fue un bug de validación o transacción rota.

---

### 2.8 Frontend muestra páginas en blanco

- **Síntoma**: el sitio carga pero las páginas son blancas o muestran error genérico de Next. Errores de hidratación en consola del navegador.
- **Severidad**: SEV2
- **Diagnóstico**:
  1. Abrir DevTools → Network: ¿llegan los chunks `.js`? ¿Hay 404s en `/_next/static/*`?
  2. Console del navegador: errores específicos. Buscar `ChunkLoadError`, `Hydration failed`, errores de runtime.
  3. ¿El backend responde? `curl /api/health` (404 desde el frontend significa que el frontend tampoco puede llamar al backend).
  4. ¿Hubo un deploy del frontend reciente que rompió?
  5. ¿`CORS_ORIGINS` del backend incluye el dominio del frontend? Ver `apps/backend/src/main.ts:120-141`. Si CORS rechaza, las llamadas fallan y la UI puede quedar vacía.
- **Mitigación**:
  - **ChunkLoadError tras deploy**: el cliente tiene un bundle viejo cacheado pidiendo chunks que ya no existen. Solución: que el usuario haga hard refresh (Ctrl+Shift+R) o esperar a que el cache CDN/browser expire.
  - **Hydration errors masivos**: rollback frontend (sección 3.2).
  - **CORS roto**: ajustar `CORS_ORIGINS` en Railway → backend variables → redeploy. Recordar: **no acepta `*`** (`main.ts:127` lanza error si lo encuentra).
- **Verificación**: cargar la página principal en una ventana de incógnito limpia, ver UI funcional.
- **Postmortem**: si fue causado por deploy.

---

### 2.9 Logs llenos de errores Prisma P2003 (FK violation)

- **Síntoma**: los logs del backend muestran errores `Foreign key constraint failed on the field` repetidamente. Algunos endpoints fallan con 500.
- **Severidad**: SEV2/SEV3 según volumen.
- **Causa típica**: alguien intentó borrar un registro referenciado por otra tabla (ej: borrar un `Cliente` con `Pedido` activos), o un seed/import metió datos inconsistentes.
- **Diagnóstico**:
  1. Identificar la FK que falla en el mensaje de Prisma (ej: `cliente_id`, `ruta_id`, `usuario_id`).
  2. Mapear contra el schema (`apps/backend/prisma/schema.prisma`). Casi todas las FKs usan `onDelete: Restrict` deliberadamente — no se puede borrar si hay referencias.
     - Excepciones: `RolPermiso` y `DetallePedido` usan `onDelete: Cascade`; `Pedido.hojaCargaId` usa `onDelete: SetNull`.
  3. Buscar la operación que detonó:
     ```bash
     railway logs --service backend --tail 500 | grep -E 'P2003|Foreign key'
     ```
- **Mitigación**:
  - **No es un bug del sistema, es protección de integridad funcionando**. La regla es no borrar entidades que tienen historial (clientes con pedidos, usuarios con auditoría).
  - **Solución de negocio**: en lugar de borrar, **desactivar** (`activo = false`). Todas las entidades relevantes tienen ese flag.
  - Si realmente hay que borrar, primero limpiar las referencias en orden: detalles → pedidos → cliente, etc. Hacer en transacción.
- **Verificación**: dejaron de aparecer P2003 en logs después de que el operador entendió el flujo correcto.
- **Postmortem**: solo si revela un bug en la UI (ej: botón "eliminar" que no debería existir para entidades con dependencias).

---

### 2.10 Disk full en Railway

- **Síntoma**: `/api/health/deep` falla en `disk` (threshold 90%). Errores `ENOSPC` en logs. Uploads de logo fallan. El backend puede crashear si Postgres no puede escribir WAL.
- **Severidad**: SEV1 si Postgres está afectado, SEV2 si solo es el filesystem del backend.
- **Diagnóstico**:
  1. Hit deep health:
     ```bash
     curl -s https://<backend>/api/health/deep | jq
     ```
     Mira el campo `disk`. Threshold actual: 90% (`health.controller.ts:28`).
  2. ¿Qué llenó el disco?
     - Carpeta `uploads/` (logos de empresa servidos vía `useStaticAssets`). Debería ser tiny salvo abuso.
     - Logs locales (Railway maneja la rotación, pero verificar).
     - Postgres data dir (si la DB comparte volumen).
- **Mitigación**:
  - **`uploads/` lleno**: limpiar archivos viejos / huérfanos. **Cuidado**: el logo activo de la empresa está referenciado en `empresa.logo_url`. No borrar el archivo apuntado por esa columna.
    ```sql
    SELECT logo_url FROM empresa WHERE id = 1;
    ```
  - **Postgres data dir**: ampliar el plan de Railway (más storage) o purgar datos viejos:
    ```sql
    -- Audit logs > 6 meses (decisión de retención TODO: definir oficialmente)
    DELETE FROM registro_auditoria WHERE fecha_creacion < NOW() - INTERVAL '6 months';
    -- Logs de transición de pedidos cerrados hace > 1 año
    DELETE FROM estado_pedido_logs WHERE pedido_id IN (
      SELECT id FROM pedidos WHERE estado IN ('DELIVERED','CANCELLED') AND fecha_actualizacion < NOW() - INTERVAL '1 year'
    );
    VACUUM FULL;
    ```
  - Plan estructural (ver limitaciones, sección 6): migrar uploads a Wasabi S3 (infra prevista pero no implementada).
- **Verificación**: `/api/health/deep` retorna 200 con `disk.status: "up"`.
- **Postmortem**: obligatorio si Postgres se afectó.

---

## 3. Procedimientos operacionales

### 3.1 Cómo hacer un deploy manual

- **Cuándo**: Railway tiene auto-deploy desde `main`. Manual solo si el auto-deploy se rompió o querés deployar una rama.
- **Procedimiento**:
  1. Verificar que la branch builda local:
     ```bash
     pnpm install
     pnpm --filter @siadlp/shared build
     pnpm --filter backend build
     pnpm --filter frontend build
     ```
  2. Verificar tests:
     ```bash
     pnpm --filter backend test
     pnpm --filter backend test:e2e
     pnpm --filter frontend test
     ```
  3. Push a `main` o trigger desde Railway dashboard → service → Deploy → "Deploy from branch".
  4. Watchear logs durante el deploy:
     ```bash
     railway logs --service backend --follow
     ```
     Esperar:
     - `prisma migrate deploy` exitoso (ver `apps/backend/Dockerfile:28`).
     - `prisma:seed` exitoso (idempotente).
     - `Application running on port 4020` (mensaje de `main.ts:150`).
  5. Smoke test post-deploy:
     ```bash
     curl https://<backend>/api/health/ready
     # Esperado: 200 con database up
     curl -X POST https://<backend>/api/auth/login -H "Content-Type: application/json" -d '{"correo":"admin@siadlp.com","contrasena":"<pwd>"}'
     # Esperado: 200 con accessToken
     ```
- **TODO**: documentar comando exacto de Railway CLI cuando se decida si se usa CLI o solo dashboard. Hoy el deploy ocurre vía push a main.

---

### 3.2 Cómo hacer rollback a versión anterior

- **Cuándo**: el último deploy rompió producción.
- **Procedimiento Railway dashboard** (más simple):
  1. Railway → service afectado → tab **Deployments**.
  2. Localizar el deploy anterior conocido como bueno.
  3. Click `...` → **Redeploy**. Railway reusa el build artifact previo.
  4. Esperar a que el nuevo deploy esté `Active`.
  5. **Verificar las migraciones**: si el deploy roto agregó migraciones de Prisma, el rollback de **código** NO revierte el schema. Si la migración nueva no es backward-compatible, el código viejo puede romper. Decidir:
     - **Migración aditiva** (ej: nueva columna nullable): código viejo funciona — rollback OK.
     - **Migración destructiva** (drop column, rename): rollback del código no es seguro. Hay que crear una migración inversa o restaurar DB desde backup (3.3).
  6. Smoke test (idem 3.1 paso 5).
- **Procedimiento por git** (si Railway no permite redeploy por algún motivo):
  ```bash
  git revert <COMMIT_HASH_MALO>
  git push origin main
  # Auto-deploy se dispara
  ```
- **TODO**: documentar política de migrations forward-only + script de rollback (mencionado en `docs/ARCHITECTURE.md` Fase 1).

---

### 3.3 Cómo restaurar la DB desde un backup

- **Cuándo**: pérdida de datos / corrupción / migración destructiva mal aplicada.
- **PRECONDICIÓN**: tener backups configurados.

> **TODO CRÍTICO**: actualmente **no hay backups automáticos configurados** en Railway Postgres para este proyecto. Es una limitación conocida del scope MVP (sección 6). Antes del go-live productivo:
> 1. Activar Railway Postgres backups automáticos (chequear Pro plan).
> 2. Configurar `pg_dump` programado a Wasabi S3 (cron en GitHub Actions o servicio Railway dedicado).
> 3. Documentar el comando exacto de restauración aquí.

- **Procedimiento manual de emergencia** (si tenés un dump local reciente):
  ```bash
  # Backup defensivo del estado actual (por si la "restauración" empeora)
  pg_dump "$DATABASE_URL" -Fc -f "pre-restore-$(date +%Y%m%d-%H%M%S).dump"

  # Restauración. CUIDADO: esto sobreescribe.
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" backup.dump
  ```
- **Verificación**:
  ```sql
  SELECT count(*) FROM usuarios;
  SELECT count(*) FROM pedidos;
  SELECT max(fecha_creacion) FROM pedidos; -- ¿Está al día?
  ```
- **Postmortem**: siempre. Pérdida de datos es siempre SEV1 con postmortem L3.

---

### 3.4 Cómo correr el seed en producción (con cuidado)

- **Cuándo**: bootstrap inicial. Idealmente nunca después.
- **Contexto**: el seed corre automáticamente en cada deploy (`Dockerfile:28` ejecuta `pnpm prisma:seed` después de `migrate deploy`). El script en `apps/backend/prisma/seed.ts` debe ser **idempotente** (no duplica datos si corre múltiples veces).
- **Procedimiento manual** (si necesitás re-seedear sin redeploy):
  1. Conectarse al shell del container de Railway (Railway → service → "Shell" tab) o vía Railway CLI.
  2. Desde `/app/apps/backend`:
     ```bash
     npx dotenv -e ../../.env -- npx prisma migrate status
     # Confirmá que las migraciones están aplicadas antes de seedear.
     pnpm prisma:seed
     ```
- **Riesgos**:
  - Si el seed **no es idempotente**, vas a duplicar usuarios / catálogos. Verificá el código del seed antes.
  - Si el seed resetea contraseñas (típico patrón en seeds de admin), perdés las contraseñas que los usuarios cambiaron. **Confirmá el código** antes de correr en prod.
- **Alternativa segura**: insertar datos vía SQL directo con `INSERT ... ON CONFLICT DO NOTHING` en lugar de re-seedear todo.

---

### 3.5 Cómo cambiar JWT_SECRET sin invalidar a todos los usuarios (rolling)

> **TODO IMPORTANTE**: esto **NO está soportado en el código actual**. La validación de JWT en `apps/backend/src/auth/strategies/jwt.strategy.ts:17` usa un solo `secretOrKey`, no un array. Cualquier rotación del `JWT_SECRET` invalida todos los tokens existentes.

- **Procedimiento actual (con invalidate global)**:
  1. Generar secret nuevo: `openssl rand -hex 32`. Guardar el valor anterior en un lugar seguro.
  2. Actualizar `JWT_SECRET` en Railway → backend variables.
  3. Redeployar.
  4. **Comunicar al cliente** que todos los usuarios deben re-loguear.
  5. Ventana de impacto: ~2h (los tokens existentes son válidos hasta su `exp`, pero la nueva firma los rechaza inmediatamente — efecto: 401 hasta que re-loguean).
- **Procedimiento ideal (rolling, requiere implementación)**:
  - Soportar dos secrets simultáneos: `JWT_SECRET_CURRENT` para firmar nuevo, `JWT_SECRET_PREVIOUS` para verificar viejo.
  - Verificar firma contra ambos.
  - Tras 2h (TTL del token), eliminar `JWT_SECRET_PREVIOUS`.
  - **TODO**: implementar como evolución post-MVP (mencionado en `SECURITY-AUDIT.md` Fase 1 — refresh tokens + rotation).

---

### 3.6 Cómo reiniciar el throttler (si hubo flood de tráfico)

- **Cuándo**: pico de tráfico legítimo está bloqueando usuarios reales.
- **Contexto**: el `@nestjs/throttler` configurado mantiene los buckets **en memoria del proceso**. No hay storage compartido (no hay Redis).
- **Procedimiento**:
  1. **Restart del backend desde Railway** — vacía los buckets (memoria del proceso se pierde).
     - Railway → service backend → top-right `...` → Restart.
  2. Esperar ~30s a que esté `Active`.
  3. Verificar:
     ```bash
     curl -s https://<backend>/api/health
     # Esperado: 200
     ```
- **Riesgos**:
  - Pérdida de conexiones HTTP en vuelo (~segundos de impacto).
  - El restart NO mitiga si la causa raíz es brute force activo — solo da una ventana hasta que el atacante vuelva a llenar el bucket. En ese caso ir a 3.7.
- **Sin Redis no hay forma de "reset selectivo"**. Si lo necesitás recurrente, considerá migrar a `@nestjs/throttler` con storage Redis (sin scope MVP).

---

### 3.7 Cómo bloquear un usuario sospechoso de brute force

- **Síntoma**: un correo recibe múltiples logins fallidos en `auth.service.ts:46-72` — los logs de Pino reportan `login.failed` con `reason: invalid_password` repetido para el mismo `correo`.
- **Diagnóstico** (identificar el patrón):
  ```bash
  # Logs estructurados (Pino emite JSON)
  railway logs --service backend --tail 1000 | grep '"login.failed"' | jq -s 'group_by(.correo) | map({correo: .[0].correo, count: length}) | sort_by(.count) | reverse | .[0:5]'
  ```
- **Mitigación inmediata** (no requiere redeploy):
  1. **Desactivar la cuenta atacada** vía SQL — el `JwtStrategy` revalida `usuario.activo` en cada request (`jwt.strategy.ts:28`), así que el efecto es inmediato:
     ```sql
     UPDATE usuarios SET activo = false WHERE correo = '<correo_atacado>';
     ```
  2. Comunicarse con el dueño legítimo de la cuenta para verificar (cambiar password, reactivar).
- **Mitigación a nivel infraestructura**:
  - **Bloqueo por IP**: si la fuente es una sola IP, agregarla al bloqueo de Cloudflare / proxy delante de Railway. **TODO**: Railway no expone bloqueo de IP nativo; documentar cuando se ponga Cloudflare delante.
  - **Account lockout automático**: NO está implementado. Es una limitación documentada en `docs/SECURITY-AUDIT.md` (finding A07.LOW). Recomendado para producción real.
- **Verificación**: los `login.failed` para ese correo se detienen (la cuenta inactiva responde antes de llegar a `bcrypt.compare`).
- **Postmortem**: obligatorio. Documentar IP, ventana de tiempo, y si hay sospecha de credential stuffing distribuido.

---

## 4. Comandos rápidos de diagnóstico

### Logs

```bash
# Últimas 100 líneas con errores (Pino: level 50 = error, 60 = fatal)
railway logs --service backend --tail 100 | grep -E '"level":(50|60)'

# Logs en tiempo real
railway logs --service backend --follow

# Logins fallidos del último deploy
railway logs --service backend --tail 1000 | grep '"login.failed"'

# Errores de Prisma
railway logs --service backend --tail 500 | grep -iE 'PrismaClient|P[0-9]{4}'
```

### Health checks

```bash
# Liveness (proceso vivo)
curl -i https://<backend>/api/health

# Readiness (DB up)
curl -s https://<backend>/api/health/ready | jq

# Deep (DB + memoria + disco) — NO usar como probe, solo diagnóstico
curl -s https://<backend>/api/health/deep | jq
```

### SQL — pedidos

```sql
-- Pedidos atascados (no terminales, sin actualizar > 2 días)
SELECT id, estado, fecha_creacion, fecha_actualizacion, hoja_carga_id
FROM pedidos
WHERE estado NOT IN ('DELIVERED','CANCELLED')
  AND fecha_actualizacion < NOW() - INTERVAL '2 days'
ORDER BY fecha_actualizacion ASC;

-- Distribución de estados de pedidos del día
SELECT estado, count(*)
FROM pedidos
WHERE fecha_creacion >= CURRENT_DATE
GROUP BY estado;

-- Hojas en DESPACHADO con pedidos no DISPATCHED (inconsistencia)
SELECT h.id, h.estado, p.id AS pedido_id, p.estado AS pedido_estado
FROM hojas_carga h
JOIN pedidos p ON p.hoja_carga_id = h.id
WHERE h.estado = 'DESPACHADO' AND p.estado <> 'DISPATCHED';
```

### SQL — auditoría

```sql
-- Auditoría reciente
SELECT id, usuario_id, accion, modulo, entidad_id, ip, fecha_creacion
FROM registro_auditoria
ORDER BY fecha_creacion DESC
LIMIT 20;

-- Acciones de un usuario sospechoso
SELECT * FROM registro_auditoria WHERE usuario_id = <ID> ORDER BY fecha_creacion DESC LIMIT 50;

-- Accesos por IP (últimas 24h)
SELECT ip, count(*) AS acciones
FROM registro_auditoria
WHERE fecha_creacion > NOW() - INTERVAL '24 hours'
GROUP BY ip
ORDER BY acciones DESC
LIMIT 10;
```

### SQL — usuarios y auth

```sql
-- Usuarios activos por rol
SELECT r.nombre, count(u.id)
FROM roles r LEFT JOIN usuarios u ON u.rol_id = r.id AND u.activo = true
GROUP BY r.nombre;

-- Desactivar usuario (efecto inmediato — el JwtStrategy lo bloquea)
UPDATE usuarios SET activo = false WHERE correo = '<correo>';

-- Reactivar
UPDATE usuarios SET activo = true WHERE correo = '<correo>';
```

### Conexión a la DB

```bash
# Local (con .env cargado)
psql "$DATABASE_URL"

# Prisma Studio (UI)
pnpm --filter backend prisma:studio
```

---

## 5. Plantilla de postmortem

> Filosofía: **blameless**. Buscamos causas sistémicas, no culpables. Lo que aprendemos vale más que quién apretó el botón.

Crear archivo en `docs/postmortems/YYYY-MM-DD-slug.md` con esta estructura:

```markdown
# Postmortem — <título corto del incidente>

- **Fecha**: YYYY-MM-DD
- **Severidad**: SEV<n>
- **Duración del impacto**: <inicio> → <fin> (XX min)
- **Autor**: <nombre>
- **Estado**: Draft | Reviewed | Closed

## 1. Resumen ejecutivo

Un párrafo que explique a un no-técnico qué pasó, qué impacto tuvo y qué hicimos.

## 2. Timeline (UTC-5 / Lima)

| Hora | Evento |
|------|--------|
| HH:MM | Primera alerta / reporte de usuario |
| HH:MM | L1 toma el caso |
| HH:MM | Se identifica la causa raíz |
| HH:MM | Mitigación aplicada |
| HH:MM | Sistema verificado funcional |
| HH:MM | Comunicación de cierre al cliente |

## 3. Impacto

- Usuarios afectados: <#> de <total>
- Funcionalidad afectada: <login / pedidos / despacho / etc>
- Datos perdidos / corruptos: sí/no, alcance
- Impacto comercial: <ej: 1 día de operaciones bloqueado>

## 4. Causa raíz

Análisis de los **5 por qués** o equivalente. No "el dev se equivocó"; el sistema permitió el error.

## 5. Detección

- Cómo nos enteramos: <alerta / usuario / monitoreo>
- Tiempo desde el evento al ack: XX min
- ¿Pudimos haber detectado antes? ¿Cómo?

## 6. Resolución

Pasos exactos que se ejecutaron para mitigar.

## 7. ¿Qué salió bien?

- Procedimiento del runbook funcionó
- Logs estructurados permitieron triage rápido
- Etc.

## 8. ¿Qué salió mal?

- Faltó alerta proactiva
- Backup desactualizado
- Etc.

## 9. Action items (concretos, asignables, con fecha)

| # | Acción | Responsable | Fecha |
|---|--------|-------------|-------|
| 1 | Implementar alerta de health-check fallando >3 min | <name> | YYYY-MM-DD |
| 2 | Documentar caso 2.X en RUNBOOK.md | <name> | YYYY-MM-DD |
| 3 | Agregar test de regresión para <bug> | <name> | YYYY-MM-DD |

## 10. Lecciones aprendidas

Qué te llevás vos / el equipo de este incidente que aplica más allá de este caso puntual.
```

---

## 6. Limitaciones conocidas (scope MVP)

Estas son limitaciones **deliberadas** del MVP académico TAP IDAT. No son bugs — son trade-offs documentados que se aceptan y se documentarán como work items para producción real. Cruzar con `docs/SECURITY-AUDIT.md` y `docs/ARCHITECTURE.md` (sección 10).

| # | Limitación | Impacto operacional | Mitigación actual | Plan |
|---|-----------|---------------------|-------------------|------|
| 1 | **No hay backups automáticos configurados** | Pérdida total de datos posible si falla Postgres + storage | `pg_dump` manual ad-hoc | Activar Railway Postgres backups + dump diario a Wasabi S3 |
| 2 | **No hay alertas (Prometheus/Grafana)** | Detección reactiva (usuarios reportan) en lugar de proactiva | Logs estructurados + health checks | Fase 1 post-TAP: OpenTelemetry → Grafana Cloud free tier |
| 3 | **No hay refresh tokens** — JWT expira en 2h, usuarios deben re-loguear | UX: re-login cada 2h. Operacional: rotación de `JWT_SECRET` invalida a todos | Token TTL 2h aceptado por el cliente | Implementar access (15min) + refresh (7d) con rotation + reuse detection |
| 4 | **No hay rate limit per-user**, solo per-IP (`@nestjs/throttler` default) | Cuenta comprometida puede saturar desde múltiples IPs | Throttle global + per-IP | Throttle por `userId` con storage Redis |
| 5 | **No hay account lockout** tras N logins fallidos | Credential stuffing distribuido posible | Throttle de 5/min en login per-IP, audit log de intentos | Implementar `intentosFallidos` + `bloqueadoHasta` en `Usuario` |
| 6 | **JWT en `localStorage`** del frontend | XSS amplifica a account takeover | No hay HTML dinámico no escapado, JWT TTL 2h, `JwtStrategy` revalida `activo` y `rolId` cada request | Migrar a HttpOnly cookies + CSRF token |
| 7 | **Throttler en memoria del proceso** | Reinicio vacía buckets; multi-instance no comparte estado | Single instance por ahora | Migrar a `ThrottlerStorageRedis` cuando haya >1 réplica |
| 8 | **`uploads/` en filesystem local de Railway** | Restart del container puede perder los logos. Disk fillable. | Backup manual del logo activo si se cambia raramente | Migrar a Wasabi S3 (infra prevista, no implementada) |
| 9 | **Logs de login fallido NO están en `registro_auditoria`** | Detección de credential stuffing limitada a logs Pino | Pino logs estructurados con `correo` + `reason` | Insertar audit row con `usuarioId=0` cuando falla login (sketch en SECURITY-AUDIT.md A09) |
| 10 | **No hay rollback automático de migraciones Prisma** | Migración destructiva mala requiere restore desde backup (que tampoco hay — ver #1) | Migrations son aditivas por convención | Documentar política forward-only + scripts de reverso por migración |
| 11 | **Sin observabilidad distribuida** (no APM, no tracing) | Debugging de incidentes es por logs + SQL | Pino con correlation IDs por request | OpenTelemetry → Tempo cuando crezca el volumen |
| 12 | **`.env` committeado al repo** | Si el repo se hace público, leak de secrets | Repo privado, política de owner explícita (`CLAUDE.md`) | Migrar a Railway secrets + rotar antes de publicar |

---

## Apéndice — Referencias cruzadas

- Schema Prisma: [`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma)
- Estados de pedido: [`packages/shared/src/enums/order-status.ts`](../packages/shared/src/enums/order-status.ts)
- Estados de hoja de carga: [`packages/shared/src/enums/dispatch-status.ts`](../packages/shared/src/enums/dispatch-status.ts)
- Transiciones permitidas: [`packages/shared/src/constants/order-transitions.ts`](../packages/shared/src/constants/order-transitions.ts)
- Health endpoints: [`apps/backend/src/health/health.controller.ts`](../apps/backend/src/health/health.controller.ts)
- Bootstrap (helmet, CORS, throttler): [`apps/backend/src/main.ts`](../apps/backend/src/main.ts)
- Auth service (login, change password): [`apps/backend/src/auth/auth.service.ts`](../apps/backend/src/auth/auth.service.ts)
- JWT strategy (revalida `activo` y `rolId` en cada request): [`apps/backend/src/auth/strategies/jwt.strategy.ts`](../apps/backend/src/auth/strategies/jwt.strategy.ts)
- Dockerfile (deploy: migrate deploy → seed → start): [`apps/backend/Dockerfile`](../apps/backend/Dockerfile)
- Auditoría de seguridad: [`docs/SECURITY-AUDIT.md`](SECURITY-AUDIT.md)
- Arquitectura: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
- Estrategia de testing: [`docs/TESTING.md`](TESTING.md)

---

**Última actualización**: 2026-05-07
**Mantenedor**: equipo SIADLP
**Próxima revisión recomendada**: tras cada postmortem o cambio de infraestructura.
