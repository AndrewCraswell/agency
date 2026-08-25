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

## Last verified Next.js source deployment

| Field | Recorded value |
| --- | --- |
| Service | `legislation-web` (`786fbca7-8798-4357-9b45-f0ba092a9750`) |
| Source commit | `5de0383` |
| Deployment | `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434` |
| Deployment status | `SUCCESS` |
| Public origin | `https://legislation-web-production-b024.up.railway.app` |
| Target port | `8080` |
| Production schema migrations | Applied through the current ledger |
| Railway service list after teardown | `legislation-web`, `pgbouncer`, `pgvector` |
| Old-service deletion | `legislation-api` (`05eb1486-7775-4797-b1c4-1b4a3f31cd26`), deleted 2026-08-25 after smoke |

This is the last verified source deployment for the in-progress NX-02A block. It does not credit any of the 87 public API
routes as migrated or **Done**.

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

## NX-02A remote deployment evidence

| Check | Result |
| --- | --- |
| Deployment | `legislation-web` deployment `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434` reached terminal `SUCCESS` from source commit `5de0383` |
| Production migrations | Schema migrations through the current ledger are applied |
| Alaska canonical foundation | Corrected publisher classification `legislature`; import `a89bc8c83d9c57893c731e090f9599cf094e9cb73e88fce5f0b7df44aadd357c` processed 6/6; idempotent rerun skipped 6 |
| NX-02A deployed smoke | All 11 jurisdiction/session operations plus rejection checks passed |
| Current release state | NX-02A's 11 operations are **Done**; the nationwide audit remains incomplete for 52 jurisdictions and 648 sessions |
| Old service teardown | `legislation-api` service `05eb1486-7775-4797-b1c4-1b4a3f31cd26` remains deleted |

The deployed API catch-all remains outside the 87-route inventory. The scoped Alaska import closed NX-02A's data gate;
the incomplete nationwide audit does not reduce the passed 11-operation deployed smoke evidence.

## Next safe actions

1. Deploy NX-02B. Its route/composition code has passed root review and local verification; all 18 routes still require
   deployed smoke before they can be **Done**.
3. Continue the migration plan's fixed endpoint-block order; do not begin authentication until all 87 routes pass
   deployed smoke.
4. Add distributed rate limiting after authentication; migrate MCP last.

## Rollback

The last verified source deployment is `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434`. After each subsequent
`legislation-web` deployment, rollback uses only the immediately preceding known-good `legislation-web` deployment; the
old `legislation-api` service was deleted at the NX-01 teardown gate and must not be recreated as a rollback target.
Recheck `/health`, `/ready`, and every cumulative smoke profile after a rollback. Database migrations remain separate
from process startup.
