# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.1

FROM node:${NODE_VERSION}-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV npm_config_registry=https://registry.npmjs.org/

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /workspace

# Railway must keep the repository root as the Docker build context. The
# legislation build extends workspace TypeScript configuration and relies on
# the root lockfile/catalog even though only this application is compiled.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/legislation ./apps/legislation
# The application image has no dependency on the monorepo's other products.
# Use an app-local workspace view so unrelated private packages and package
# extensions cannot make this filtered, frozen install unreproducible.
COPY apps/legislation/pnpm-workspace.railway.yaml ./pnpm-workspace.yaml

# The reviewed, frozen workspace lockfile contains private dependencies for
# unrelated applications. Railway cannot query those private registries during
# pnpm's whole-lockfile supply-chain verification, even though this filtered
# install never consumes those packages. Trust only this committed lockfile so
# pnpm installs the legislation dependency closure without weakening package
# integrity checks for downloaded artifacts.
RUN pnpm install --frozen-lockfile --trust-lockfile --filter legislation...
RUN pnpm --filter legislation build
RUN pnpm --filter legislation deploy --prod --legacy --force /opt/legislation

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV LEGISLATION_HOST=0.0.0.0

WORKDIR /app

RUN groupadd --system --gid 10001 legislation \
  && useradd --system --uid 10001 --gid legislation legislation

COPY --from=build --chown=legislation:legislation /opt/legislation/ ./

USER 10001
EXPOSE 3100

# Migrations are an explicit release operation and are intentionally absent
# from the API container startup path.
CMD ["node", "dist/cli/main.js", "serve"]
