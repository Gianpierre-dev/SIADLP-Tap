# Arquitectura — SIADLP

> Sistema Integral de Administración, Distribución y Logística de Papa
> Cliente: **La Cosecha S.A.C.** — Distribuidora de papa a pollerías en Lima, Perú
> Documento técnico para sustentación TAP — IDAT

---

## 1. Visión general

SIADLP es una aplicación web tipo **SaaS interno mono-tenant** que digitaliza el ciclo comercial y logístico de una distribuidora de papa: toma de pedidos, confirmación, agrupación por ruta en hojas de carga, despacho, ejecución del recorrido y registro de entregas. Reemplaza un proceso manual basado en cuadernos y planillas Excel por un sistema con trazabilidad de estados, auditoría de operaciones y reportes consolidados.

La solución está construida como un **monorepo pnpm** con dos aplicaciones (frontend Next.js + backend NestJS) y un paquete compartido de tipos y constantes. La autenticación es **JWT stateless con RBAC granular** (matriz `modulo.acción`), lo que permite definir roles (admin, supervisor, despachador, vendedor, chofer) sin tocar código. La capa de datos es PostgreSQL gestionada por Prisma, los archivos estáticos de empresa (logos) viven en Wasabi S3-compatible, y todo se despliega en Railway.

---

## 2. Modelo C4 — Nivel 1: Sistema en su contexto

Muestra los actores humanos y los sistemas externos que interactúan con SIADLP. El alcance del sistema es deliberadamente acotado: una sola empresa distribuidora, sin integración con SUNAT ni pasarelas de pago en la versión actual.

```mermaid
graph TB
  subgraph Actores["Usuarios internos de La Cosecha S.A.C."]
    admin["Administrador<br/>(gestiona usuarios, roles, catálogos)"]
    super["Supervisor<br/>(confirma pedidos, supervisa)"]
    vend["Vendedor<br/>(toma pedidos del cliente)"]
    desp["Despachador<br/>(arma hojas de carga)"]
    chof["Chofer<br/>(ejecuta ruta, registra entregas)"]
  end

  siadlp(["SIADLP<br/>Sistema web de administración,<br/>distribución y logística"])

  subgraph Externos["Sistemas externos"]
    wasabi["Wasabi S3<br/>(almacenamiento de logos<br/>y assets de empresa)"]
    railway["Railway.app<br/>(plataforma de hosting<br/>+ Postgres gestionado)"]
  end

  admin --> siadlp
  super --> siadlp
  vend --> siadlp
  desp --> siadlp
  chof --> siadlp

  siadlp -- "Sube/lee logos vía<br/>S3 API" --> wasabi
  siadlp -. "Se despliega y corre en" .-> railway

  classDef actor fill:#dbeafe,stroke:#1e40af,stroke-width:1px,color:#1e3a8a
  classDef system fill:#facc15,stroke:#a16207,stroke-width:2px,color:#713f12
  classDef ext fill:#e5e7eb,stroke:#374151,stroke-width:1px,color:#111827
  class admin,super,vend,desp,chof actor
  class siadlp system
  class wasabi,railway ext
```

**Decisiones de alcance:**
- No hay integración con facturación electrónica (SUNAT) — fuera de alcance del TAP.
- No hay app móvil nativa para choferes; la web es responsive y se usa desde el navegador del celular.
- No hay multi-tenancy; cada despliegue sirve a una sola empresa.

---

## 3. Modelo C4 — Nivel 2: Containers

Cada container es un proceso independiente, desplegable por separado. La comunicación entre frontend y backend es **HTTP/REST con JSON**; el backend habla con la base de datos vía **TCP/Postgres wire protocol** a través de Prisma.

