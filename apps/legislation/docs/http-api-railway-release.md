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
| Source snapshot commit | `819a0fc` (final bill, amendment, and supporting-material query remediation) |
| Deployment | `9824b674-c55e-4933-8cec-a68475746f5f` |
| Deployment status | `SUCCESS` |
| Image | Not recorded in the final acceptance evidence |
| Previous rollback artifact | Reverify the immediately preceding immutable Railway artifact before any rollback |
| Public origin | `https://legislation-web-production-b024.up.railway.app` |
| Target port | `8080` |
| Railway service list after teardown | `legislation-web`, `pgbouncer`, `pgvector` |
| Old-service deletion | `legislation-api` (`05eb1486-7775-4797-b1c4-1b4a3f31cd26`), deleted 2026-08-25 after smoke |
| Current verification | Commits `1fa13a0`, `36e7060`, `e72b5c4`, and `819a0fc` contain the classification-backfill safety fix and final query work; their focused and legislation verification gates passed before release. |
| Foundation smoke | Health and readiness returned `200`; unknown routes and unsupported methods returned `404`. |
| Reviewed source handler coverage | 88 of 88 explicit Next.js handlers |
| Current deployment handler coverage | 88 of 88 explicit Next.js handlers |
| Authentication smoke | WorkOS mode is active with separate M2M API and AuthKit session authorities. Current health and readiness returned `200`; prior bounded probes recorded `361ms` and `179ms`. The opt-in authenticated subscription and webhook lifecycle smokes passed 12 and 14 checks respectively. |
| Subscription lifecycle smoke | Authenticated list `200`, create `201`, create replay `201`, filtered list `200`, detail `200`, patch `200`, stale revision `412`, events `200` empty Page, deliveries `200` empty Page, delete `200`, delete replay `200`, and cancelled visibility `200`; cancellation fixture remains cancelled by design |
| Webhook lifecycle smoke | All 14 checks passed: list `200`, create/replay `201`, pending filtered list `200`, detail `200`, patch/replay `200`, stale revision `412`, rotate/replay `200`, post-rotate detail `200`, delete/replay `200`, and cancelled visibility `200`; cancellation fixture remains cancelled by design |
| Webhook verification smoke | Receiver deployment `ec110122-dc9a-4d03-aa0f-7f782739712c` resolved to public IP `69.46.46.106`; the signed challenge returned `200`, follow-up detail was `active`, and a redacted receiver acceptance receipt was observed. The cancellation fixture was cancelled afterward. Receiver service `66ac14e0-8726-40a0-a70b-db534b96c92f` was deleted; receiver test tool commit `553578e`. |
| Next API database safety | PostgreSQL `statement_timeout` is set to `15s` for API requests |
| Vote/change production smoke | The authenticated `vote-change` profile passed all 10 checks with no blocked, failed, or skipped checks. Vote collection/detail/batch used `vote:congress:house-119-2-74`; change collection/detail used a genuine provenance-complete event created by the same standard ingestion run. |
| Search/diff/research production smoke | All seven authenticated operations passed without a search skip: bill, amendment, passage, supporting-material, and universal search, document diff, and research answer. Production measurements were 176 ms for the bill branch, 711.8 ms for the final amendment SQL, 1,022/1,095 ms for stable first/deep supporting-material pages, and about 661 ms for a targeted supporting-material query. |
| Search-storage maintenance | Trigger version `20260902.9` run `run_06g6567e43uu13mooebqbu8501` completed. The 23 MB sponsor GIN index is valid and ready, `bill_sponsors` was analyzed at `2026-09-02T14:50:14.923Z`, and a natural plan used the index in 0.066 ms. All five embedding HNSW indexes are valid and ready, all four embedding tables are analyzed, and no index build remains active. |
| Classification and page integrity | The restartable classification backfill completed with zero nulls and zero mismatches after commit `1fa13a0` removed the dedicated maintenance session timeout. The classification constraint and both page-range constraints are valid; no page data repair was required. |
| Cumulative authenticated smoke | Jurisdiction/session: 11 pass. Legislative: 12 pass plus six exact `canonical_data_incomplete` skips. Documents/resources: nine pass. People/organizations: two collection passes plus 12 fixture-not-configured skips. Meetings/calendars: two collection passes plus 12 fixture-not-configured skips. The skips are named production-data gates, not query-performance or authentication failures. |

This is the current verified unified deployment from `apps/legislation`. The deleted `legislation-api` service is
historical evidence only; it is not a current service or a rollback target. The successful unified verification,
production build, and foundation smoke prove the consolidated runtime and operational boundary. The final authenticated
search, document-difference, and research smoke and production query plans are recorded above.

