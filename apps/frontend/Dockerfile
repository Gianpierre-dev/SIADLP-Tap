FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/frontend/package.json apps/frontend/

# Install all dependencies (including devDependencies for build).
# --ignore-scripts: el postinstall del monorepo asume el código completo;
# acá compilamos lo necesario explícitamente más abajo.
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/frontend/ apps/frontend/

# Build shared package first, then frontend
RUN pnpm --filter @siadlp/shared build

# Reset to production for Next.js build
ENV NODE_ENV=production

# Set env at build time for Next.js static optimization
ARG NEXT_PUBLIC_API_URL=http://localhost:4020/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter frontend build

WORKDIR /app/apps/frontend
EXPOSE 3020

# Railway inyecta PORT; localmente cae a 3020.
CMD ["sh", "-c", "pnpm start -p ${PORT:-3020}"]
