# Documentation

Focused reference pages for this monorepo. Keep pages **small and single-purpose**, and **update them in the same PR**
as the change they describe.

## Index

Legislation workspace documentation: [web](../apps/legislation-web/docs/README.md),
[ingestion](../apps/legislation-ingestion/docs/README.md), [MCP](../apps/legislation-mcp/docs/README.md),
and [core](../packages/legislation-core/docs/README.md). See
[runtime setup](../apps/legislation-web/docs/operations/development.md) for local credentials after the move and
[verification](../apps/legislation-web/docs/operations/testing.md#full-verification) for the current `pnpm verify`
legislation gate.
The [prototype telemetry specification](../apps/legislation-web/docs/engineering/telemetry-spec.md) focuses on
debugging failures and slowness with safe Sentry/Langfuse diagnostics, not product analytics or replay.
The [legislation diffing package](../packages/legislation-diffing/README.md) owns deterministic full-text comparison;
its app consumers and Storybook prototypes do not perform legal interpretation or amendment application.

Outstand product research: [documentation index](../apps/outstand/docs/README.md), including the
[Planable feature analysis](../apps/outstand/docs/planable-feature-analysis.md) and
[platform coverage and plans](../apps/outstand/docs/planable-coverage-and-plans.md).

| Page                             | What it covers                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tech-stack.md](tech-stack.md)   | The preferred tools we reach for first (by category). Deviating requires a discussion with a human.                                                         |
| [conventions.md](conventions.md) | General conventions — quality gates, tests, imports, file/component layout; links out to the pages below.                                                   |
| [react.md](react.md)             | React component conventions, product-level UI-system selection and styling, and the state/error/URL/routing/form libraries.                                 |
| [typescript.md](typescript.md)   | TypeScript/type conventions **and** the type-helper libraries (`ts-extras`, `ts-pattern`, `tiny-invariant`, `zod`) — read before writing a new type helper. |
| [hooks.md](hooks.md)             | React hook conventions **and** the full `@mantine/hooks` catalog — read before writing a new hook.                                                          |
| [database-performance.md](database-performance.md) | Privacy-safe PostgreSQL query statistics and the targeted AI diagnosis workflow. |
| [database-refresh-policy.md](database-refresh-policy.md) | Complete production-to-staging table policies, privacy boundaries and refresh release gates. |
| [environments-and-deployments.md](environments-and-deployments.md) | Legislation CI/CD, Railway environments, database refreshes, migration ownership, previews and CDN policy. |
