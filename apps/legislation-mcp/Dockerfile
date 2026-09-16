FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/legislation-web/vendor/ai-7.0.94.tgz ./apps/legislation-web/vendor/ai-7.0.94.tgz
COPY apps/legislation-mcp ./apps/legislation-mcp
COPY packages/legislation-core ./packages/legislation-core
COPY packages/typescript-config ./packages/typescript-config
COPY packages/oxlint-config ./packages/oxlint-config
RUN pnpm --filter legislation-mcp... install --frozen-lockfile --ignore-scripts
RUN pnpm --filter legislation-mcp build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/legislation-mcp/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.mjs"]