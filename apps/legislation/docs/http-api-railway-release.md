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
| Runtime transport | `LEGISLATION_MCP_TRANSPORT=in-process` |
| Hybrid allowlist | Empty. No MCP method calls the HTTP API in production. |
| Deployment contract | Repository-root Docker build context with `/apps/legislation/railway.json`; the server binds Railway's `PORT` on `0.0.0.0`. Database migrations are not run at startup. |

This record preserves valid deployment and authentication evidence from source commit `2846332` and deployment
`f7c855ed-9b81-482b-9def-d3b3d8b90255`. It is not a route-registration record for current HEAD. Current HEAD
intentionally leaves `GET /api/bills/{id}` unregistered, so historical `getBill` evidence cannot authorize an MCP
HTTP or hybrid allowlist entry.

## Verified checks

The following checks passed after the active deployment was healthy. The authenticated scoped-bills row is endpoint
completion evidence for its two documented collection routes; the remaining rows are release-preparation checks.

| Check | Result |
| --- | --- |
| `GET /health` | `200` with the expected liveness status and matching correlation ID |
| `GET /ready` | `200` with PostgreSQL pool readiness |
| Protected API without a bearer token | `401` with the expected JSON error envelope, correlation ID, and challenge |
| `GET /mcp` without a bearer token | `401` with the expected challenge |
| OAuth protected-resource metadata | Published for the MCP resource |
| Authenticated remote `scoped-bills` profile | Passed 7/7: health, readiness, unknown route, unsupported method, auth rejection, and canonical nonempty jurisdiction/session bill pages for `jurisdiction:ak` and `session:ak:30` |
| API-audience M2M token at `/mcp` | `401`, as expected because MCP accepts only its resource audience |
| Historical deployed strict MCP HTTP parity canary | `getBill` passed for `bill:ak:30:hb:1` against the then-deployed snapshot with exact recursive direct QueryService versus deployed HTTP-adapter equality; correlation ID `bd7dda5d-104b-47d8-8ffa-2251e2abbcda`. This evidence is stale for current HEAD and is non-authorizing because `GET /api/bills/{id}` is intentionally unregistered. |

The reviewed local `scoped-bills` smoke profile also passed. The authenticated remote profile verified canonical,
nonempty `Page<BillSummary>` responses for the jurisdiction- and session-scoped bill collections, as well as the
server's health, readiness, and rejection-path behavior. Its scope remains intentionally narrower than the full API
acceptance and MCP-parity checklist.

## Authentication resolution and MCP cutover gate

`WORKOS_API_AUDIENCE` now supplies the dedicated audience for API authentication. The API accepts a token issued for
that audience or the MCP resource audience; MCP itself accepts only the MCP resource audience. This separates the API
and MCP canaries without changing the protected-resource metadata served for MCP.

An ephemeral M2M token issued for `WORKOS_API_AUDIENCE` passed the remote scoped-bills profile and received the
expected `401` at `/mcp`. The ephemeral WorkOS application was deleted and verified absent after the run. This closes
the Railway API release smoke gate without granting an API-audience credential access to MCP.

The historical deployed `getBill` parity canary is retained as release evidence only. It does not show that current
HEAD registers `GET /api/bills/{id}` and must not be used to enable `getBill`. Production is intentionally configured
to use the direct in-process adapter, and the hybrid allowlist is empty, so no MCP method calls the HTTP API.

## Next safe actions

1. Run authenticated smoke only for exact registered routes: global and jurisdiction/session-scoped bill collections,
   supporting-material list and detail routes, and singular document or supporting-material section routes. Add
   canonical bill and supporting-material search-route coverage once those routes are landed and reviewed. Blocked
   amendment, vote, meeting, person, and organization routes require their data and schema implementation first;
   fixture discovery alone does not advance them.
2. Treat only canonical `searchBills` and query-present `searchSupportingMaterials` as the next MCP HTTP candidates.
   `getBill` is not a candidate while current HEAD intentionally leaves `GET /api/bills/{id}` unregistered.
3. For each candidate, first prove shared direct-MCP and HTTP output parity against one database snapshot. Missing
   parity routes remain blockers; do not substitute direct data access in the adapter.
4. Run a remote same-snapshot canary for the candidate, then run an MCP-resource authenticated canary. The API-audience
   token's expected `/mcp` rejection is not MCP canary success evidence.
5. Only after shared output parity, the remote same-snapshot canary, and MCP-resource authentication all pass may an
   operator select `LEGISLATION_MCP_TRANSPORT=hybrid` and explicitly allowlist one of those candidates. Keep the
   allowlist empty until then and retain the in-process switch as the immediate rollback path.

## Rollback

For an application regression, redeploy the previous successful `legislation-api` deployment
`b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7`, then recheck `/health`, `/ready`, protected API rejection, and MCP
authentication. Database migrations stay backward-compatible and remain separate from process startup. For an HTTP
adapter regression after a future canary, restore `LEGISLATION_MCP_TRANSPORT=in-process` before considering an image
rollback.
