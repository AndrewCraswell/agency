FROM node:24.13.1-bookworm-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2 AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agentic/package.json apps/agentic/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --filter agentic --prod --frozen-lockfile --ignore-scripts

FROM node:24.13.1-bookworm-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /workspace/apps/agentic/node_modules ./apps/agentic/node_modules
COPY --chown=node:node apps/agentic ./apps/agentic
RUN mkdir -p /workspace/apps/agentic/artifacts && chown node:node /workspace/apps/agentic/artifacts

USER node
WORKDIR /workspace/apps/agentic
EXPOSE 3000 3001
ENTRYPOINT ["node", "../../node_modules/tsx/dist/cli.mjs"]
CMD ["src/controlPlane/worker.ts"]