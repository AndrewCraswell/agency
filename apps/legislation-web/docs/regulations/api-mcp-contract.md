# Regulatory HTTP API contract

Contract recorded September 14, 2026. The [exact-version text operation](legal-text-serving.md) is implemented locally;
the corresponding opt-in `get_legal_text` MCP tool is also implemented locally. The
[published code list](legal-code-discovery.md), [edition/provision browser](legal-edition-browsing.md), and their
`list_legal_codes`, `get_legal_code`, `list_legal_editions`, `get_legal_edition`, `list_legal_provisions` tools are implemented locally;
code detail serves authorized metadata, published edition-component counts and the explicit current eCFR edition;
complete-history and search-capability enrichment remains planned.
[Federal lexical search](legal-search-serving.md) is also locally implemented as a POST route and typed client;
the API-backed `search_regulations` tool is also implemented locally. Other routes/tools remain proposed.
No deployed regulatory coverage is claimed. Parent: [implementation](../../../legislation-ingestion/docs/regulations/implementation.md). Reuse the normative
[shared HTTP schemas](../engineering/api/schemas.md), WorkOS access rules and API-backed MCP architecture.

Naming decision, September 14, 2026: use `/api/legal/` with simple resource names and `/api/search/legal` for ranked
retrieval. This namespace covers regulations and statutes, including future state coverage. Published rules, proposals
and notices use `publications`; consolidated code sections use `provisions`. The namespace is not a resource parent.

## Runtime and access

The application-layer canary service (`src/modules/request-handling/api/legal-search-canary.ts`) now requires identity from the verified request
context and an explicitly configured organization allowlist. It requires a selected acknowledged preparation and checks
API/MCP permission before accessing search text. It currently accepts only official federal sources with worldwide
rights; territory-limited policies fail closed until trusted territory attributes are available. Caller-supplied identity
or location fields cannot authorize access. These are application-service gates, not a registered route/tool or a billing
plan implementation. The newer public search implementation below replaces internal preparation selectors with
edition/code selection. Exact-text serving has a separate registered route and client
method, using the same WorkOS API boundary with local signed-token audience tests.

The [cross-edition application canary](edition-search-canary.md) additionally accepts discovered edition IDs rather
than internal preparation/version IDs. It validates selected copy receipts and metadata signatures, ranks unique
versions across editions and hydrates exact canonical passages. The public route and typed client now use this service
with provenance projection, current-code selection and frozen paging, including API-backed MCP parity. Publication/agency search,
semantic retrieval and deployed acceptance remain open; unsupported requested capabilities fail explicitly.

Each operation gets an explicit Next.js `src/app/api/.../route.ts`, a strict Zod request schema, reusable application query
service, typed API-client method and HTTP/MCP parity tests. No catch-all regulatory router and no direct provider/model
ingestion inside request handlers. Public read operations below are authenticated; no operator ingestion controls are
exposed in public MCP. Existing WorkOS API/MCP audiences remain distinct and token forwarding/exchange follows the
existing adapter contract. Do not accept an MCP audience token directly as an API credential.

All successful bodies use the existing `ResourceResponse<T>`, `Page<T>` or explicitly extended `SearchPage<T>` envelope;
errors preserve correlation IDs and existing status/categories. Canonical entities include `id`, `canonicalUrl`,
`sources`, `updatedAt`. Memberships, relationship edges, capability rows, source-agency references, reader blocks and
diff hunks are contextual values; they do not acquire artificial canonical detail routes.
Sources identify publisher and supplier separately, source URL/rendition, retrievedAt, sourceModifiedAt, source currency,
rights/attribution and version hash. Missing dates/text/status are `null`/explicit availability, not fabricated defaults.

Authorization checks source rights before retrieval, candidate ranking, snippets, aggregate counts, caching and artifact
delivery. Canonical hydration rechecks current rights so a stale search index cannot leak restricted text. Government
records may eventually be public by product decision; this specification starts authenticated. Feature readiness and
account entitlements are distinct: unsupported data is not described as a customer quota exhaustion.

## Shared request rules

IDs are opaque single encoded path segments. Reject unknown fields, invalid dates, reversed ranges and unsupported
filters with `400 invalid_request`. Lists use cursor + limit default 20/max 100; ordinary ID/enum filter arrays max 25 unique
items. Legal search is an explicit exception: its implemented schema permits 100 unique IDs, as specified below.
Collection cursors bind caller, normalized filters, sort, page size and selected generation. POST searches are
read-only and use no mutation idempotency key. Query text is trimmed 1–500 characters.