```mermaid
graph TB
  subgraph Cliente["Navegador del usuario"]
    browser["Browser<br/>(Chrome, Edge, móvil)"]
  end

  subgraph Railway["Railway.app — Producción"]
    fe["Frontend<br/><b>Next.js 16 App Router</b><br/>React 19 + Tailwind 4<br/>shadcn (@base-ui/react) + Zustand<br/>SSR + Client Components"]
    be["Backend API<br/><b>NestJS 11</b><br/>JWT + RBAC + Throttler<br/>Audit Interceptor global"]
    db[("PostgreSQL 15<br/>(Prisma 7 ORM)<br/>~18 tablas relacionales")]
  end

  wasabi[("Wasabi S3<br/>Bucket de assets<br/>(logos de empresa)")]

  browser -- "HTTPS<br/>HTML + JS bundle" --> fe
  fe -- "fetch<br/>JSON + Bearer JWT<br/>/api/*" --> be
  be -- "SQL vía Prisma<br/>connection pool" --> db
  be -- "Signed URLs<br/>(PUT/GET)" --> wasabi
  browser -- "GET logo<br/>(URL pública)" --> wasabi

  classDef container fill:#bfdbfe,stroke:#1d4ed8,stroke-width:2px,color:#1e3a8a
  classDef store fill:#fde68a,stroke:#a16207,stroke-width:2px,color:#713f12
  classDef ext fill:#e5e7eb,stroke:#374151,stroke-width:1px,color:#111827
  class fe,be container
  class db,wasabi store
  class browser ext
```

**Detalles operativos:**
- El frontend corre en `:3020` y el backend en `:4020/api` (configuración local). En Railway, ambos son servicios separados con dominios distintos.
- El JWT se almacena en el cliente (Zustand persistido) y se envía como `Authorization: Bearer <token>` en cada request.
- Throttling global: 20 req/min en endpoints sensibles (login), 300 req/min en general (`@nestjs/throttler`).

---

## 4. Modelo C4 — Nivel 3: Components (Backend)

Cada módulo NestJS encapsula un **dominio del negocio** y expone un controlador REST. Hay tres guards globales (`Throttler`, `JwtAuth`, `Permissions`) y un interceptor (`Audit`) que se aplican a TODA la API, salvo decoradores `@Public()`.

```mermaid
graph TB
  subgraph Global["Guards e Interceptores globales (orden de ejecución)"]
    g1["1. ThrottlerGuard<br/>(rate limiting)"]
    g2["2. JwtAuthGuard<br/>(valida token + carga usuario)"]
    g3["3. PermissionsGuard<br/>(verifica modulo.acción)"]
    i1["AuditInterceptor<br/>(loggea writes en BD)"]
  end

  subgraph Modulos["Módulos de dominio"]
    auth["AuthModule<br/>POST /auth/login<br/>POST /auth/refresh"]
    users["UsersModule<br/>CRUD usuarios"]
    roles["RolesModule<br/>CRUD roles + permisos"]
    catalogs["CatalogsModule<br/>(clients, products, routes,<br/>vehicles, drivers)"]
    orders["OrdersModule<br/>Crear/confirmar/cancelar<br/>Transiciones validadas"]
    dispatch["DispatchModule<br/>Hojas de carga + entregas<br/>Iniciar ruta"]
    reports["ReportsModule<br/>Dashboard + Excel exports"]
    audit["AuditModule<br/>Lectura de logs"]
    empresa["EmpresaModule<br/>Datos + logo (Wasabi)"]
    ubigeo["UbigeoModule<br/>Departamento/Provincia/Distrito"]
  end

  prisma["PrismaModule<br/>(provider singleton)"]

  g1 --> g2 --> g3 --> Modulos
  Modulos -- "todas las escrituras" --> i1
  Modulos -- "PrismaService" --> prisma
  prisma -- "TCP" --> db[("PostgreSQL")]
  empresa -- "@aws-sdk/client-s3" --> wasabi[("Wasabi S3")]

  classDef guard fill:#fecaca,stroke:#b91c1c,stroke-width:1px,color:#7f1d1d
  classDef mod fill:#bbf7d0,stroke:#15803d,stroke-width:1px,color:#14532d
  classDef infra fill:#fde68a,stroke:#a16207,stroke-width:2px,color:#713f12
  class g1,g2,g3,i1 guard
  class auth,users,roles,catalogs,orders,dispatch,reports,audit,empresa,ubigeo mod
  class prisma,db,wasabi infra
```