The 14 subscription/webhook handlers are deployed, and Railway has separate WorkOS M2M and AuthKit session authorities plus
both application encryption secrets. `AUTH_MODE=workos` is active and the anonymous rejection boundary passed remote smoke;
the seven subscription and all seven webhook operations are **Done** after authenticated lifecycle smoke. Across all 88
operations, release state is 66 **Done** and 22 **Blocked** by named production prerequisites. No route remains In
progress; each remaining promotion gate is a named production-fixture blocker.
The OpenStates plural `OPENSTATES_API_KEY` is corrected in both Railway and Trigger. The Alaska canary remains a separate
production-data gate; no HNSW build is active. Do not claim representative lookup completion from configuration alone.
Application-level API and MCP rate limiting is out of scope and intentionally absent. The application has no Redis
limiter dependency, limiter configuration, or Railway Redis service. Provider-specific ingestion concurrency, retry,
and `429` handling protect upstream data sources and remain separate from client-facing API throttling.

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
| Production-data blocked | Native processed documents may legitimately have `NULL` OCR status because no OCR run was required. Source `6d807c6` projects those rows as `not-required` while preserving fail-closed behavior for unprocessed rows. Passage search needs an authenticated production probe before this gate is promoted. |
| Resolved in current release | Global changes were blocked in this historical release; standard vote ingestion later created a genuine provenance-complete event, and both change routes passed authenticated smoke in `e419978a-d839-41c5-897b-d9d536a60dc3`. |
| Next endpoint block | People/organization and meeting/calendar delivery subsequently completed; their remaining operation-specific data gates are recorded below. |
| MCP | MCP remains last. Its browser-consent canary is blocked until a live Next.js MCP route exists. |

The two document operations remain production-data blocked and are not **Done**. They require production data that satisfies their
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

Deployment `fe2db27e-4229-4fb4-9afd-98911fd6941d` now fetches the official Congress.gov member-detail resource, reuses
Bioguide identities across Congress ranges, and persists provider-owned profiles, federal jurisdiction links, and
source-titled terms through CLI, backfill, and daily synchronization. This can unblock person detail and person-term
detail after a bounded production refresh and fresh smoke. It does not fabricate or populate committee memberships, so
organization detail and membership detail remain structurally blocked pending a complete current GovInfo committee-data
ingestion.

## Meetings, calendars, and representative lookup deployed smoke

| Outcome | Result |
| --- | --- |
| Deployment | Source commit `866eb6f` deployed as `168b7b40-3457-48e1-a470-a45cf5b112a9`; terminal `SUCCESS`; image `sha256:2975fa98b4c408094ef66d80e0d3e07322a2e6cfe41fef6710815c1dae58b5a8`. |
| Historical split-runtime verification | `apps/legislation` verification passed 198 files with 2 skipped and 1,036 tests with 40 skipped. The former `apps/legislation-web` split app passed 22 files and 571 tests. Next.js `16.3.1` build and built router 173/173 passed. |
| Cumulative smoke | Production `/health` and `/ready` returned `200`; the meeting/calendar profile and all prior release profiles passed. |
| Done | Eight operations passed deployed smoke: meetings collection, meeting agenda list, meeting documents list and detail, meeting outcomes list, meeting participants list and detail, and calendars collection. |
| Canonical-fixture blocked | Meeting detail, meeting agenda-item detail, meeting outcome detail, calendar detail, and calendar meetings remain blocked and receive no Done credit. |
| Meeting rematerialization operator | Deployment `bb0d1d62-742a-48a6-a261-fc304acc12e7` adds `congress:events --domain meetings --rematerialize`, which restarts the selected Congress range, reuses the canonical normalizer/upsert path for unchanged provider records, and fails closed on ambiguous location, classification, status, provenance, session, or committee facts. Do not run it until HNSW is clear. |
| Dependency-configuration blocked | Representative lookup remains blocked pending the production OpenStates canary. The plural `OPENSTATES_API_KEY` is corrected in both Railway and Trigger, and the former HNSW prerequisite is clear. Do not promote this route until a fresh POST smoke passes. |
| Rollback | Previous successful `legislation-web` deployment: `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`. |
| Next endpoint block | Search, document-difference, and research delivery is **Done**. |

The meeting/calendar delivery block is complete. Its six named blockers are independent promotion gates: do not mark
them Done until the fixture or OpenStates production-canary prerequisite is resolved and deployed smoke is repeated.

## Search, document-difference, and research deployment history and current gate

| Outcome | Result |
| --- | --- |
| Historical handler coverage at `0a2748b` | 88 of 88 public operations had explicit deployed Next.js handlers. At that snapshot, 53 routes had Done release credit, 25 were blocked by named production prerequisites, and 10 awaited their documented release gates. Current 66/0/22 accounting is recorded above. |
| Deployment | Source commit `0a2748b` deployed as `35cfc3bb-ea63-477c-b467-6bf84a4200c5`; terminal `SUCCESS`. |
| Operational smoke | Production `GET /health` and `GET /ready` returned `200`. |
| Production endpoint smoke | The final cumulative authenticated profile passed bill, amendment, passage, supporting-material, and universal search, document diff, and research answer without a search skip. |
| Route state | All seven routes are **Done**. |

