# Railway API release record

## Current release

| Field | Recorded value |
| --- | --- |
| Service | `legislation-api` |
| Public origin | `https://legislation-api-production-7096.up.railway.app` |
| Source commit | `2846332` |
| Active deployment | `f7c855ed-9b81-482b-9def-d3b3d8b90255` |
| Deployment status | `SUCCESS` |
| Previous successful deployment | `b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7` |
| Deployment contract | Repository-root Docker build context with `/apps/legislation/railway.json`; the server binds Railway's `PORT` on `0.0.0.0`. Database migrations are not run at startup. |

This record preserves valid deployment and authentication evidence from source commit `2846332` and deployment
`f7c855ed-9b81-482b-9def-d3b3d8b90255`. It is not a route-registration record for current HEAD. Current HEAD
intentionally leaves `GET /api/bills/{id}` unregistered. Nothing in this deployment record promotes an endpoint.

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

1. Run release smoke only for exact registered routes: global and jurisdiction/session-scoped bill collections,
   supporting-material list and detail routes, and singular document or supporting-material section routes. Add
   canonical bill and supporting-material search-route coverage once those routes are landed and reviewed. Blocked
   amendment, vote, meeting, person, and organization routes require their data and schema implementation first;
   fixture discovery alone does not advance them.
2. Keep endpoint states governed by the implementation backlog and local smoke checklist; this release record alone
   does not promote any endpoint.

## Rollback

For an application regression, redeploy the previous successful `legislation-api` deployment
`b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7`, then recheck `/health`, `/ready`, protected API rejection, and MCP
authentication. Database migrations stay backward-compatible and remain separate from process startup.
