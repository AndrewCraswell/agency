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
| Source snapshot commit | `7bb8a68` |
| Deployment | `f6a0534f-c56e-479f-b201-a086cd0f678a` |
| Deployment status | `SUCCESS` |
| Previous successful rollback deployment | `9de2719a-d34e-46ee-a86e-09768058d1ff` |
| Public origin | `https://legislation-web-production-b024.up.railway.app` |
| Target port | `8080` |
| Railway service list after teardown | `legislation-web`, `pgbouncer`, `pgvector` |
| Old-service deletion | `legislation-api` (`05eb1486-7775-4797-b1c4-1b4a3f31cd26`), deleted 2026-08-25 after smoke |
| Unified verification | 227 test files passed with 2 skipped; 1,829 tests passed with 40 skipped; focused route acceptance passed; the Next.js production build succeeded |
| Foundation smoke | Health, readiness, and homepage returned `200`; unknown-route and unsupported-method checks returned `404` |
| Reviewed source handler coverage | 88 of 88 explicit Next.js handlers |
| Current deployment handler coverage | 88 of 88 explicit Next.js handlers |
| Authentication smoke | WorkOS mode is active; health and readiness returned `200`, while an anonymous `GET /api/jurisdictions` returned the canonical `401` envelope and Bearer challenge |
| Search/diff/research production smoke | Pending: active HNSW index pressure must be relieved before semantic and hybrid search smoke |

This is the current verified unified deployment from `apps/legislation`. The deleted `legislation-api` service is
historical evidence only; it is not a current service or a rollback target. The successful unified verification,
production build, and foundation smoke prove the consolidated runtime and operational boundary. Required production
semantic and hybrid smoke remains pending.

The 14 subscription/webhook handlers are deployed, and Railway has the public WorkOS verifier values and both
application encryption secrets. `AUTH_MODE=workos` is active and the anonymous rejection boundary passed remote smoke;
authenticated ownership and lifecycle smoke remains. Across all 88 operations, release state is
40 **Done**, 23 **In progress**, and 25 **Blocked** by named production prerequisites. Authenticated functional smoke
must cover the subscription/webhook handlers and provenance-complete change-feed rule before promoting any operation to
Done. Application-level API and MCP rate limiting is intentionally absent;
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
| Dependency-configuration blocked | Representative lookup is blocked because `OPENSTATES_API_KEY` is absent. The deployed route returned `503 dependency_unavailable`, `retryable: true`, and `Retry-After: 30`. |
| Rollback | Previous successful `legislation-web` deployment: `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`. |
| Next endpoint block | Search, document-difference, and research delivery is **In progress**. |

The meeting/calendar delivery block is complete. Its six named blockers are independent promotion gates: do not mark
them Done until the fixture or `OPENSTATES_API_KEY` prerequisite is resolved and deployed smoke is repeated.

## Search, document-difference, and research deployment history and current gate

| Outcome | Result |
| --- | --- |
| Handler coverage | 73 of 88 public operations have explicit deployed Next.js handlers. This includes 40 routes with Done release credit, 26 routes blocked by named production prerequisites, and seven active search, document-difference, and research routes. |
| Deployment | Source commit `0a2748b` deployed as `35cfc3bb-ea63-477c-b467-6bf84a4200c5`; terminal `SUCCESS`. |
| Operational smoke | Production `GET /health` and `GET /ready` returned `200`. |
| Production endpoint smoke | Pending. Active HNSW index pressure prevents safely running semantic and hybrid search probes. |
| Route state | All seven routes remain **In progress**. Do not mark them Done until cumulative production smoke passes after the index pressure is relieved. |

The subsequent unified-runtime source snapshot `3a498d1` deployed as
`9de2719a-d34e-46ee-a86e-09768058d1ff` with terminal `SUCCESS`. Its unified verification and foundation smoke are
recorded in the current production table above. That deployment supersedes `35cfc3bb-ea63-477c-b467-6bf84a4200c5`,
which is now the immediately preceding successful rollback target, but it does not change the route state.

The old `legislation-api` service remains deleted. The next action is to relieve or otherwise schedule around HNSW index
pressure, then run the complete search, document-difference, and research production smoke with audited fixtures and record the result here.

## Next safe actions

1. Relieve or schedule around active HNSW index pressure, then run the pending search, document-difference, and research
   production smoke without reopening the meeting/calendar release. Keep every named fixture and configuration blocker explicit until it passes a fresh deployed smoke.
2. After that smoke passes, add the production WorkOS request-identity boundary and required subscription/webhook secrets,
   then deploy and functionally smoke all 14 subscription/webhook routes. Do not treat their reviewed source or fail-closed `403` behavior as release
   completion.
3. Keep MCP migration deferred until after the authenticated API release, and run its canary only after a live Next.js
   MCP route exists.

## Rollback

The current deployment is `9de2719a-d34e-46ee-a86e-09768058d1ff`; its immediately preceding known-good
`legislation-web` rollback deployment is `35cfc3bb-ea63-477c-b467-6bf84a4200c5`. After each subsequent
`legislation-web` deployment, rollback uses only the newly recorded immediately preceding known-good deployment. The
old `legislation-api` service was deleted at the foundation teardown gate and must not be recreated as a rollback target.
Recheck `/health`, `/ready`, and every cumulative smoke profile after a rollback. Database migrations remain separate
from process startup.
