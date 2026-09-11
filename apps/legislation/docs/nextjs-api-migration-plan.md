# Next.js API migration and release plan

## Purpose

This plan replaces the earlier TanStack Start and standalone HTTP-server delivery sequence. `apps/legislation` is the
canonical application, documentation home, and Next.js runtime. The deployed Railway service retains the
`legislation-web` name. Its scaffold landed in commit `03e1c7b` with Next.js `16.2.6`; the user-approved foundation
upgrade is Next.js `16.3.1`. The 88 endpoint implementations in
`apps/legislation` remain useful domain, repository, projection, validation, and test code, but they are not counted as
migrated until an explicit Route Handler and its deployed Railway smoke gate pass.

The required order is:

1. Migrate the application runtime to Next.js and deploy the foundation.
2. Migrate all 88 public endpoints to Next.js Route Handlers.
3. Complete deployed smoke for every route block.
4. Add WorkOS request identity and the required subscription/webhook secrets, then deploy and functionally smoke the
   subscription and webhook routes. All 14 subscription and webhook operations now have closure evidence.
5. Begin MCP migration only after the authenticated HTTP API release. The API gate is now complete for routes with
   available canonical production data, and work stopped before MCP implementation or smoke as requested.

No product UX is in this plan. Until a design is approved, the Next.js page surface is only the smallest non-product
placeholder needed to prove the application runtime.

## Current truth

| Concern | Current evidence | Target state |
| --- | --- | --- |
| Application and API runtime | Canonical application: `apps/legislation`; Next.js service `legislation-web`. Source `5548045`, deployment `57197853-4d0e-4072-8e9f-d27ca154adeb`, terminal `SUCCESS`. September 11 civic smoke passed 11 newly accepted operations; broad lexical amendment and passage searches returned 503 and are reopened. | One Next.js App Router production runtime |
| Public endpoint domain code | 88 of 88 implemented and reviewed in `apps/legislation` | Reused behind Next.js Route Handlers |
| Next.js Route Handlers | Source and deployment both cover 88/88. Current acceptance: 77 Done and 11 Blocked (nine data gates, two search timeouts). See the reconciled HTTP API backlog for exact evidence and historical versus fresh checks. | Every endpoint accepted with canonical production data |
| Railway runtime | `legislation-web` service `786fbca7-8798-4357-9b45-f0ba092a9750`; deployment `57197853-4d0e-4072-8e9f-d27ca154adeb` from `5548045`, terminal `SUCCESS`; public origin `https://legislation-web-production-b024.up.railway.app`. Health/readiness returned 200 on September 11. The deleted `legislation-api` service is not a rollback target. | Rollback through a verified immutable prior Railway artifact |
| Authentication | The shared Next.js API boundary verifies separate WorkOS M2M API and AuthKit session authorities, installs verified request identity, preserves canonical `401` behavior, and leaves health/readiness public. Authenticated subscription and webhook lifecycle smoke and the cumulative seven-operation search, document-difference, and research profile passed. Remaining skips are named canonical-fixture gaps rather than authentication failures. | Complete for the released API surface |
| MCP transport | In-process access remains | HTTP client cutover only after every API endpoint and authentication gate passes |

The previous endpoint ledger's 88 **Done** rows described the reusable standalone implementation. They did not prove
Next.js routing or a Next.js deployment. This plan uses separate **Domain state** and **Next route state** so that those
two facts cannot be conflated again.

## Foundation version and dependency decision

The Next.js scaffold landed in commit `03e1c7b` and was initially pinned to `next@16.2.6`. The user approved upgrading
the foundation to exact `next@16.3.1`, with the matching React dependencies already used by the application. The
foundation gate is therefore implementation, build, and deployment evidence; it is not a missing-Next dependency gate.

Keep the approved Microsoft feed for workstation installs and preserve the committed frozen lockfile. Do not use a
floating `latest` tag, change the hosts file, or replace the repository registry configuration to make an install pass.
The Railway image follows the existing `legislation-api` release pattern: its isolated, frozen workspace closure uses
`https://registry.npmjs.org/` inside the container build and never copies the workstation `.npmrc` or a feed credential.

The gate is complete only when a clean frozen install, focused type check, production Next.js build, and container build
all succeed from the committed lockfile.

## Target architecture

- `apps/legislation` owns the canonical application, Next.js route handlers, route inventory, documentation, and
  release record. Its explicit handlers serve the documented `/api/**` operations. The operational `/health` and
  `/ready` handlers retain their exact root paths; neither endpoint runs migrations.
