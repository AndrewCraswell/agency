FROM node:24.13.1-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 10001 legislation \
  && useradd --system --uid 10001 --gid legislation legislation

# Build from the self-contained context produced by `pnpm container:prepare`.
# It contains compiled output and production dependencies only.
COPY --chown=legislation:legislation . ./

USER 10001
EXPOSE 3100
CMD ["node", "dist/cli/main.js", "serve"]
