# Search, research answers, and document comparison

Search uses POST because structured filters and model controls are request bodies. These operations are read-only and
do not use idempotency keys. They return the [shared `SearchPage`](schemas.md).

## Exact search types

```ts
type BaseSearchRequest = {
  query: string
  mode?: "lexical" | "semantic" | "hybrid"
  cursor?: string | null
  limit?: number
  explain?: boolean
  jurisdictionIds?: string[]
  sessionIds?: string[]
  from?: string | null
  to?: string | null
}
type BillSearchRequest = BaseSearchRequest & { classifications?: string[]; statuses?: string[]; subjects?: string[]; sponsorIds?: string[]; introducedFrom?: string; introducedTo?: string }
type AmendmentSearchRequest = BaseSearchRequest & { billIds?: string[]; sponsorPersonIds?: string[]; recordTypes?: ("structured" | "document")[]; statuses?: string[]; submittedFrom?: string; submittedTo?: string }
type PassageSearchRequest = BaseSearchRequest & { billIds?: string[]; documentIds?: string[]; documentClassifications?: string[]; versionCodes?: string[]; headings?: string[]; pageFrom?: number; pageTo?: number }
type MaterialSearchRequest = BaseSearchRequest & { billIds?: string[]; amendmentIds?: string[]; meetingIds?: string[]; organizationIds?: string[]; classifications?: string[]; documentFrom?: string; documentTo?: string }
type MatchExplanation = {
  mode: SearchMode
  matchedFields: string[]
  snippet: string | null
  lexicalScore: number | null
  semanticScore: number | null
  rerankScore: number | null
  explanation: string | null
}
type SearchHit<R, T extends string> = {
  recordType: T; recordId: string; score: number; rank: number
  match: MatchExplanation; record: R; sources: SourceReference[]
}
type BillSearchHit = SearchHit<BillSummary, "bill">
type AmendmentSearchHit = SearchHit<AmendmentSummary, "amendment">
type PassageRecord = DocumentSection & { document: DocumentSummary; bill: BillSummary | null; highlightRanges: HighlightRange[] }
type PassageSearchHit = SearchHit<PassageRecord, "passage">
type MaterialRecord = { material: SupportingMaterialSummary; section: SupportingMaterialSection; relatedRecordIds: string[] }
type MaterialSearchHit = SearchHit<MaterialRecord, "supporting-material">
type PersonSearchHit = SearchHit<PersonSummary, "person">
type OrganizationSearchHit = SearchHit<OrganizationSummary, "organization">
type MeetingSearchHit = SearchHit<MeetingSummary, "meeting">
type UniversalSearchHit = BillSearchHit | AmendmentSearchHit | PassageSearchHit | MaterialSearchHit | PersonSearchHit | OrganizationSearchHit | MeetingSearchHit
type HighlightRange = { start: number; end: number; kind: "exact" | "stem" | "semantic" }
```

`query` is 1 to 500 trimmed characters; default mode is `lexical`; `limit` is 1 to 100 in lexical mode and 1 to 25 in
semantic or hybrid mode, default 20. The applied limit is never silently reduced; a larger semantic request returns
`400 invalid_request`. ID and enum arrays contain at most 25 unique values. `explain` defaults false. Semantic ranges identify supporting spans and are not
token-level explanations. Scores are comparable only inside one response.

No semantic request silently falls back to lexical. Missing model dependencies return `503 dependency_unavailable`.

## Model and ranking contract

| Product | Lexical candidate source | Embedding route | Dimensions | Merge | Reranker |
| --- | --- | --- | ---: | --- | --- |
| bills | bill title, abstract, subjects | `voyageai/voyage-4` | 1,024 | weighted reciprocal-rank fusion (RRF) | `cohere/rerank-v3.5` |
| amendments | structured metadata and amendment-document text | `openai/text-embedding-3-small` | 1,536 | independent structured/document candidates merged by RRF | none |
| document passages | section text and headings | `openai/text-embedding-3-small` | 1,536 | weighted RRF | `cohere/rerank-v3.5` |
| supporting materials | section text and metadata | `voyageai/voyage-4` | 1,024 | weighted RRF | none |