- Every documented HTTP operation has an explicit `route.ts`; a catch-all proxy does not count as migration.
- Route Handlers export only documented methods. Undocumented methods and aliases retain the contract's rejection
  behavior.
- Database, repositories, query services, canonical projections, request schemas, and response schemas remain
  framework-independent in `apps/legislation` and are reused by the Next.js boundary. The standalone HTTP composition
  remains transitional source code while migration is in progress; the old `legislation-api` Railway service was deleted
  after the foundation teardown gate rather than retained as a rollback service.
- A server-only composition module owns process-wide database pools and service singletons. It must be safe under Next.js
  development reloads and Railway production lifecycle behavior.
- API Route Handlers use the Node.js runtime because PostgreSQL, cryptography, provider clients, and document tooling are
  not Edge-runtime dependencies.
- The adapter preserves exact status codes, error/resource/page/search/batch envelopes, correlation IDs, ETags,
  conditional requests, request-size bounds, cancellation, and safe error handling.
- `/health` is liveness and `/ready` is database-backed readiness.
- Railway builds the `legislation-web` service from the repository root. Because the config is nested, set the Railway
  Config File Path explicitly to `/apps/legislation/railway.json`; nested config is not discovered automatically.
  Before the first deployment and after config changes, verify the effective service uses the Dockerfile builder,
  `apps/legislation/Dockerfile`, and `/ready` health check. The old `legislation-api` service was deleted
  after the new service reached terminal `SUCCESS` and remote `/health` and `/ready` smoke passed; rollback now uses the
  preceding successful `legislation-web` deployment.
- The standalone `serve` command remains transitional only while block-by-block parity is being established. It is
  removed from the production path after the last Next route block passes.

## Status definitions

| State | Meaning for a Next.js endpoint |
| --- | --- |
| Blocked | A named predecessor, dependency, data capability, or product decision is missing. |
| Ready | All predecessors exist and implementation may begin. |
| In progress | A `route.ts` or adapter change exists, but local, deployment, or remote-smoke evidence is incomplete. |
| Done | The explicit Route Handler is reviewed, committed, deployed to Railway, and passed its block's remote smoke. |

## Phase plan

### Correct the delivery record

State: **Done**

- Make this plan canonical and link it from the documentation index, API contract, implementation ledger, architecture
  decisions, and Railway release record.
- Record 88 domain implementations as reusable input and 0 Next.js Route Handlers as complete.
- Record the `legislation-web` service identity, the approved `16.3.1` upgrade, and the unified application/runtime
  boundary.
- Remove TanStack Start and premature MCP-cutover language from active planning.
- Commit the documentation correction with normal hooks.

Exit gate: the repository no longer describes the standalone implementation as completed Next.js delivery.

### Next.js foundation and first Railway deployment

State: **Done**.

- Deployment evidence: service `legislation-web` (`786fbca7-8798-4357-9b45-f0ba092a9750`) deployed source commit
  `d344cc0` as deployment `50a71f45-0d55-4ce7-9872-806c21043490`, reached terminal `SUCCESS`, and serves
  `https://legislation-web-production-b024.up.railway.app` on target port `8080`.
- Remote smoke evidence: `GET /health` returned `200` with `{ "status": "ok" }`; `GET /ready` returned `200` with
  `{ "databasePool": { "active": 0, "idle": 1, "maximum": 8, "saturation": 0, "total": 1, "waiting": 0 }, "status": "ready" }`;
  `POST /health` returned the documented JSON `404` and preserved the correlation ID.
- Teardown evidence: old Railway `legislation-api` service `05eb1486-7775-4797-b1c4-1b4a3f31cd26` was deleted on
  2026-08-25 after the deployment and health/readiness smoke gates passed. The Railway service list now contains only
  `legislation-web`, `pgbouncer`, and `pgvector`.
- The jurisdiction/session release includes the committed and deployed API catch-all, which normalizes unknown `/api/**` paths to the standard JSON
  error envelope. It remains part of the block's smoke coverage but is not counted as one of the 88 endpoint routes and
  does not change the completed health/readiness foundation gate.

Exit gate: complete. The approved Next.js App Router foundation reached terminal `SUCCESS`, remote `/health` and `/ready`
smoke passed, and the old `legislation-api` Railway service was deleted and recorded before endpoint migration.

