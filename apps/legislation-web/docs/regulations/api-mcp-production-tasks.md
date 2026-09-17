# Remaining regulatory HTTP and MCP tasks

Owner: [production backlog](../../../legislation-ingestion/docs/regulations/production-backlog.md). Exact route/tool names live in the
[API/MCP contract](api-mcp-contract.md); preserve `/api/legal/` simple resource names and `/api/search/legal`.
W owns explicit Next routes and query/application services; C owns typed client/contracts and shared auth primitives;
M owns its adapter/registration. Do not add direct database/provider access behind MCP or replace WorkOS login.

## HTTP surface

Code canonical URLs now resolve through an authenticated metadata detail route, typed client and API-backed
`get_legal_code` tool. It shares catalog rights filtering and rejects mismatched response identities. Detail includes
published edition-component counts and the explicit current eCFR head with separate issue/currency dates. Complete-history
coverage, search-capability enrichment and deployed detail acceptance remain open; this advances but does not close HTTP-04.

September 15 discovery slice: [published code discovery](legal-code-discovery.md) adds the strict codes-list contract,
rights-filtered catalog service, explicit route, typed client and API-backed `list_legal_codes` tool. This advances
HTTP-02/03/04/14/15 and TOOLS-01/02/04/08/09; code detail, editions, traversal, coverage and deployed gates remain open.

The [edition/provision browser](legal-edition-browsing.md) additionally ships code-edition lists, structural traversal,
strict client contracts, explicit Next routes and corresponding MCP tools. It advances the same gates and connects
discovered IDs to exact text. Code detail, edition detail, public coverage and deployed acceptance remain open.

September 17 local slice: stage-specific coverage ships a strict shared contract, rights-filtered database reader,
explicit `/api/legal/coverage` route, typed client and API-backed `get_regulatory_coverage` tool. Canonical, lexical and
semantic readiness are derived independently from published membership, acknowledged copy receipts and exact ready
vector counts. HTTP-10 and TOOLS-02 remain open for deployed canaries and broader statute/state data.

September 15 local slice: [exact-text serving](legal-text-serving.md) implements the selected database read, strict
response/request contract, typed client and explicit authenticated version-text route. This advances HTTP-01/03/06/14/15;
their full-scope gates remain open, including passages, discovery, deployed credentials/router and deployed MCP parity.

The exact-text MCP slice adds the typed adapter call, conditional `get_legal_text` registration, same-principal API
credential verification and bounded continuation. It advances TOOLS-01/03/04/08/09; full tool sets and deployed canaries
remain open. Shared service credentials cannot authorize another MCP caller's regulatory reads.

Schemas can start now; query-backed delivery depends on INDEX-02/07 and the relevant canonical data. Deliver complete
vertical slices: application service, serializer, strict client parser, explicit route and focused parity tests together.

- [ ] **HTTP-01 Reconcile the remaining wire contract.** Extend existing search/reader schemas with canonical code,
  edition, provision, publication, version, passage and coverage DTOs. Preserve the generic 25-item filter limit and
  legal search's explicit 100-ID exception; define nulls, source fields and safe error details once.
  **Done:** normative docs, request validation, serialization and client parsing agree, with unknown fields rejected.
- [ ] **HTTP-02 Implement shared legal selectors.** Resolve current, edition+version and exclusive asOf against validated
  membership and actual historical capability. **Done:** unsupported dates return the specified conflict, incompatible
  edition/version pairs fail, annual snapshots never pretend to support arbitrary daily history. Depends on HTTP-01.
- [ ] **HTTP-03 Complete request authorization.** Integrate the existing gated canary with deployed WorkOS API identity,
  organization access and feature readiness; evaluate source rights before candidates/counts/snippets. **Done:** absent,
  wrong-audience, wrong-account, revoked and synthetic restricted-state cases fail before text access. Depends on HTTP-01.
- [ ] **HTTP-04 Implement legal code/edition discovery.** Ship codes list/detail, code editions, edition detail and
  code-provision traversal with explicit root/children/all modes. **Done:** structural order and pinned-edition cursors
  page without omissions; incomplete/unsupported editions are labeled honestly. Depends on HTTP-02–03.
- [ ] **HTTP-05 Implement provision and version reads.** Ship provision detail, versions, reverse edition memberships
  and version detail with context-neutral immutable fields and separately validated selected context. **Done:** exact
  versions remain readable across head changes; responses never mix dates/hierarchy from another edition. Depends on HTTP-02–03.