Selection permits `editionId`, `versionId`, or both: together they validate that the requested version belongs to the
requested edition and provision. `asOf: YYYY-MM-DD` is exclusive with both and applies only to supported publisher
history, never implicitly to publication dates. Omission on a provision selects its latest validated edition; a direct
version lookup with no edition remains context-neutral. Search can use `editionIds` instead of selection for explicit comparison scope;
mixing `editionIds` and `asOf` is rejected. Filter date names specify their meaning, e.g. `publishedFrom` versus
`observedFrom`; do not reuse ambiguous `from` for different clocks. All ranges are inclusive.

Immutable version metadata includes owner identity, `contentHash`, input contract and language. Edition-specific `basis`,
`selectedDate`, `sourceCurrencyDate`, `observedAt`, hierarchy, locators, rights and `isLatestValidated` belong in a
separate selected context. A context-neutral version returns no invented edition dates or hierarchy. See
[data contract](../../../../packages/legislation-core/docs/regulations/data-contract.md) for historical semantics.
Unsupported asOf returns `409 conflict`/`historical_coverage_unavailable`, not silently selected nearby text. Unknown
canonical IDs return 404. A scope with no ingested coverage returns coverage warnings and no claim of known absence.

## Endpoint inventory

Lists specify default sort below with final ID tiebreakers. GET detail responses contain bounded metadata, not unbounded
entire title text or child collections. Readable text uses ordered source blocks; passages are retrieval excerpts.

| Operation | Input in addition to ID/cursor/limit | Response and ordering |
| --- | --- | --- |
| GET `/api/legal/codes` | jurisdictionId, kind (`statute`/`regulation`) | `Page<LegalCode>`; jurisdiction/name/id |
| GET `/api/legal/codes/{codeId}` | none | `Resource<LegalCodeDetail>`; authorized metadata, published edition-component count and nullable current eCFR head; full coverage/capability enrichment remains planned |
| GET `/api/legal/codes/{codeId}/editions` | sourceId, issuedFrom, issuedTo | `Page<LegalEdition>`; issue date descending/id |
| GET `/api/legal/codes/{codeId}/provisions` | editionId OR asOf; traversal (`children`/`all`); parentId; nodeKind | `Page<ProvisionSummary>`; edition structural order/id |
| GET `/api/legal/editions/{editionId}` | none | `LegalEditionDetail`; manifest coverage, dates, revision and status |
| GET `/api/legal/provisions/{provisionId}` | editionId and/or versionId OR exclusive asOf | `ProvisionDetail`; selected version and separate context, bounded text preview |
| GET `/api/legal/provisions/{provisionId}/versions` | sourceId | `Page<ProvisionVersionSummary>`; first observed date descending/id; edition memberships paged through edition traversal |
| GET `/api/legal/provisions/{provisionId}/editions` | versionId?; sourceId? | `Page<LegalEditionMembership>`; edition ID ascending; rights-filtered membership discovery |
| GET `/api/legal/versions/{versionId}` | editionId? for a provision version | `LegalVersionDetail`; immutable identity and optional validated context |
| GET `/api/legal/versions/{versionId}/text` | exactly one editionId for provision text OR sourceObservationId for publication text; anchor OR cursor; limit | `ResourceResponse<LegalTextWindow>`; lossless ordered source blocks; locally implemented |
| GET `/api/legal/versions/{versionId}/passages` | none | `Page<LegalPassage>`; ordinal/id; provision or publication version |
| GET `/api/legal/passages/{passageId}` | none | `LegalPassage`; exact source/version/locator and bounded text |
| POST `/api/legal/provisions/resolve` | citation, jurisdictionId, codeId?, editionId? OR asOf? | `CitationResolution`; resolved, ambiguous or not_found result |
| GET `/api/legal/publications` | jurisdictionId, agencyId OR sourceId + sourceAgencyId, kind, publishedFrom, publishedTo, updatedSince | `Page<RegulatoryDocumentSummary>`; publication date descending/id |
| GET `/api/legal/agencies` | jurisdictionId; sourceId?; q? | `Page<LegalAgencyReference>`; name/source/alias; publisher-reference directory, not new organization identities |
| GET `/api/legal/publications/{documentId}` | versionId? | `RegulatoryDocumentDetail`; latest validated default; dates, kind, agencies, current text version ID |
| GET `/api/legal/publications/{documentId}/versions` | none | `Page<DocumentVersionSummary>`; source revision/observation descending/id |
| GET `/api/legal/actions/{actionId}` | none | `RegulatoryActionDetail`; grouping evidence and bounded aliases |
| GET `/api/legal/actions/{actionId}/publications` | kind | `Page<RegulatoryDocumentSummary>`; publication date ascending/id |
| POST `/api/search/legal` | request defined below | `SearchPage<RegulatorySearchHit>`; frozen ranking |
| POST `/api/legal/versions/compare` | leftVersionId, rightVersionId, cursor?, limit? | `Page<LegalDiffHunk>`; source structural order |
| GET `/api/legal/relationships` | exactly one owner; type; direction; scope (`selected`/`all`); editionId/versionId for selected evidence | `Page<LegalRelationship>`; type/target/id; typed bounded target summaries |
| GET `/api/legal/events` | jurisdictionId, codeId, documentId, kind, observedFrom, observedTo, cursor | `Page<LegalEvent>`; observedAt ascending/id |
| GET `/api/legal/coverage` | jurisdictionId, codeId, corpus, sourceId | `Page<RegulatoryCoverage>`; jurisdiction/corpus/source/id |
| GET `/api/legal/artifacts/{artifactId}` | none | `LegalArtifactAccess`; metadata plus short-lived authorized download URL where permitted |

