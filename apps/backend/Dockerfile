FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/backend/ apps/backend/
COPY .env .env

# Build shared package first, then backend
RUN pnpm --filter @siadlp/shared build
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

WORKDIR /app/apps/backend
EXPOSE 4020

CMD ["sh", "-c", "npx dotenv -e ../../.env -- npx prisma migrate deploy && npx dotenv -e ../../.env -- node dist/src/main"]
