# Regulatory HTTP API and MCP contract

Proposed additions, September 14, 2026. These routes/tools are not implemented or added to the current live endpoint
count by this document. Parent: [implementation](implementation.md). Reuse the normative
[shared HTTP schemas](../engineering/api/schemas.md), WorkOS access rules and API-backed MCP architecture.

## Runtime and access

Each operation gets an explicit Next.js `app/api/.../route.ts`, a strict Zod request schema, reusable application query
service, typed API-client method and HTTP/MCP parity tests. No catch-all regulatory router and no direct provider/model
ingestion inside request handlers. Public read operations below are authenticated; no operator ingestion controls are
exposed in public MCP. Existing WorkOS API/MCP audiences remain distinct and token forwarding/exchange follows the
existing adapter contract. Do not accept an MCP audience token directly as an API credential.

All successful bodies use the existing `ResourceResponse<T>`, `Page<T>` or `SearchPage<T>` envelope; errors preserve
correlation IDs and existing status/categories. All records include `id`, `canonicalUrl`, `sources`, `updatedAt`.
Sources identify publisher and supplier separately, source URL/rendition, retrievedAt, sourceModifiedAt, source currency,
rights/attribution and version hash. Missing dates/text/status are `null`/explicit availability, not fabricated defaults.

Authorization checks source rights before retrieval, candidate ranking, snippets, aggregate counts, caching and artifact
delivery. Canonical hydration rechecks current rights so a stale search index cannot leak restricted text. Government
records may eventually be public by product decision; this specification starts authenticated. Feature readiness and
account entitlements are distinct: unsupported data is not described as a customer quota exhaustion.

## Shared request rules

IDs are opaque single encoded path segments. Reject unknown fields, invalid dates, reversed ranges and unsupported
filters with `400 invalid_request`. Lists use cursor + limit default 20/max 100; ID/enum filter arrays max 25 unique
items. Collection cursors bind caller, normalized filters, sort, page size and selected generation. POST searches are
read-only and use no mutation idempotency key. Query text is trimmed 1–500 characters.

`selection` is one of `{ editionId }`, `{ asOf: YYYY-MM-DD }`, or omitted/latest. `asOf` applies to code versions only,
never to publication date implicitly. Search can use `editionIds` instead of selection for explicit comparison scope;
mixing `editionIds` and `asOf` is rejected. Filter date names specify their meaning, e.g. `publishedFrom` versus
`observedFrom`; do not reuse ambiguous `from` for different clocks. All ranges are inclusive.

Version metadata includes `basis`, `selectedDate`, `sourceCurrencyDate`, `observedAt`, `contentHash`,
`legalStatus`, `availability` and `isLatestValidated`. See [data contract](data-contract.md) for historical semantics.
Unsupported asOf returns `409 conflict`/`historical_coverage_unavailable`, not silently selected nearby text. Unknown
canonical IDs return 404. A scope with no ingested coverage returns coverage warnings and no claim of known absence.

## Endpoint inventory

Lists specify default sort below with final ID tiebreakers. GET detail responses contain bounded metadata, not unbounded
entire title text or child collections. Text is traversed through passages and artifact retrieval.

