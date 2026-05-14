# ADR-002: Prisma ORM sobre PostgreSQL

## Status

Accepted

## Context

El dominio de SIADLP es claramente relacional. Algunas evidencias del schema:

- `Cliente` tiene FK a `Ruta` y FKs opcionales a la cadena de ubigeo (`Departamento` → `Provincia` → `Distrito`) con sus tres índices.
- `Pedido` agrupa `DetallePedido` (1-N) y referencia `Cliente`, `Usuario` (creador) y opcionalmente `HojaCarga`.
- `HojaCarga` actúa como agregador: relaciona `Ruta`, `Vehiculo`, `Chofer` y los pedidos de la hoja.
- `Permiso` declara unique compuesto `(modulo, accion)` y se asocia a `Rol` via tabla puente `RolPermiso`.
- Operaciones cruzan tablas en una sola transacción: asignar pedidos a una hoja, marcar transición de estado y registrar `EstadoPedidoLog` deben ser atómicos.

Necesitamos una capa de datos que cumpla cuatro objetivos:

1. **Integridad referencial garantizada en la base** (no en código): FKs declaradas con la política correcta de `onDelete`.
2. **Tipado fuerte sobre el resultado de cada query** sin reescribir tipos a mano (DRY entre schema y código).
3. **Migraciones versionadas y reproducibles** que se puedan aplicar identicamente en local, CI y Railway.
4. **Compatibilidad con el setup de testing del proyecto** (pglite, ver ADR-004) — el ORM no puede asumir un Postgres-server real.

## Decision

Usar **Prisma 7** como ORM y **PostgreSQL 15** como motor relacional. El schema vive en `apps/backend/prisma/schema.prisma` y es la única fuente de verdad del modelo de datos. El cliente Prisma se genera en build (`prisma generate`) y se inyecta en los services NestJS vía un `PrismaService` que extiende `PrismaClient` y conecta/desconecta con `OnModuleInit` y `OnModuleDestroy`.

Las migraciones se versionan con `prisma migrate dev` localmente (genera SQL en `prisma/migrations/`) y se aplican con `prisma migrate deploy` en CI y Railway. Las políticas de FK se declaran explícitamente:

- **`onDelete: Restrict`** para entidades de catálogo críticas (`Ruta`, `Cliente`, `Usuario`, `Producto`): bloquea borrado si tiene dependencias. Política conservadora — se prefiere fallar a perder datos.
- **`onDelete: Cascade`** para hijos triviales (`DetallePedido`, `RolPermiso`, `EstadoPedidoLog` respecto a su pedido): no tiene sentido conservarlos si el padre desaparece.
- **`onDelete: SetNull`** para relaciones opcionales (`Pedido.hojaCargaId` → `HojaCarga`): borrar la hoja libera al pedido en lugar de eliminarlo.

## Implementation notes

- El `PrismaService` extiende `PrismaClient`, implementa `OnModuleInit` (`await this.$connect()`) y `OnModuleDestroy` para cierre limpio de conexiones.
- Se exporta vía `PrismaModule` global (`@Global()`) para que cualquier service pueda inyectarlo sin re-importarlo.
- En tests unit, `PrismaService` se reemplaza por un objeto mock con `vi.fn()` o `jest.fn()`. En integration, se usa una instancia real apuntando a pglite (ver ADR-004).
- Las queries con joins complejos pasan por services (no se exponen directamente desde controllers) — esto encapsula el ORM y permite refactor futuro.
- Las migraciones generadas se commitean al repo en `apps/backend/prisma/migrations/` con su timestamp y nombre descriptivo.

## Consequences

### Positive

- **Type safety end-to-end:** `prisma.pedido.findMany({ include: { detalles: true } })` retorna un tipo exacto sin escribir DTOs manuales. Renombrar `cantidad` rompe el build en cada lugar que la consume.
- **Migrations declarativas:** el schema es la fuente, las migraciones se derivan automáticamente con `prisma migrate dev`; revisar diffs en PR es directo (es SQL plano versionado en `prisma/migrations/`).
- **Excelente DX:** autocompletado de queries, errores en compile-time cuando un campo cambia, Prisma Studio para inspeccionar datos en desarrollo sin necesitar `psql`.
- **PostgreSQL real:** transacciones ACID, índices compuestos (`@@index([rolId])`), tipos nativos (`Decimal(10,2)` para `cantidad` y `capacidadKg`, `VarChar(2)` para `id` de departamento), CTE, ventanas, y soporte JSON/full-text si se necesitara más adelante.
- **Transacciones interactivas:** `prisma.$transaction(async (tx) => { ... })` permite operaciones multi-tabla atómicas con rollback automático si lanza excepción.
- **Compatibilidad con pglite:** el mismo schema corre sobre pglite (Postgres-WASM) en integration tests, sin SQL alternativo para tests (ver ADR-004).
- **Generación reproducible:** `prisma generate` en CI emite siempre el mismo cliente para el mismo schema — builds determinísticos.

