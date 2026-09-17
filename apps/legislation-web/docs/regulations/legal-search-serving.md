# Regulatory lexical search serving

`POST /api/search/legal`, `LegislationApiClient.searchLegal` and the opt-in `search_regulations` MCP tool are implemented locally through the existing WorkOS
API authentication boundary. The request/response contract is in `src/api-client/legal-search-contract.ts`; the client
checks both wire shape and agreement with requested filters, mode, limits and fallback permission.

## Available scope

The current implementation accepts one corpus per request: `regulation` or `regulatory_publication`. Regulation search
supports explicit published federal edition IDs or current eCFR heads selected by code IDs. With neither selector it
requests every published current eCFR head; every selected edition must have a verified search copy. It never narrows
that request to just indexed titles. Selection is capped at 100 editions. All selected code IDs and edition IDs must be
represented; incompatible intersection or missing published identities return 404. Jurisdiction can be omitted or
`jurisdiction:us`.

Federal Register publication search supports publication-kind and inclusive publication-date filters. It filters the
isolated projection before ranking and serves only when the complete canonical filter partition has matching projected
identities, receipts, memberships and source/target revision fences. It has no document-count cap. Exact verification
currently traverses receipts in bounded 100-scope pages on each request; representative-volume measurements and a
durable precomputed revision manifest remain required before national promotion. Publication ranking uses the same
15-minute frozen-candidate pagination contract as edition search. Federal Register publication requests may also filter
by `sourceAgencyId`.

Lexical limit is 1–100, default 20. Pagination persists the frozen ranked window described in
[cross-edition retrieval](edition-search-canary.md). Repost the same JSON filters with `meta.nextCursor` as `cursor`.
The next link is the same POST endpoint, not a GET query. Cursors also bind normalized public filters and requested
mode/fallback permission. Default-current head changes invalidate the underlying selection; they do not silently
resume a different generation. Publication cursors additionally bind the complete kind/date partition generation;
changed filters or any canonical/target revision fail instead of resuming another result set. No national readiness is
implied by the retained pilots.

Regulation agency filters, statute corpora and state jurisdictions return 503 with a safe capability reason. The default
mixed regulation/publication request therefore currently returns 503. Date-based `asOf` returns 409
`historical_coverage_unavailable`. Semantic/hybrid returns 503 unless `allowDegraded: true`, in which case lexical
results explicitly report the requested mode, effective lexical mode, degradation and an explanatory warning.
No embeddings or reranker calls occur in this implementation.

## Provenance and boundaries

Hits include canonical provision/version/passage IDs, source URL, artifact acquisition timestamp, publisher,
rights attribution, canonical version hash, locator, parent, edition observation and publisher currency. The result
update timestamp is the selected edition's publication into Rostra; unavailable source modification time remains null.
eCFR selections are labeled observed snapshots, not proof of arbitrary historical legal status. Annual editions use
published-edition context. Section native IDs produce CFR citations; other structural IDs remain explicit native
identifiers with a warning. Publication agency arrays retain official Federal Register source IDs and names as
unresolved references. Records without a publisher ID use a deterministic document-occurrence identity and are never
merged by name. PDF-only records without agency metadata retain an empty array and explicit warning. No source reference
is presented as a resolved canonical organization. Regulation results retain empty agency arrays until code-agency
mapping ships.

Snippets are at most 500 characters. The canonical URL points to the existing exact-version text endpoint with its
edition selector. Publisher/supplier are the stored official publisher for this direct federal acquisition path;
future licensed sources require a separate attribution/supplier policy. Source rights and target copy integrity are
checked before ranking, and returned passages are compared with canonical storage. Responses use `private, no-store`.

Search now requires a separate acknowledgement revision snapshot for every generation in each selected scope.
Canonical and target mutations invalidate that snapshot before ranking, including mutations that remove all query
matches. Reverified pages alone do not renew it; explicit acknowledgement is required. Snapshot manifests also bind
frozen cursors. See [copy-validation boundaries](../../../legislation-ingestion/docs/regulations/copy-validation-checkpoints.md). Both retained two-title pilots have
been upgraded and re-acknowledged for this contract without replacing source text or embeddings.
The serving transaction additionally compares live source inventory counts, ordinal/version identities and preparation
context. Added source members or changed code names/publication document numbers fail even when no existing generation
counter changes. This prevents expected-generation joins from silently hiding newly added unprepared source records.

## Validation and remaining gates

The local HTTP canary uses the authenticated Web Request/Node handler bridge and typed client, signed test credentials,
source database 55438 and disposable target 55455. It verifies two exact hits across Titles 3/23, source provenance and
canonical version hashes, pagination, current code selection, explicit fallback, unprepared/default scope refusal,
cursor mode binding, and missing/wrong-audience/wrong-organization credentials. Evidence is stored in
`artifacts/regulatory-backfills/legal-search-http-canary.ts/.json`. The renewed run at `2026-09-16T06:42:29Z` also
verified stale-revision refusal for a no-match query, refusal after page revalidation alone, restored serving after
acknowledgement and rejection of the old cursor. It writes query caches, a target metadata no-op, validation/receipt
records and canonical lexical acknowledgement; no source content or embeddings change.

