# MCP documentation

M owns the standalone resource, SDK transport, authentication composition and outbound typed HTTP adapter. It calls W
over HTTPS, never databases, models or source providers. C supplies shared schemas/research definitions/auth primitives.

| Need | Read |
| --- | --- |
| Configuration, build/start, health/readiness and smoke | [Runtime README](../README.md) |
| Failure diagnostics, correlation and redaction | [Sentry telemetry](operations/telemetry.md) |
| Resource registration and pending browser consent | [Authentication](operations/authentication.md) |
| Registered baseline tools | [Tool contracts](engineering/tool-contracts.md) |
| Relationship listings, counts, rates and rankings | [Analytics contract](../../../packages/legislation-core/docs/engineering/relationship-analytics.md) |
| Regulatory mapping and exact-text transport | [Legal tools](engineering/legal-tools.md) |
| Unit tests, isolated built-process acceptance and distinct-origin boundaries | [Testing](operations/testing.md) |

Commands from the repository root: `pnpm --filter legislation-mcp dev`, `pnpm --filter legislation-mcp build`,
`pnpm --filter legislation-mcp start`, `pnpm --filter legislation-mcp test`. Smoke requires independently provisioned
MCP credentials and an explicit M origin; W's API token is not an MCP token.

Cross-owner references: [W product/API](../../legislation-web/docs/README.md),
[W search contract](../../legislation-web/docs/engineering/api/search-and-diffs.md),
[I evidence](../../legislation-ingestion/docs/README.md), [C contracts](../../../packages/legislation-core/docs/README.md),
[single final legislation gate](../../legislation-web/docs/operations/testing.md#full-verification).
W lives at `apps/legislation-web`. Local fixture/rejection tests and historical combined-host evidence
do not establish standalone deployment, consent, revocation or production legal coverage.