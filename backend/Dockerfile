# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.0

FROM node:${NODE_VERSION}-bookworm-slim AS base

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*


FROM base AS dependencies

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund


FROM dependencies AS build

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Prisma validates the datasource while generating, so use non-secret, build-only
# placeholders. The generated client never embeds these connection values.
RUN DB_HOST=localhost \
    DB_PORT=5432 \
    DB_NAME=container_build \
    DB_USER=container_build \
    DB_PASSWORD=container_build \
    npm run prisma:generate \
    && npm run build


FROM dependencies AS production-dependencies

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

RUN npm prune --omit=dev --no-audit --no-fund


FROM base AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node


# Build with --target worker to run the PostgreSQL identity outbox worker.
FROM runtime AS worker

CMD ["node", "dist/workers/outbox.worker.js"]


# Build with --target migrate to create a one-shot, forward-only migration job.
FROM dependencies AS migrate

ENV NODE_ENV=production

COPY --chown=node:node prisma.config.ts ./prisma.config.ts
COPY --chown=node:node prisma ./prisma

USER node

CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]


# The final stage is the default production API image.
FROM runtime AS api

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || '5000') + '/api/v1/health/live').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "dist/server.js"]