The corresponding September 16 MCP parity evidence and transport limits are retained in
[M's legal tool record](../../../legislation-mcp/docs/engineering/legal-tools.md#retained-search-pilot-evidence).

The retained Federal Register canary now exercises projection-first retrieval across all 110 January 18, 2000
publications: 12 final rules, 92 notices and six proposed rules. Canonical and target inventories match at 873 passages,
and all projection hashes validate. The unfiltered request verifies two receipt/revision pages and returns all three
publication kinds. Kind-filtered requests return all 92 matching notices and all six proposed rules. A disposable clone
rejected a missing filter-partition member, a corrupted projection hash and a changed non-result canonical version.
The typed authenticated HTTP boundary returned the complete 92-notice result set in four stable pages with no duplicate
versions and rejected changed filters on continuation.

The retained agency canary filtered the complete partition by `fr-agency-406` and returned only 65 FR 2521 with the
unresolved Personnel Management Office source reference. All 110 projection identities bind the exact agency
evidence hash. Of those scopes, 107 have agency references and three explicitly have no source agency metadata.
The companion source-agency directory canary returned 56 rights-visible identities: 50 publisher IDs and six
document-occurrence identities. Its `personnel` query returned only `fr-agency-406`; all directory identities remain
unresolved until reviewed organization mapping exists.

This is not deployed Next-router or real WorkOS credential evidence. Canonical organization resolution, publication
browse/detail/version operations, full-corpus performance, semantic/vector search, remaining reconciliation and
deployment acceptance are open.

## Target query semantics

This section is the broader planned contract, not the currently available lexical scope above. W owns query/model
execution; M calls W over HTTPS. Defaults are regulatory code plus publications, latest validated editions and explicit
publication kinds/dates. Statutes require `corpora: ["statute"]` when enabled. Historical requests select exact editions
or supported `asOf`, never implicitly mixing current and historical text.

Apply jurisdiction, agency, code, kind, dates, edition and rights filters before ranking. Selective ANN must demonstrate
recall; bounded exact vector search may suit small filtered subsets. An unfiltered top-k is not a restricted top-k.
Lexical limit is 1–100/default 20; semantic/hybrid 1–25/default 10. Initial candidate pools are 100 lexical and 100 vector,
deduplicated by owner-version and RRF-fused for hybrid; benchmark and record chosen sizes. Reranking stays disabled until
its regulatory canary improves quality within budget. Never add raw BM25 and cosine scores; return rank/mode and document
any diagnostic scores. Group a provision's passages into one best hit with bounded sibling pointers.

Lexical paging uses deterministic score/ID ordering bound to generation. Semantic/hybrid freezes a bounded ranking in
a short-lived server-side snapshot bound to principal, filters, generation and ranking contract. Pages do not re-embed
or rerank; expired cursors return 400 with safe restart guidance. Null cursor ends that candidate window, not all relevant
law; report candidate-set truncation. Dependency failures return 503 unless explicit `allowDegraded: true` permits
lexical fallback, with effective mode/degradation reported. Coverage gaps/staleness are distinct from dependency failure.

## Evaluation and promotion gates

One checklist governs promotion; [I's frozen protocol](../../../legislation-ingestion/docs/regulations/embedding-evaluation-protocol.md)
owns corpus/judgment preparation and generation evidence. Freeze at least 60 judgments: 15 exact citations, 20 topical
code queries, 10 proposal/final cases, 10 history/correction cases and five cross-title/agency/appendix cases. Include
excluded-date/corpus negatives, text-free nodes and future synthetic state fixtures. A product/domain reviewer approves
answers/evidence; an LLM cannot self-certify its own judgments.

Launch targets, not existing production measurements:

- Exact citation: 100 percent correct identity/version, no silently selected ambiguous match.
- Human-judged Recall@25 >= 0.90 and nDCG@10 >= 0.80, with subgroup reporting and no material lexical-baseline regression
	on temporal, proposal/final or jurisdiction filters.
- Every hit has correct canonical/source/version references; zero forbidden, wrong-jurisdiction or wrong-version hits.
- With 20 concurrent readers and approved ingestion, warmed p95 detail <= 500 ms, lexical <= 1 second, semantic <= 2.5
	seconds and hybrid <= 3 seconds. Record cold cache separately; error rate < 1 percent excluding deliberate invalid/auth/chaos.
- I proves no unexplained missing/extra current passages, matching sampled hashes and no failed/delayed retry work
	through the promotion boundary. Every eligible semantic input matches model/dimension/contracts; exclusions are explicit.

Exercise missing models, failed copies, stale generations, restrictions, corrections, cancellation and replay. Compare
API and MCP fixtures. Promote lexical and semantic separately; a valid index, green task or small canary is insufficient.

## Internal reader boundary

`createLegalSearchCanary` requires verified context and server-configured organization allowlist before DB access.
Its internal preparation selector rejects caller identity/access fields. Lock scope metadata, check display/local-search
rights and then API/MCP permission, official federal identity and worldwide rights before opening the target. Limited
territory policies need trusted context. Internal local-search permission alone is not external API entitlement.

Load body/blocks only after policy metadata passes. `searchCurrentLegalProvision` selects the canonical head's acknowledged
preparation and rechecks head, job, receipt, membership and rights. A newer unindexed head fails rather than returning
an old edition as current; annual history never acquires a current eCFR head through acknowledgement.

The internal `searchCopiedLegalPassages` reader is version-scoped, bounded to 500 query characters/50 results and a target
snapshot, with source membership/rights locks spanning the read. Validate generation metadata/count and each hit against
canonical content/input hashes. Unreturned rows are not audited by search; whole-copy inspection belongs to I. Both FTS
paths match complete input text, including citation/heading/table context. None of these internal helpers independently
establishes public entitlement, BM25 or global readiness. Retained producer and source-pilot evidence remains in
[I storage validation](../../../legislation-ingestion/docs/regulations/storage-validation.md).