- [ ] **HTTP-06 Implement bounded source-text and passage reads.** Ship version text/passages and passage detail using
  the existing lossless reader, anchors and continuation; enforce body and text limits. **Done:** complete continuation
  reconstructs the selected source, oversized responses are bounded, revoked cached text is refused. Depends on HTTP-05, PASS-08.
- [ ] **HTTP-07 Implement citation resolution.** Ship provisions/resolve over canonical aliases with jurisdiction/code/
  edition constraints. **Done:** ambiguous and absent citations return the documented result with bounded candidates;
  no fuzzy guess is silently presented as an exact provision. Depends on HTTP-02–03, ING-10.
- [ ] **HTTP-08 Implement publication and agency discovery.** Ship publication list/detail/versions and source-agency
  directory with publication-date/kind/agency filters. **Done:** unresolved source agencies remain representable, duplicate
  printed numbers resolve to distinct canonical documents, all results retain exact provenance. Depends on ING-05/09, HTTP-01/03.
- [ ] **HTTP-09 Implement lexical legal search end to end.** Connect the strict search schema to corpus-wide query
  service, request-bound response checks, typed client method and explicit POST route. **Done:** lexical searches
  preserve filters, exact versions and pagination; semantic/hybrid requests return explicit unavailable capability
  until HTTP-17 ships, not an empty semantic success. Depends on INDEX-02/07–08, HTTP-01–03.
  Local progress: `validateLegalSearchResponse` binds mode/limit, degradation permission, scope and date filters to
  the request and rejects duplicate versions and inconsistent continuation. Wire tests exercise empty-result fallback
  and exact historical-date evidence. Public projection, current-code/explicit-edition selectors, POST route and typed
  client are now locally implemented and covered by a real-database authenticated handler canary. Agency/publication
  scopes and deployed acceptance remain open. The API-backed MCP search tool now passes local real-database
  search/pagination/text parity; see [serving evidence](legal-search-serving.md).
- [ ] **HTTP-10 Implement public coverage reporting.** Ship coverage filters and stage-specific capability, requested/
  available/excluded scope, publisher currency and collection attempt fields. **Done:** source collection, canonical,
  lexical and semantic readiness differ correctly; account-inaccessible metadata is not disclosed. Depends on ING-16
  for full scope, INDEX-06 for pilot scope, HTTP-03.
- [ ] **HTTP-11 Implement authorized artifact access.** Ship artifact metadata and short-lived download links only when
  redistribution is allowed; reuse configured artifact storage. **Done:** links expire within the contract limit,
  unauthorized requests reveal neither storage credentials nor internal listings, denied rights issue no link. Depends on HTTP-03.
- [ ] **HTTP-12 Implement actions and relationships.** Ship action detail/publications and relationship queries from
  persisted source evidence with bounded typed targets and selected/all scopes. **Done:** unresolved links remain explicit
  and an observed citation is not presented as proven legal impact. Depends on ING-09–10, HTTP-02–03/08.
- [ ] **HTTP-13 Implement version comparison and events.** Ship same-owner literal diff with bounded persisted paging
  and events ordered by observation time; separate historical imports from new-source changes. **Done:** cross-owner
  comparisons fail, diff continuation is stable, events never substitute for a synchronization checkpoint. Depends on HTTP-05–06, SYNC-05–07.
- [ ] **HTTP-14 Run built-router and client canaries.** Extend the existing actual-router harness with retained IDs,
  real response schemas and token-audience tests. **Done:** success, unsupported date, stale cursor, rights denial,
  dependency outage and exact-source hydration pass through HTTP, not only mocked application services. Depends on the
  selected pilot routes above; repeat for each added route.
- [ ] **HTTP-15 Complete operation inventory and docs.** Update endpoint counts, route inventories and examples only
  for shipped operations; make unavailable capabilities discoverable without registering incomplete methods. **Done:**
  explicit route files, client methods, normative inventory and failure examples agree. Depends on HTTP-04–14.
- [ ] **HTTP-16 Verify full-scope consumer behavior.** Exercise realistic backend, frontend and third-party sequences:
  discover coverage -> search -> exact version/text -> next page -> observe correction. **Done:** documented limits,
  selection and errors are usable without internal generation IDs; latency and rights checks pass deployed. Depends on HTTP-15, OPS-08.
- [ ] **HTTP-17 Connect semantic and hybrid search.** Extend the shipped search service/client path to bounded persisted
  vector generations, frozen candidate paging and explicit allowed lexical fallback. **Done:** request/response model,
  generation, scope and degradation metadata agree during normal queries and outages; a pilot generation is sufficient.
  Depends on HTTP-09, INDEX-09–10, VECTOR-04; bulk embedding completion is not a prerequisite.