The subsequent unified-runtime source snapshot `3a498d1` deployed as
`9de2719a-d34e-46ee-a86e-09768058d1ff` with terminal `SUCCESS` and superseded
`35cfc3bb-ea63-477c-b467-6bf84a4200c5`. Both are historical milestones and are now `REMOVED`; neither is a current
rollback target. Current-release evidence is source `8150f36` deployed as
`5c5ed557-fcff-40e4-bce7-2e473423b2c0`; its immediately preceding successful deployment
`fe2db27e-4229-4fb4-9afd-98911fd6941d` is `REMOVED`, as recorded above.

The old `legislation-api` service remains deleted. Passage hybrid ranking is bounded, the amendment-only partial HNSW
candidate path is valid and ready, and the authenticated passage, amendment, document-difference, and research smoke has
passed.

## Authenticated API release evidence

The current `legislation-web` deployment `9824b674-c55e-4933-8cec-a68475746f5f` is sourced from snapshot `819a0fc`
and reached terminal `SUCCESS`; health and readiness returned `200`, with an idle, unsaturated database pool. The final
acceptance evidence did not record the immediately preceding immutable deployment ID. The release uses separate WorkOS
authorities for M2M API tokens and AuthKit user-session tokens. Prior bounded remote probes returned
`GET /health` `200` in `361ms` with `status`, `GET /ready` `200` in `179ms` with `databasePool/status`, an anonymous
protected API request `401` with the canonical challenge, authenticated `GET /api/organizations` `200` in `813ms` with
a canonical Page, authenticated `GET /api/supporting-materials?limit=1` `200` in `3977ms` with a canonical Page, and
authenticated `GET /api/bills?sort=introduced-desc&limit=1` `200` in `6691ms` with a canonical Page; correlation-ID echo
was observed. The opt-in authenticated subscription-lifecycle smoke passed all 12 checks listed in the current production
table, and the webhook lifecycle smoke passed all 14 checks: list `200`, create/replay `201`, pending filtered list `200`,
detail `200`, patch/replay `200`, stale revision `412`, rotate/replay `200`, post-rotate detail `200`, delete/replay `200`,
and cancelled visibility `200`; the cancellation fixture remains cancelled by design. The Next API sets PostgreSQL
`statement_timeout` to `15s`. These probes promote the six webhook operations covered by the lifecycle smoke plus the verified
challenge operation. The final cumulative smoke promotes all seven search, document-difference, and research operations;
the endpoint ledger is now 66 Done and 22 Blocked. The browse
index release additionally returned authenticated canonical one-item pages for bills in 609/158/77 ms and amendments in
345/108/88 ms, with correlation-ID echo on all six requests.

## Next safe actions

1. Begin MCP migration only when directed. Cut over through the authenticated HTTP API tool by tool, prove canonical
   lexical, semantic, and hybrid parity, and retain a rollback boundary. This release intentionally stopped before MCP
   implementation or smoke.
2. Run
   `congress:entities --start-congress 119 --end-congress 119`, verify the canonical person/profile/jurisdiction/term
   predicates, and smoke person detail and person-term detail. Federal organization and membership detail remain blocked
   pending a complete current GovInfo committee-data ingestion and fresh smoke. No roster command exists. If a canonical
   operator is later required, name it `govinfo:committees`; do not use historical `congress:entities` ranges or the
   historical backfill to imply a federal committee refresh. Then run
   `congress:events --domain meetings --start-congress <start> --end-congress <end> --rematerialize`. Verify canonical
   provenance/relationship predicates before using the resulting meeting as smoke evidence; do not infer completion from
   an ingestion success count.
3. For one official native-text document, run
   `documents:process --document-id <document-id> --force` and then
   `embeddings:document-sections --document-id <document-id> --limit 64`. Verify replacement sections, dedicated vectors,
   and the two affected document routes before promotion.
4. Resolve the remaining canonical civic-fixture blockers one bounded source-backed cohort at a time, then repeat the
   exact affected production smoke profile before promoting an operation.
5. Keep every named fixture and configuration blocker explicit until it passes fresh deployed smoke.

## Rollback

The current deployment is `9824b674-c55e-4933-8cec-a68475746f5f`. Reverify the immediately preceding immutable Railway
source or image before using it as a rollback artifact; the final acceptance evidence did not record that artifact's ID.
After each subsequent `legislation-web` deployment, record the prior known-good artifact and verify whether it remains
available for redeploy. The old `legislation-api` service was deleted at the foundation teardown gate and must not be
recreated as a rollback target.
Recheck `/health`, `/ready`, and every cumulative smoke profile after a rollback. Database migrations remain separate
from process startup.