**Convenciones de los módulos:**
- Cada módulo tiene `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/*.dto.ts`.
- DTOs validados con `class-validator` (decoradores `@IsString`, `@IsInt`, `@IsEnum`, etc.).
- Servicios reciben `PrismaService` por DI; nunca instancian Prisma directamente.
- El controlador usa decoradores `@RequirePermissions('modulo.acción')` para autorizar.

---

## 5. Flujo de un request típico

Caso: un **vendedor crea un pedido**. Muestra cómo cada capa contribuye y dónde se aplican validaciones, autorización y auditoría.

```mermaid
sequenceDiagram
  autonumber
  participant U as Vendedor
  participant FE as Frontend<br/>(Next.js)
  participant TG as ThrottlerGuard
  participant JG as JwtAuthGuard
  participant PG as PermissionsGuard
  participant C as OrdersController
  participant S as OrdersService
  participant V as Validador<br/>(class-validator)
  participant P as PrismaService
  participant DB as PostgreSQL
  participant AI as AuditInterceptor

  U->>FE: Llena formulario "Nuevo pedido"
  FE->>FE: Valida HTML5 + cliente
  FE->>TG: POST /api/orders<br/>Bearer <JWT> + body JSON
  TG->>TG: ¿Bajo el límite?<br/>(20-300 req/min)
  TG->>JG: ok
  JG->>JG: Verifica firma JWT,<br/>extrae userId, rolId
  JG->>PG: req.user poblado
  PG->>PG: ¿usuario tiene<br/>permiso "orders.create"?
  PG->>C: ok
  C->>V: Valida CreateOrderDto
  V-->>C: 400 si inválido
  C->>S: createOrder(dto, userId)
  S->>P: prisma.$transaction([<br/> pedido.create,<br/> detallePedido.createMany,<br/> estadoPedidoLog.create<br/>])
  P->>DB: BEGIN; INSERTs; COMMIT
  DB-->>P: rows
  P-->>S: Pedido completo
  S-->>C: PedidoDto
  C-->>AI: response
  AI->>P: prisma.registroAuditoria.create<br/>(modulo, accion, usuarioId, ip)
  AI-->>FE: 201 Created + JSON
  FE->>FE: Actualiza estado UI,<br/>muestra toast "Pedido REGISTERED"
  FE-->>U: Vista de detalle
```

**Puntos clave:**
- La autorización ocurre **antes** del controlador — un usuario sin permiso nunca ejecuta la lógica de negocio.
- Las operaciones que tocan múltiples tablas (Pedido + DetallePedido + Log) van en una **transacción Prisma** atómica.
- La auditoría se registra **después** de que la respuesta es exitosa, fuera del path crítico de la transacción de negocio.

---

## 6. Modelo de datos

Diagrama ER simplificado con las entidades centrales. Los nombres siguen el schema real (Prisma usa camelCase en TS y mapea a `snake_case` en la BD vía `@map`).

```mermaid
erDiagram
  USUARIO ||--o{ PEDIDO : "crea"
  USUARIO }o--|| ROL : "pertenece a"
  ROL ||--o{ ROL_PERMISO : "tiene"
  PERMISO ||--o{ ROL_PERMISO : "asignado a"

  CLIENTE ||--o{ PEDIDO : "realiza"
  CLIENTE }o--|| RUTA : "asignado a"
  CLIENTE }o--o| DEPARTAMENTO : "ubicado en"
  CLIENTE }o--o| PROVINCIA : "ubicado en"
  CLIENTE }o--o| DISTRITO : "ubicado en"

  PEDIDO ||--|{ DETALLE_PEDIDO : "contiene"
  PEDIDO ||--o{ ESTADO_PEDIDO_LOG : "registra cambios"
  PEDIDO }o--o| HOJA_CARGA : "agrupado en"
  PEDIDO ||--o| ENTREGA : "genera"
  PRODUCTO ||--o{ DETALLE_PEDIDO : "aparece en"

  HOJA_CARGA }o--|| RUTA : "cubre"
  HOJA_CARGA }o--|| VEHICULO : "asignada a"
  HOJA_CARGA }o--|| CHOFER : "conducida por"
  HOJA_CARGA }o--|| USUARIO : "creada por"

  ENTREGA }o--|| USUARIO : "registrada por"
  USUARIO ||--o{ REGISTRO_AUDITORIA : "produce"

  USUARIO {
    int id PK
    string correo UK
    string contrasena
    string nombre
    int rolId FK
    bool activo
  }
  ROL {
    int id PK
    string nombre UK
  }
  PERMISO {
    int id PK
    string modulo
    string accion
  }
  CLIENTE {
    int id PK
    string razonSocial
    string ruc UK
    int rutaId FK
    string distritoId FK
  }
  PEDIDO {
    int id PK
    int clienteId FK
    date fechaEntrega
    string estado
    int hojaCargaId FK
    int creadoPorId FK
  }
  DETALLE_PEDIDO {
    int id PK
    int pedidoId FK
    int productoId FK
    decimal cantidad
  }
  HOJA_CARGA {
    int id PK
    date fecha
    int rutaId FK
    int vehiculoId FK
    int choferId FK
    string estado
    decimal totalKg
  }
  ENTREGA {
    int id PK
    int pedidoId FK_UK
    string estado
    datetime fechaEntrega
  }
```