## Search serving tasks

These original INDEX IDs follow query ownership into W; I retains copy/reconciliation tasks and dated source-pilot
evidence in [search production](../../../legislation-ingestion/docs/regulations/search-production-tasks.md).

- [ ] **INDEX-02 Implement corpus-wide candidate selection.** Select authorized acknowledged scopes before ranking;
  honor validated current, explicit historical and publication filters. Done: no excluded/unacknowledged candidates
  across editions/publications. Depends on INDEX-01.
- [ ] **INDEX-05 Complete rights invalidation across serving.** Invalidate filter projections, result/candidate caches
  and later vectors, coordinating I's existing bounded cleanup. Done: immediate read denial, resumable derivative
  removal and preservation of other allowed copies.
- [ ] **INDEX-07 Implement canonical result hydration.** Group by owner/exact version and attach citation, locator,
  dates, agencies and warnings without contradictory context or duplicate documents. Depends on INDEX-02, ING-09.
- [ ] **INDEX-08 Implement lexical cursor binding.** Bind caller, normalized query/filters, limit, stable ranking and
  generation; invalidate incompatible rights/generation. Done: no skipped/duplicate pages and safe changed-account,
  filter and expiry errors. Depends on INDEX-07. Local evidence: a 15-minute, 1,000-version frozen window and DB checks
  for stable pages, caller/query/limit/scope binding, tampering and expiry cleanup; see [pagination](edition-search-canary.md).
  Broader public/deployed acceptance remains open.
- [ ] **INDEX-09 Implement frozen semantic/hybrid candidates.** Persist bounded model/generation-bound candidates,
  expiry, caller and truncation metadata, deterministic fusion and selected reranking. Done: no changing rankings across
  pages or revoked cached hits. Depends on INDEX-07, VECTOR-04.
- [ ] **INDEX-10 Implement explicit degradation.** Require explicit lexical fallback permission and preserve requested/
  effective mode, generation/model metadata. Outage, missing vectors or partial scope cannot masquerade as semantic
  success. Depends on INDEX-02/09.
- [ ] **INDEX-11 Tune selective lexical/filter indexes.** Capture EXPLAIN ANALYZE and representative-volume timings for
  common/sparse jurisdiction/code/agency/date/edition filters. Done: bounded scans and pre-top-k filtering, with measured
  limits/risks. C owns schema changes and I maintenance. Depends on INDEX-02/07.
- [ ] **INDEX-13 Benchmark correction and concurrent retrieval.** Coordinate I loading/corrections/revocation with
  representative reads; prove latency, throughput and repair lag without bill-search regression. Depends on INDEX-11–12, OPS-06.
- [ ] **INDEX-14 Promote lexical capability by partition.** Select serving generation/rollback pointer; test disable/
  revert without deleting sources. Advertise only acknowledged measured scope and restore prior allowed generations.
  Depends on INDEX-06, INDEX-12–13, HTTP-14.

## MCP delivery ownership

The original TOOLS-01 through TOOLS-11 tasks now have one home in
[M's regulatory delivery backlog](../../../legislation-mcp/docs/engineering/legal-tool-tasks.md).
This page retains HTTP and adjacent product tasks; cross-owner dependencies keep their original IDs.

## Adjacent product delivery

- [ ] **PRODUCT-01 Integrate regulatory result types into universal search.** Add explicit discriminators and cited
  record links through the existing client/rendering path. **Done:** bill search behavior is unchanged and regulatory
  source/version links work; integrated-browser desktop/mobile/keyboard acceptance passes. Depends on HTTP-09/15.
- [ ] **PRODUCT-02 Extend research citations and notification targets.** Add exact regulatory version citations and
  supported regulatory subscription/webhook event kinds using existing infrastructure. **Done:** historical imports
  do not trigger ordinary new-change alerts; signed retry delivery is idempotent. Depends on HTTP-12–13, SYNC-07.
- [ ] **PRODUCT-03 Define enterprise synchronization separately.** Specify an atomic baseline, durable committed-change
  cursor, hydration, purge/restriction, retention and resnapshot protocol before implementing external bulk sync.
  **Done:** reviewed protocol and executable recovery acceptance plan exist; events/webhooks are not mislabeled as a
  lossless data feed. Depends on HTTP-10/13 and actual enterprise sync requirements; not a core ingestion gate.

These product tasks extend serving after the relevant API slice. They do not block acquiring or indexing federal data.
Customer-facing copy requires available Fluent review; actual UX changes require integrated-browser acceptance.