### Legislative endpoint migration

State: **Complete with named production-data blockers**.

Each sub-block requires explicit `route.ts` files under `apps/legislation/app/api`, focused adapter/contract tests,
production build, reviewed commit, deployment of the `legislation-web` Railway service, terminal `SUCCESS`,
remote smoke, and rollback evidence.

Current deployment evidence: source commit `866eb6f` deployed as `168b7b40-3457-48e1-a470-a45cf5b112a9`, reached
terminal `SUCCESS`, and produced image `sha256:2975fa98b4c408094ef66d80e0d3e07322a2e6cfe41fef6710815c1dae58b5a8`;
rollback is deployment `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`.

#### Jurisdictions and sessions (11 endpoints)

Next route state for every operation in this block: **Done**. The explicit handlers and API catch-all are committed and
deployed on `legislation-web`; all 11 operations and the rejection checks passed deployed smoke.

- `GET /api/jurisdictions`
- `GET /api/jurisdictions/{jurisdictionId}`
- `GET /api/jurisdictions/{jurisdictionId}/sessions`
- `GET /api/jurisdictions/{jurisdictionId}/bills`
- `GET /api/jurisdictions/{jurisdictionId}/organizations`
- `GET /api/jurisdictions/{jurisdictionId}/commissions`
- `GET /api/jurisdictions/{jurisdictionId}/committees`
- `GET /api/jurisdictions/{jurisdictionId}/meetings`
- `GET /api/sessions/{sessionId}`
- `GET /api/sessions/{sessionId}/bills`
- `GET /api/sessions/{sessionId}/meetings`

The Alaska scoped snapshot corrected the publisher classification to `legislature`. Production processed all 6 of 6
records from import hash `a89bc8c83d9c57893c731e090f9599cf094e9cb73e88fce5f0b7df44aadd357c`; its idempotent rerun skipped all
6. The full deployed foundation and jurisdiction/session smoke now passes all 11 operations plus rejection checks. Production schema
migrations through the current ledger are applied. The nationwide audit remains incomplete for 52 jurisdictions and 648
sessions; that broader data gap does not reopen the successfully scoped jurisdiction/session route gate. The API catch-all is part of
the deployed block and does not count as one of the 88 explicit migrated endpoint handlers.

#### Bills, amendments, and votes (18 endpoints)

Next route state: **18 Done**. Fifteen bills and amendments operations passed their earlier deployed smoke. The three
previously data-blocked vote operations passed authenticated collection, detail, and batch smoke against deployment
`e419978a-d839-41c5-897b-d9d536a60dc3`; source-derived vote positions remain usable even when a canonical person link is
not yet safe. This is not MCP scope.

- `GET /api/bills`
- `POST /api/bills/batch`
- `POST /api/bills/amendments/batch`
- `GET /api/bills/{billId}`
- `GET /api/bills/{billId}/timeline`
- `GET /api/bills/{billId}/related`
- `GET /api/bills/{billId}/sections`
- `GET /api/bills/{billId}/amendments`
- `GET /api/bills/{billId}/votes`
- `GET /api/bills/{billId}/documents`
- `GET /api/bills/{billId}/changes`
- `GET /api/amendments`
- `POST /api/amendments/batch`
- `GET /api/amendments/{amendmentId}`
- `GET /api/votes`
- `POST /api/votes/batch`
- `GET /api/votes/{voteId}`
- `GET /api/votes/{voteId}/positions`

#### Documents, supporting material, and canonical resources (10 endpoints)

Next route state: **10 Done**. Deployed smoke passed all four supporting-material routes, all three document routes,
mixed-result `POST /api/resources/batch`, and both global change routes. On 2026-09-02, authenticated production
verification used a real processed, section-bearing document whose persisted OCR value is null and confirmed that the
deployed projection correctly returns OCR `not-required`. `GET /api/documents/{documentId}` returned `200` in 157 ms and
`GET /api/documents/{documentId}/sections` returned `200` in 46 ms; both also passed correlation-ID, cache, ETag, and
conditional-request checks.
The global change collection and canonical detail route are Done. Both expose only events with complete immutable
provenance; the detail route returns `404 not_found` for incomplete legacy rows. Standard Congress vote ingestion created
one genuine provenance-complete change fixture, and authenticated collection/detail smoke passed against deployment
`e419978a-d839-41c5-897b-d9d536a60dc3`.