**Notas del modelo:**
- `Pedido.hojaCargaId` es **opcional** — un pedido recién registrado o cancelado no tiene hoja.
- `Entrega.pedidoId` es **único** (1:1) — un pedido tiene como máximo una entrega registrada.
- `EstadoPedidoLog` da trazabilidad histórica de cada transición (quién, cuándo, motivo).
- `RegistroAuditoria` cubre todas las operaciones de escritura, no solo las de pedido.
- Tablas omitidas del diagrama por simplicidad: `Empresa` (singleton id=1), `Departamento`/`Provincia`/`Distrito` (catálogo INEI de ubigeo).

---

## 7. Máquina de estados de Pedido

Las transiciones se definen en `packages/shared/src/constants/order-transitions.ts` y se validan en cada cambio de estado tanto en frontend (deshabilitar botones) como en backend (rechazar requests inválidos).

```mermaid
stateDiagram-v2
  [*] --> REGISTERED : Vendedor crea pedido

  REGISTERED --> CONFIRMED : Supervisor aprueba
  REGISTERED --> CANCELLED : Cliente desiste

  CONFIRMED --> DISPATCHED : Despachador<br/>asigna a hoja de carga<br/>+ confirma despacho

  DISPATCHED --> ON_ROUTE : Chofer inicia ruta<br/>(hoja pasa a EN_RUTA)

  ON_ROUTE --> DELIVERED : Entrega exitosa<br/>(crea registro Entrega)
  ON_ROUTE --> ISSUE : Cliente ausente,<br/>rechazo o problema

  ISSUE --> CONFIRMED : Reintento de entrega<br/>(vuelve al pool)

  DELIVERED --> [*]
  CANCELLED --> [*]

  note right of ISSUE
    El estado ISSUE no es terminal:
    el pedido puede volver a CONFIRMED
    para ser reagendado en otra hoja.
  end note

  note left of CANCELLED
    Estado terminal.
    No hay reapertura.
  end note
```

**Reglas duras (del código):**
- Desde `DELIVERED` y `CANCELLED` **no hay transiciones** — son estados absorbentes.
- Desde `CONFIRMED` solo se puede ir a `DISPATCHED` — no se puede cancelar un pedido ya confirmado (decisión de negocio: hay que crear un caso ISSUE).
- La transición `ISSUE → CONFIRMED` es la única "hacia atrás" del flujo y permite reagendar.

---

## 8. Máquina de estados de HojaCarga

La hoja de carga es el agregado logístico que agrupa varios pedidos confirmados de la misma ruta y los asigna a un vehículo y chofer.

```mermaid
stateDiagram-v2
  [*] --> PREPARANDO : Despachador crea hoja<br/>(asigna ruta + vehículo + chofer)

  PREPARANDO --> DESPACHADO : Despachador confirma<br/>(pedidos pasan a DISPATCHED)

  DESPACHADO --> EN_RUTA : Chofer inicia ruta<br/>(pedidos pasan a ON_ROUTE)

  EN_RUTA --> COMPLETADO : Todos los pedidos<br/>marcados DELIVERED o ISSUE

  COMPLETADO --> [*]

  note right of PREPARANDO
    Mientras la hoja esté en
    PREPARANDO, se pueden
    agregar/quitar pedidos.
  end note

  note right of DESPACHADO
    Snapshot inmutable:
    los pedidos ya no se
    pueden mover de hoja.
  end note
```

