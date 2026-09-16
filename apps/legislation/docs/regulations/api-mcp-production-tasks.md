# Remaining regulatory HTTP and MCP tasks

Owner: [production backlog](production-backlog.md). Exact route/tool names live in the
[API/MCP contract](api-mcp-contract.md); preserve `/api/legal/` simple resource names and `/api/search/legal`.
Work in explicit Next route files, reusable application services, `src/api-client/client.ts`, existing auth/request
context and `src/mcp/`. Do not add direct database/provider access behind MCP or replace WorkOS login.

## HTTP surface

September 15 discovery slice: [published code discovery](legal-code-discovery.md) adds the strict codes-list contract,
rights-filtered catalog service, explicit route, typed client and API-backed `list_legal_codes` tool. This advances
HTTP-02/03/04/14/15 and TOOLS-01/02/04/08/09; code detail, editions, traversal, coverage and deployed gates remain open.

The [edition/provision browser](legal-edition-browsing.md) additionally ships code-edition lists, structural traversal,
strict client contracts, explicit Next routes and corresponding MCP tools. It advances the same gates and connects
discovered IDs to exact text. Code detail, edition detail, public coverage and deployed acceptance remain open.

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

## MCP tools

Reuse the API-backed adapter, existing API/MCP token exchange and response-size budgeting. Tool registration waits for
the corresponding endpoint slice. TOOLS-05 is a bounded model gate, not a dependency on every remaining tool.

- [ ] **TOOLS-01 Add shared typed API adapter calls.** Map regulatory operations to the actual client methods and
  safe error handling; retain correlation and explicit version selection. **Done:** no model key, database pool,
  ingestion control or government source fetch is reachable from the adapter. Depends on HTTP-01, first shipped routes.
- [ ] **TOOLS-02 Add coverage and code discovery tools.** Implement `get_regulatory_coverage`, `list_legal_codes` and
  `list_legal_provisions` with contract-aligned inputs and read-only annotations. **Done:** clients can discover IDs
  and unsupported scope before searching; tool discovery lists only implemented capabilities. Depends on HTTP-04/10, TOOLS-01.
- [ ] **TOOLS-03 Add retrieval tools.** Implement `search_regulations`, `get_legal_provision` and `get_legal_text` using
  search/provision/text API methods; preserve exact selected context through composed calls. **Done:** no silent latest
  version substitution or custom MCP-only ranking path. Depends on HTTP-05–06/09, TOOLS-01.
  Local progress: `search_regulations` calls the strict HTTP client under same-principal credentials. The real-database
  MCP canary verifies cross-edition hits, continuation and composed exact text against HTTP. Provision detail, broader
  scope and deployed acceptance remain open.
- [ ] **TOOLS-04 Enforce combined output budgets.** Apply the existing MCP response byte budget and 100,000-character
  assembled text ceiling, including composed requests, warnings and continuation. **Done:** large tables/documents
  return deterministic continuation; no field bypasses limits or silently truncates evidence. Depends on TOOLS-02–03.
- [ ] **TOOLS-05 Run the deployed API-backed model canary.** Invoke discovery, search and exact-text reads using real
  client credentials and a bounded persisted lexical/vector pilot. **Done:** API/MCP IDs, citations, hashes, filters,
  dates, modes and pagination agree; MCP-audience tokens cannot call API directly. Depends on HTTP-14/17, TOOLS-02–04/11,
  VECTOR-07 for semantic evidence. Does not depend on EVAL-12 or bulk vectors.
- [ ] **TOOLS-06 Add publication/action tools.** Implement `list_regulatory_documents`, `get_regulatory_document` and
  `get_regulatory_action` with proposal/final/notice distinctions and agency/source filters. **Done:** duplicated
  publisher numbers and unresolved grouping evidence retain the same API meaning. Depends on HTTP-08/12, TOOLS-01.
- [ ] **TOOLS-07 Add diff/relationship/event tools.** Implement `compare_legal_versions`, `get_legal_relationships` and
  `get_legal_changes`; propagate bounded paging and exact owner/version selection. **Done:** every output field agrees
  with the corresponding HTTP response, including unsupported history. Depends on HTTP-12–13, TOOLS-01.
- [ ] **TOOLS-08 Test hostile source content and grounding.** Include source text containing tool instructions, fake
  system messages and misleading proposed/current language. **Done:** source strings remain untrusted data; no tool
  executes their instructions or supplies uncited invented legal status. Depends on TOOLS-03/06–07.
- [ ] **TOOLS-09 Verify rights and outage behavior.** Test account isolation, mid-pagination revocation, expired source
  capability, model outage and partially ready partitions through a real MCP client. **Done:** safe errors/degradation
  and continuation match HTTP without cached content leakage. Depends on TOOLS-05–08.
- [ ] **TOOLS-10 Publish and verify the shipped tool catalog.** Document input examples, coverage discovery, unsupported
  cases and read-only/idempotent annotations; run deployed tool discovery and a complete research sequence. **Done:**
  catalog, advertised tools and actual client execution agree. Depends on TOOLS-09, HTTP-15–16.
- [ ] **TOOLS-11 Verify the deployed lexical-only path.** Run coverage discovery, lexical search and exact-text
  continuation with a real MCP client against the acknowledged pilot, including wrong-account/audience and unavailable
  semantic requests. **Done:** IDs, citations, versions, limits and safe errors agree with HTTP without requiring any
  vectors. Depends on HTTP-14, TOOLS-02–04, OPS-08. This is G2; TOOLS-05 adds G3's model evidence later.

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
