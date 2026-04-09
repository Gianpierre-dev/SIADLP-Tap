# SIADLP - Sistema Integral de Administracion, Distribucion y Logistica de Papa

**La Cosecha S.A.C.** - Distribuidora de papas a pollerias en Lima, Peru.

Trabajo de Aplicacion Profesional (TAP) para obtener el titulo de Tecnico Profesional en Desarrollo de Sistemas de Informacion - IDAT.

**Autores:** Gianpierre Wong - Paulo Wong

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
