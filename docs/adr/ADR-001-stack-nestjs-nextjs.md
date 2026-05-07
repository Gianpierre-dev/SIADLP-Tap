# ADR-001: Stack backend NestJS + frontend Next.js

## Status

Accepted

## Context

SIADLP es un sistema interno para La Cosecha S.A.C. que opera flujos transaccionales (pedidos, despachos, entregas) y un dashboard administrativo con tablas, formularios complejos y reportes Excel. El equipo es pequeño (dos desarrolladores), el plazo es académico-acotado y el sistema debe ser entregado como monorepo con tipado fuerte de extremo a extremo.

Necesitamos un stack que cumpla simultáneamente cuatro criterios:

1. **Arquitectura modular y testeable en el backend.** El sistema crece por módulos de dominio (auth, catalogs, orders, dispatch, audit). Cada módulo debe ser aislable, con sus controllers, services y tests propios.
2. **Renderizado mixto SSR/CSR y buen DX para un dashboard rico en interacción.** Hay vistas que se benefician de renderizado en servidor (listas paginadas, reportes) y otras puramente interactivas (formularios complejos con cascada de ubigeo).
3. **Un único lenguaje en todas las capas** para reducir cambios de contexto y compartir tipos (enums de estado, constantes de negocio) vía workspace package.
4. **Ecosistema maduro con documentación abundante** — el equipo va a aprender mientras construye, así que la disponibilidad de tutoriales, issues resueltos y librerías mantenidas es decisiva.

## Decision

Adoptar **NestJS 11** en el backend y **Next.js 16 (App Router)** en el frontend, ambos sobre **TypeScript estricto** (`"strict": true`) y orquestados como **monorepo pnpm workspaces** con un paquete compartido `packages/shared` para enums y constantes de dominio.

**NestJS** provee la columna vertebral del backend:

- Módulos con metadata (`@Module`) que delimitan dominios (`AuthModule`, `OrdersModule`, `DispatchModule`).
- Inyección de dependencias declarativa, lo que permite swap de implementaciones en tests con un `.overrideProvider()`.
- Decoradores para controllers (`@Controller`, `@Get`, `@Post`), services (`@Injectable`) y guards (`@UseGuards`).
- Integración nativa con `class-validator` para DTOs y con `class-transformer` para serialización.
- Testing utilities oficiales (`@nestjs/testing`) que arman módulos en memoria con DI real.

**Next.js App Router** habilita:

- React Server Components por defecto, con opt-in a Client Components mediante `"use client"`.
- Layouts anidados que persisten entre navegaciones (sidebar, header del dashboard).
- Data fetching server-side colocado junto al componente que consume los datos.
- Streaming SSR con `Suspense` para mejorar tiempo a primer byte en vistas pesadas.

## Implementation notes

- El monorepo se organiza con `pnpm workspaces`: `apps/backend`, `apps/frontend`, `packages/shared`.
- El paquete compartido se referencia con `"shared": "workspace:*"` y se importa como `import { PEDIDO_ESTADOS } from 'shared'`.
- El backend expone `/api/*` y el frontend lo consume vía un wrapper en `apps/frontend/src/lib/api.ts`.
- En desarrollo se levantan ambos en paralelo con `pnpm dev` (script root). En Docker, cada app tiene su propio Dockerfile multi-stage.
- El frontend usa `shadcn/ui` (componentes copiados al repo, no dependencia) sobre `@base-ui/react` y Tailwind 4 — alineado con el ecosistema React 19.

## Consequences

### Positive

- **Tipado end-to-end:** los enums de estado (`PEDIDO_ESTADOS`, `HOJA_CARGA_ESTADOS`) viven en `packages/shared` y los consumen ambos lados; un cambio en `shared` rompe ambos builds simultáneamente — esto es deseable porque obliga a sincronizar contratos.
- **Arquitectura por capas explícita:** controller → service → repository (Prisma) facilita testear cada capa de forma aislada y aplicar la pirámide de testing.
- **DI de NestJS** permite inyectar mocks/fakes en unit tests sin parcheo global. El `Test.createTestingModule()` arma un contenedor DI específico para cada suite.
- **Guards declarativos** (`@UseGuards(JwtAuthGuard, PermisosGuard)`) y decoradores propios (`@RequierePermisos('pedidos.crear')`) hacen que la autorización sea legible en el handler.
- **App Router de Next.js** elimina la dualidad `getServerSideProps` / `getStaticProps` y simplifica el modelo mental de data fetching: si el componente es Server Component, hace `await fetch()` directamente.
- **Comunidad y documentación grandes:** ambos frameworks son estándares de facto en sus respectivos lados, con tutoriales abundantes y libros publicados.

### Negative

- Curva inicial de NestJS (decoradores, módulos, providers, scopes) es más empinada que Express puro. Para alguien que viene de Express toma una semana adaptarse al modelo mental.
- App Router de Next.js es relativamente nuevo y algunas librerías del ecosistema React aún se publican pensando en Pages Router; ocasionalmente hay incompatibilidades sutiles que requieren wrappers Client Component.
- La diferenciación Server Component vs Client Component en Next 16 exige disciplina mental para no arrastrar código pesado al cliente.
- TypeScript estricto en monorepo exige disciplina: cualquier cambio de contrato en `shared` invalida tipos de ambos lados a la vez (esto es deseable pero ruidoso al refactorizar).

## Alternatives considered

- **Express puro:** descartado. No impone estructura: cada microdecisión (cómo organizar rutas, dónde poner middleware, cómo inyectar dependencias) queda a criterio del autor. Los patrones DI/guards/interceptors hay que reimplementar a mano y eso es exactamente el problema que NestJS resuelve. Mal fit para un sistema que va a ser revisado por evaluadores que esperan ver una arquitectura reconocible.
- **Koa / Fastify:** ecosistemas más chicos. Fastify es muy performante pero no tiene la integración first-party con ORMs, validadores y testing utilities que tiene NestJS. Para un MVP académico la velocidad de desarrollo importa más que el throughput por request.
- **Spring Boot (Java) / .NET (C#):** stacks profesionales y maduros, pero exigen dos lenguajes (back y front) y rompen la promesa de monorepo TypeScript con tipos compartidos. Además, el deploy en Railway con build cache y hot reload es mucho más fricción que con Node.
- **Create React App + Express:** dos repos separados, pierde tipos compartidos, no soporta SSR/RSC y CRA está oficialmente en modo mantenimiento desde 2023 (la React team recomienda Next.js o Vite).
- **Remix:** buen framework, pero el modelo de loaders/actions co-localizados con la ruta es menos compatible con la pauta del curso (API REST tradicional documentada con guards de NestJS y consumida por separado).
- **Astro:** orientado a sitios content-first con "islands architecture"; pobre fit para un dashboard SPA con muchas interacciones, formularios complejos y tablas paginadas server-side.
- **Vite + React puro (sin framework de routing):** posible para el frontend, pero exige montar manualmente routing, data fetching y SSR. Reimplementar Next.js a mano no aporta valor.

## References

- NestJS — https://docs.nestjs.com/
- Next.js App Router — https://nextjs.org/docs/app
- TypeScript Handbook — https://www.typescriptlang.org/docs/handbook/intro.html
- pnpm workspaces — https://pnpm.io/workspaces
- React Server Components RFC — https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md
- Martin Fowler, *Inversion of Control Containers and the Dependency Injection pattern* — https://martinfowler.com/articles/injection.html
- Repositorio del proyecto — `apps/backend/src/main.ts`, `apps/frontend/src/app/layout.tsx`
