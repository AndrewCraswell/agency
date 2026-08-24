# HTTP API local smoke and MCP parity checklist

## Purpose and evidence rule

Use this checklist after an API product has passed code review and before any endpoint moves from **In progress** to
**Done**. It is an execution plan, not evidence that a smoke or parity run has occurred. Record the date, commit,
database snapshot, model routing configuration, commands, sanitized results, and reviewer in the run record.

An endpoint passes only when the live handler projects the documented contract. A `200` response from an existing
application-service method is insufficient when canonical fields, provenance, filters, pagination, or search metadata
do not match the contract.

## Test fixture and prerequisites

- Use a disposable local PostgreSQL database migrated from an empty schema with the current migration set.
- Seed canonical fixtures covering at least two jurisdictions, two sessions, related bills, a structured amendment, a
  document-backed amendment, a recorded vote with named positions, a processed document with multiple sections, a
  supporting material, two people, two organizations, and a meeting with related records.
- Include one missing ID, one inaccessible tenant-owned ID, one image-only document completed through OCR, and enough
  records to produce a second page.
- Start the same composed handler used by the service. Do not mount a slice-only test server for acceptance evidence.
- Run authenticated requests with a valid user token and, separately, an organization token. Retain correlation IDs but
  redact tokens, addresses, webhook secrets, and provider credentials.
- Pin the expected embedding and reranking routes from the contract. If model credentials are intentionally absent,
  semantic and hybrid checks are blocked rather than silently treated as lexical checks.

The reviewed local harness is `pnpm --filter legislation smoke:api`. Without
`LEGISLATION_SMOKE_BASE_URL`, it starts the same composed `src/cli/main.ts serve` process used by the application on
`127.0.0.1:3199`, waits for `/health` and `/ready`, and shuts it down after the run. Set
`LEGISLATION_SMOKE_BASE_URL` to exercise an already-running local or remote instance instead. The harness always
prints a JSON report with individual `passed`, `skipped`, `blocked`, and `failed` checks; a missing fixture is skipped,
an unavailable route or dependency is blocked, and no blocked check is treated as success. A blocked report exits with
code 2; a failed report exits with code 1.

Detail fixtures are supplied by name only through `LEGISLATION_SMOKE_JURISDICTION_ID`,
`LEGISLATION_SMOKE_SESSION_ID`, `LEGISLATION_SMOKE_BILL_ID`, `LEGISLATION_SMOKE_AMENDMENT_ID`,
`LEGISLATION_SMOKE_VOTE_ID`, `LEGISLATION_SMOKE_DOCUMENT_ID`, `LEGISLATION_SMOKE_DOCUMENT_ID_B`,
`LEGISLATION_SMOKE_MATERIAL_ID`, `LEGISLATION_SMOKE_MEETING_ID`, `LEGISLATION_SMOKE_PERSON_ID`, and
`LEGISLATION_SMOKE_ORGANIZATION_ID`. The list and search routes always run; detail, relationship, and diff routes run
only when their required IDs are supplied. For `AUTH_MODE=workos` (or explicit `LEGISLATION_SMOKE_REQUIRE_AUTH=true`),
`LEGISLATION_SMOKE_TOKEN` is required. It is sent only as an in-memory bearer header and is never included in the
report or diagnostics. Each route has a 30-second request deadline by default; set
`LEGISLATION_SMOKE_REQUEST_TIMEOUT_MS` to an integer from 1 through 60,000 milliseconds when a different bounded
deadline is needed. The harness separately asserts unauthenticated `401` rejection, response envelopes, matching
`x-correlation-id` values, unknown-route handling, and unsupported-method handling.

For the implemented scoped bill pages, set `LEGISLATION_SMOKE_PROFILE=scoped-bills` with both
`LEGISLATION_SMOKE_JURISDICTION_ID` and `LEGISLATION_SMOKE_SESSION_ID`. This profile runs health, readiness,
unknown-route, unsupported-method, and enabled-auth rejection checks, then requires nonempty exact canonical
`Page<BillSummary>` responses from both scoped bill routes. It intentionally skips the full profile's known
In-progress and Blocked endpoint set. It also requires `LEGISLATION_SMOKE_CANONICAL_API_BASE_URL` or
`LEGISLATION_PUBLIC_API_BASE_URL`: the value must be a credential-free HTTP(S) origin at its root, without a query or
fragment. Set the smoke-specific value when the expected configured public base URL differs from
`LEGISLATION_SMOKE_BASE_URL`; the profile verifies every bill canonical URL against it.

## Shared protocol smoke

Complete these assertions once per composed server build and repeat mutation assertions for every mutable product.

- [ ] `GET /health` returns `200`; `GET /ready` returns `200` only when PostgreSQL is ready.
- [ ] An API request without a required bearer token returns `401` with `WWW-Authenticate` and the protected-resource
      metadata link; an invalid token does not reach a handler.
