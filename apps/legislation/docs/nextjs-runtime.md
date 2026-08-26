# Next.js runtime and smoke boundary

## Ownership

`apps/legislation` is the canonical Legislative Intelligence application and documentation home. The deployed Railway
service retains the name `legislation-web`. That is a service identity, not a second canonical application. The Next.js
runtime, route handlers, and smoke harness belong to `apps/legislation`.

The deleted `legislation-api` Railway service is historical evidence only. It is neither a current service nor a
rollback target. Rollback uses the immediately preceding known-good `legislation-web` deployment.

## Runtime contract

Each documented public operation requires an explicit Next.js Route Handler. Root `GET /health` is liveness and root
`GET /ready` is database-backed readiness. Neither endpoint runs migrations. Browser code must never receive database
credentials, a machine-to-machine API secret, or a `NEXT_PUBLIC_*` copy of one.

The runtime is pinned to `next@16.3.1`, `react@19.2.7`, and `react-dom@19.2.7`. Next's build-only TypeScript API uses
the local `typescript@5.9.3` dependency; the repository's native TypeScript compiler remains the type-checking source
of truth. The deployment image is credential-free and uses a frozen install without copying workstation registry
credentials.

## Current release boundary

There are 73 explicit Next.js route handlers out of 87 public operations. Of those, 40 have release **Done** credit,
26 remain blocked by named production data, fixture, or dependency prerequisites, and the seven NX-04 search, diff,
and research routes are deployed but remain **In progress** until their production smoke passes. The remaining 14
subscription and webhook routes are behind the NX-04 phase gate.

The current deployment is source commit `0a2748b`, deployed as Railway deployment
`35cfc3bb-ea63-477c-b467-6bf84a4200c5` with terminal `SUCCESS`. Its `/health` and `/ready` checks returned `200`.
NX-04 production smoke is intentionally still pending: active HNSW index pressure must be relieved before exercising
semantic and hybrid search in production. A successful deployment and health checks do not promote NX-04 routes to
**Done** without that smoke evidence.

Authentication remains after all 87 routes complete deployed smoke. Distributed rate limiting follows authentication.
MCP migration is last and remains blocked until both earlier gates are complete.

## Smoke procedure

Run the deployed smoke only with an audited production origin and audited fixtures. The harness lives in
`apps/legislation/scripts/smoke-deployment.mjs`; use its documented `LEGISLATION_SMOKE_*` environment variables. The
profile is cumulative for every released route block.

```powershell
$env:LEGISLATION_SMOKE_BASE_URL = 'https://legislation-web-production-b024.up.railway.app'
pnpm --filter legislation smoke:deployment
```

For NX-04, configure its audited query, expected-outcome, bill, document, and research-fixture variables. Do not run
that profile while HNSW index pressure is active. The harness keeps fixture
identities, query text, coordinates, research prompts, tokens, and model errors out of its stable report.

See the [migration plan](nextjs-api-migration-plan.md) for route-state accounting and the
[Railway API release record](http-api-railway-release.md) for immutable release evidence.
