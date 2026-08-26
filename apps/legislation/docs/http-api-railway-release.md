# Railway API release record

## Historical pre-unified-runtime release (deleted)

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

The old `legislation-api` service was deleted after the Next.js foundation teardown gate passed. `apps/legislation` is
the canonical application and release-record home. Railway retains the current service name `legislation-web`; it is
not a second canonical application. The deleted service is not a live rollback service, and no deployment should be
described as final API cutover until the remaining migration gates pass.

## Current production deployment

| Field | Recorded value |
| --- | --- |
| Service | `legislation-web` (`786fbca7-8798-4357-9b45-f0ba092a9750`) |
| Canonical application | `apps/legislation` |
| Source snapshot commit | `c3c5f43` (header-adapter defect fix; supersedes the subscription closure source `400edaf`) |
| Deployment | `e1781bbc-6526-4f87-8eb8-df39142bf11a` |
| Deployment status | `SUCCESS` |
| Previous rollback artifact | `4269326d-cc50-4023-81b0-c545d6c7206a` (superseded and `REMOVED`; redeploy its immutable source/image only if Railway supports it) |
| Public origin | `https://legislation-web-production-b024.up.railway.app` |
| Target port | `8080` |
| Railway service list after teardown | `legislation-web`, `pgbouncer`, `pgvector` |
| Old-service deletion | `legislation-api` (`05eb1486-7775-4797-b1c4-1b4a3f31cd26`), deleted 2026-08-25 after smoke |
| Unified verification | 227 test files passed with 2 skipped; 1,829 tests passed with 40 skipped; focused route acceptance passed; the Next.js production build succeeded |
| Foundation smoke | Health, readiness, and homepage returned `200`; unknown-route and unsupported-method checks returned `404` |
| Reviewed source handler coverage | 88 of 88 explicit Next.js handlers |
| Current deployment handler coverage | 88 of 88 explicit Next.js handlers |
| Authentication smoke | WorkOS mode is active with separate M2M API and AuthKit session authorities; current health returned `200` in `361ms`, readiness returned `200` in `179ms`, and the opt-in authenticated subscription and webhook lifecycle smokes passed 12 and 14 checks respectively |
| Subscription lifecycle smoke | Authenticated list `200`, create `201`, create replay `201`, filtered list `200`, detail `200`, patch `200`, stale revision `412`, events `200` empty Page, deliveries `200` empty Page, delete `200`, delete replay `200`, and cancelled visibility `200`; cancellation fixture remains cancelled by design |
| Webhook lifecycle smoke | All 14 checks passed: list `200`, create/replay `201`, pending filtered list `200`, detail `200`, patch/replay `200`, stale revision `412`, rotate/replay `200`, post-rotate detail `200`, delete/replay `200`, and cancelled visibility `200`; cancellation fixture remains cancelled by design |
| Next API database safety | PostgreSQL `statement_timeout` is set to `15s` for API requests |
| Search/diff/research production smoke | Deliberately paused while the document HNSW index is at `432502/648743` blocks and consumes database I/O; resume only after the index work is safe to exercise |

This is the current verified unified deployment from `apps/legislation`. The deleted `legislation-api` service is
historical evidence only; it is not a current service or a rollback target. The successful unified verification,
production build, and foundation smoke prove the consolidated runtime and operational boundary. Live authenticated
probes are recorded above; full expensive smoke remains deliberately paused while HNSW construction consumes database I/O.

The 14 subscription/webhook handlers are deployed, and Railway has separate WorkOS M2M and AuthKit session authorities plus
both application encryption secrets. `AUTH_MODE=workos` is active and the anonymous rejection boundary passed remote smoke;
the seven subscription and first six webhook operations are **Done** after authenticated lifecycle smoke. The webhook
verification operation remains **In progress** pending its challenge smoke. Across all 88 operations, release state is
53 **Done**, 10 **In progress**, and 25 **Blocked** by named production prerequisites. Authenticated functional smoke
must cover webhook verification and the provenance-complete change-feed rule before promoting remaining operations to Done.
The OpenStates plural `OPENSTATES_API_KEY` is corrected in both Railway and Trigger; the Alaska canary remains deferred while
the document HNSW index is at `432502/648743` blocks. Do not claim representative lookup completion from configuration alone.
Application-level API and MCP rate limiting is intentionally absent;
provider-specific ingestion retry behavior remains separate.

## Next.js foundation deployment configuration

The `legislation-web` service uses the repository root as its build context. Railway does not automatically discover
nested config files, so set the service Config File Path explicitly to `/apps/legislation/railway.json`. Before
deploying, verify the effective service configuration uses the Dockerfile builder, `apps/legislation/Dockerfile`, and
`/ready` as the health check. A deployment is not a foundation success if Railway used a different builder, Dockerfile,
or health path.

