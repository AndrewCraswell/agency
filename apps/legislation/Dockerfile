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
COPY packages/typescript-config ./packages/typescript-config
COPY apps/legislation ./apps/legislation
COPY apps/legislation/pnpm-workspace.railway.yaml ./pnpm-workspace.yaml

# The isolated workspace selects only legislation's dependency closure while
# retaining frozen lockfile and integrity validation.
RUN pnpm install --frozen-lockfile --trust-lockfile --ignore-scripts --filter legislation...
RUN pnpm --filter legislation build
# Next's standalone tracer can retain @swc/helpers' pnpm symlink while omitting
# its versioned target. Copy that target into the traced production closure.
RUN cp --parents -R node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers \
      apps/legislation/.next/standalone/
RUN test -f apps/legislation/.next/standalone/apps/legislation/server.js
RUN test -f apps/legislation/.next/standalone/node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers/esm/_interop_require_default.js

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN groupadd --system --gid 10001 legislation \
  && useradd --system --uid 10001 --gid legislation legislation

COPY --from=build --chown=legislation:legislation /workspace/apps/legislation/.next/standalone/ ./
COPY --from=build --chown=legislation:legislation /workspace/apps/legislation/.next/static/ ./apps/legislation/.next/static/
COPY --from=build --chown=legislation:legislation /workspace/apps/legislation/public/ ./apps/legislation/public/

USER 10001
WORKDIR /app/apps/legislation
EXPOSE 3000

CMD ["node", "server.js"]
