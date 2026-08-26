# Next.js API migration and release plan

## Purpose

This plan replaces the earlier TanStack Start and standalone HTTP-server delivery sequence. `apps/legislation` is the
canonical application, documentation home, and Next.js runtime. The deployed Railway service retains the
`legislation-web` name. Its scaffold landed in commit `03e1c7b` with Next.js `16.2.6`; the user-approved foundation
upgrade is Next.js `16.3.1`. The 87 endpoint implementations in
`apps/legislation` remain useful domain, repository, projection, validation, and test code, but they are not counted as
migrated until an explicit Route Handler and its deployed Railway smoke gate pass.

The required order is:

1. Migrate the application runtime to Next.js and deploy the foundation.
2. Migrate all 87 public endpoints to Next.js Route Handlers.
3. Complete deployed smoke through NX-04.
4. Add WorkOS request identity and the required NX-05 secrets, then deploy and functionally smoke NX-05.
5. Add distributed API rate limiting after authentication.
6. Migrate MCP to the authenticated, rate-limited HTTP API last.

No product UX is in this plan. Until a design is approved, the Next.js page surface is only the smallest non-product
placeholder needed to prove the application runtime.

## Current truth

| Concern | Current evidence | Target state |
| --- | --- | --- |
| Application and API runtime | Canonical application: `apps/legislation`; the deployed Next.js service remains named `legislation-web`. Source snapshot commit `3a498d1` deployed as `9de2719a-d34e-46ee-a86e-09768058d1ff` and reached terminal `SUCCESS`. Unified verification passed 221 test files with 2 skipped and 1,688 tests with 40 skipped; all 212 built-router acceptance tests and the Next.js build passed. Foundation health, readiness, and homepage smoke returned `200`; unknown-route and unsupported-method checks returned `404`. | One Next.js App Router production runtime with staged endpoint blocks |
| Public endpoint domain code | 87 of 87 implemented and reviewed in `apps/legislation` | Reused behind Next.js Route Handlers |
| Next.js Route Handlers | Reviewed source coverage is 87 of 87. The current production deployment contains 73 of 87: 40 Done, 26 Blocked by named production prerequisites, and 7 In progress in NX-04. NX-05A/B route and composition code plus local tests exist in source, but their 14 routes remain Blocked on NX-04, production request identity, required secrets, deployment, and functional smoke. | 87 of 87 deployed and remotely smoked |
| Railway runtime | `legislation-web` service `786fbca7-8798-4357-9b45-f0ba092a9750`; current deployment `9de2719a-d34e-46ee-a86e-09768058d1ff` from source snapshot `3a498d1` is `SUCCESS`; domain `https://legislation-web-production-b024.up.railway.app`, target port `8080`; old `legislation-api` service is deleted. The previous successful rollback deployment is `35cfc3bb-ea63-477c-b467-6bf84a4200c5`. NX-04 production smoke is pending because active HNSW index pressure makes semantic/hybrid search unsafe to exercise. | Staged Next.js endpoint releases on `legislation-web`; rollback uses the recorded prior successful `legislation-web` deployment |
| Authentication | WorkOS logic exists in the standalone composition; the Next.js production boundary intentionally installs no request identity, so NX-05 fails closed with `403` | Added after NX-04 and before functional NX-05 release smoke |
| Rate limiting | No approved distributed Next.js boundary | Added after authentication with a shared Railway-compatible store |
| MCP transport | In-process access remains | HTTP client cutover only after API, auth, and rate-limit gates pass |

The previous endpoint ledger's 87 **Done** rows described the reusable standalone implementation. They did not prove
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
  after the NX-01 teardown gate rather than retained as a rollback service.
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

### NX-00: Correct the delivery record

State: **In progress**

- Make this plan canonical and link it from the documentation index, API contract, implementation ledger, architecture
  decisions, and Railway release record.
- Record 87 domain implementations as reusable input and 0 Next.js Route Handlers as complete.
- Record the `legislation-web` service identity, the approved `16.3.1` upgrade, and the unified application/runtime
  boundary.
- Remove TanStack Start and premature MCP-cutover language from active planning.
- Commit the documentation correction with normal hooks.