- `GET /api/documents/{documentId}`
- `GET /api/documents/{documentId}/sections`
- `GET /api/documents/{documentId}/sections/{sectionId}`
- `GET /api/supporting-materials`
- `GET /api/supporting-materials/{materialId}`
- `GET /api/supporting-materials/{materialId}/sections`
- `GET /api/supporting-materials/{materialId}/sections/{sectionId}`
- `GET /api/changes`
- `GET /api/changes/{changeId}`
- `POST /api/resources/batch`

Exit gate: all 39 legislative routes are **Done** in the Next route ledger and the latest document/resource Railway deployment
passes the cumulative legislative smoke profile.

### Civic endpoint migration

State: **Complete as a delivery/release block**. Twenty civic operations remain Blocked by their own named
production-fixture or dependency configuration gates; those independent blockers do not prevent the search, document-difference, and research release from becoming
the next eligible block.

#### People and organizations (14 endpoints)

Next route implementation and deployment state: **Complete**. Next-route release state for every operation in this block:
**14 Blocked by canonical production data**. The route code, focused tests, production build, deployment
`1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`, and cumulative remote smoke are complete, but none of these routes receives Done
credit because production has zero canonical-ready civic fixtures. The safe smoke profile passed nine operations and
classified four canonical-data responses as blocked; one synthetic membership lookup correctly returned `404`.

- `GET /api/people`
- `GET /api/people/{personId}`
- `GET /api/people/{personId}/bills`
- `GET /api/people/{personId}/amendments`
- `GET /api/people/{personId}/votes`
- `GET /api/people/{personId}/memberships`
- `GET /api/people/{personId}/terms/{termId}`
- `GET /api/organizations`
- `GET /api/organizations/{organizationId}`
- `GET /api/organizations/{organizationId}/members`
- `GET /api/organizations/{organizationId}/memberships/{membershipId}`
- `GET /api/organizations/{organizationId}/meetings`
- `GET /api/organizations/{organizationId}/bills`
- `GET /api/organizations/{organizationId}/calendars`

#### Meetings, calendars, and representative lookup (14 endpoints)

Next route delivery/release state: **Complete**. Source commit `866eb6f` deployed as
`168b7b40-3457-48e1-a470-a45cf5b112a9`, reached terminal `SUCCESS`, and produced image
`sha256:2975fa98b4c408094ef66d80e0d3e07322a2e6cfe41fef6710815c1dae58b5a8`; the preceding successful deployment
`1795e79c-9a7a-4f6a-ab6c-c7c1a546450a` is the rollback target. In that historical split-runtime release,
`apps/legislation` verification passed 198 files with 2 skipped and 1,036 tests with 40 skipped; the former
`apps/legislation-web` split app passed 22 files and 571 tests; the Next.js `16.3.1` build and built router (173/173)
passed. Production `/health` and `/ready` returned `200`, and the new block plus all earlier cumulative smoke profiles
passed.

The eight operations below are **Done**:

- `GET /api/meetings`
- `GET /api/meetings/{meetingId}/agenda`
- `GET /api/meetings/{meetingId}/documents`
- `GET /api/meetings/{meetingId}/documents/{eventDocumentId}`
- `GET /api/meetings/{meetingId}/outcomes`
- `GET /api/meetings/{meetingId}/participants`
- `GET /api/meetings/{meetingId}/participants/{participantId}`
- `GET /api/calendars`

The five operations below remain **Blocked by canonical production fixtures** and receive no Done credit:

- `GET /api/meetings/{meetingId}`
- `GET /api/meetings/{meetingId}/agenda/{agendaItemId}`
- `GET /api/meetings/{meetingId}/outcomes/{outcomeId}`
- `GET /api/calendars/{calendarId}`
- `GET /api/calendars/{calendarId}/meetings`

`POST /api/representative-lookups` remains **Blocked** pending the production OpenStates canary. The civic repair is
committed and the plural `OPENSTATES_API_KEY` is corrected in both Railway and Trigger. The former HNSW prerequisite is
clear; do not promote this route until a fresh POST smoke passes.

Exit gate: the meeting/calendar release is complete. Promote each currently blocked operation only after its named fixture or
configuration dependency is resolved and a fresh deployed smoke passes; do not reopen the completed block merely to
start search, document-difference, and research delivery.

### Search, document-difference, and research endpoint migration (7 endpoints)