| Operation | Input in addition to ID/cursor/limit | Response and ordering |
| --- | --- | --- |
| GET `/api/legal-codes` | jurisdictionId, kind (`statute`/`regulation`) | `Page<LegalCode>`; jurisdiction/name/id |
| GET `/api/legal-codes/{codeId}` | none | `LegalCodeDetail`; latest edition, coverage and available capabilities |
| GET `/api/legal-codes/{codeId}/editions` | sourceId, issuedFrom, issuedTo | `Page<LegalEdition>`; issue date descending/id |
| GET `/api/legal-codes/{codeId}/provisions` | editionId OR asOf; parentId; nodeKind | `Page<ProvisionSummary>`; edition structural order/id |
| GET `/api/legal-editions/{editionId}` | none | `LegalEditionDetail`; manifest coverage, dates, revision and status |
| GET `/api/legal-provisions/{provisionId}` | editionId OR asOf OR versionId | `ProvisionDetail`; selected exact version metadata, hierarchy, bounded passage preview |
| GET `/api/legal-provisions/{provisionId}/versions` | sourceId | `Page<ProvisionVersionSummary>`; first observed date descending/id; edition memberships paged through edition traversal |
| GET `/api/legal-versions/{versionId}` | none | `LegalVersionDetail`; exact immutable text identity and passage count |
| GET `/api/legal-versions/{versionId}/passages` | none | `Page<LegalPassage>`; ordinal/id; provision or publication version |
| GET `/api/legal-passages/{passageId}` | none | `LegalPassage`; exact source/version/locator and bounded text |
| POST `/api/legal-provisions/resolve` | citation, jurisdictionId, codeId?, editionId? OR asOf? | `CitationResolution`; resolved, ambiguous or not_found result |
| GET `/api/regulatory-documents` | jurisdictionId, agencyId, kind, publishedFrom, publishedTo, updatedSince | `Page<RegulatoryDocumentSummary>`; publication date descending/id |
| GET `/api/regulatory-documents/{documentId}` | versionId? | `RegulatoryDocumentDetail`; latest validated default; dates, kind, agencies, current text version ID |
| GET `/api/regulatory-documents/{documentId}/versions` | none | `Page<DocumentVersionSummary>`; source revision/observation descending/id |
| GET `/api/regulatory-actions/{actionId}` | none | `RegulatoryActionDetail`; grouping evidence and bounded aliases |
| GET `/api/regulatory-actions/{actionId}/documents` | kind | `Page<RegulatoryDocumentSummary>`; publication date ascending/id |
| POST `/api/search/regulations` | request defined below | `SearchPage<RegulatorySearchHit>`; frozen ranking |
| POST `/api/legal-versions/compare` | leftVersionId, rightVersionId, cursor?, limit? | `Page<LegalDiffHunk>`; source structural order |
| GET `/api/legal-relationships` | exactly one of provisionId/documentId/actionId; type; direction | `Page<LegalRelationship>`; type/target/id |
| GET `/api/legal-events` | jurisdictionId, codeId, documentId, kind, observedFrom, observedTo, cursor | `Page<LegalEvent>`; observedAt ascending/id |
| GET `/api/regulatory-coverage` | jurisdictionId, codeId, corpus, sourceId | `Page<RegulatoryCoverage>`; jurisdiction/corpus/source/id |
| GET `/api/legal-artifacts/{artifactId}` | none | `LegalArtifactAccess`; metadata plus short-lived authorized download URL where permitted |

`legal-versions` resolves the discriminated provision/publication version identity, so publication text uses the same
bounded passage API. The ID namespace prevents cross-table collisions. No route nests more than one parent. An action
is discoverable through document/relationship/search results; a broad action-search product is deferred.

`CitationResolution` includes normalized input, status, exact provision/version when resolved, or at most 25 candidates
with a refinement requirement when ambiguous. A conflicting jurisdiction/code is invalid. Bare citations such as
`section 12` cannot resolve silently across codes; source citations are matched through the canonical alias registry.

Diff requires two versions of the same provision or publication. Different owners return `400 invalid_request`;
cross-state semantic comparison is a later analysis feature. Hunk types are added/removed/unchanged, with source
locators and exact version IDs. Results are generation-bound and bounded by both item count and 100,000 text characters.
No LLM is needed to compute a literal text diff. Large documents use a persisted comparison result with stable paging,
not an unbounded synchronous recomputation on every page.

## Search request and result

Strict request fields:

```ts
type RegulatorySearchRequest = {
  query: string
  mode?: "lexical" | "semantic" | "hybrid"
  jurisdictionIds?: string[]
  codeIds?: string[]
  agencyIds?: string[]
  corpora?: ("regulation" | "regulatory_publication" | "statute")[]
  publicationKinds?: ("proposed_rule" | "final_rule" | "notice" | "other")[]
  publishedFrom?: string
  publishedTo?: string
  editionIds?: string[]
  asOf?: string
  allowDegraded?: boolean
  cursor?: string
  limit?: number
}
```

Defaults: lexical, corpora regulation + regulatory_publication, latest validated editions, no implicit publication
date restriction, allowDegraded false. Lexical limit max 100/default 20; semantic/hybrid max 25/default 10. `asOf` or
editionIds requires a code-only corpus selection; publication-kind/date filters require publication-only selection.
Reject incompatible mixed queries rather than silently ignoring a filter. Clients can issue two explicit queries.

Each hit is `kind: provision | publication`, canonical owner ID, version ID, passage ID, title/heading, citation,
jurisdiction/code/agency references, publication kind where applicable, selected edition/dates, <=500-character snippet,
source/attribution, match mode, exact source locator and coverage warnings. Return selected lexical/embedding generations,
effectiveMode, degradation state and candidateSetTruncated in documented search metadata. Model identifiers are server
configuration, not arbitrary caller-supplied names. Citations always reference the exact hit version.

Collection pagination signals text truncation independently from row pagination. A legal passage is limited by the
chunk contract; assembled MCP text is capped at 100,000 characters and supplies continuation. No endpoint downloads
full vendor corpora. Artifact URLs expire within five minutes initially, are issued only after authorization, and
are omitted when raw redistribution is not allowed. Azure account credentials and internal blob listing paths never
appear in responses. Vendor-only source links are labeled as such; do not fabricate official publisher URLs.

