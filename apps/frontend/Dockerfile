FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/frontend/package.json apps/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/frontend/ apps/frontend/

# Build shared package first, then frontend
RUN pnpm --filter @siadlp/shared build

# Set env at build time for Next.js static optimization
ARG NEXT_PUBLIC_API_URL=http://localhost:4020/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter frontend build

WORKDIR /app/apps/frontend
EXPOSE 3020

CMD ["pnpm", "start", "-p", "3020"]