Next route state for every operation in this block: **Done**. The final query changes landed in commits `36e7060`,
`e72b5c4`, and `819a0fc`. Source snapshot `819a0fc` deployed as `9824b674-c55e-4933-8cec-a68475746f5f` with terminal
`SUCCESS`; health and readiness returned `200` and the cumulative authenticated profile passed all seven operations
without a search skip.

- `POST /api/search/bills`
- `POST /api/search/amendments`
- `POST /api/search/passages`
- `POST /api/search/supporting-materials`
- `POST /api/search/all`
- `POST /api/document-diffs`
- `POST /api/research/answers`

The smoke profile must separately prove lexical, semantic, and hybrid retrieval, canonical result mapping, diff bounds,
provider dependency failures, research-answer citations, and request cancellation. Model credentials must not appear in
logs or smoke output.

Exit gate: complete. All seven routes are **Done** and the deployment passed cumulative read/search/diff/research smoke.

### Subscription and webhook endpoint migration

#### Subscriptions (7 endpoints)

Reviewed source state: explicit routes, production composition, and focused local tests exist. Deployment
`e1781bbc-6526-4f87-8eb8-df39142bf11a` from source `c3c5f43` reached terminal `SUCCESS`. Next route release state for all
seven subscription operations is **Done** after opt-in authenticated lifecycle smoke passed all 12 checks: list `200`,
create `201`, create replay `201`, filtered list `200`, detail `200`, patch `200`, stale revision `412`, events `200`
empty Page, deliveries `200` empty Page, delete `200`, delete replay `200`, and cancelled visibility `200`. The cancellation
fixture remains cancelled by design. Closure commits include `20c6ab0`, `014ea3b`, `400edaf`, and the header-adapter fix
`c3c5f43`.

- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `GET /api/subscriptions/{subscriptionId}`
- `PATCH /api/subscriptions/{subscriptionId}`
- `DELETE /api/subscriptions/{subscriptionId}`
- `GET /api/subscriptions/{subscriptionId}/events`
- `GET /api/subscriptions/{subscriptionId}/deliveries`

#### Webhooks (7 endpoints)

Reviewed source state: explicit routes, production composition, and focused local tests exist. The composition reuses
the durable repository, encrypted idempotency replay, webhook-secret protection, URL-safety checks, and pinned
verification challenge transport. Source snapshot `c3c5f43` (including the header-adapter defect fix) is deployed as
`e1781bbc-6526-4f87-8eb8-df39142bf11a` with terminal `SUCCESS`. Authenticated webhook lifecycle smoke passed all 14 checks:
list `200`, create/replay `201`, pending filtered list `200`, detail `200`, patch/replay `200`, stale revision `412`,
rotate/replay `200`, post-rotate detail `200`, delete/replay `200`, and cancelled visibility `200`; the cancellation fixture
remains cancelled by design. All seven webhook operations are **Done**. A separate throwaway Railway receiver deployment
`ec110122-dc9a-4d03-aa0f-7f782739712c` resolved to `69.46.46.106`, returned `200` to the signed challenge, and transitioned
the webhook to `active`; receiver service `66ac14e0-8726-40a0-a70b-db534b96c92f` was deleted after the redacted acceptance
receipt was observed. The receiver test tool is committed in `553578e`. Reviewed local source now supplies verified identity
through the shared API boundary.

- `GET /api/webhooks`
- `POST /api/webhooks`
- `GET /api/webhooks/{webhookId}`
- `PATCH /api/webhooks/{webhookId}`
- `DELETE /api/webhooks/{webhookId}`
- `POST /api/webhooks/{webhookId}/rotate-secret`
- `POST /api/webhooks/{webhookId}/verify`

The remote profile proves owner scoping, fail-closed authenticated access, ETags and `If-Match`, idempotency, one-time
secret handling, cancellation receipts, URL-safety checks, replay without printing secrets, and verification challenge behavior.
WorkOS request identity and the required idempotency and webhook-secret encryption keys are configured in the current deployment.

Exit gate: all seven subscription routes and all seven webhook routes are **Done** with the recorded authenticated lifecycle
smoke. The complete authenticated cumulative smoke for all 88 routes remains a separate release gate. Source coverage and
local tests alone do not satisfy that remaining gate.

### WorkOS authentication

