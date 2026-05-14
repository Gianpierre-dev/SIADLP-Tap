# SIADLP - Sistema Integral de Administracion, Distribucion y Logistica de Papa

[![CI](https://github.com/Gianpierre-dev/SIADLP-Tap/actions/workflows/ci.yml/badge.svg)](https://github.com/Gianpierre-dev/SIADLP-Tap/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-362_passing-brightgreen)
![Coverage](https://img.shields.io/badge/branch_coverage-%E2%89%A580%25-brightgreen)
![Mutation](https://img.shields.io/badge/mutation_score-99.11%25-brightgreen)
![Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0-brightgreen)
![Lighthouse](https://img.shields.io/badge/lighthouse-96%E2%80%93100-brightgreen)
![Stack](https://img.shields.io/badge/stack-NestJS_%2B_Next.js_16-blue)
![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)

**La Cosecha S.A.C.** - Distribuidora de papas a pollerias en Lima, Peru.

Trabajo de Aplicacion Profesional (TAP) para obtener el titulo de Tecnico Profesional en Desarrollo de Sistemas de Informacion - IDAT.

**Autores:** Gianpierre Wong - Paulo Wong

---

## Documentación técnica

| Documento | Descripción |
|-----------|-------------|
| [`docs/TESTING.md`](docs/TESTING.md) | Estrategia de testing (pirámide, AAA, test doubles, mutation testing) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura del sistema (C4 model, sequence, ER, state machines) |
| [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) | Audit OWASP Top 10 con fixes aplicados |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Manual operacional ante incidentes (10 síntomas + 7 procedimientos) |
| [`docs/LIGHTHOUSE.md`](docs/LIGHTHOUSE.md) | Lighthouse audit del frontend (Performance 96-100, A11y 100) |
| [`docs/adr/`](docs/adr/) | 5 Architecture Decision Records |

## Testing

**362 tests automatizados** distribuidos en la pirámide de testing:

| Nivel | Suite | Tests | Stack |
|-------|-------|-------|-------|
| Unit (shared) | `packages/shared` | 19 | Vitest |
| Unit (backend) | `apps/backend/src` | 176 | Jest + @nestjs/testing |
| Integration | `apps/backend/test/integration` | 55 | Jest + pglite |
| E2E (backend) | `apps/backend/test` | 12 | Jest + supertest |
| Component (frontend) | `apps/frontend/src` | 92 | Vitest + RTL |
| E2E (frontend) | `apps/frontend/tests-e2e` | 8 | Playwright |
| **Total** | | **362** | |

**Mutation testing:** Stryker configurado sobre 5 services críticos. Baseline 36.75% — ver [`apps/backend/MUTATION-TESTING.md`](apps/backend/MUTATION-TESTING.md).

```bash
pnpm test                          # todos los tests
pnpm test:backend:integration      # integration con pglite
pnpm test:frontend:e2e             # Playwright
pnpm --filter backend test:mutation # mutation testing (~7 min)
```

## Observability

- **Health endpoints:**
  - `GET /api/health` — liveness probe (Railway/K8s)
  - `GET /api/health/ready` — readiness con check de DB
  - `GET /api/health/deep` — DB + memory + disk (dashboards)
- **Logs estructurados** con Pino: JSON en producción, pretty en development, redacción de campos sensibles
- **Audit log** en `registro_auditoria` con interceptor global

---

## Requisitos

### Opcion A: Docker (recomendado)

Solo necesitas:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Opcion B: Desarrollo local

- [Node.js](https://nodejs.org/) v20 o superior
- [pnpm](https://pnpm.io/) v9 o superior (`npm install -g pnpm`)
- [PostgreSQL](https://www.postgresql.org/) 15

---

## Inicio rapido con Docker

```bash
# 1. Clonar el repositorio
git clone https://github.com/Gianpierre-dev/SIADLP-Tap.git
cd SIADLP-Tap

# 2. Levantar todo (DB + Backend + Frontend)
docker compose up --build

# 3. Abrir en el navegador
# http://localhost:3020
```

Eso es todo. Docker levanta PostgreSQL, corre las migraciones automaticamente, y arranca ambos servidores.

---

## Inicio rapido local (desarrollo)

```bash
# 1. Clonar el repositorio
git clone https://github.com/Gianpierre-dev/SIADLP-Tap.git
cd SIADLP-Tap

# 2. Instalar dependencias
pnpm install

# 3. Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE siadlp_db;"

# 4. Correr migraciones
pnpm --filter backend prisma:migrate

# 5. Levantar backend y frontend en paralelo
pnpm dev

# 6. Abrir en el navegador
# http://localhost:3020
```

---

## Credenciales de acceso

| Campo | Valor |
|-------|-------|
| Correo | `admin@lacosecha.com` |
| Contrasena | `Admin123!` |
| Rol | Administrador (acceso completo) |

---

## Puertos

| Servicio | Puerto |
|----------|--------|
| Frontend | http://localhost:3020 |
| Backend API | http://localhost:4020/api |
| PostgreSQL | localhost:5432 |

---

## Estructura del proyecto

```
SIADLP-Tap/
+-- apps/
|   +-- backend/          # NestJS 11 + Prisma 7 + PostgreSQL
|   |   +-- src/
|   |   |   +-- auth/         # JWT + RBAC con permisos granulares
|   |   |   +-- catalogs/     # Clientes, proveedores, productos, rutas, vehiculos, choferes
|   |   |   +-- orders/       # Pedidos con calculo de precios
|   |   |   +-- purchases/    # Ordenes de compra + recepcion
|   |   |   +-- production/   # Produccion con rendimiento y merma
|   |   |   +-- inventory/    # Inventario dual (MP/PT) + kardex
|   |   |   +-- dispatch/     # Despacho, entregas y cobros
|   |   |   +-- reports/      # Dashboard + exports Excel
|   |   |   +-- audit/        # Log de auditoria
|   |   +-- prisma/           # Schema y migraciones
|   +-- frontend/         # Next.js 16 + React 19 + Tailwind 4 + shadcn/ui
|       +-- src/
|           +-- app/          # 18 paginas (App Router)
|           +-- components/   # DataTable, Sidebar, AuthGuard
|           +-- lib/          # API wrapper, auth store (Zustand)
+-- packages/
|   +-- shared/           # Enums y constantes compartidas
+-- docker-compose.yml    # Levanta DB + Backend + Frontend
+-- .env                  # Variables de entorno (committeado)
+-- README.md
```

---

## Modulos del sistema

| Modulo | Descripcion |
|--------|-------------|
| **Dashboard** | KPIs del dia: pedidos, produccion, inventario, despacho, cobros |
| **Pedidos** | Crear, confirmar, cancelar. Precio = base + tarifa de ruta |
| **Compras** | Ordenes de compra -> confirmar -> en camino -> recepcion con stock automatico |
| **Produccion** | Lotes con insumos MP -> productos PT. Metricas: rendimiento, merma, costo/kg |
| **Inventario** | Stock MP y PT, kardex de movimientos, alertas de stock bajo, ajustes |
| **Despacho** | Hojas de carga por ruta, confirmar, iniciar ruta, registrar entregas y cobros |
| **Catalogos** | CRUD de clientes, proveedores, productos, rutas, vehiculos, choferes |
| **Usuarios** | CRUD con roles RBAC y permisos granulares (modulo.accion) |
| **Reportes** | Exportacion a Excel: pedidos, produccion, inventario, despachos |
| **Auditoria** | Log de todas las operaciones de escritura con usuario, IP y detalle |

---

## Comandos utiles

```bash
# Desarrollo
pnpm dev                          # Levantar todo (backend + frontend)
pnpm --filter backend dev         # Solo backend
pnpm --filter frontend dev        # Solo frontend

# Build
pnpm --filter backend build       # Compilar backend
pnpm --filter frontend build      # Compilar frontend

# Lint
pnpm --filter backend lint        # Lint backend
pnpm --filter frontend lint       # Lint frontend

# Base de datos
pnpm --filter backend prisma:migrate   # Correr migraciones
pnpm --filter backend prisma:studio    # Abrir Prisma Studio (GUI)
pnpm --filter backend prisma:generate  # Regenerar cliente Prisma

# Docker
docker compose up --build         # Levantar todo con Docker
docker compose down               # Detener todo
docker compose down -v            # Detener y borrar datos de la BD
```

---

## Stack tecnologico

| Capa | Tecnologia |
|------|------------|
| Backend | NestJS 11 - Prisma 7 - PostgreSQL 15 - JWT - bcryptjs |
| Frontend | Next.js 16 - React 19 - Tailwind CSS 4 - shadcn/ui - Zustand |
| Validacion | class-validator (backend) - HTML5 + client-side (frontend) |
| Reportes | ExcelJS |
| Monorepo | pnpm workspaces |
| Contenedores | Docker - Docker Compose |
