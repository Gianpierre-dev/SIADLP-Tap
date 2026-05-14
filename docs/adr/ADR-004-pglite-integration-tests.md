# ADR-004: pglite como base de datos para integration tests

## Status

Accepted

## TL;DR

Integration tests del backend usan **pglite** (PostgreSQL 16 compilado a WebAssembly) en lugar de SQLite, Docker o mocks. Mismo SQL que producción, sin dependencias externas, suite completa en segundos.

## Context

La estrategia de testing del proyecto (ver `docs/TESTING.md`) define tres niveles para el backend: unit, integration y E2E. El nivel **integration** debe ejercitar SQL real sobre el mismo motor que producción para detectar bugs específicos de PostgreSQL que un mock de Prisma jamás detectaría:

- Semántica de transacciones (`BEGIN/COMMIT/ROLLBACK`, savepoints, isolation levels).
- Cascadas (`onDelete: Cascade | Restrict | SetNull`) declaradas en el schema.
- Constraints únicos compuestos (`@@unique([modulo, accion])` en `permisos`).
- Comparaciones case-sensitive de strings y comportamiento de `NULL` en uniques.
- Ordenamientos con `NULLS LAST/FIRST` (Postgres por defecto difiere de SQLite).
- Tipos nativos: `Decimal(10,2)` para `cantidad`, `Date` puro vs `Timestamp`, `VarChar(2)` para `id` de departamento.

El requerimiento operativo es que la suite **corra en CI sin Docker**. Los runners de GitHub Actions soportan Docker, pero introduce overhead de pull/start (15–30s por job), complicación con ports y networking, y los tiempos se multiplican cuando se pluraliza por matrix builds o por `--parallel` de Jest. También debe correr **localmente sin requerir que el desarrollador instale PostgreSQL** — la barrera de entrada ideal es `pnpm install && pnpm test`, sin servicios externos.

## Decision

Usar **`@electric-sql/pglite`** (PostgreSQL 16 compilado a WebAssembly, in-memory) como motor de base para todos los integration tests del backend (`apps/backend/test/integration/*.integration.spec.ts`).

El setup vive en un helper `createTestDb()` que: (1) instancia pglite en memoria, (2) genera el SQL de creación del schema con `prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema.prisma --script`, (3) lo aplica sobre la instancia pglite, (4) retorna un `PrismaClient` apuntando a esa instancia. Cada test suite arma y descarta su propia DB en `beforeAll`/`afterAll`, garantizando aislamiento total entre suites paralelas.

## Implementation notes

- El cliente Prisma se instancia con `datasourceUrl` apuntando a un protocolo custom interpretado por el driver pglite (`prisma-adapter-pglite`).
- El SQL del schema se cachea en memoria por suite para no re-generar con cada test individual; `beforeEach` solo limpia datos vía `TRUNCATE ... CASCADE`.
- Los seeds de testing son **mínimos y explícitos**: cada test crea solo los datos que necesita. No hay un seed compartido grande que oculte qué dependencias tiene cada test.
- Tiempo medido en CI: la suite completa de 55 integration tests termina en ~6 segundos en un runner estándar de GitHub Actions.
- Para debugging, pglite se puede inspeccionar via `prisma.$queryRaw\`SELECT ...\`` igual que un Postgres normal.
- El helper `createTestDb()` está en `apps/backend/test/integration/_helpers/db.ts` y es la única puerta de entrada — ningún test instancia pglite directamente.
- Para agregar una integration test nueva, el patrón es: `const db = await createTestDb()` en `beforeAll`, `await db.$disconnect()` en `afterAll`, `await db.$executeRaw\`TRUNCATE ... CASCADE\`` en `beforeEach`.

## Consequences

### Positive

- **Mismo SQL que producción:** pglite es Postgres 16 real compilado a WASM, no un dialecto ni una reimplementación. Los bugs específicos de Postgres (case-sensitivity de identificadores, semántica de transacciones, constraints diferidos, comportamiento de `NULL` en uniques) se reproducen en tests.
- **Sin Docker en CI:** los workflows de GitHub Actions corren `pnpm test` directamente y terminan más rápido. Menos puntos de falla en el pipeline.
- **Sin Docker localmente:** un dev nuevo clona, instala y corre tests sin instalar nada extra. La barrera de entrada es la mínima posible.
- **Boot instantáneo:** una instancia pglite arranca en milisegundos. Una suite de 55 integration tests termina en pocos segundos.
- **Aislamiento por suite:** cada `beforeAll` crea una DB nueva — sin estado compartido, sin race conditions cuando Jest paraleliza con `--maxWorkers`.
- **Defensa de schema:** un test específico verifica que las tablas del scope eliminado (compras/producción/inventario, ver ADR-003) **no existen** en el schema aplicado — barrera contra regresiones por reintroducción accidental.
- **Mismo schema source:** el SQL se deriva del mismo `schema.prisma` que producción, vía `prisma migrate diff`. No hay riesgo de divergencia entre el schema testeado y el desplegado.

