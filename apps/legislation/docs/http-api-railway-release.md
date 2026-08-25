# Railway API release record

## Current transitional release

| Field | Recorded value |
| --- | --- |
| Service | `legislation-api` |
| Public origin | `https://legislation-api-production-7096.up.railway.app` |
| Source commit | `2846332` |
| Active deployment | `f7c855ed-9b81-482b-9def-d3b3d8b90255` |
| Deployment status | `SUCCESS` |
| Previous successful deployment | `b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7` |
| Deployment contract | Repository-root Docker build context with `/apps/legislation/railway.json`; the standalone Node server binds Railway's `PORT` on `0.0.0.0`. Database migrations are not run at startup. |

This record preserves valid standalone-server deployment and authentication evidence from source commit `2846332` and
deployment `f7c855ed-9b81-482b-9def-d3b3d8b90255`. It is not a Next.js deployment and does not promote any endpoint's
Next route state. The approved replacement sequence is the
[Next.js API migration and staged release plan](nextjs-api-migration-plan.md).

The current public origin remains useful as a rollback target while the Next.js foundation and endpoint blocks are
released. It must not be described as the final application architecture.

## Verified checks

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

## Next safe actions

1. Complete the patched Next.js dependency gate and NX-01 foundation work.
2. Deploy the Next.js foundation without claiming endpoint migration, wait for terminal `SUCCESS`, and verify
   `/health`, `/ready`, 404, and unsupported-method behavior.
3. Migrate endpoint blocks in the plan's fixed order. After every block, record the new deployment ID, source commit,
   cumulative remote-smoke evidence, and the immediately preceding successful deployment as rollback.
4. Add authentication only after all 87 routes pass deployed smoke; add distributed rate limiting after auth; migrate
   MCP last.

## Rollback

Until the first Next.js deployment succeeds, an application regression rolls back to deployment
`f7c855ed-9b81-482b-9def-d3b3d8b90255` (or, if that deployment itself is under investigation,
`b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7`). After each Next.js block, the release record must replace this with the
immediately preceding known-good deployment. Recheck `/health`, `/ready`, and every cumulative smoke profile after a
rollback. Database migrations remain separate from process startup.