**Acoplamiento de máquinas:**
- Confirmar despacho de la hoja (`PREPARANDO → DESPACHADO`) ejecuta en transacción la transición `CONFIRMED → DISPATCHED` para todos sus pedidos.
- Iniciar ruta (`DESPACHADO → EN_RUTA`) propaga `DISPATCHED → ON_ROUTE` a los pedidos.
- La hoja llega a `COMPLETADO` cuando ningún pedido suyo queda en `ON_ROUTE`.

---

## 9. Decisiones arquitectónicas clave

Los ADR (Architecture Decision Records) viven en `docs/adr/`. Son documentos cortos que registran **el contexto, la decisión y las consecuencias** de cada elección arquitectónica relevante.

| # | Decisión | Resumen |
|---|----------|---------|
| ADR-001 | Stack NestJS + Next.js | Backend NestJS por su modularidad, DI y guards declarativos; frontend Next.js App Router por SSR + RSC + ecosistema React. Ver [`docs/adr/ADR-001-stack-nestjs-nextjs.md`](adr/ADR-001-stack-nestjs-nextjs.md). |
| ADR-002 | RBAC con matriz de permisos | En lugar de roles hardcodeados, los permisos se modelan como `(modulo, acción)` y se asignan a roles vía tabla `RolPermiso`. Permite crear roles nuevos sin redeploy. |
| ADR-003 | Estados como string + tabla de transiciones | Los estados de Pedido son `string` en BD (no `enum` Postgres) para evitar migraciones al evolucionar el flujo. La validez se define en `packages/shared`. |
| ADR-004 | JWT stateless sin Redis | Para el alcance del TAP, JWT firmado es suficiente. No se implementa blacklist; un cambio de contraseña no invalida tokens existentes hasta su expiración. Trade-off documentado. |
| ADR-005 | Auditoría como interceptor global | Toda escritura pasa por `AuditInterceptor`. Evita olvidar logs en cada endpoint y centraliza el formato. Costo: ~1 INSERT extra por write. |

> **Nota:** Solo ADR-001 está formalmente documentado en este momento. ADR-002 a ADR-005 son decisiones efectivas presentes en el código y se documentarán en formato MADR antes de la sustentación final.

---

## 10. Trade-offs y limitaciones

Decisiones honestas sobre lo que el sistema **no hace** y por qué.

| Área | Limitación actual | Razón | Mitigación / Plan |
|------|-------------------|-------|-------------------|
| **Tiempo real** | El chofer no ve actualizaciones push del despachador (ni viceversa). Hay que refrescar. | WebSockets agregan complejidad operativa (sticky sessions, reconexión) que excede el alcance del TAP. | Polling cada 30s en vistas críticas. WebSockets / SSE en evolución. |
| **Caché** | Cada request hace ida a BD; no hay Redis ni edge cache. | El volumen actual (1 empresa, ~50-200 pedidos/día) no lo justifica. | Agregar `cache-manager` + Redis cuando p95 > 500ms en endpoints de lectura. |
| **Búsqueda** | La búsqueda de pedidos/clientes usa `LIKE` sobre Postgres con índices B-tree. | Suficiente para los volúmenes actuales. | Migrar a `pg_trgm` o Meilisearch si la BD supera ~100k filas/tabla. |
| **Multi-tenancy** | Una sola empresa por despliegue. Tabla `empresa` con `id=1` fija. | El cliente es una sola distribuidora; multi-tenancy real (row-level security) sería over-engineering. | Si se vende a más empresas, separar por instancia (más simple) o agregar `tenantId` (más complejo). |
| **Observabilidad** | Logs a stdout + auditoría en BD. No hay APM ni tracing distribuido. | Costo de OpenTelemetry / Datadog no se justifica al volumen actual. | Si crece, integrar OpenTelemetry → Grafana Tempo. |
| **Refresh tokens** | El JWT dura X horas; al expirar, el usuario relogea. No hay refresh token. | Simplicidad. Sin Redis no hay forma robusta de revocar refreshes. | Migrar a access + refresh con blacklist en Redis si la UX lo requiere. |
| **Inventario** | El sistema actual modela pedidos pero no descuenta stock automáticamente. | El alcance del MVP del TAP se concentró en distribución, no en producción/inventario. | Diseño previsto pero fuera de la versión sustentada. |
| **Pagos / cobros** | No se registran cobros ni saldos por cliente. | Decisión explícita del cliente (manejan caja aparte). | Posible módulo futuro. |
| **App móvil** | El chofer usa la web responsive desde el celular. | Una app nativa (RN/Flutter) duplicaba el esfuerzo y no agregaba valor inmediato. | PWA con instalación + offline-first es el siguiente paso lógico. |

