# SIADLP

Sistema de Informacion para la Administracion y Distribucion de Papa Procesada — La Cosecha S.A.C.

## Requisitos

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 15 (local o Docker)

## Instalacion

```bash
# Clonar e instalar dependencias
git clone <repo-url>
cd SIADLP-Tap
pnpm install

# Base de datos (opcion 1: PostgreSQL local)
# Crear la base de datos siadlp_db manualmente

# Base de datos (opcion 2: Docker)
docker compose up -d

# Ejecutar migraciones
cd apps/backend && pnpm prisma:migrate

# Iniciar ambos servicios
pnpm dev
```

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `pnpm dev` | Inicia backend (3000) y frontend (3001) |
| `pnpm dev:backend` | Solo backend |
| `pnpm dev:frontend` | Solo frontend |
| `pnpm build` | Build de produccion |
| `pnpm test` | Ejecuta tests del backend |

## Estructura

```
apps/backend/    → NestJS API (puerto 3000)
apps/frontend/   → Next.js Web (puerto 3001)
packages/shared/ → Tipos y constantes compartidas
docs/            → Documentacion del TAP
```

## Autores

- Anthony Gianpierre Terrazas Tello
- Paulo Cesar Wong Diaz
