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

Reviewed source and the current production deployment both contain 88 of 88 explicit Next.js route handlers. Forty have
release **Done** credit, 25 remain blocked by named production data, fixture, or dependency prerequisites, and 23 remain
**In progress** until their required remote functional smoke passes.

The shared Next.js API boundary now authenticates supported and catch-all `/api/**` requests in WorkOS mode, installs
only the verified user and optional organization identity in request context, and returns the canonical `401` challenge
before endpoint handlers run. Health and readiness remain public. Production requires both encryption keys, while the
release procedure separately requires `AUTH_MODE=workos` and the public WorkOS verifier values. Functional
subscription/webhook release still requires the blocked search, document-difference, and research smoke plus cumulative
authenticated smoke; until then all 14 routes remain **In progress**.

Set `LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET` and `LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY` to independent
base64 or base64url-encoded 32-byte values in production. The names are deployment configuration only and are never
returned to clients or written to logs.

The current unified deployment is source snapshot commit `7bb8a68`, deployed as Railway deployment
`f6a0534f-c56e-479f-b201-a086cd0f678a` with terminal `SUCCESS`. Bounded verification passed 227 test files with 2
skipped and 1,829 tests with 40 skipped; focused route acceptance and the Next.js production build also passed. Remote
health and readiness returned `200`, and an anonymous protected API request returned the canonical `401` challenge. The
immediately preceding successful rollback deployment is `9de2719a-d34e-46ee-a86e-09768058d1ff`.

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
