FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

# Install all dependencies (including devDependencies for build).
# --ignore-scripts: el postinstall compila el código, pero acá todavía no está
# (solo los package.json); el build explícito se hace más abajo tras copiar el source.
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/backend/ apps/backend/
COPY scripts/ scripts/

# Build shared package first, then backend
# (las variables de entorno vienen de la plataforma: Railway o docker-compose)
RUN pnpm --filter @siadlp/shared build
RUN pnpm --filter backend exec prisma generate
RUN pnpm --filter backend build

WORKDIR /app/apps/backend
EXPOSE 4020

# En Railway/compose las variables vienen del entorno (no de un archivo .env).
# Aplica migraciones, ejecuta el seed (idempotente) y arranca la API.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/src/main"]