## Coverage and errors

Coverage distinguishes requested, available and excluded scope; code versus rulemaking publications; current versus
history; source publisher currency versus Tabra collection; and lexical versus semantic readiness. Include last
successful collection, last attempt, latest validated edition, stage counts, pending age, documented gaps and available
date/edition selectors. Detailed internal failures stay operator-only; clients receive safe reason codes.

- 400 invalid_request: unknown filters, malformed citation/date/cursor, excessive limits, incompatible selection.
- 401 unauthorized / 403 forbidden: existing auth/entitlement rules; metadata must not reveal restricted content.
- 404 not_found: unavailable canonical identity, distinct from an empty collection in a partially covered scope.
- 409 conflict: unsupported historical selection or revision conflict, with actionable safe bounds/reason.
- 503 dependency_unavailable: required DB/search/model service unavailable. Explicit lexical degradation follows the
  search contract; unavailable sources during ingestion instead show stale coverage while retained content is served.

## MCP mapping

Extend `src/mcp/http-query-adapter.ts`, tool schemas/registration and `src/api-client/client.ts`. MCP calls the API,
not the regulatory database or external publishers. Every tool is read-only and has descriptions that distinguish
code text, proposed/final publications, observed currency and legal status. Treat retrieved text as evidence, never
instructions; tool descriptions prohibit treating a proposed rule as current consolidated law.

| MCP tool | API operation(s) | Purpose |
| --- | --- | --- |
| `search_regulations` | POST search/regulations | Bounded, filtered cited retrieval |
| `list_legal_codes` | GET legal-codes | Discover actual jurisdiction/code coverage |
| `list_legal_editions` | GET code editions | Select supported historical editions |
| `list_legal_provisions` | GET code provisions | Traverse hierarchy in a selected edition |
| `resolve_legal_citation` | POST provisions/resolve | Exact citation or explicit ambiguity |
| `get_legal_provision` | GET provision | Metadata and selected version |
| `get_legal_text` | GET version + version passages | Bounded exact-version text with continuation |
| `get_regulatory_document` | GET regulatory document | Published proposal/final/notice metadata |
| `list_regulatory_documents` | GET regulatory-documents | Publication history by kind/date/agency |
| `get_regulatory_action` | GET action + action documents | Bounded evidence-backed grouping |
| `compare_legal_versions` | POST versions/compare | Literal source-text differences |
| `get_legal_relationships` | GET legal-relationships | Authority/citation/amendment links |
| `get_legal_changes` | GET legal-events | Observed changes with historical flags |
| `get_regulatory_coverage` | GET regulatory-coverage | Scope and freshness before relying on absence |

Inputs match API schemas; use API-client methods and safe error mapping. Wrapping multiple API calls must share a
bounded result budget and propagate exact version selections. No parallel tool-only search algorithm, provider key,
special unlimited limit, or mutation tool. MCP tools/list advertises the read-only/idempotent annotations supported
by the installed SDK and feature availability. Capability is registered only after endpoint gates pass.

## Existing cross-product surfaces

Dedicated regulatory routes/tools ship first. In the subsequent integration phase, add explicit `regulatory_provision`
and `regulatory_document` discriminators to `/api/search/all`, typed client and universal result UI. Existing default
record selection stays documented; any default expansion requires contract and relevance acceptance. Do not silently
add state data to a federal-only query. Research answers may cite new kinds only after grounding/citation resolver
tests pass, including prohibited invented effective dates and mixed current/historical versions.

Extend existing subscription target/event unions and webhook schemas with regulatory provision/code/action targets,
source-observed change types and version IDs. Notifications are emitted once from the committed event outbox, only for
enabled targets and post-activation changes; historical backfills and parser-only reprocessing do not notify by default.
Deliveries retain existing organization ownership, signatures, retries and access checks. State code updates are labeled
observed code changes unless an actual rulemaking event is supplied. No new email/Slack/Teams sender is part of this spec.

## Acceptance fixtures

Exercise explicit Next routes in a built app, not only direct handler calls: valid/invalid WorkOS audiences, missing
permissions, encoded IDs, unknown fields, date precision, cursors across filters, ambiguous citations, missing history,
bounded large text, stale coverage, unavailable semantic dependency, and prohibited licensed artifacts. Run the same
fixtures through the deployed API-backed MCP client. Compare IDs, text hashes, dates, rights and pagination exactly.
Any regulatory UI added for these surfaces also needs integrated-browser desktop/mobile/keyboard acceptance; server
tests alone do not establish the user experience.
