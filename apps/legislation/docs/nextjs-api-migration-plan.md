# Next.js API migration and release plan

## Purpose

This plan replaces the earlier TanStack Start and standalone HTTP-server delivery sequence. The approved application
and API boundary is the existing Next.js App Router application in `apps/legislation-web`. Its scaffold landed in
commit `03e1c7b` with Next.js `16.2.6`; the user-approved foundation upgrade is Next.js `16.3.1`. The existing 87
endpoint implementations in `apps/legislation` remain useful domain, repository, projection, validation, and test code,
but they are not counted as migrated until an explicit Route Handler exists under `apps/legislation-web/app/api` and its
deployed Railway smoke gate passes.

The required order is:

1. Migrate the application runtime to Next.js and deploy the foundation.
2. Migrate all 87 public endpoints to Next.js Route Handlers.
3. Deploy and smoke-test Railway after every endpoint block.
4. Add WorkOS authentication after every endpoint is migrated.
5. Add distributed API rate limiting after authentication.
6. Migrate MCP to the authenticated, rate-limited HTTP API last.

No product UX is in this plan. Until a design is approved, the Next.js page surface is only the smallest non-product
placeholder needed to prove the application runtime.

## Current truth

| Concern | Current evidence | Target state |
| --- | --- | --- |
| Application and API runtime | Next.js `16.3.1` App Router foundation is deployed; the last verified source deployment is `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434` from source commit `5de0383` | Next.js App Router production server in `legislation-web` with staged endpoint blocks |
| Public endpoint domain code | 87 of 87 implemented and reviewed in `apps/legislation` | Reused behind Next.js Route Handlers |
| Next.js Route Handlers | 11 of 87 Done in NX-02A; 18 In progress in NX-02B; 0 Ready; 58 Blocked at ordered release gates | 87 of 87 deployed and remotely smoked |
| Railway runtime | `legislation-web` service `786fbca7-8798-4357-9b45-f0ba092a9750`, last verified source deployment `cd297c07-b9d9-4900-b0ff-9f6ac2bc6434` (`SUCCESS`), source `5de0383`, domain `https://legislation-web-production-b024.up.railway.app`, target port `8080`; production schema migrations through the current ledger are applied; old `legislation-api` service is deleted | Staged Next.js endpoint releases on `legislation-web`; rollback uses the preceding successful `legislation-web` deployment |
| Authentication | WorkOS logic exists in the standalone composition | Added to the Next.js request boundary only after route migration |
| Rate limiting | No approved distributed Next.js boundary | Added after authentication with a shared Railway-compatible store |
| MCP transport | In-process access remains | HTTP client cutover only after API, auth, and rate-limit gates pass |

The previous endpoint ledger's 87 **Done** rows described the reusable standalone implementation. They did not prove
Next.js routing or a Next.js deployment. This plan uses separate **Domain state** and **Next route state** so that those
two facts cannot be conflated again.

## Foundation version and dependency decision

The Next.js scaffold already exists in `apps/legislation-web` from commit `03e1c7b` and was initially pinned to
`next@16.2.6`. The user approved upgrading the foundation to exact `next@16.3.1`, with the matching React dependencies
already used by the scaffold. The foundation gate is therefore implementation, build, and deployment evidence; it is
not a missing-Next dependency gate.

Keep the approved Microsoft feed for workstation installs and preserve the committed frozen lockfile. Do not use a
floating `latest` tag, change the hosts file, or replace the repository registry configuration to make an install pass.
The Railway image follows the existing `legislation-api` release pattern: its isolated, frozen workspace closure uses
`https://registry.npmjs.org/` inside the container build and never copies the workstation `.npmrc` or a feed credential.

The gate is complete only when a clean frozen install, focused type check, production Next.js build, and container build
all succeed from the committed lockfile.

## Target architecture

- `apps/legislation-web/app/api/**` owns the explicit Next.js API Route Handlers for the documented `/api/**` operations.
  The operational `/health` and `/ready` handlers remain at `apps/legislation-web/app/health/route.ts` and
  `apps/legislation-web/app/ready/route.ts` so their root contract paths stay exact. `app/layout.tsx` and `app/page.tsx`
  remain the existing non-product application shell.
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
- `/health` is liveness and `/ready` is database-backed readiness. Neither runs migrations.
- Railway builds the new `legislation-web` service from the repository root. Because the config is nested, set the
  Railway Config File Path explicitly to `/apps/legislation-web/railway.json`; nested config is not discovered
  automatically. Before the first deployment and after config changes, verify the effective service uses the Dockerfile
  builder, `apps/legislation-web/Dockerfile`, and `/ready` health check. The old `legislation-api` service was deleted
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
- Record the existing `legislation-web` scaffold, the approved `16.3.1` upgrade, and the parallel Railway-service
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

