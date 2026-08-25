# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.1

FROM node:${NODE_VERSION}-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV npm_config_registry=https://registry.npmjs.org/
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /workspace

# Railway must retain the repository root as the Docker build context because
# this application extends the shared workspace TypeScript configuration and
# committed lockfile/catalog. Do not copy the workstation's private registry
# configuration into the build image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/oxlint-config ./packages/oxlint-config
COPY packages/typescript-config ./packages/typescript-config
COPY apps/legislation ./apps/legislation
COPY apps/legislation-web ./apps/legislation-web
COPY apps/legislation-web/pnpm-workspace.railway.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile --ignore-scripts --filter legislation... --filter legislation-web...
RUN pnpm --filter legislation-web build
# Fail the image build clearly if the application stops producing the traced
# production dependency closure required by the standalone runtime.
RUN test -f apps/legislation-web/.next/standalone/apps/legislation-web/server.js

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN groupadd --system --gid 10001 legislation-web \
  && useradd --system --uid 10001 --gid legislation-web legislation-web

COPY --from=build --chown=legislation-web:legislation-web /workspace/apps/legislation-web/.next/standalone/ ./
COPY --from=build --chown=legislation-web:legislation-web /workspace/apps/legislation-web/.next/static/ ./apps/legislation-web/.next/static/

USER 10001
WORKDIR /app/apps/legislation-web
EXPOSE 3000

# The generated Next server reads Railway's injected PORT. Database migrations
# are not part of this browser application's startup path.
CMD ["node", "server.js"]