`/api/legal/versions` resolves the discriminated provision/publication version identity, so publication text uses the same
bounded reader API. The ID namespace prevents cross-table collisions. No route nests more than one parent. An action
is discoverable through document/relationship/search results; a broad action-search product is deferred.

`CitationResolution` includes normalized input, status, exact provision/version when resolved, or at most 25 candidates
with a refinement requirement when ambiguous. A conflicting jurisdiction/code is invalid. Bare citations such as
`section 12` cannot resolve silently across codes; source citations are matched through the canonical alias registry.

Diff requires two versions of the same provision or publication. Different owners return `400 invalid_request`;
cross-state semantic comparison is a later analysis feature. Hunk types are added/removed/unchanged, with source
locators and exact version IDs. Results are generation-bound and bounded by both item count and 100,000 text characters.
No LLM is needed to compute a literal text diff. Large documents use a persisted comparison result with stable paging,
not an unbounded synchronous recomputation on every page.

## Reader, traversal and source context

The executable foundation is C's `src/legal-text/reader-contract.ts` and `reader-text.ts`. Database-backed exact
text reads, the explicit HTTP text route and typed client are implemented behind the organization allowlist.
Code/edition lists and provision traversal are implemented locally; detail/coverage operations and deployed acceptance remain phase gates.

The resource envelope keeps selection/continuation in `data` with strict metadata. C owns
[body, block, window and continuation invariants](../../../../packages/legislation-core/docs/regulations/reader-contract.md).
W attaches authorized selected context and rechecks current rights on every page; pure projection is not authorization.

Provision traversal defaults to direct `children`: omitted `parentId` returns roots; a parent returns only its immediate
children in that edition. `traversal=all` enumerates every node and rejects `parentId`. Validate parent membership.
Return selected edition/version, bounded ancestor references, `hasChildren`, heading/citation and node kind in summaries;
pin that edition in subsequent child links and cursors. Resolve latest once, not separately on each expansion.

`agencyId` means an existing canonical organization ID, discoverable through `/api/organizations?classification=agency`.
The legal agency directory exposes namespaced publisher aliases with resolved/unresolved status and nullable organization
ID. `sourceAgencyId` is the stable source-alias key, not a fabricated publisher or organization ID; require its `sourceId`.
Raw publisher IDs/names remain separately retained. Apply the same source-visibility policy to the directory and results.

Relationship values include source owner/version/context, relation type, evidence basis/locator, and a bounded typed
target summary. Unresolved targets carry literal citation text and nullable target ID/URL. Default `scope=all` explicitly
means aggregate history. A reader requests `scope=selected` with its context; fail if that evidence selection is unsupported.
Never silently show current links as evidence for a selected historical version.

## Strict wire-schema integration

