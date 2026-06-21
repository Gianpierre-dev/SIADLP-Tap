# SIADLP — Sistema Integrado de Administración y Distribución Logística de Papas

[![CI](https://github.com/Gianpierre-dev/SIADLP-Tap/actions/workflows/ci.yml/badge.svg)](https://github.com/Gianpierre-dev/SIADLP-Tap/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-362_passing-brightgreen)
![Stack](https://img.shields.io/badge/stack-NestJS_11_%2B_Next.js_16-blue)
![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)

Sistema web que automatiza el proceso de **distribución logística** de la empresa **La Cosecha S.A.C.** (distribuidora de papa procesada a pollerías de Lima): registro de pedidos, armado de hojas de carga por ruta, asignación de vehículos y choferes, registro de entregas en campo, dashboard ejecutivo y auditoría.

> Trabajo de Aplicación Profesional (TAP) — Técnico en Desarrollo de Sistemas de Información, IDAT.
> **Autores:** Anthony Gianpierre Terrazas Tello · Paulo Cesar Wong Diaz

---

## 🧱 Stack Tecnológico

| Capa | Tecnologías |
|------|-------------|
| **Frontend** | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui · Zustand 5 |
| **Backend** | NestJS 11 · TypeScript · JWT · class-validator · RBAC con permisos granulares |
| **Base de datos** | PostgreSQL 15 · Prisma ORM 7 |
| **Infraestructura** | Monorepo pnpm workspaces · Docker · Docker Compose |
| **Calidad** | Jest · Vitest · Playwright · pglite · Stryker (mutation testing) · GitHub Actions |

---

## ✅ Requisitos Previos

Antes de empezar, asegurate de tener instalado:

| Herramienta | Versión mínima | Verificar con |
|-------------|----------------|---------------|
| **Node.js** | 20 LTS | `node -v` |
| **pnpm** | 9+ | `pnpm -v` |
| **Docker Desktop** | reciente | `docker -v` |
| **Git** | reciente | `git --version` |

> ¿No tenés pnpm? Instalalo con: `npm install -g pnpm`

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/Gianpierre-dev/SIADLP-Tap.git
cd SIADLP-Tap
```

### 2. Instalar dependencias (todo el monorepo)

```bash
pnpm install
```

### 3. Configurar variables de entorno

Copiá el archivo de ejemplo y completá los valores:

```bash
cp .env.example .env
```

Contenido del `.env` (raíz del proyecto):

```env
# Base de datos — la password (sql) debe coincidir con la de docker-compose.yml
DATABASE_URL="postgresql://postgres:sql@localhost:5432/siadlp_db"

# Autenticación — GENERÁ UN SECRETO PROPIO de 32+ caracteres
JWT_SECRET="cambia-esto-por-un-secreto-seguro-de-32-o-mas-caracteres"
JWT_EXPIRES_IN="2h"

# Servidor
API_PORT=4020
CORS_ORIGINS=http://localhost:3020

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4020/api
```

> 🔐 **Seguridad:** generá tu propio `JWT_SECRET`. En Git Bash / Linux / Mac:
> `openssl rand -hex 32`

### 4. Levantar la base de datos, migrar y poblar

**Opción rápida (todo en un comando):**

```bash
pnpm setup
```

Esto levanta PostgreSQL en Docker, aplica las migraciones y ejecuta el seed.

**Opción manual (paso a paso):**

```bash
# a) Levantar el servidor PostgreSQL y CREAR la base de datos "siadlp_db"
docker compose up -d db

# b) Generar el cliente de Prisma (solo genera el código, NO crea tablas)
pnpm --filter backend prisma:generate

# c) CREAR LAS TABLAS en la base de datos (aplica las migraciones)
pnpm --filter backend prisma:migrate

# d) Poblar la base con datos iniciales (roles, permisos, usuarios demo, ubigeo)
pnpm --filter backend prisma:seed
```

> **¿Qué comando crea la base de datos?**
> - `docker compose up -d db` → levanta PostgreSQL y crea la base vacía `siadlp_db`.
> - `pnpm --filter backend prisma:migrate` → crea las **tablas** dentro de esa base.
> - `prisma:generate` **no** toca la base: solo genera el cliente TypeScript.
>
> Si NO usás Docker, necesitás un PostgreSQL propio (instalado o en la nube) con una base
> `siadlp_db` creada, y apuntar `DATABASE_URL` a él antes del paso (c).

### 5. Iniciar la aplicación (modo desarrollo)

```bash
pnpm dev
```

Esto levanta **backend y frontend en paralelo**:

| Servicio | URL |
|----------|-----|
| 🖥️ **Frontend** | http://localhost:3020 |
| ⚙️ **Backend (API)** | http://localhost:4020/api |

### 6. Iniciar sesión

El seed crea usuarios de demostración. Contraseña para todos: **`Admin123!`**

| Rol | Correo |
|-----|--------|
| Administrador | `admin@lacosecha.com` |
| Gerente (Supervisor) | `supervisor@lacosecha.com` |
| Jefe de Despacho | `despacho@lacosecha.com` |
| Vendedor | `vendedor@lacosecha.com` |
| Chofer | `chofer@lacosecha.com` |

---

## 🐳 Ejecutar todo con Docker (opcional)

Para levantar base de datos + backend + frontend en contenedores:

```bash
docker compose up -d --build
```

Para detener y eliminar todo (incluyendo datos):

```bash
docker compose down -v
```

---

## 📜 Comandos Disponibles

### Desarrollo

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Levanta backend + frontend en paralelo |
| `pnpm dev:backend` | Solo el backend |
| `pnpm dev:frontend` | Solo el frontend |
| `pnpm build` | Compila todo el monorepo |
| `pnpm lint` | Linter en todos los paquetes |

### Base de datos (Prisma)

| Comando | Descripción |
|---------|-------------|
| `pnpm --filter backend prisma:generate` | Genera el cliente de Prisma |
| `pnpm --filter backend prisma:migrate` | Aplica/crea migraciones |
| `pnpm --filter backend prisma:seed` | Puebla la base con datos iniciales |
| `pnpm --filter backend prisma:studio` | Abre Prisma Studio (explorador visual de la BD) |
| `pnpm setup:fresh` | Reinicia la BD desde cero (borra datos + migra + seed) |

### Pruebas

| Comando | Descripción |
|---------|-------------|
| `pnpm test` | Pruebas unitarias (backend + frontend) |
| `pnpm test:backend:integration` | Pruebas de integración (pglite) |
| `pnpm test:backend:e2e` | Pruebas E2E del backend (supertest) |
| `pnpm test:frontend:e2e` | Pruebas E2E del frontend (Playwright) |
| `pnpm test:cov` | Pruebas con reporte de cobertura |
| `pnpm test:all` | **Toda la suite** (362 pruebas) |
| `pnpm --filter backend test:mutation` | Mutation testing con Stryker |

---

## 📁 Estructura del Proyecto

```
SIADLP-Tap/
├── apps/
│   ├── backend/          # API NestJS 11 (módulos por dominio)
│   │   ├── prisma/       # schema.prisma, migraciones y seed
│   │   └── src/          # auth, users, roles, catalogs, orders,
│   │                     # dispatch, reports, audit, empresa, ubigeo
│   └── frontend/         # App Next.js 16 (App Router)
│       └── src/app/      # rutas: /login, /pedidos, /despacho, etc.
├── packages/
│   └── shared/           # Tipos y enums compartidos (máquina de estados)
├── docs/                 # ADRs, ARCHITECTURE, TESTING, RUNBOOK, SECURITY-AUDIT
├── scripts/              # Datos de ubigeo del Perú (seed)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

---

## 📚 Documentación Técnica

| Documento | Contenido |
|-----------|-----------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura del sistema (C4, secuencia, ER, máquinas de estado) |
| [`docs/TESTING.md`](docs/TESTING.md) | Estrategia de testing (pirámide, AAA, test doubles, mutation) |
| [`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) | Auditoría de seguridad |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Operación y despliegue |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (decisiones de diseño) |

---

## 👥 Autores

- **Anthony Gianpierre Terrazas Tello** — Scrum Master · Backend · Líder Técnico
- **Paulo Cesar Wong Diaz** — Frontend · QA

Proyecto desarrollado para **La Cosecha S.A.C.** · Lima, Perú · 2026