State: **Done for the released API surface**. The release uses separate WorkOS authorities for M2M API tokens and AuthKit
user-session tokens and has both application encryption secrets configured. The opt-in subscription and webhook
lifecycle smokes passed, and deployment `9824b674-c55e-4933-8cec-a68475746f5f` passed the cumulative authenticated
search, document-difference, and research profile. Remaining endpoint skips have named missing-fixture gates and did not
expose an authentication failure.

- WorkOS bearer verification and request identity now run in the shared Next.js API boundary.
- `/health` and `/ready` remain public; supported and catch-all `/api/**` requests authenticate in WorkOS mode.
- Enforce issuer, JWKS signature, audience, expiry, subject, client/session identity, organization scope, and access
  class.
- Preserve exact `401` challenge and `403` authorization semantics and correlation IDs.
- Store separate M2M and AuthKit session authority configuration only in Railway variables; never commit or print
  credentials or tokens.
- Add negative tests for missing, malformed, expired, wrong-issuer, wrong-audience, wrong-client, and wrong-organization
  tokens.
- Preserve the successful authenticated cumulative smoke evidence and repeat only the affected profile after resolving
  a named production-fixture blocker.

Exit gate: complete for every operation with available canonical production data; negative token cases fail closed.

### MCP migration to the HTTP API

State: **Deferred**. The authenticated API release is complete, but implementation and smoke deliberately stopped before
this step at the user's request.

- Give MCP a dedicated WorkOS service identity and API audience credentials.
- Complete the typed API client for every MCP-used operation without bypassing the Next.js boundary.
- Replace in-process repository/query calls tool-by-tool with the deployed HTTP client.
- Add method-by-method canonical mapping, error, timeout, cancellation, and pagination tests.
- Run MCP lexical, semantic, and hybrid parity against canonical API results.
- Add a rollback switch that restores the prior in-process adapter during canary and soak.
- Deploy a canary, monitor auth failures, latency, provider errors, and canonical-result drift, then promote.
- Remove the in-process adapter only after the agreed soak period and rollback review.

Exit gate: all MCP tools use the deployed API, parity and operational gates pass, and rollback has been exercised.

### Final cleanup and closure

- Remove the standalone production HTTP serving path and obsolete TanStack planning artifacts.
- Keep operational CLIs that are still explicitly required; do not retain duplicate public HTTP compositions.
- Update the contract, endpoint ledger, Railway release record, runbooks, and architecture decisions to final state.
- Run focused app verification followed by the repository-required verification.
- Commit the exact reviewed changes normally and archive completed migration worktrees.

Exit gate: one Next.js production runtime owns the API, all 88 routes, WorkOS auth, and the MCP client boundary with
complete release and rollback evidence.

## Release gate required after every endpoint block

1. Update the Next route ledger from **Ready** to **In progress** only when implementation begins.
2. Review every explicit Route Handler and shared adapter change against the contract.
3. Run focused route tests, composed service tests, type checking, formatting, linting, and a production Next.js build.
4. Commit the reviewed block with normal hooks.
5. Deploy that commit to the Railway `legislation-web` service. Keep the last successful `legislation-web`
   deployment as the rollback target; the old `legislation-api` service must already have been deleted at the foundation
   teardown gate.
6. Wait for the deployment to reach terminal `SUCCESS`; a build submission is not success.
7. Verify `/health` and `/ready` before endpoint smoke.
8. Run the new block's remote smoke and all earlier cumulative smoke profiles.
9. Record commit, deployment ID, public origin, smoke evidence, prior `SUCCESS` rollback target, and observed blockers.
10. Mark routes **Done** only after the deployed smoke passes. On failure, preserve the previous deployment and keep the
    affected rows **In progress** or **Blocked** with the exact error.

## Progress accounting

Progress reports must always present both numbers:

- **Reusable domain implementation:** 88/88.
- **Explicit Next.js handler coverage:** 88/88 in reviewed source and the current production deployment. All 14
  subscription/webhook operations have passed their authenticated lifecycle smoke.
- **Next.js Route Handler release state:** 77/88 Done; 0 In progress; 0 Ready; 11 Blocked. The states sum to all 88
  public API operations.
- **Blocked-route accounting:** Three organization activity/calendar operations, five meeting/calendar fixture
  operations, representative lookup, and two reproduced lexical-search timeouts. The September 11 acceptance
  reconciliation in the HTTP API backlog supersedes the earlier all-civic-routes-blocked claims.

Foundation, authentication, MCP cutover, and final cleanup are separate phase gates. None may be inferred from the
endpoint count, and none may be moved earlier than the approved sequence.