### Negative

- **Vendor lock-in al cliente Prisma:** migrar a otro ORM exige reescribir todas las queries. Mitigado porque las queries viven detrás de services (capa de aislamiento), pero el costo no es trivial.
- **Prisma 7 es reciente** (release line de finales de 2024/2025) y arrastra issues abiertos con tipos en queries muy complejas (ej. `findMany` con múltiples `include` anidados condicionales). En SIADLP no se manifestó como bloqueante porque las queries del dominio son moderadas.
- **Sin "raw" elegante para queries muy complejas:** `$queryRaw` existe pero pierde parte del type safety; aceptable porque el dominio aquí no requiere SQL exótico.
- **Cliente generado pesa** unos cuantos MB en el bundle del backend (no afecta runtime, pero se nota en imagen Docker; mitigado con multi-stage build).
- **Connection pooling externo:** en deploys serverless conviene Prisma Accelerate o pgBouncer; Railway con un proceso Node tradicional no requiere esto, pero es algo a considerar si se cambia de plataforma.

## Alternatives considered

- **TypeORM:** más viejo, basado en decoradores que duplican información del modelo (la entidad describe la tabla y el cliente al mismo tiempo, fácil que se desincronicen). Peor inferencia de tipos en queries con joins, migrations con history menos predecible y bugs históricos en cascadas. Su DX para refactorizar es notablemente peor: renombrar un campo no propaga errores de tipo de la misma forma.
- **Sequelize:** ORM legacy con tipado bolt-on (`sequelize-typescript`), modelo Active Record con muchos foot-guns en transacciones. No alineado con un proyecto TypeScript-first y con peor documentación de patrones modernos.
- **Drizzle ORM:** muy buen ORM moderno, query builder type-safe sobre SQL real, sin codegen. Descartado por madurez relativa al momento de inicio del proyecto y por menor cantidad de recursos de aprendizaje (tutoriales, libros, ejemplos en YouTube). Si se reevaluara hoy, es la alternativa más fuerte y probablemente la elección si el proyecto comenzara en 2026.
- **MicroORM (MikroORM):** Unit of Work potente y modelo Data Mapper limpio, pero pesado y con curva de aprendizaje más alta para un equipo chico que prioriza velocidad de entrega.
- **SQL crudo (`knex` / `postgres.js`):** máxima flexibilidad y control total sobre las queries, pero pierde el tipado de filas y exige mantener tipos TypeScript a mano sincronizados con el schema. Para un sistema con ~15 tablas el costo de mantenimiento es alto.
- **MongoDB:** descartado de raíz. El dominio es relacional puro: FKs explícitas, integridad referencial, joins entre `pedido`, `hoja_carga` y `entrega`, ubigeo jerárquico, unique compuestos en permisos. Forzar un documento para "pedido con detalle" replicaría datos del cliente, rompería normalización y haría imposible la auditoría transaccional.
- **Supabase como backend completo:** atractivo para prototipos, pero acopla la app al BaaS y limita la lógica server-side custom (validaciones complejas, transacciones multi-tabla orquestadas).

## References

- Prisma docs — https://www.prisma.io/docs
- Prisma migrations — https://www.prisma.io/docs/orm/prisma-migrate
- PostgreSQL 15 docs — https://www.postgresql.org/docs/15/index.html
- Schema del proyecto — `apps/backend/prisma/schema.prisma`
- Prisma vs TypeORM comparison — https://www.prisma.io/docs/orm/more/comparisons/prisma-and-typeorm
- Joe Celko, *SQL for Smarties* — referencia clásica sobre modelado relacional
- Drizzle ORM (alternativa moderna) — https://orm.drizzle.team/
