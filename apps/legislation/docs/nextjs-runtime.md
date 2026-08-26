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

Reviewed source now contains 88 of 88 explicit Next.js route handlers. The current production deployment contains 73 of
88: 40 have release **Done** credit, 26 remain blocked by named production data, fixture, or dependency prerequisites,
and the seven search, document-difference, and research routes are deployed but remain **In progress** until their
production smoke passes. The 14 subscription and webhook handlers, compositions, and local tests exist only in reviewed
source and are not part of the current production image.

The shared Next.js API boundary now authenticates supported and catch-all `/api/**` requests in WorkOS mode, installs
only the verified user and optional organization identity in request context, and returns the canonical `401` challenge
before endpoint handlers run. Health and readiness remain public. Production requires both encryption keys, while the
release procedure separately requires `AUTH_MODE=workos` and the public WorkOS verifier values. Functional
subscription/webhook deployment still requires the blocked search, document-difference, and research smoke, those
Railway values, both keys, deployment, and cumulative authenticated smoke; until then all 14 routes remain **In
progress**.

Set `LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET` and `LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY` to independent
base64 or base64url-encoded 32-byte values in production. The names are deployment configuration only and are never
returned to clients or written to logs.

The current unified deployment is source snapshot commit `3a498d1`, deployed as Railway deployment
`9de2719a-d34e-46ee-a86e-09768058d1ff` with terminal `SUCCESS`. Unified verification passed 221 test files with 2
skipped and 1,688 tests with 40 skipped; all 212 built-router acceptance tests and the Next.js production build also
passed. Foundation smoke returned `200` for health, readiness, and the homepage, and `404` for the unknown-route and
unsupported-method checks. The immediately preceding successful rollback deployment is
`35cfc3bb-ea63-477c-b467-6bf84a4200c5`.

Search, document-difference, and research production smoke is intentionally still pending: active HNSW index pressure
must be relieved before exercising semantic and hybrid search in production. A successful deployment, verification,
build, and foundation smoke do not promote those routes to **Done** without endpoint evidence.

Authentication enables functional subscription/webhook release verification after the blocked search,
document-difference, and research smoke. MCP migration is deferred until after the authenticated API release.

## Smoke procedure

Run the deployed Next.js smoke only with an audited production origin and audited fixtures. The unified harness lives
in `apps/legislation/scripts/smoke-foundation.mjs`; use its documented `LEGISLATION_WEB_SMOKE_*` environment variables.
The profile is cumulative for every enabled route block.

```powershell
$env:LEGISLATION_WEB_SMOKE_BASE_URL = 'https://legislation-web-production-b024.up.railway.app'
pnpm --filter legislation smoke:foundation
```

For search, document-difference, and research smoke, configure the audited query, expected-outcome, bill, document,
and research-fixture variables. Do not run that profile while HNSW index pressure is active. The harness keeps fixture
identities, query text, coordinates, research prompts, tokens, and model errors out of its stable report.

See the [migration plan](nextjs-api-migration-plan.md) for route-state accounting and the
[Railway API release record](http-api-railway-release.md) for immutable release evidence.