Exit gate: the repository no longer describes the standalone implementation as completed Next.js delivery.

### NX-01: Next.js foundation and first Railway deployment

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
- NX-02A includes the committed and deployed API catch-all, which normalizes unknown `/api/**` paths to the standard JSON
  error envelope. It remains part of the block's smoke coverage but is not counted as one of the 87 endpoint routes and
  does not change the completed health/readiness foundation gate.

Exit gate: complete. The approved Next.js App Router foundation reached terminal `SUCCESS`, remote `/health` and `/ready`
smoke passed, and the old `legislation-api` Railway service was deleted and recorded before endpoint migration.

### NX-02: Legislative endpoint migration

State: **In progress**.

Each sub-block requires explicit `route.ts` files under `apps/legislation/app/api`, focused adapter/contract tests,
production build, reviewed commit, deployment of the `legislation-web` Railway service, terminal `SUCCESS`,
remote smoke, and rollback evidence.

Current deployment evidence: source commit `866eb6f` deployed as `168b7b40-3457-48e1-a470-a45cf5b112a9`, reached
terminal `SUCCESS`, and produced image `sha256:2975fa98b4c408094ef66d80e0d3e07322a2e6cfe41fef6710815c1dae58b5a8`;
rollback is deployment `1795e79c-9a7a-4f6a-ab6c-c7c1a546450a`.

#### NX-02A: Jurisdictions and sessions (11 endpoints)

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
6. The full deployed foundation and NX-02A smoke now passes all 11 operations plus rejection checks. Production schema
migrations through the current ledger are applied. The nationwide audit remains incomplete for 52 jurisdictions and 648
sessions; that broader data gap does not reopen the successfully scoped NX-02A route gate. The API catch-all is part of
the deployed block and does not count as one of the 87 explicit migrated endpoint handlers.

#### NX-02B: Bills, amendments, and votes (18 endpoints)

Next route state: **15 Done; 3 Blocked by production data**. Fifteen bills and amendments operations passed deployed
smoke. Three vote operations remain Blocked by their required production data and do not receive Done credit. This is
not authorization, rate limiting, or MCP scope.

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

#### NX-02C: Documents, supporting material, and canonical resources (9 endpoints)

Next route state: **6 Done; 3 Blocked by production data**. Deployed smoke passed all four supporting-material routes,
`GET /api/documents/{documentId}/sections/{sectionId}`, and mixed-result `POST /api/resources/batch`. The following
three routes remain Blocked and do not receive Done credit:

- `GET /api/documents/{documentId}` and `GET /api/documents/{documentId}/sections`: every section-bearing production
  `bill_documents` row has `ocr_status = NULL`, so canonical document/OCR projection fails closed.
- `GET /api/changes`: production canonical source provenance is incomplete, so the change projection fails closed.

- `GET /api/documents/{documentId}`
- `GET /api/documents/{documentId}/sections`
- `GET /api/documents/{documentId}/sections/{sectionId}`
- `GET /api/supporting-materials`
- `GET /api/supporting-materials/{materialId}`
- `GET /api/supporting-materials/{materialId}/sections`
- `GET /api/supporting-materials/{materialId}/sections/{sectionId}`
- `GET /api/changes`
- `POST /api/resources/batch`

Exit gate: all 38 legislative routes are **Done** in the Next route ledger and the latest NX-02C Railway deployment
passes the cumulative legislative smoke profile.

### NX-03: Civic endpoint migration

State: **Complete as a delivery/release block**. Twenty civic operations remain Blocked by their own named
production-fixture or dependency configuration gates; those independent blockers do not prevent NX-04 from becoming
the next eligible block.

#### NX-03A: People and organizations (14 endpoints)

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

#### NX-03B: Meetings, calendars, and representative lookup (14 endpoints)

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

`POST /api/representative-lookups` remains **Blocked by dependency configuration**: `OPENSTATES_API_KEY` is absent.
The deployed route correctly returns `503 dependency_unavailable` with `retryable: true` and `Retry-After: 30`.

Exit gate: the NX-03B release is complete. Promote each currently blocked operation only after its named fixture or
configuration dependency is resolved and a fresh deployed smoke passes; do not reopen the completed block merely to
start NX-04.

