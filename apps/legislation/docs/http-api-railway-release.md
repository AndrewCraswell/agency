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

## Current Next.js source deployment

| Field | Recorded value |
| --- | --- |
| Service | `legislation-web` (`786fbca7-8798-4357-9b45-f0ba092a9750`) |
| Source commit | `27fa397` |
| Deployment | `cc047806-27f7-4110-a6e0-7f27f4b4e517` |
| Deployment status | `SUCCESS` |
| Image | `sha256:121ef83d948e400d0f73c1d4d17fecce248153916fcf71936228bc3b0ff3e227` |
| Rollback deployment | `c8238bec-5a3b-4335-8dee-ecf8568c6a06` |
| Public origin | `https://legislation-web-production-b024.up.railway.app` |
| Target port | `8080` |
| Railway service list after teardown | `legislation-web`, `pgbouncer`, `pgvector` |
| Old-service deletion | `legislation-api` (`05eb1486-7775-4797-b1c4-1b4a3f31cd26`), deleted 2026-08-25 after smoke |

This is the current verified source deployment. The deleted `legislation-api` service is historical evidence only; it is
not a current service or a rollback target.

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

## Historical NX-02A remote deployment evidence

| Check | Result |
| --- | --- |
| Deployment | `legislation-web` deployment `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434` reached terminal `SUCCESS` from source commit `5de0383` |
| Production migrations | Schema migrations through the current ledger are applied |
| Alaska canonical foundation | Corrected publisher classification `legislature`; import `a89bc8c83d9c57893c731e090f9599cf094e9cb73e88fce5f0b7df44aadd357c` processed 6/6; idempotent rerun skipped 6 |
| NX-02A deployed smoke | All 11 jurisdiction/session operations plus rejection checks passed |
| NX-02A release state | NX-02A's 11 operations are **Done**; the nationwide audit remains incomplete for 52 jurisdictions and 648 sessions |
| Old service teardown | `legislation-api` service `05eb1486-7775-4797-b1c4-1b4a3f31cd26` remains deleted |

The deployed API catch-all remains outside the 87-route inventory. The scoped Alaska import closed NX-02A's data gate;
the incomplete nationwide audit does not reduce the passed 11-operation deployed smoke evidence.

## NX-02C deployed smoke

| Outcome | Result |
| --- | --- |
| **Done** | 6 NX-02C operations passed deployed smoke against the current `legislation-web` deployment. |
| Production-data blocked | Document detail and document-section collection remain blocked because the production records have `NULL` OCR status. |
| Production-data blocked | Global changes remains blocked because the production records lack source provenance. |
| Next endpoint block | NX-03A starts next. |
| MCP | MCP remains last. Its browser-consent canary is blocked until a live Next.js MCP route exists. |

The three production-data-blocked operations are not **Done**. They require production data that satisfies their
documented contract, followed by a fresh deployed smoke, rather than a route or deployment change.

## Next safe actions

1. Start NX-03A and retain the distinction between route behavior and production-data evidence.
2. Continue the migration plan's fixed endpoint-block order; do not begin authentication until all 87 routes pass
   deployed smoke.
3. Add distributed rate limiting after authentication. Migrate MCP last, and run its canary only after a live Next.js
   MCP route exists.

## Rollback

The current deployment is `cc047806-27f7-4110-a6e0-7f27f4b4e517`; its rollback target is the prior successful
`legislation-web` deployment `c8238bec-5a3b-4335-8dee-ecf8568c6a06`. After each subsequent `legislation-web`
deployment, rollback uses only the immediately preceding known-good `legislation-web` deployment. The old
`legislation-api` service was deleted at the NX-01 teardown gate and must not be recreated as a rollback target.
Recheck `/health`, `/ready`, and every cumulative smoke profile after a rollback. Database migrations remain separate
from process startup.