Reuse the existing envelope metadata exactly for ordinary resources and pages. Capabilities use `legalCapabilitySchema`:
`available`, `not_ingested`, `incomplete`, `unsupported`, or `restricted`, with independent `isStale` and safe reason.
Only retained available/incomplete data can be stale. Absence of a state publication feed is `unsupported`, not an empty
complete publication corpus. Canonical publication, code and relationship DTOs must reference these strict types rather
than inventing parallel status vocabularies.

Regulatory search deliberately extends `SearchPage.meta` with `legal: { lexicalGeneration, embeddingGeneration,
effectiveMode, degraded, candidateSetTruncated }`; nullable embedding generation means no vector generation was used.
Update the shared normative schema, endpoint serializer and typed client parser together before registering this route.
Do not add arbitrary metadata to the current strict client or put machine-readable state into warning strings.
Historical selection errors use allowlisted structured details containing reason and available edition/date bounds;
the HTTP serializer and client error parser must preserve them together. Internal SQL, rights-policy bodies and source
credentials never appear in these errors. Complete DTO examples and strict parser parity remain API-01/API-08 gates.

## Search request and result

`src/api-client/legal-search-contract.ts` now defines strict request and response schemas. They are not yet
wired to a registered route, client method or MCP tool. Request queries trim whitespace and accept 1–500 characters;
ID lists contain 1–100 unique IDs of at most 256 characters. Empty lists, duplicate selectors, unknown fields,
reversed date ranges and incompatible corpus filters fail validation. Cursors are opaque strings capped at 8,192 characters.

Response hits share canonical fields, exact version/passage IDs, citation, jurisdiction, agency references, snippet,
match mode, source locator, version hash and coverage warnings. Provision hits add code and validated edition context;
publication hits add publication kind, publication date, nullable effective date and observation ID. Legal sources
extend SourceReference with publisher, supplier and nullable attribution. Metadata distinguishes requested `mode`
from `legal.effectiveMode`; the only fallback is an explicit change from semantic/hybrid to lexical. Embedding generation
and model reporting must agree with effective mode. Duplicate passage IDs and mismatched selected versions are rejected.
Authorization, supported coverage and cursor binding still belong to the service boundary. The shared
`validateLegalSearchResponse` additionally binds a parsed response to the normalized request: mode, limit, explicit
degradation permission, corpora, jurisdiction, source-agency IDs, code/edition selection and publication dates/kinds.
An `asOf` response requires the exact selected date with publisher point-in-time evidence. This validator is a
prerequisite for endpoint/client wiring; it does not establish those endpoints are shipped.

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
editionIds or codeIds requires a code-only corpus selection; publication-kind/date filters require publication-only selection.
Reject incompatible mixed queries rather than silently ignoring a filter. Clients can issue two explicit queries.
`agencyIds` contains source-agency directory IDs (`sourceAgencyId`), including unresolved agency references, rather
than requiring a resolved organization ID. Values within one filter are alternatives; different filters intersect.

Pages reject duplicate exact owner/version pairs even when different passages matched. `truncated` is true exactly
when a next cursor exists or `candidateSetTruncated` is true. A continuing page must contain the requested number of
hits; the final capped window can have no next cursor while still reporting truncation. Continuation cannot return
the cursor that was just submitted. These client checks supplement server authorization and frozen ranking.

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
history; source publisher currency versus Rostra collection; and lexical versus semantic readiness. Include last
successful collection, last attempt, latest validated edition, stage counts, pending age, documented gaps and available
date/edition selectors. Detailed internal failures stay operator-only; clients receive safe reason codes.

- 400 invalid_request: unknown filters, malformed citation/date/cursor, excessive limits, incompatible selection.
- 401 unauthorized / 403 forbidden: existing auth/entitlement rules; metadata must not reveal restricted content.
- 404 not_found: unavailable canonical identity, distinct from an empty collection in a partially covered scope.
- 409 conflict: unsupported historical selection or revision conflict, with actionable safe bounds/reason.
- 503 dependency_unavailable: required DB/search/model service unavailable. Explicit lexical degradation follows the
  search contract; unavailable sources during ingestion instead show stale coverage while retained content is served.

## MCP mapping

M owns the [complete tool-to-API mapping, registration gates and transport limits](../../../legislation-mcp/docs/engineering/legal-tools.md).
W owns the endpoint inventory above. C owns shared wire schemas; M calls W through its typed client, never the database.

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