- [ ] A valid request echoes or generates one correlation ID in both the header and response envelope.
- [ ] Unknown paths and lookalike prefixes return `404`; unsupported methods do not get claimed by another slice.
- [ ] Unknown query and body fields return `400 invalid_request` instead of being ignored.
- [ ] A body over the configured ceiling returns `413 payload_too_large` without invoking the service.
- [ ] Every page honors `limit`, binds its cursor to filters and ordering, emits a stable `next` link, and returns no
      duplicate or missing records across two consecutive pages.
- [ ] A malformed, expired, filter-mismatched, or cross-principal cursor returns `400` without leaking cursor contents.
- [ ] Canonical reads include `id`, `canonicalUrl`, non-empty `sources`, `updatedAt`, stable ordering, and the documented
      `ResourceResponse` or `Page` envelope.
- [ ] Missing and invisible resources both return the same safe `404 not_found` shape.
- [ ] Batch reads reject more than 25 unique IDs, preserve request order, isolate item errors, and do not fail a valid
      outer request because one item is missing.
- [ ] Cacheable reads return the documented validators; `If-None-Match` returns an empty `304` only when unchanged.
- [ ] Logs and errors contain no SQL, stack, raw provider payload, token, address, or cross-tenant identifier.

## Canonical legislative-read product

- [ ] Browse and retrieve jurisdictions and sessions; verify jurisdiction/session links and active/date filters.
- [ ] Browse bills, retrieve a bill, and compare the response field-for-field with `BillSummary` and `BillDetail`.
- [ ] Exercise bill, amendment, and vote batches at 1, 25, duplicate, missing, and 26-ID boundaries.
- [ ] Traverse a bill timeline and verify each item is the documented discriminated action, vote, or meeting-outcome
      union with canonical source references.
- [ ] Retrieve related bills in explicit and semantic modes; verify a `Page<RelatedBillHit>`, relationship evidence,
      model metadata when used, and stable score/order behavior.
- [ ] Retrieve bill sections, a document, its section collection, and one section by canonical URL; verify
      OCR/extraction fields, offsets, ordinals, hosted and official URLs, provenance, parent mismatch `404`, and cursor
      continuation.
- [ ] Browse and retrieve structured and document-backed amendments; verify their canonical discriminator and bill link.
- [ ] Browse and retrieve votes; verify result/count vocabulary and named position identity mapping.
- [ ] Browse and retrieve supporting materials, retrieve one supporting-material section by canonical URL, and browse
      change events; verify canonical parent links, parent mismatch `404`, and provenance.
- [ ] Confirm every contract route still marked **Blocked** returns `404`, not a placeholder or empty success.

## Civic graph and meeting product

- [ ] Browse and retrieve people with jurisdiction, organization, active-status, query, and cursor filters.
- [ ] Browse and retrieve organizations with classification, parent, jurisdiction, active-status, query, and cursor
      filters; confirm committee and commission classifications remain canonical organizations.
- [ ] Browse and retrieve meetings with jurisdiction, organization, date-window, and cursor filters; verify timezone,
      status, organization, session, and provenance projection.
- [ ] Verify person, organization, and meeting detail child collections expose truthful truncation/cursor metadata.
- [ ] Confirm relationship, calendar, agenda, participant, outcome, document, and representative-lookup routes remain
      absent until their named queries/providers exist.

## Search and document-diff product

- [ ] Run the same representative query through lexical, semantic, and hybrid bill search; verify the requested mode,
      actual embedding/reranking models, rerank flag, canonical bill hits, sources, scores, and cursor behavior.
- [ ] Repeat mode and metadata checks for amendment, passage, and supporting-material search using fixtures that exercise
      each product-specific embedding route.
- [ ] Exercise every documented filter. A filter not supported by the application service must return a precise `400`;
      it must never be silently discarded.
- [ ] Verify passage hits map section to document and bill, supporting-material hits map to their canonical material,
      and amendment hits preserve structured/document-backed identity.
- [ ] Request a document diff for two versions of one bill; verify bounds, counts, ordered operations, canonical source
      mapping, and rejection of cross-bill or nonexistent document pairs.
- [ ] Confirm universal search and research answers remain absent while their fusion, generation, citation, and budget
      controls are blocked.

## Subscription and webhook product gate

Do not execute this section or compose the handler until the backlog's repository, encryption, idempotency, matching,
and delivery adapters are implemented and reviewed.

- [ ] Prove organization and personal ownership isolation for list, read, patch, cancel, events, and deliveries.
- [ ] Prove exact normalized subscription duplicates conflict for both null-organization and organization owners while
      distinct event/delivery/frequency/timezone combinations remain valid.
- [ ] Replay every mutation with the same idempotency key and body; verify identical status, headers, and encrypted
      secret response for 24 hours. Reuse the key with another body and verify `409`.
- [ ] Verify current and stale `If-Match` behavior, exact DELETE replay, cancellation audit retention, and disabled linked
      delivery preferences.
- [ ] Attempt webhook creation and verification with loopback, private, link-local, mixed public/private DNS,
      credential-bearing, redirecting, and DNS-rebinding destinations. No request may connect unless it pins a currently
      revalidated approved public address while preserving the hostname for TLS and Host.
- [ ] Verify challenge body/signature/timeout behavior, signature constant-time validation, five-minute receiver window,
      one-time secret disclosure, dual-key overlap, zero-overlap rotation, and old-key expiry.
