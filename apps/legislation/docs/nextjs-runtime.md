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

Reviewed source and the current production deployment both contain 88 of 88 explicit Next.js route handlers. Sixty-six
have release **Done** credit and 22 remain blocked by named production data, fixture, or dependency prerequisites. No
route remains **In progress** after the authenticated search, document-difference, and research smoke passed.

The shared Next.js API boundary now authenticates supported and catch-all `/api/**` requests in WorkOS mode, installs
only the verified user and optional organization identity in request context, and returns the canonical `401` challenge
before endpoint handlers run. Health and readiness remain public. Production requires both encryption keys, while the
release procedure separately requires `AUTH_MODE=workos` and the public WorkOS verifier values. The subscription and
webhook lifecycle gates and the cumulative authenticated search, document-difference, and research gate have passed.
Remaining blocked routes require their named production fixtures rather than authentication changes.

Set `LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET` and `LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY` to independent
base64 or base64url-encoded 32-byte values in production. The names are deployment configuration only and are never
returned to clients or written to logs.

The current unified deployment is source snapshot commit `819a0fc`, deployed as Railway deployment
`9824b674-c55e-4933-8cec-a68475746f5f` with terminal `SUCCESS`. Remote health and readiness returned `200`; unknown routes
and unsupported methods returned `404`; and the authenticated cumulative profile passed all seven search,
document-difference, and research operations without a search skip. Commits `1fa13a0`, `36e7060`, `e72b5c4`, and
`819a0fc` contain the classification-backfill safety fix and final production query work.

Search, document-difference, and research production smoke is complete. All five embedding HNSW indexes are valid and
ready, all four embedding tables have current statistics, both page-range constraints are valid, and no PostgreSQL index
build remains active.

The authenticated API performance release is complete for every route that has its required production data. MCP
migration and MCP smoke are the next deferred step; work stopped before that step as requested.

## Smoke procedure

Run the deployed Next.js smoke only with an audited production origin and audited fixtures. The unified harness lives
in `apps/legislation/scripts/smoke-foundation.mjs`; use its documented `LEGISLATION_WEB_SMOKE_*` environment variables.
The profile is cumulative for every enabled route block.

```powershell
$env:LEGISLATION_WEB_SMOKE_BASE_URL = 'https://legislation-web-production-b024.up.railway.app'
$env:LEGISLATION_WEB_SMOKE_TOKEN = Read-Host 'API bearer token'
pnpm --filter legislation smoke:foundation
```

`LEGISLATION_WEB_SMOKE_TOKEN` is optional for an isolated runtime with authentication disabled and required when the
target uses `AUTH_MODE=workos`. The harness sends it only as an in-memory `Authorization: Bearer` header for `/api/**`
requests. It does not send the token to `/health`, `/ready`, or the homepage and does not include it in reports or
diagnostics.

For search, document-difference, and research smoke, configure the audited query, expected-outcome, bill, document,
and research-fixture variables. Before repeating an expensive profile, verify no index build is active. The harness keeps fixture
identities, query text, coordinates, research prompts, tokens, and model errors out of its stable report.

See the [migration plan](nextjs-api-migration-plan.md) for route-state accounting and the
[Railway API release record](http-api-railway-release.md) for immutable release evidence.