## LLM design review: September 14, 2026

Three isolated judges reviewed the proposed endpoints as a backend architect, frontend consumer and third-party
integrator. All found the resource decomposition coherent; all rejected freezing this draft unchanged. A second round
challenged targeted fixes, followed by a fairness comparison against the same resource model under `/api/legal/`.
Both naming layouts were considered valid; preference for the existing layout was weak and based on consistency.
The subsequent product decision selects `/api/legal/` and `/api/search/legal`; the inventory and mappings above use
that approved naming. The retained judge report describes the earlier evaluated draft, not an alternative active contract.
These are model judgments, not runtime or real-user acceptance. The review protocol, score summaries, evidence references
and scenario dispositions are retained in [the review report](../../../legislation/artifacts/regulatory-api-review/review-2026-09-14.md).
This is ignored local historical evidence retained under `apps/legislation`, not a tracked file guaranteed in a fresh checkout.

The adopted contract preserves the original resource identities and now contains 25 planned operations: the original
22 plus bounded source text, reverse edition-membership discovery and a publisher-agency reference directory.
The latter exposes source aliases and creates no competing canonical agency identity. Implementation status remains
separate from these design decisions:

| Area | Required clarification or recommended change |
| --- | --- |
| Readable text | Source projection, selected database reads, HTTP/client and opt-in MCP text delivery implemented locally; discovery and deployed acceptance pending. |
| Exact selection | Combined membership validation and source-authorized exact text reads implemented; publisher-date lookup and broader selectors pending. |
| Browse | Root/direct-child/all-node request validation implemented; database traversal pending. |
| Discovery | Canonical/unresolved source-reference schema implemented; directory and source-alias filtering pending. |
| Wire schemas | Reader/capability/context schemas implemented; broader DTOs and shared strict-client integration remain API-01/API-08. |
| Enterprise sync | Required protocol and failure cases specified below; durable feed implementation remains a separate enterprise gate. |

The reader contract above fixes selector, anchor and source-block semantics. Public serialization must attach validated
canonical context and authorization; local source-record preview IDs are never exposed as canonical version IDs.

The existing WorkOS boundary, API-backed MCP, source rights, literal diffs, explicit historical-coverage rejection and
federal/state capability separation were judged strengths. Dedicated broad action search, a new agency identity system,
extra batch routes and wholesale path renaming were not justified by the reviewed scenarios. Durable third-party sync
may be deferred for a reader-only release, but remains a required gate before promising an enterprise replica connector.

## Enterprise synchronization gate

`GET /api/legal/events` serves activity history, not a guaranteed replica feed. `updatedSince` is a browse filter,
not an acknowledgement or checkpoint. Neither source observation timestamps nor a raw bigserial allocation establish
commit order: an earlier allocated event may commit after a later one. Notifications suppress some backfill/parser
events and cannot replace synchronization. The enterprise feed must independently implement:

1. A frozen, authorized subset baseline linked atomically to a durable committed-change checkpoint. Specify supported
   code/publication scope and the exact retained revisions; do not promise whole licensed-corpus export.
2. A committed-order log or equivalent contiguous acknowledgement protocol which cannot skip a later commit with an
   earlier observation/allocated ID. Stable event IDs, revision precedence and at-least-once deduplication are mandatory.
3. Separate next-page and terminal next-poll tokens, bound to caller, scope and schema. An empty page does not discard
   the last durable checkpoint. Old tokens replay within declared retention; expiration returns safe resnapshot guidance.
4. Upsert, metadata/relationship change, membership removal and rights-withdrawal dispositions. A purge notice for
   previously delivered content includes only a permitted safe identifier/instruction, never newly restricted text.
   Rights changes trigger reconciliation even if the underlying body hash is unchanged.
5. Exact revision hydration while it is permitted and retained. If the referenced revision is no longer deliverable,
   return a classified restriction/expiry outcome and resync instructions; do not substitute the newest text silently.
6. Tests for baseline races, delayed commit, duplicate replay, empty polls, partial page failure, scope/rights changes,
   token expiration and revision unavailability. Snapshot/delta continuity must be demonstrated with real committed data.

The endpoint and retention SLA for this additional capability are not advertised until its durable store and scoped
delivery contract pass API-14. This gate does not block frozen regulatory ingestion or the authenticated reader canary.