## Historical standalone checks (pre-unified-runtime)

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

## Historical jurisdiction and session remote deployment evidence

| Check | Result |
| --- | --- |
| Deployment | `legislation-web` deployment `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434` reached terminal `SUCCESS` from source commit `5de0383` |
| Production migrations | Schema migrations through the current ledger are applied |
| Alaska canonical foundation | Corrected publisher classification `legislature`; import `a89bc8c83d9c57893c731e090f9599cf094e9cb73e88fce5f0b7df44aadd357c` processed 6/6; idempotent rerun skipped 6 |
| Jurisdiction/session deployed smoke | All 11 jurisdiction/session operations plus rejection checks passed |
| Jurisdiction/session release state | The 11 operations are **Done**; the nationwide audit remains incomplete for 52 jurisdictions and 648 sessions |
| Old service teardown | `legislation-api` service `05eb1486-7775-4797-b1c4-1b4a3f31cd26` remains deleted |

The deployed API catch-all remains outside the 88-route inventory. The scoped Alaska import closed the jurisdiction/session data gate;
the incomplete nationwide audit does not reduce the passed 11-operation deployed smoke evidence.

## Documents and resources deployed smoke

| Outcome | Result |
| --- | --- |
| **Done** | 6 document/resource operations passed deployed smoke against the current `legislation-web` deployment. |
| Production-data blocked | Document detail and document-section collection remain blocked because the production records have `NULL` OCR status. |
| Production-data blocked | Global changes remains blocked because the production records lack source provenance. |
| Next endpoint block | People/organization and meeting/calendar delivery subsequently completed; their remaining operation-specific data gates are recorded below. |
| MCP | MCP remains last. Its browser-consent canary is blocked until a live Next.js MCP route exists. |

The three production-data-blocked operations are not **Done**. They require production data that satisfies their
documented contract, followed by a fresh deployed smoke, rather than a route or deployment change.

## People and organizations deployed smoke

| Outcome | Result |
| --- | --- |
| Deployment | Source commit `6afcf42` (including route commit `04ca95d`) deployed as `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`; terminal `SUCCESS`; image `sha256:a9bd51f8b4af80b50986b5f7bec35b272d8530c71ded44f10805635c51221f84`. |
| Cumulative smoke | Jurisdiction/session: 11 pass. Bills, amendments, and votes: 15 pass plus 3 vote-data skips. Documents/resources: 6 pass plus 3 canonical-data skips. People/organizations: 9 pass, four canonical-data skips, and one expected synthetic membership `404`. Health/readiness and rejection checks passed. |
| Route state | The 14 people/organization routes are implemented and deployed, but remain data-blocked and receive no Next-route Done credit because production has zero canonical-ready civic fixtures. |
| Rollback | Previous successful `legislation-web` deployment: `cc047806-27f7-4110-a6e0-7f27f4b4e517`. |
| Next endpoint block | Historical evidence. Meeting/calendar delivery subsequently completed. |

The four canonical-data skips cover person detail, term detail, organization collection, and organization detail. The
remaining people/organization smoke routes returned the documented empty-page, dependency, or expected-not-found outcomes. The
production fixture audit found no canonical-ready people, profiles, terms, organizations, memberships, calendars, or
required civic relationships, so data remediation is required before promoting these routes to Done.

## Meetings, calendars, and representative lookup deployed smoke

| Outcome | Result |
| --- | --- |
| Deployment | Source commit `866eb6f` deployed as `168b7b40-3457-48e1-a470-a45cf5b112a9`; terminal `SUCCESS`; image `sha256:2975fa98b4c408094ef66d80e0d3e07322a2e6cfe41fef6710815c1dae58b5a8`. |
| Historical split-runtime verification | `apps/legislation` verification passed 198 files with 2 skipped and 1,036 tests with 40 skipped. The former `apps/legislation-web` split app passed 22 files and 571 tests. Next.js `16.3.1` build and built router 173/173 passed. |
| Cumulative smoke | Production `/health` and `/ready` returned `200`; the meeting/calendar profile and all prior release profiles passed. |
| Done | Eight operations passed deployed smoke: meetings collection, meeting agenda list, meeting documents list and detail, meeting outcomes list, meeting participants list and detail, and calendars collection. |
| Canonical-fixture blocked | Meeting detail, meeting agenda-item detail, meeting outcome detail, calendar detail, and calendar meetings remain blocked and receive no Done credit. |
| Dependency-configuration blocked | Representative lookup remains blocked pending the production OpenStates canary. The plural `OPENSTATES_API_KEY` is now corrected in both Railway and Trigger, but the Alaska canary remains deferred while the document HNSW index is at `432502/648743` blocks; do not promote this route until a fresh POST smoke passes. |
| Rollback | Previous successful `legislation-web` deployment: `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`. |
| Next endpoint block | Search, document-difference, and research delivery is **In progress**. |