### NX-04: Search, differences, and research endpoint migration (7 endpoints)

Next route state for every operation in this block: **In progress**. All seven explicit handlers are deployed in source
commit `0a2748b`, deployed as `35cfc3bb-ea63-477c-b467-6bf84a4200c5` with terminal `SUCCESS`; `/health` and `/ready`
returned `200`. The remediation deployment does not complete the block: active HNSW index pressure still prevents the
required production semantic/hybrid smoke from running safely.

The unified application/runtime snapshot `3a498d1` subsequently deployed as
`9de2719a-d34e-46ee-a86e-09768058d1ff` with terminal `SUCCESS`, passed the unified verification and build gates, and
passed foundation smoke. This superseding deployment retains the same seven-route **In progress** state because no
NX-04 semantic or hybrid production smoke was run.

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

Exit gate: all seven routes are **Done** and the NX-04 deployment passes cumulative read/search/diff smoke.

### NX-05: Subscription and webhook endpoint migration

#### NX-05A: Subscriptions (7 endpoints)

Reviewed source state: explicit routes, production composition, and focused local tests exist. Next route release state
for every operation in this block remains **Blocked**. The code is not present in the current production deployment,
and the production composition intentionally has no request identity, so direct use fails closed with `403`.

- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `GET /api/subscriptions/{subscriptionId}`
- `PATCH /api/subscriptions/{subscriptionId}`
- `DELETE /api/subscriptions/{subscriptionId}`
- `GET /api/subscriptions/{subscriptionId}/events`
- `GET /api/subscriptions/{subscriptionId}/deliveries`

#### NX-05B: Webhooks (7 endpoints)

Reviewed source state: explicit routes, production composition, and focused local tests exist. The composition reuses
the durable repository, encrypted idempotency replay, webhook-secret protection, URL-safety checks, and pinned
verification challenge transport. Next route release state for every operation remains **Blocked**; the code is not in
the current production deployment and no production identity is installed.

- `GET /api/webhooks`
- `POST /api/webhooks`
- `GET /api/webhooks/{webhookId}`
- `PATCH /api/webhooks/{webhookId}`
- `DELETE /api/webhooks/{webhookId}`
- `POST /api/webhooks/{webhookId}/rotate-secret`
- `POST /api/webhooks/{webhookId}/verify`

After NX-04 passes, WorkOS request identity and the required idempotency and webhook-secret encryption keys must be
configured before functional deployment smoke. The remote profile must prove owner scoping, fail-closed unauthenticated
access, ETags and `If-Match`, idempotency, one-time secret handling, cancellation receipts, URL-safety checks,
verification challenge behavior, and replay without printing secrets.

Exit gate: all 14 routes are **Done** after authenticated deployment and cumulative smoke for all 87 routes. Source
coverage and local tests alone do not satisfy this gate.

### NX-06: WorkOS authentication

State: **Blocked** until NX-04 is complete. Its production request identity is then required to functionally deploy and
smoke NX-05.

- Port WorkOS bearer verification and request identity into the shared Next.js API boundary.
- Keep `/health` and `/ready` public; default `/api/**` to authenticated unless the contract says otherwise.
- Enforce issuer, JWKS signature, audience, expiry, subject, client/session identity, organization scope, and access
  class.
- Preserve exact `401` challenge and `403` authorization semantics and correlation IDs.
- Store WorkOS secrets only in Railway variables; never commit or print them.
- Add negative tests for missing, malformed, expired, wrong-issuer, wrong-audience, wrong-client, and wrong-organization
  tokens.
- Deploy, wait for `SUCCESS`, run authenticated cumulative smoke for all endpoint blocks, and record rollback evidence.

Exit gate: every documented API operation passes authenticated remote smoke and all negative token cases fail closed.

### NX-07: Distributed API rate limiting

State: **Blocked** until NX-06 is complete.

- Select and provision a Railway-compatible shared store; in-process counters are not an acceptable production design.
- Key authenticated limits by WorkOS subject and organization, with an IP fallback only for public health boundaries.
- Define separately reviewable tiers for ordinary reads, batch reads, search, AI/research, subscription mutations, and
  webhook mutations.
