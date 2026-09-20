# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.1

FROM node:${NODE_VERSION}-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV npm_config_registry=https://registry.npmjs.org/
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /workspace

# Railway retains the repository root as the build context because the app
# extends shared workspace configuration and uses the committed lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/oxlint-config ./packages/oxlint-config
COPY packages/storybook-config ./packages/storybook-config
COPY packages/typescript-config ./packages/typescript-config
COPY packages/legislation-core ./packages/legislation-core
COPY packages/legislation-diffing ./packages/legislation-diffing
COPY apps/legislation-web ./apps/legislation-web
COPY apps/legislation-web/pnpm-workspace.railway.yaml ./pnpm-workspace.yaml

# The isolated workspace selects only legislation-web's dependency closure while
# retaining frozen lockfile and integrity validation.
RUN pnpm install --frozen-lockfile --trust-lockfile --ignore-scripts --filter legislation-web...
RUN pnpm --filter legislation-web build
# Next's standalone tracer can retain @swc/helpers' pnpm symlink while omitting
# its versioned target. Copy that target into the traced production closure.
RUN cp --parents -R node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers \
  apps/legislation-web/.next/standalone/
RUN test -f apps/legislation-web/.next/standalone/apps/legislation-web/server.js
RUN test -f apps/legislation-web/.next/standalone/node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers/esm/_interop_require_default.js

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN groupadd --system --gid 10001 legislation \
  && useradd --system --uid 10001 --gid legislation legislation

COPY --from=build --chown=legislation:legislation /workspace/apps/legislation-web/.next/standalone/ ./
COPY --from=build --chown=legislation:legislation /workspace/apps/legislation-web/.next/static/ ./apps/legislation-web/.next/static/
COPY --from=build --chown=legislation:legislation /workspace/apps/legislation-web/public/ ./apps/legislation-web/public/

USER 10001
WORKDIR /app/apps/legislation-web
EXPOSE 3000

CMD ["node", "server.js"]