### Negative

- **pglite es relativamente nuevo** (proyecto público desde 2024 por el equipo ElectricSQL). Comunidad chica, menos issues resueltos por StackOverflow, posibilidad de bugs específicos de WASM que un Postgres-server no tiene.
- **No cubre extensiones nativas** (PostGIS, pg_cron, pg_vector, etc.). Si el dominio crece a usar extensiones, hay que reevaluar — probablemente moviéndose a testcontainers para esos tests específicos.
- **Memoria:** una instancia por suite puede crecer si los tests crean muchos datos; mitigado porque los integration tests usan datasets chicos por diseño.
- **Diferencias menores con server real:** algunas configuraciones de `wal_level`, replicación, autovacuum o conexiones concurrentes no aplican o se comportan distinto; irrelevante para tests funcionales pero a tener en cuenta si se quiere testear performance real.
- **Single-process:** pglite no simula múltiples conexiones concurrentes con locks como un servidor real. Tests que dependen de comportamiento bajo concurrencia (deadlocks, bloqueos de fila) deben hacerse en un Postgres-server tradicional.

## Alternatives considered

- **SQLite:** descartado con fuerza. SQLite difiere de Postgres en muchas dimensiones: tipos JSON nativos (Postgres `jsonb` vs SQLite `TEXT`), arrays, CTE recursivas, semántica de transacciones (SQLite no tiene niveles de aislamiento como `READ COMMITTED`), comparación de strings, comportamiento de `NULL` en uniques (Postgres permite múltiples NULL en columna unique, SQLite también pero con reglas distintas), tipos `DECIMAL`. Tests que pasan en SQLite y fallan en Postgres son el peor escenario: falsa seguridad.
- **Testcontainers + Docker (`@testcontainers/postgresql`):** opción técnicamente correcta y muy popular en JVM/Java. En Node introduce dependencia de Docker en CI runners (overhead de pull de imagen, cold start del contenedor, requiere `--privileged` o socket binding en algunos entornos) y en el setup de cada desarrollador. Para un proyecto académico que apunta a `pnpm install && pnpm test` es overkill.
- **DB de testing compartida (un Postgres server con múltiples schemas):** no escala con tests paralelos. Race conditions entre suites cuando Jest corre con `--maxWorkers > 1`, y la lógica de cleanup (truncate, reset secuencias) es costosa en tiempo y propensa a bugs.
- **Mocks de Prisma (`jest-mock-extended`, `prisma-mock`):** útiles para **unit tests** del service, pero **no es integration**. Mockear `prisma.pedido.findMany` reemplaza la query con un retorno fijo: pierde la capa SQL real, las cascadas, los constraints, los índices, el ordenamiento. Eso es exactamente lo que el nivel integration debe ejercitar.
- **In-memory Postgres alternativos (`pg-mem`):** reimplementaciones JavaScript de Postgres con cobertura SQL parcial. Funcionan para queries simples pero divergen rápido en features avanzadas. pglite es más fiel porque es **el binario de Postgres real compilado a WebAssembly**, no una reimplementación.
- **Supabase Local (CLI):** levanta un Postgres real en Docker; sufre los mismos problemas que testcontainers más el peso de la suite Supabase entera.

## Validación empírica

Antes de adoptar pglite se hizo una prueba concreta: replicar tres bugs reales detectados previamente en queries Postgres-específicas (uno con `DISTINCT ON`, uno con índice parcial y uno con cascada `onDelete`) y confirmar que pglite los reproduce idénticamente. Los tres pasaron. Esto da confianza razonable de que la fidelidad SQL es suficiente para el dominio del proyecto.

Adicionalmente, se compararon planes de ejecución (`EXPLAIN ANALYZE`) en pglite vs un Postgres 15 servidor: los planes son equivalentes en estructura, las constantes de costo difieren marginalmente (esperado, dado que el ambiente WASM no tiene la misma información de hardware).

## References

- pglite — https://github.com/electric-sql/pglite
- Anuncio de pglite (ElectricSQL, 2024) — https://electric-sql.com/blog/2024/02/05/electric-sql-postgres-anywhere
- Estrategia de testing — `docs/TESTING.md` § 4.1 y § 5.1
- `prisma migrate diff` — https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-diff
- Martin Fowler, *Practical Test Pyramid* — https://martinfowler.com/articles/practical-test-pyramid.html
- Testcontainers docs — https://node.testcontainers.org/