The response `meta.models` records only models actually used. Lexical mode has an empty model list and never reports
reranking. RRF uses `1 / (60 + rank)`; default lexical and semantic weights are both 1.0. Semantic and hybrid products
retrieve and, where applicable, rerank at most 25 candidates, matching the approved rollout contract.

For lexical bill search, each lexical match source considers at most 1,000 candidates. This is a bounded result window:
when that bound prevents a continuation, the response sets `meta.truncated` to `true` and returns no continuation
(`meta.nextCursor` and `links.next` are `null`). Clients must refine the query or filters before continuing. A lexical
bill cursor binds the normalized query and filters; changing either returns `400 invalid_request`.

## `POST /api/search/bills` (`searchBills`)

Body is `BaseSearchRequest & { classifications?: string[]; statuses?: string[]; subjects?: string[];
sponsorIds?: string[]; introducedFrom?: date; introducedTo?: date }`. Response is
`200 SearchPage<BillSearchHit>`. Searchable fields are identifier, title, abstract, subjects, sponsor names, and processed
version text. Standard errors are `400`, `401`, `403`, `413`, `422`, `500`, and `503`.
BaseSearch `from` and `to` filter the canonical bill `updatedAt` interval inclusively; a date-only upper bound includes
the complete UTC date. `introducedFrom` and `introducedTo` continue to filter the publisher's introduction date.

## `POST /api/search/amendments` (`searchAmendments`)

Body is `BaseSearchRequest & { billIds?: string[]; sponsorPersonIds?: string[]; recordTypes?:
("structured" | "document")[]; statuses?: string[]; submittedFrom?: date; submittedTo?: date }`. Response is
`200 SearchPage<AmendmentSearchHit>`. Structured and document candidates are retrieved independently; `recordType` and
`documentId` preserve their identities.

## `POST /api/search/passages` (`searchBillPassages`)

Body is `BaseSearchRequest & { billIds?: string[]; documentIds?: string[]; documentClassifications?: string[];
versionCodes?: string[]; headings?: string[]; pageFrom?: integer; pageTo?: integer }`. Page numbers are positive and
`pageFrom <= pageTo`. Response is `200 SearchPage<PassageSearchHit>`. This ranked endpoint is distinct from ordered
`GET /api/documents/{documentId}/sections` and `GET /api/bills/{billId}/sections` traversal.

## `POST /api/search/supporting-materials` (`searchSupportingMaterials`)

Body is `BaseSearchRequest & { billIds?: string[]; amendmentIds?: string[]; meetingIds?: string[];
organizationIds?: string[]; classifications?: string[]; documentFrom?: date; documentTo?: date }`. Response is
`200 SearchPage<MaterialSearchHit>`. Search hits contain one bounded section, never the complete material text.
For supporting materials, BaseSearch `from` and `to` filter the canonical material `updatedAt` interval inclusively;
date-only upper bounds include the complete UTC date. `documentFrom` and `documentTo` continue to filter the publisher
document date. `sessionIds` filters through the material's linked bills without duplicating a material hit.

## `POST /api/search/all` (`searchAll`)

```ts
type UniversalSearchRequest = BaseSearchRequest & {
  recordTypes?: ("bill" | "amendment" | "passage" | "supporting-material" | "person" | "organization" | "meeting")[]
  filters?: {
    bill?: Omit<BillSearchRequest, keyof BaseSearchRequest>
    amendment?: Omit<AmendmentSearchRequest, keyof BaseSearchRequest>
    passage?: Omit<PassageSearchRequest, keyof BaseSearchRequest>
    supportingMaterial?: Omit<MaterialSearchRequest, keyof BaseSearchRequest>
    person?: { jurisdictionIds?: string[]; organizationIds?: string[]; parties?: string[]; isActive?: boolean }
    organization?: { jurisdictionIds?: string[]; classifications?: string[]; parentOrganizationIds?: string[]; isActive?: boolean }
    meeting?: { jurisdictionIds?: string[]; organizationIds?: string[]; classifications?: string[]; statuses?: string[]; from?: string; to?: string }
  }
  perTypeLimit?: number
}
```

`perTypeLimit` is 1 to 25, default 10. Response is `200 UniversalSearchResponse`:

```ts
type UniversalSearchResponse = SearchPage<UniversalSearchHit> & {
  meta: SearchPage<UniversalSearchHit>["meta"] & {
    groups: { recordType: UniversalSearchHit["recordType"]; returned: number; nextCursor: string | null }[]
  }
}
```