---

## 11. Plan de evolución

Roadmap técnico ordenado por valor / esfuerzo. No es compromiso de fechas; es la dirección si el sistema entra en producción real.

### Fase 1 — Endurecimiento (post-TAP, 1-2 meses)
1. **Refresh tokens + revocación** vía Redis (`BLACKLIST:<jti>`).
2. **Observabilidad básica:** structured logs JSON + OpenTelemetry → Grafana Cloud (free tier).
3. **Tests E2E ampliados** con Playwright cubriendo los 5 flujos críticos.
4. **Migrations forward-only** con script de rollback documentado.

### Fase 2 — Performance y UX (3-6 meses)
1. **Caché Redis** en endpoints de catálogo (productos, rutas, clientes) — TTL 5 min.
2. **Realtime** vía SSE para vista del despachador (estado de hojas en curso).
3. **PWA + offline-first** para el chofer (cola de entregas pendientes que sincroniza al recuperar red).
4. **Dashboard** con KPIs (pedidos del día, on-time delivery rate, ruta más rentable).

### Fase 3 — Escala (6-12 meses, si aplica)
1. **Multi-tenancy** con `tenantId` + RLS de Postgres.
2. **Búsqueda full-text** (`pg_trgm` o Meilisearch).
3. **Read replicas** de Postgres para reportes pesados.
4. **CDN** para assets de Next.js (Cloudflare delante de Railway).
5. **Integración SUNAT** para emisión de boletas / facturas electrónicas.
6. **API pública** (versionada `/v1/`) con OpenAPI generado por NestJS Swagger.

### Fase 4 — Inteligencia (visión)
1. **Optimización de rutas** con algoritmos VRP (Vehicle Routing Problem).
2. **Forecast de demanda** por cliente/zona con series temporales.
3. **App nativa para chofer** con captura de firma y foto de entrega.

---

## Apéndice A — Convenciones del repositorio

| Aspecto | Convención |
|---------|-----------|
| Package manager | `pnpm` (workspaces) |
| Estructura | Monorepo: `apps/backend`, `apps/frontend`, `packages/shared` |
| Estilo de código | TypeScript strict, ESLint, Prettier |
| Commits | Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`) |
| Ramas | `main` (estable), `feat/*`, `fix/*` |
| CI | GitHub Actions — lint + tests en cada PR |
| Despliegue | Railway.app (auto-deploy de `main`) |
| Naming BD | `snake_case` (vía `@map` de Prisma); modelos TS en `PascalCase` español |

## Apéndice B — Referencias

- Schema Prisma: [`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma)
- Estados de pedido: [`packages/shared/src/enums/order-status.ts`](../packages/shared/src/enums/order-status.ts)
- Estados de hoja: [`packages/shared/src/enums/dispatch-status.ts`](../packages/shared/src/enums/dispatch-status.ts)
- Transiciones permitidas: [`packages/shared/src/constants/order-transitions.ts`](../packages/shared/src/constants/order-transitions.ts)
- Bootstrap del backend: [`apps/backend/src/app.module.ts`](../apps/backend/src/app.module.ts)
- Plan de testing: [`docs/TESTING.md`](TESTING.md)
- Diagramas de flujo de negocio: [`docs/flujos/`](flujos/)
- ADR-001 (stack): [`docs/adr/ADR-001-stack-nestjs-nextjs.md`](adr/ADR-001-stack-nestjs-nextjs.md)