- Apply bounded windows and concurrency controls without weakening provider or database safety limits.
- Return `429` with `Retry-After`, documented rate-limit headers, the standard error envelope, and correlation ID.
- Add deterministic store-failure behavior, concurrency tests, boundary/reset tests, and multi-instance tests.
- Deploy, wait for `SUCCESS`, prove limit exhaustion and recovery remotely, and rerun the authenticated cumulative smoke.

Exit gate: distributed enforcement behaves consistently across instances and normal endpoint smoke remains clean.

### NX-08: MCP migration to the HTTP API

State: **Blocked** until NX-07 is complete.

- Give MCP a dedicated WorkOS service identity and API audience credentials.
- Complete the typed API client for every MCP-used operation without bypassing the Next.js boundary.
- Replace in-process repository/query calls tool-by-tool with the deployed HTTP client.
- Add method-by-method canonical mapping, error, timeout, cancellation, pagination, and rate-limit tests.
- Run MCP lexical, semantic, and hybrid parity against canonical API results.
- Add a rollback switch that restores the prior in-process adapter during canary and soak.
- Deploy a canary, monitor auth failures, 429s, latency, provider errors, and canonical-result drift, then promote.
- Remove the in-process adapter only after the agreed soak period and rollback review.

Exit gate: all MCP tools use the deployed API, parity and operational gates pass, and rollback has been exercised.

### NX-09: Final cleanup and closure

- Remove the standalone production HTTP serving path and obsolete TanStack planning artifacts.
- Keep operational CLIs that are still explicitly required; do not retain duplicate public HTTP compositions.
- Update the contract, endpoint ledger, Railway release record, runbooks, and architecture decisions to final state.
- Run focused app verification followed by the repository-required verification.
- Commit the exact reviewed changes normally and archive completed migration worktrees.

Exit gate: one Next.js production runtime owns the API, all 87 routes, WorkOS auth, distributed rate limiting, and the MCP
client boundary with complete release and rollback evidence.

## Release gate required after every endpoint block

1. Update the Next route ledger from **Ready** to **In progress** only when implementation begins.
2. Review every explicit Route Handler and shared adapter change against the contract.
3. Run focused route tests, composed service tests, type checking, formatting, linting, and a production Next.js build.
4. Commit the reviewed block with normal hooks.
5. Deploy that commit to the Railway `legislation-web` service. Keep the last successful `legislation-web`
   deployment as the rollback target; the old `legislation-api` service must already have been deleted at the NX-01
   teardown gate.
6. Wait for the deployment to reach terminal `SUCCESS`; a build submission is not success.
7. Verify `/health` and `/ready` before endpoint smoke.
8. Run the new block's remote smoke and all earlier cumulative smoke profiles.
9. Record commit, deployment ID, public origin, smoke evidence, prior `SUCCESS` rollback target, and observed blockers.
10. Mark routes **Done** only after the deployed smoke passes. On failure, preserve the previous deployment and keep the
    affected rows **In progress** or **Blocked** with the exact error.

## Progress accounting

Progress reports must always present both numbers:

- **Reusable domain implementation:** 87/87.
- **Explicit Next.js handler coverage:** 87/87 in reviewed source; 73/87 in the current production deployment. The
  deployed 73 consist of 40 Done, 26 Blocked by named production prerequisites, and 7 In progress in NX-04. The 14
  source-only NX-05 subscription/webhook routes are blocked on NX-04, authentication and required secrets, deployment,
  and functional smoke.
- **Next.js Route Handler release state:** 40/87 Done; 7 In progress in NX-04; 0 Ready; 40 Blocked. The 40+7+40
  states sum to all 87 public API operations.
- **Blocked-route accounting:** 26 routes are Blocked by named production-data, canonical-fixture, or dependency
  deficiencies (three vote operations, document detail, document sections, global changes, all 14 NX-03A
  people/organization operations, five NX-03B canonical-fixture operations, and representative lookup configuration);
  the remaining 14 are blocked by the NX-05 phase and authentication gates.

Foundation, authentication, rate limiting, MCP cutover, and final cleanup are separate phase gates. None may be inferred
from the endpoint count, and none may be moved earlier than the approved sequence.
