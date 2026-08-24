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
# Modern `pnpm deploy` requires injected workspace packages. Keep that setting
# local to this image instead of changing install semantics for the monorepo.
RUN node -e "const fs=require('node:fs');const p='pnpm-lock.yaml';const s=fs.readFileSync(p,'utf8');const a='settings:\\n';if(!s.startsWith('lockfileVersion:')||!s.includes(a)||s.includes('injectWorkspacePackages:'))throw new Error('unexpected lockfile settings');fs.writeFileSync(p,s.replace(a,a+'  injectWorkspacePackages: true\\n'))"

# The reviewed, frozen lockfile was produced through a registry proxy. Keep its
# exact versions while refreshing proxy-specific tarball checksums against the
# public registry. The isolated workspace installs only legislation's closure.
RUN pnpm install --frozen-lockfile --trust-lockfile --update-checksums --filter legislation...
RUN pnpm --filter legislation build
RUN pnpm --filter legislation deploy --prod --force /opt/legislation

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