- [ ] Exercise webhook retry categories, bounded jitter/backoff, five-attempt terminal behavior, dead-letter/audit state,
      and delivery-ID deduplication. Email and in-application delivery require their own reviewed executors.

## MCP-to-HTTP parity

For each row marked migrated in the MCP parity map, call the MCP tool and its HTTP operation against the same database
snapshot and normalized input.

| Product | MCP operations | HTTP assertions |
| --- | --- | --- |
| Bills | search, get one/many, timeline, text, related, version comparison | Same canonical bill/document IDs, child completeness, ordering, warnings, and diff operations. |
| Amendments | search, get one/many, search for bills | Same structured/document-backed identities, bill links, item errors, pagination, and ranking. |
| Votes | search, get bill votes, get one/many | Same vote IDs, result/count vocabulary, named positions, ordering, and pagination. |
| People and organizations | search and get | Same canonical IDs, memberships exposed by the approved detail contract, filters, and warnings. |
| Meetings and calendars | search/get event and calendar | Same canonical meeting IDs, time/status fields, child records, and explicit absence where calendar resources are blocked. |
| Supporting materials | search and get | Same material/section IDs, parent mapping, provenance, ranking, and pagination. |
| Changes | search changes | Same event IDs, filters, observed ordering, before/after policy, and cursors. |

Apply these parity rules:

- [ ] Compare canonical records after removing transport-only envelope fields; do not compare raw provider objects.
- [ ] Require exact ID, discriminator, date/time, relationship, source URL, warning, and pagination equality.
- [ ] For deterministic lexical retrieval, require identical ordered IDs through the compared depth.
- [ ] For semantic or hybrid retrieval, pin models and index snapshot, then require identical ordered IDs and scores within
      the documented numeric tolerance. A top-k overlap metric alone does not excuse transport divergence.
- [ ] Compare error category, retryability, item isolation, and absent-versus-empty behavior for invalid and missing input.
- [ ] Record latency separately; parity passes on behavior and quality, while latency is an independent release gate.

### Focused `getBill` canary

`pnpm --filter legislation canary:mcp-http-parity` is the first fail-closed parity canary. It compares the direct
`LegislationQueryService.getBill` result with the deployed HTTP-backed MCP adapter for one explicit fixture. Set
`LEGISLATION_PARITY_API_BASE_URL`, `LEGISLATION_PARITY_BILL_ID`, and `LEGISLATION_PARITY_TOKEN`; the configured
`DATABASE_URL` must point to the same snapshot as the deployment. The token remains in memory and is never printed.
The canary normalizes JSON date serialization, then requires exact recursive equality, including child ordering,
warnings, truncation, and absent-versus-present fields. It exits nonzero on any request error or mismatch and does not
change Railway configuration or `LEGISLATION_MCP_HTTP_METHODS`.

## Run record

Record one row per execution:

| Field | Value |
| --- | --- |
| Date and reviewer | |
| Commit/deployment | |
| Database fixture/snapshot | |
| Auth principal scopes | |
| Embedding and reranking routes | |
| Products and routes exercised | |
| Smoke result and evidence path | |
| MCP parity result and evidence path | |
| Known deviations and owning backlog item | |

### 2026-08-24 release-preparation record

| Field | Value |
| --- | --- |
| Date and reviewer | 2026-08-24, authenticated remote evidence supplied for root review |
| Commit/deployment | Commit `2846332`; Railway `legislation-api` deployment `f7c855ed-9b81-482b-9def-d3b3d8b90255` |
| Database fixture/snapshot | Local scoped bill fixture; remote production records `jurisdiction:ak` and `session:ak:30` |
| Auth principal scopes | Local scoped profile and remote no-token API/MCP challenge checks passed. An ephemeral M2M token for `WORKOS_API_AUDIENCE` passed the API profile and was correctly rejected by `/mcp`; its WorkOS application was deleted and verified absent. |
| Embedding and reranking routes | Not exercised |
| Products and routes exercised | Local scoped bill routes; remote `/health`, `/ready`, unknown route, unsupported method, unauthenticated rejection, and authenticated scoped `GET /api/jurisdictions/{jurisdictionId}/bills` plus `GET /api/sessions/{sessionId}/bills` |
| Smoke result and evidence path | Remote `scoped-bills` profile passed 7/7 with 0 blocked and 0 failed against the recorded deployment. See [Railway API release record](http-api-railway-release.md). |
| MCP parity result and evidence path | Focused strict `getBill` HTTP-parity canary passed for `bill:ak:30:hb:1` against the same production snapshot: exact recursive direct QueryService versus deployed HTTP-adapter equality, correlation ID `bd7dda5d-104b-47d8-8ffa-2251e2abbcda`. Production MCP remains in-process. |
| Known deviations and owning backlog item | Only the two scoped bill collection routes are Done. Remaining MCP methods, an MCP-resource authenticated canary, and any HTTP/hybrid enablement remain pending (API-07). |

Only after the run is reviewed, linked from the backlog, and the route is included in a reviewed commit may its state
move to **Done**.
