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
| Focused strict MCP HTTP parity canary | `getBill` passed for `bill:ak:30:hb:1` against the same production snapshot with exact recursive direct QueryService versus deployed HTTP-adapter equality; correlation ID `bd7dda5d-104b-47d8-8ffa-2251e2abbcda` |

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

The focused strict `getBill` parity canary has passed, but the committed HTTP and hybrid query adapters remain dormant.
Production is intentionally configured to use the direct in-process adapter. Even if hybrid mode is selected later, its
default empty allowlist makes no HTTP calls until an operator explicitly enables a method after remote parity passes.

## Next safe actions

1. Run the full authenticated API profile when the remaining approved bill, document, amendment, vote, material,
   meeting, person, and organization fixture IDs are available.
2. Run the remaining MCP-to-HTTP parity rows for the mapped products against one snapshot. Missing parity routes
   remain blockers; do not substitute direct data access in the adapter.
3. Run an MCP-resource authenticated canary. The API-audience token's expected `/mcp` rejection is not MCP canary
   success evidence.
4. Only after the MCP-resource canary passes, use `LEGISLATION_MCP_TRANSPORT=hybrid` with `getBill` as the single
   explicit allowlist method. Observe authorization and latency, then retain the in-process switch as the immediate
   rollback path while further methods are canaried.

## Rollback

For an application regression, redeploy the previous successful `legislation-api` deployment
`b00f37c0-50c1-4e95-91e3-1ba3bfa5d1d7`, then recheck `/health`, `/ready`, protected API rejection, and MCP
authentication. Database migrations stay backward-compatible and remain separate from process startup. For an HTTP
adapter regression after a future canary, restore `LEGISLATION_MCP_TRANSPORT=in-process` before considering an image
rollback.
