# Railway API release record

## Historical pre-NX-01 release (deleted)

| Field | Recorded value |
| --- | --- |
| Service | `legislation-api` |
| Public origin | `https://legislation-api-production-7096.up.railway.app` |
| Source commit | `2846332` |
| Active deployment | `f7c855ed-9b81-482b-9def-d3b3d8b90255` |
| Deployment status | `SUCCESS` |
| Previous successful deployment | `b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7` |
| Service status | Deleted 2026-08-25 after the Next.js foundation deployment and remote health/readiness smoke passed |
| Deployment contract | Repository-root Docker build context with `/apps/legislation/railway.json`; the standalone Node server binds Railway's `PORT` on `0.0.0.0`. Database migrations are not run at startup. |

This record preserves valid standalone-server deployment and authentication evidence from source commit `2846332` and
deployment `f7c855ed-9b81-482b-9def-d3b3d8b90255`. It is not a Next.js deployment and does not promote any endpoint's
Next route state. The approved replacement sequence is the
[Next.js API migration and staged release plan](nextjs-api-migration-plan.md).

The old `legislation-api` service was deleted after the Next.js foundation teardown gate passed. The Next.js route source
is the existing `apps/legislation-web/app/api` boundary, and its deployment is the current Railway service named
`legislation-web`. The `apps/legislation` service remains reusable domain code plus transitional standalone source; it is
not a live rollback service. Neither service should be described as final API cutover until the migration gates pass.

## Current Next.js foundation release

| Field | Recorded value |
| --- | --- |
| Service | `legislation-web` (`786fbca7-8798-4357-9b45-f0ba092a9750`) |
| Source commit | `d344cc0` |
| Deployment | `50a71f45-0d55-4ce7-9872-806c21043490` |
| Deployment status | `SUCCESS` |
| Public origin | `https://legislation-web-production-b024.up.railway.app` |
| Target port | `8080` |
| Railway service list after teardown | `legislation-web`, `pgbouncer`, `pgvector` |
| Old-service deletion | `legislation-api` (`05eb1486-7775-4797-b1c4-1b4a3f31cd26`), deleted 2026-08-25 after smoke |

This is the NX-01 foundation deployment only. It does not credit any of the 87 public API routes as migrated.

## Next.js foundation deployment configuration

The new `legislation-web` service uses the repository root as its build context. Railway does not automatically discover
nested config files, so set the service Config File Path explicitly to `/apps/legislation-web/railway.json`. Before
deploying, verify the effective service configuration uses the Dockerfile builder, `apps/legislation-web/Dockerfile`,
and `/ready` as the health check. A deployment is not a foundation success if Railway used a different builder, Dockerfile,
or health path.

## Historical standalone checks (pre-NX-01)

The following checks passed after the active deployment was healthy. These are deployment and release-preparation
evidence; endpoint completion remains governed by the implementation backlog and local endpoint smoke checklist.

| Check | Result |
| --- | --- |
| `GET /health` | `200` with the expected liveness status and matching correlation ID |
| `GET /ready` | `200` with PostgreSQL pool readiness |
| Protected API without a bearer token | `401` with the expected JSON error envelope, correlation ID, and challenge |
| `GET /mcp` without a bearer token | `401` with the expected challenge |
| OAuth protected-resource metadata | Published for the MCP resource |
| Authenticated remote `scoped-bills` profile | Passed 7/7: health, readiness, unknown route, unsupported method, auth rejection, and canonical nonempty jurisdiction/session bill pages for `jurisdiction:ak` and `session:ak:30` |
| API-audience M2M token at `/mcp` | `401`, as expected because MCP accepts only its resource audience |

The reviewed local `scoped-bills` smoke profile also passed. The remote release profile verified canonical,
nonempty `Page<BillSummary>` responses for the jurisdiction- and session-scoped bill collections, as well as the
server's health, readiness, and rejection-path behavior. Its scope remains intentionally narrower than the full API
acceptance checklist.

## NX-01 remote foundation evidence

| Check | Result |
| --- | --- |
| Deployment | `legislation-web` deployment `50a71f45-0d55-4ce7-9872-806c21043490` reached terminal `SUCCESS` from source commit `d344cc0` |
| `GET /health` | `200` with `{ "status": "ok" }` |
| `GET /ready` | `200` with `{ "databasePool": { "active": 0, "idle": 1, "maximum": 8, "saturation": 0, "total": 1, "waiting": 0 }, "status": "ready" }` |
| `POST /health` | JSON `404` with correlation ID preserved |
| Old service teardown | `legislation-api` service `05eb1486-7775-4797-b1c4-1b4a3f31cd26` deleted after the deployment and health/readiness gates passed |

Active NX-02A gate: generic unknown Next.js paths still return the framework's HTML `404`. The API catch-all must
normalize unknown `/api/**` paths to the standard JSON error envelope before the first endpoint-block smoke; this does
not add a route to the 87-endpoint inventory.

## Next safe actions

1. Close the active NX-02A API catch-all gate by normalizing generic unknown `/api/**` paths to the standard JSON error
   envelope.
2. Begin NX-02A with the 11 Ready jurisdictions and sessions routes. After the block passes local and deployed smoke,
   redeploy `legislation-web` and record the new deployment ID, source commit, cumulative remote-smoke evidence, and the
   immediately preceding successful `legislation-web` deployment as rollback.
3. Continue the migration plan's fixed endpoint-block order; do not begin authentication until all 87 routes pass
   deployed smoke.
4. Add distributed rate limiting after authentication; migrate MCP last.

## Rollback

The NX-01 foundation deployment `50a71f45-0d55-4ce7-9872-806c21043490` is the current rollback baseline. After each
subsequent `legislation-web` deployment, rollback uses only the immediately preceding known-good `legislation-web`
deployment; the old `legislation-api` service was deleted at the NX-01 teardown gate and must not be recreated as a
rollback target. Recheck `/health`, `/ready`, and every cumulative smoke profile after a rollback. Database migrations
remain separate from process startup.