Each sub-block requires explicit `route.ts` files under `apps/legislation-web/app/api`, focused adapter/contract tests,
production build, reviewed commit, deployment of the parallel `legislation-web` Railway service, terminal `SUCCESS`,
remote smoke, and rollback evidence.

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

Next route state for every operation in this block: **In progress**. NX-02A's release gate is complete. Explicit bills,
amendments, and votes Route Handlers plus their composition artifacts have passed root review and local verification but still require
deployment and deployed smoke. This is not authorization, rate limiting, or MCP scope, and it does not
promote any of these 18 operations to **Done**.

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

Next route state for every operation in this block: **Blocked** on NX-02B.

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

#### NX-03A: People and organizations (14 endpoints)

Next route state for every operation in this block: **Blocked** on NX-02C.

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

Next route state for every operation in this block: **Blocked** on NX-03A.

- `GET /api/meetings`
- `GET /api/meetings/{meetingId}`
- `GET /api/meetings/{meetingId}/agenda`
- `GET /api/meetings/{meetingId}/agenda/{agendaItemId}`
- `GET /api/meetings/{meetingId}/documents`
- `GET /api/meetings/{meetingId}/documents/{eventDocumentId}`
- `GET /api/meetings/{meetingId}/outcomes`
- `GET /api/meetings/{meetingId}/outcomes/{outcomeId}`
- `GET /api/meetings/{meetingId}/participants`
- `GET /api/meetings/{meetingId}/participants/{participantId}`
- `GET /api/calendars`
- `GET /api/calendars/{calendarId}`
- `GET /api/calendars/{calendarId}/meetings`
- `POST /api/representative-lookups`

Exit gate: all 28 civic routes are **Done** and the NX-03B deployment passes cumulative legislative and civic remote
smoke using production-shaped fixtures.

### NX-04: Search, differences, and research endpoint migration (7 endpoints)

Next route state for every operation in this block: **Blocked** on NX-03B.

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

Next route state for every operation in this block: **Blocked** on NX-04.

- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `GET /api/subscriptions/{subscriptionId}`
- `PATCH /api/subscriptions/{subscriptionId}`
- `DELETE /api/subscriptions/{subscriptionId}`
- `GET /api/subscriptions/{subscriptionId}/events`
- `GET /api/subscriptions/{subscriptionId}/deliveries`

#### NX-05B: Webhooks (7 endpoints)

Next route state for every operation in this block: **Blocked** on NX-05A.

- `GET /api/webhooks`
- `POST /api/webhooks`
- `GET /api/webhooks/{webhookId}`
- `PATCH /api/webhooks/{webhookId}`
- `DELETE /api/webhooks/{webhookId}`
- `POST /api/webhooks/{webhookId}/rotate-secret`
- `POST /api/webhooks/{webhookId}/verify`

The remote profile must prove owner scoping in the transitional test identity, ETags and `If-Match`, idempotency,
one-time secret handling, cancellation receipts, URL-safety checks, verification challenge behavior, and replay without
printing secrets.

Exit gate: all 14 routes are **Done**. The NX-05B deployment passes cumulative smoke for all 87 routes. Only at this
point may authentication work begin.

### NX-06: WorkOS authentication

State: **Blocked** until NX-02 through NX-05 are complete.

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
5. Deploy that commit to the parallel Railway `legislation-web` service. Keep the last successful `legislation-web`
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
- **Next.js Route Handler release state:** 11/87 Done in NX-02A; 18 In progress in NX-02B; 0 Ready; 58 Blocked. The
  11+18+58 states sum to all 87 public API operations.
- **NX-02B code state:** 18 explicit route/composition artifacts are In progress and have passed root review and local
  verification; deployment and deployed smoke remain before they can be **Done**.

Foundation, authentication, rate limiting, MCP cutover, and final cleanup are separate phase gates. None may be inferred
from the endpoint count, and none may be moved earlier than the approved sequence.
