# Despliegue en Railway — SIADLP

El sistema se despliega como **3 piezas** dentro de un mismo proyecto de Railway:

1. **PostgreSQL** (base de datos — plugin de Railway)
2. **Backend** (NestJS — usa `apps/backend/Dockerfile`)
3. **Frontend** (Next.js — usa `apps/frontend/Dockerfile`)

> Ambos servicios construyen desde la **raíz del repo** (monorepo pnpm). En cada
> servicio de Railway hay que indicar la ruta de su Dockerfile.

---

## Variables de entorno por servicio

### Backend
| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia al servicio Postgres) |
| `JWT_SECRET` | un secreto de **32+ caracteres** (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | `2h` |
| `CORS_ORIGINS` | la URL pública del **frontend** (ej. `https://siadlp-frontend.up.railway.app`) |
| `RAILWAY_DOCKERFILE_PATH` | `apps/backend/Dockerfile` |

> Railway inyecta `PORT` automáticamente; el backend ya lo usa.

### Frontend
| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | la URL pública del **backend** + `/api` (ej. `https://siadlp-backend.up.railway.app/api`) |
| `RAILWAY_DOCKERFILE_PATH` | `apps/frontend/Dockerfile` |

> `NEXT_PUBLIC_API_URL` se "hornea" en el build de Next.js, así que el backend
> debe estar desplegado **antes** para conocer su URL.

---

## Orden de despliegue (importante)

1. Crear el proyecto y agregar **PostgreSQL**.
2. Desplegar el **backend** → tomar su URL pública.
3. Desplegar el **frontend** con `NEXT_PUBLIC_API_URL` = URL del backend + `/api`.
4. Volver al backend y poner `CORS_ORIGINS` = URL del frontend.
5. Redeploy del backend para aplicar el CORS.

El backend, al arrancar, aplica migraciones y ejecuta el seed (crea el usuario
`admin@lacosecha.com` / `Admin123!`).