People, organizations, and meetings currently have lexical indexes
only. A `semantic` request selecting any of those types returns `422 unprocessable`. A `hybrid` request applies hybrid
ranking to embedded types, lexical ranking to those three types, and merges normalized per-type ranks by RRF. It never
pretends a lexical-only hit has a semantic score. The universal cursor continues only this merged request.

`sessionIds` is supported for meeting groups and for products with a documented session relationship. People and
organizations have no canonical session relationship in the current read model; selecting either type with
`sessionIds` returns `422 unprocessable` rather than silently broadening the result set.
Shared and product-specific `jurisdictionIds` are intersected; a disjoint intersection returns an empty product group.

## `POST /api/document-diffs` (`compareDocumentVersions`)

```ts
type DocumentDiffRequest = {
  billId: string; leftDocumentId: string; rightDocumentId: string
  granularity?: "section" | "paragraph" | "word"
  includeUnchanged?: boolean; cursor?: string | null; limit?: number
}
type DiffOperation = {
  classification: "insert" | "delete" | "equal"; text: string
  leftStart: number | null; leftEnd: number | null; rightStart: number | null; rightEnd: number | null
}
type DiffHunk = {
  ordinal: number; classification: "added" | "removed" | "changed" | "unchanged"
  leftSectionId: string | null; rightSectionId: string | null
  leftText: string | null; rightText: string | null; operations: DiffOperation[]; sources: SourceReference[]
}
type DocumentDiff = {
  id: string; billId: string; leftDocument: DocumentSummary; rightDocument: DocumentSummary
  granularity: "section" | "paragraph" | "word"; hunks: DiffHunk[]
  counts: { added: number; removed: number; changed: number; unchanged: number }
  nextCursor: string | null; truncated: boolean
}
```

All fields except optional controls are required. `granularity` defaults `section`, `includeUnchanged` false, `limit`
100 (1 to 100). IDs must differ and both documents must belong to the bill. Character offsets are zero-based half-open
ranges and `start <= end`. Response is `200 ResourceResponse<DocumentDiff>`. Ownership mismatch or unprocessed text is
`409 conflict`; bad bounds are `400`; an oversized hunk is `413`.

## `POST /api/research/answers` (`answerLegislativeResearchQuestion`)

```ts
type ResearchScope = {
  jurisdictionIds?: string[]; sessionIds?: string[]; billIds?: string[]; personIds?: string[]
  organizationIds?: string[]; meetingIds?: string[]; from?: string; to?: string
}
type ResearchRetrieval = {
  recordTypes: ("bill" | "amendment" | "passage" | "supporting-material")[]
  mode: SearchMode; maxEvidence: number; candidateCount: number; evidenceCount: number
  rrfK: 60; models: ModelUsage[]; rerankedProducts: ("bill" | "passage")[]
}
type ResearchAnswerRequest = {
  question: string; scope: ResearchScope
  retrieval: { recordTypes: ResearchRetrieval["recordTypes"]; mode: SearchMode; maxEvidence?: number }
  answerFormat?: "concise" | "detailed" | "timeline"
}
type ResearchCitation = {
  id: string; recordType: string; recordId: string; documentId: string | null; billId: string | null
  sectionId: string | null; title: string; snippet: string; sourceUrl: string
  sourceUpdatedAt: string | null; sources: SourceReference[]
}
type ResearchClaim = { text: string; citationIds: string[]; confidence: "supported" | "mixed" | "insufficient" }
type ResearchAnswer = {
  id: string; question: string; answer: string; claims: ResearchClaim[]; citations: ResearchCitation[]
  retrieval: ResearchRetrieval; generatedAt: string; warnings: string[]
}
```

`question` is 1 to 2,000 characters. Scope must contain at least one explicit constraint unless the caller has global
research permission; each array has at most 25 IDs and `from <= to`. `maxEvidence` is 1 to 50, default 20; format
defaults `concise`. The response is always `200 ResourceResponse<ResearchAnswer>` when the calculation completes,
including an explicit insufficient-evidence answer. Every nontrivial claim cites evidence. Policy rejection returns
`422 unprocessable`; unavailable required models return `503`. The answer ID is for feedback and trace correlation, not
evidence that a new canonical resource was created.
