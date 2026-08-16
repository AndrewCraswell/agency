FROM ghcr.io/pnpm/pnpm:11.9.0 AS pnpm

FROM node:24.13.1-bookworm-slim AS build
WORKDIR /workspace
RUN apt-get update \
  && apt-get install --yes --no-install-recommends libatomic1 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=pnpm /opt/pnpm /opt/pnpm
RUN ln --symbolic /opt/pnpm/pnpm /usr/local/bin/pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/legislation/package.json apps/legislation/package.json
COPY packages/oxlint-config/package.json packages/oxlint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter legislation...
COPY apps/legislation apps/legislation
COPY packages/oxlint-config packages/oxlint-config
COPY packages/typescript-config packages/typescript-config
RUN pnpm --filter legislation build
RUN pnpm --filter legislation deploy --prod --legacy /prod/legislation

FROM node:24.13.1-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 10001 legislation && useradd --system --uid 10001 --gid legislation legislation
COPY --from=build --chown=legislation:legislation /prod/legislation ./
USER 10001
EXPOSE 3100
CMD ["node", "dist/cli/main.js", "serve"]