The meeting/calendar delivery block is complete. Its six named blockers are independent promotion gates: do not mark
them Done until the fixture or OpenStates production-canary prerequisite is resolved and deployed smoke is repeated.

## Search, document-difference, and research deployment history and current gate

| Outcome | Result |
| --- | --- |
| Handler coverage | 88 of 88 public operations have explicit deployed Next.js handlers. This includes 53 routes with Done release credit, 25 routes blocked by named production prerequisites, and 10 operations awaiting their documented release gates. |
| Deployment | Source commit `0a2748b` deployed as `35cfc3bb-ea63-477c-b467-6bf84a4200c5`; terminal `SUCCESS`. |
| Operational smoke | Production `GET /health` and `GET /ready` returned `200`. |
| Production endpoint smoke | Deliberately paused. Active HNSW index construction consumes database I/O, so the full expensive lexical, semantic, hybrid, diff, and research probes must wait. |
| Route state | All seven routes remain **In progress**. Do not mark them Done until cumulative production smoke passes after the index pressure is relieved. |

The subsequent unified-runtime source snapshot `3a498d1` deployed as
`9de2719a-d34e-46ee-a86e-09768058d1ff` with terminal `SUCCESS`. Its unified verification and foundation smoke are
recorded in the current production table above. That deployment supersedes `35cfc3bb-ea63-477c-b467-6bf84a4200c5`,
which is now the immediately preceding successful rollback target, but it does not change the route state.

The old `legislation-api` service remains deleted. The next action is to relieve or otherwise schedule around HNSW index
pressure, then run the complete search, document-difference, and research production smoke with audited fixtures, followed by
the remaining webhook verification smoke, and record the result here.

## Authenticated API release evidence

The current `legislation-web` deployment `e1781bbc-6526-4f87-8eb8-df39142bf11a` is sourced from snapshot `c3c5f43`,
including the header-adapter defect fix; it reached terminal `SUCCESS`. The prior deployment
`4269326d-cc50-4023-81b0-c545d6c7206a` is superseded and `REMOVED`. The release uses separate WorkOS
authorities for M2M API tokens and AuthKit user-session tokens. Prior bounded remote probes returned
`GET /health` `200` in `361ms` with `status`, `GET /ready` `200` in `179ms` with `databasePool/status`, an anonymous
protected API request `401` with the canonical challenge, authenticated `GET /api/organizations` `200` in `813ms` with
a canonical Page, authenticated `GET /api/supporting-materials?limit=1` `200` in `3977ms` with a canonical Page, and
authenticated `GET /api/bills?sort=introduced-desc&limit=1` `200` in `6691ms` with a canonical Page; correlation-ID echo
was observed. The opt-in authenticated subscription-lifecycle smoke passed all 12 checks listed in the current production
table, and the webhook lifecycle smoke passed all 14 checks: list `200`, create/replay `201`, pending filtered list `200`,
detail `200`, patch/replay `200`, stale revision `412`, rotate/replay `200`, post-rotate detail `200`, delete/replay `200`,
and cancelled visibility `200`; the cancellation fixture remains cancelled by design. The Next API sets PostgreSQL
`statement_timeout` to `15s`. These probes do not promote the 53/10/25 endpoint ledger beyond the six webhook operations and
seven subscription operations: webhook verification and the full authenticated cumulative smoke remain pending, and expensive
smoke is paused during active HNSW I/O.

## Next safe actions

1. Relieve or schedule around active HNSW index pressure, then run the pending search, document-difference, and research
   production smoke without reopening the meeting/calendar release. Keep every named fixture and configuration blocker explicit until it passes a fresh deployed smoke.
2. After that smoke passes, run authenticated challenge smoke for webhook verification and the provenance-complete change-feed
   rule. Do not treat empty collection probes, reviewed source, or fail-closed `403` behavior as release completion.
3. Keep MCP migration deferred until every API endpoint is complete and the authenticated API release gate passes; run
   its canary only after a live Next.js MCP route exists.

## Rollback

The current deployment is `e1781bbc-6526-4f87-8eb8-df39142bf11a`. The preceding deployment
`4269326d-cc50-4023-81b0-c545d6c7206a` was superseded and removed; it is not an active rollback deployment. If Railway
supports redeploying its immutable source/image, it may be used only after verifying the resulting deployment. After each
subsequent `legislation-web` deployment, record the prior known-good artifact and verify whether it remains available for
redeploy. The old `legislation-api` service was deleted at the foundation teardown gate and must not be recreated as a
rollback target.
Recheck `/health`, `/ready`, and every cumulative smoke profile after a rollback. Database migrations remain separate
from process startup.
