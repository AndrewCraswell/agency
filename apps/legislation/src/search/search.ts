import { createHash } from "node:crypto"
import { and, arrayOverlaps, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { getTableColumns, type SQL } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import { billActionTimestamp } from "../db/queries/bill-action-timestamp.js"
import {
  amendmentEmbeddings,
  amendments,
  billActions,
  billDocuments,
  billEmbeddings,
  billSponsors,
  bills,
  documentSectionEmbeddings,
  documentSections,
  supportingMaterialLinks,
  supportingMaterialSectionEmbeddings,
  supportingMaterialSections,
  supportingMaterials
} from "../db/schema/schema.js"
import { embeddingRouteFor } from "../models/embedding-routing.js"

const DEFAULT_LIMIT = 20
const LEXICAL_BILL_CANDIDATE_LIMIT = 1_000
// PostgreSQL cannot use the section GIN index to satisfy a relevance ordering.
// Rank a deterministic section sample and report when its lookahead proves incomplete coverage.
const LEXICAL_BILL_VERSION_CANDIDATE_LIMIT = 1_000
const MAXIMUM_LIMIT = 100
const MAXIMUM_QUERY_LENGTH = 500
const {
  embedding: _billEmbedding,
  embeddingInputHash: _billEmbeddingInputHash,
  embeddingModel: _billEmbeddingModel,
  embeddedAt: _billEmbeddedAt,
  searchVector: _billSearchVector,
  ...billSearchSummaryColumns
} = getTableColumns(bills)
const { text: _supportingMaterialText, ...supportingMaterialSummaryColumns } = getTableColumns(supportingMaterials)

export interface SearchFilters {
  classifications?: string[]
  introducedFrom?: string
  introducedTo?: string
  jurisdictionIds?: string[]
  sessionIds?: string[]
  sponsorIds?: string[]
  statuses?: string[]
  subjects?: string[]
  /** Inclusive canonical BillSummary.updatedAt lower bound. */
  updatedFrom?: Date
  /** Inclusive canonical BillSummary.updatedAt timestamp upper bound. */
  updatedTo?: Date
  /** Exclusive upper bound used when a date-only updatedTo includes a full UTC day. */
  updatedToExclusive?: Date
}

export interface SearchInput extends SearchFilters {
  cursor?: string
  limit?: number
  mode?: "hybrid" | "lexical" | "semantic"
  query: string
}

export interface SearchPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

export interface SearchModelUsage {
  model: string
  purpose: "embedding" | "reranking"
}

export interface BillSearchResultPage extends SearchPage<BillSearchCandidate> {
  search: {
    isReranked: boolean
    models: SearchModelUsage[]
  }
}

/**
 * The persisted facts needed to turn a search candidate into the public
 * canonical bill summary. Search never infers a source, status, or action
 * timestamp that is absent from the database.
 */
export interface BillSearchCandidate {
  classification: string[]
  createdAt: Date
  distance?: number
  id: string
  identifier: string
  introducedAt: string | null
  jurisdictionId: string
  latestActionAt: Date | null
  lexicalScore: number | null
  matchedFields: BillSearchMatchedField[]
  rerankScore: number | null
  rank?: number
  score: number
  semanticScore: number | null
  sessionId: string
  snippet: string | null
  sourceUpdatedAt: Date | null
  sourceUrl: string
  status: string | null
  subjects: string[]
  summary: string | null
  title: string
  updatedAt: Date
  upstreamIds: Record<string, string>
}

export type BillSearchMatchedField =
  | "abstract"
  | "identifier"
  | "semantic"
  | "sponsorNames"
  | "subjects"
  | "title"
  | "versionText"

export function validateSearchInput(
  input: SearchInput,
  bindCursor = false
): { limit: number; offset: number; query: string } {
  const query = input.query.trim()
  if (query.length === 0 || query.length > MAXIMUM_QUERY_LENGTH) {
    throw new Error(`Search query must contain between 1 and ${MAXIMUM_QUERY_LENGTH} characters`)
  }
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  return { limit, offset: decodeSearchCursor(input.cursor, bindCursor ? input : undefined), query }
}

export function decodeSearchCursor(cursor: string | undefined, input?: SearchInput): number {
  if (cursor === undefined) {
    return 0
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof value !== "object" ||
      value === null ||
      !("offset" in value) ||
      typeof value.offset !== "number" ||
      !Number.isSafeInteger(value.offset) ||
      value.offset < 0
    ) {
      throw new Error("invalid shape")
    }
    if (input === undefined && "version" in value) {
      throw new Error("bound cursor used outside lexical bill search")
    }
    if (
      input !== undefined &&
      (!("binding" in value) ||
        value.binding !== searchCursorBinding(input) ||
        !("version" in value) ||
        value.version !== 1 ||
        value.offset >= LEXICAL_BILL_CANDIDATE_LIMIT)
    ) {
      throw new Error("search request does not match cursor")
    }
    return value.offset
  } catch {
    throw new Error("Invalid search cursor")
  }
}

export function encodeSearchCursor(offset: number, input?: SearchInput): string {
  return Buffer.from(
    JSON.stringify(input === undefined ? { offset } : { binding: searchCursorBinding(input), offset, version: 1 })
  ).toString("base64url")
}

function searchCursorBinding(input: SearchInput): string {
  const value = {
    classifications: sortedValues(input.classifications),
    introducedFrom: input.introducedFrom,
    introducedTo: input.introducedTo,
    jurisdictionIds: sortedValues(input.jurisdictionIds),
    mode: input.mode ?? "lexical",
    query: input.query.trim(),
    sessionIds: sortedValues(input.sessionIds),
    sponsorIds: sortedValues(input.sponsorIds),
    statuses: sortedValues(input.statuses),
    subjects: sortedValues(input.subjects),
    updatedFrom: input.updatedFrom?.toISOString(),
    updatedTo: input.updatedTo?.toISOString(),
    updatedToExclusive: input.updatedToExclusive?.toISOString()
  }
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url")
}

function sortedValues(values: readonly string[] | undefined): readonly string[] | undefined {
  return values === undefined ? undefined : [...new Set(values)].sort()
}

function billFilters(filters: SearchFilters): SQL[] {
  return [
    filters.jurisdictionIds === undefined ? undefined : inArray(bills.jurisdictionId, filters.jurisdictionIds),
    filters.sessionIds === undefined ? undefined : inArray(bills.sessionId, filters.sessionIds),
    filters.statuses === undefined ? undefined : inArray(bills.status, filters.statuses),
    filters.subjects === undefined ? undefined : arrayOverlaps(bills.subjects, filters.subjects),
    filters.classifications === undefined ? undefined : arrayOverlaps(bills.classification, filters.classifications),
    filters.introducedFrom === undefined ? undefined : gte(bills.introducedAt, filters.introducedFrom),
    filters.introducedTo === undefined ? undefined : lte(bills.introducedAt, filters.introducedTo),
    filters.updatedFrom === undefined ? undefined : gte(bills.updatedAt, filters.updatedFrom),
    filters.updatedTo === undefined ? undefined : lte(bills.updatedAt, filters.updatedTo),
    filters.updatedToExclusive === undefined ? undefined : sql`${bills.updatedAt} < ${filters.updatedToExclusive}`,
    filters.sponsorIds === undefined
      ? undefined
      : sql`exists (select 1 from ${billSponsors} where ${billSponsors.billId} = ${bills.id} and ${inArray(billSponsors.personId, filters.sponsorIds)})`
  ].filter((condition): condition is SQL => condition !== undefined)
}

export function paginateSearchRows<T>(rows: T[], limit: number, offset: number, hasMore = false): SearchPage<T> {
  const available = rows.slice(offset)
  const truncated = available.length > limit || hasMore
  return {
    items: available.slice(0, limit),
    nextCursor: truncated ? encodeSearchCursor(offset + limit) : undefined,
    truncated
  }
}

/**
 * A model/provider candidate window may be incomplete, but its cursor must
 * never advance beyond items that were actually retrieved. `truncated`
 * retains the coverage signal while `nextCursor` only exists for a real next
 * item in the bounded window.
 */
export function paginateCappedSearchRows<T>(rows: T[], limit: number, offset: number, capped = false): SearchPage<T> {
  const available = rows.slice(offset)
  const hasNextInWindow = available.length > limit
  return {
    items: available.slice(0, limit),
    nextCursor: hasNextInWindow ? encodeSearchCursor(offset + limit) : undefined,
    truncated: hasNextInWindow || capped
  }
}

/**
 * Database search queries apply their cursor offset in SQL. The returned
 * window must therefore use that offset only to advance the opaque cursor,
 * never to slice the window a second time.
 */
export function paginateSearchDatabaseRows<T>(
  rows: T[],
  limit: number,
  offset: number,
  input?: SearchInput,
  capped = false,
  maximumOffset?: number
): SearchPage<T> {
  const truncated = rows.length > limit || capped
  return {
    items: rows.slice(0, limit),
    nextCursor:
      rows.length > limit && (maximumOffset === undefined || offset + limit < maximumOffset)
        ? encodeSearchCursor(offset + limit, input)
        : undefined,
    truncated
  }
}

export async function lexicalBillSearch(
  database: LegislationDatabase,
  input: SearchInput
): Promise<SearchPage<BillSearchCandidate>> {
  const { limit, offset, query } = validateSearchInput(input, true)
  const result = await database.execute<LexicalBillSearchRow>(buildLexicalBillSearchQuery(input, query, limit, offset))
  const versionCoverageCapped = hasCappedLexicalBillVersionCoverage(result.rows)
  const candidateRows = result.rows.filter(isLexicalBillSearchCandidateRow)
  const page = paginateSearchDatabaseRows(
    candidateRows,
    limit,
    offset,
    input,
    offset + limit + 1 > LEXICAL_BILL_CANDIDATE_LIMIT || versionCoverageCapped,
    LEXICAL_BILL_CANDIDATE_LIMIT
  )
  if (page.items.length === 0) {
    return { ...page, items: [] }
  }

  const candidates = await hydrateLexicalBillCandidates(database, page.items, query)
  return { ...page, items: candidates }
}

export function buildLexicalBillSearchQuery(input: SearchInput, query: string, limit: number, offset: number): SQL {
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const candidateLimit = Math.min(Math.max(limit + offset + 1, 25), LEXICAL_BILL_CANDIDATE_LIMIT)
  const billTextMatches = sql<boolean>`${bills.searchVector} @@ ${searchQuery}`
  const identifierMatches = isBillIdentifierQuery(query)
    ? sql<boolean>`lower(${bills.identifier}) = lower(${query})`
    : sql<boolean>`false`
  const titleMatches = sql<boolean>`to_tsvector('english', ${bills.title}) @@ ${searchQuery}`
  const abstractMatches = sql<boolean>`to_tsvector('english', coalesce(${bills.summary}, '')) @@ ${searchQuery}`
  const subjectMatches = sql<boolean>`to_tsvector('english', array_to_string(${bills.subjects}, ' ')) @@ ${searchQuery}`
  const sponsorSearchVector = sql`to_tsvector('english', ${billSponsors.name})`
  const versionRank = sql<number>`max(ts_rank_cd(version_section_matches.search_vector, ${searchQuery}))`
  const sponsorRank = sql<number>`max(ts_rank_cd(${sponsorSearchVector}, ${searchQuery}))`
  const rank = sql<number>`
    ts_rank_cd(${bills.searchVector}, ${searchQuery})
    + case when ${identifierMatches} then 1 else 0 end
    + coalesce(sponsor_matches.sponsor_rank, 0)
    + coalesce(version_matches.version_rank, 0)
  `
  return sql`
    with bill_text_matches as materialized (
      select ${bills.id} as id
      from ${bills}
      where ${billTextMatches} and ${and(...billFilters(input)) ?? sql`true`}
      order by ts_rank_cd(${bills.searchVector}, ${searchQuery}) desc, ${bills.id} asc
      limit ${candidateLimit}
    ),
    identifier_matches as materialized (
      select ${bills.id} as id
      from ${bills}
      where ${identifierMatches} and ${and(...billFilters(input)) ?? sql`true`}
      order by ${bills.id} asc
      limit ${candidateLimit}
    ),
    primary_sources as (
      select id from bill_text_matches
      union all
      select id from identifier_matches
    ),
    primary_matches as materialized (
      select id
      from primary_sources
      group by id
      limit ${candidateLimit}
    ),
    primary_count as (
      select count(*)::integer as count
      from primary_matches
    ),
    sponsor_matches as materialized (
      select sponsor_fallback.*
      from primary_count
      cross join lateral (
        select ${billSponsors.billId} as bill_id, ${sponsorRank} as sponsor_rank
        from ${billSponsors}
        inner join ${bills} on ${bills.id} = ${billSponsors.billId}
        where
          ${sponsorSearchVector} @@ ${searchQuery}
          and ${and(...billFilters(input)) ?? sql`true`}
        group by ${billSponsors.billId}
        order by ${sponsorRank} desc, ${billSponsors.billId} asc
        limit greatest(${candidateLimit} - primary_count.count, 0)
      ) sponsor_fallback
    ),
    version_section_lookahead as materialized (
      select
        ${documentSections.id} as section_id,
        ${billDocuments.billId} as bill_id
      from primary_count
      cross join ${documentSections}
      inner join ${billDocuments} on ${documentSections.documentId} = ${billDocuments.id}
      inner join ${bills} on ${bills.id} = ${billDocuments.billId}
      where
        primary_count.count < ${candidateLimit}
        and ${billDocuments.classification} = 'version'
        and ${billDocuments.processingStatus} = 'processed'
        and ${documentSections.searchVector} @@ ${searchQuery}
        and ${and(...billFilters(input)) ?? sql`true`}
      order by ${documentSections.id} asc
      limit ${LEXICAL_BILL_VERSION_CANDIDATE_LIMIT + 1}
    ),
    version_section_coverage as (
      select count(*) > ${LEXICAL_BILL_VERSION_CANDIDATE_LIMIT} as capped
      from version_section_lookahead
    ),
    version_section_candidates as materialized (
      select bill_id, section_id
      from version_section_lookahead
      order by section_id asc
      limit ${LEXICAL_BILL_VERSION_CANDIDATE_LIMIT}
    ),
    version_section_matches as materialized (
      select
        version_section_candidates.bill_id,
        ${documentSections.searchVector} as search_vector
      from version_section_candidates
      inner join ${documentSections} on ${documentSections.id} = version_section_candidates.section_id
      order by ts_rank_cd(${documentSections.searchVector}, ${searchQuery}) desc, version_section_candidates.section_id asc
    ),
    version_matches as materialized (
      select version_fallback.*
      from primary_count
      cross join lateral (
        select version_section_matches.bill_id as bill_id, ${versionRank} as version_rank
        from version_section_matches
        group by version_section_matches.bill_id
        order by ${versionRank} desc, version_section_matches.bill_id asc
        limit greatest(${candidateLimit} - primary_count.count, 0)
      ) version_fallback
    ),
    candidate_sources as (
      select id from primary_matches
      union all
      select bill_id as id from sponsor_matches
      union all
      select bill_id as id from version_matches
    ),
    candidate_ids as (
      select id
      from candidate_sources
      group by id
    ),
    ranked_candidates as (
      select
        ${bills.id} as "id",
        ${abstractMatches} as "abstractMatches",
        ${billTextMatches} as "billTextMatches",
        ${identifierMatches} as "identifierMatches",
        ${rank} as "rank",
        sponsor_matches.sponsor_rank as "sponsorRank",
        ${subjectMatches} as "subjectMatches",
        ${titleMatches} as "titleMatches",
        version_section_coverage.capped as "versionCoverageCapped",
        version_matches.version_rank as "versionRank"
      from candidate_ids
      inner join ${bills} on ${bills.id} = candidate_ids.id
      left join sponsor_matches on sponsor_matches.bill_id = ${bills.id}
      left join version_matches on version_matches.bill_id = ${bills.id}
      cross join version_section_coverage
    ),
    bounded_candidates as materialized (
      select *
      from ranked_candidates
      order by "rank" desc, "id" asc
      limit ${candidateLimit}
    ),
    page_candidates as materialized (
      select *, false as "coverageOnly"
      from bounded_candidates
      order by "rank" desc, "id" asc
      limit ${limit + 1}
      offset ${offset}
    )
    select * from page_candidates
    union all
    select
      null::text as "id",
      null::boolean as "abstractMatches",
      null::boolean as "billTextMatches",
      null::boolean as "identifierMatches",
      null::real as "rank",
      null::real as "sponsorRank",
      null::boolean as "subjectMatches",
      null::boolean as "titleMatches",
      version_section_coverage.capped as "versionCoverageCapped",
      null::real as "versionRank",
      true as "coverageOnly"
    from version_section_coverage
    order by "coverageOnly" asc, "rank" desc nulls last, "id" asc nulls last
  `
}

export function isBillIdentifierQuery(query: string): boolean {
  return /^[a-z][a-z. -]*\d+[a-z]?$/i.test(query.trim())
}

function billSearchMatchedFields(value: {
  abstractMatches: boolean
  identifierMatches: boolean
  sponsorRank: number | null
  subjectMatches: boolean
  titleMatches: boolean
  versionRank: number | null
}): BillSearchMatchedField[] {
  return [
    ...(value.identifierMatches ? (["identifier"] as const) : []),
    ...(value.titleMatches ? (["title"] as const) : []),
    ...(value.abstractMatches ? (["abstract"] as const) : []),
    ...(value.subjectMatches ? (["subjects"] as const) : []),
    ...(value.sponsorRank === null ? [] : (["sponsorNames"] as const)),
    ...(value.versionRank === null ? [] : (["versionText"] as const))
  ]
}

interface LexicalBillSearchCandidateRow {
  [key: string]: unknown
  abstractMatches: boolean
  billTextMatches: boolean
  coverageOnly: false
  id: string
  identifierMatches: boolean
  rank: number
  sponsorRank: number | null
  subjectMatches: boolean
  titleMatches: boolean
  versionCoverageCapped: boolean
  versionRank: number | null
}

interface LexicalBillSearchCoverageRow {
  [key: string]: unknown
  coverageOnly: true
  id: null
  versionCoverageCapped: boolean
}

type LexicalBillSearchRow = LexicalBillSearchCandidateRow | LexicalBillSearchCoverageRow

function isLexicalBillSearchCandidateRow(row: LexicalBillSearchRow): row is LexicalBillSearchCandidateRow {
  return !row.coverageOnly
}

export function hasCappedLexicalBillVersionCoverage(rows: readonly { versionCoverageCapped: boolean }[]): boolean {
  return rows.some((row) => row.versionCoverageCapped)
}

async function hydrateLexicalBillCandidates(
  database: LegislationDatabase,
  rows: readonly LexicalBillSearchCandidateRow[],
  query: string
): Promise<BillSearchCandidate[]> {
  const billIds = rows.map((row) => row.id)
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const sponsorSearchVector = sql`to_tsvector('english', ${billSponsors.name})`
  const sponsorCandidateIds = rows
    .filter((row) => !row.billTextMatches && !row.identifierMatches && row.sponsorRank !== null)
    .map((row) => row.id)
  const versionCandidateIds = rows
    .filter((row) => !row.billTextMatches && !row.identifierMatches && row.versionRank !== null)
    .map((row) => row.id)
  // Keep each request to one active database operation at a time. The ranking
  // window is already small, while concurrent hydration queries would add four
  // simultaneous PgBouncer clients for a single API request.
  const billRows = await database
    .select({
      bill: billSearchSummaryColumns,
      billSnippet: sql<string | null>`ts_headline(
        'english',
        concat_ws(' ', ${bills.identifier}, ${bills.title}, ${bills.summary}, array_to_string(${bills.subjects}, ' ')),
        ${searchQuery},
        'MaxFragments=2, MaxWords=35, MinWords=10'
      )`
    })
    .from(bills)
    .where(inArray(bills.id, billIds))
  const latestActionRows = await database
    .select({
      billId: billActions.billId,
      latestActionAt: sql<Date | null>`max(${billActionTimestamp()})`.mapWith(billActions.actionAt)
    })
    .from(billActions)
    .where(inArray(billActions.billId, billIds))
    .groupBy(billActions.billId)
  const sponsorSnippetRows =
    sponsorCandidateIds.length === 0
      ? []
      : await database
          .select({
            billId: billSponsors.billId,
            snippet: sql<string | null>`min(ts_headline(
              'english',
              ${billSponsors.name},
              ${searchQuery},
              'MaxFragments=1, MaxWords=20, MinWords=5'
            ))`
          })
          .from(billSponsors)
          .where(and(inArray(billSponsors.billId, sponsorCandidateIds), sql`${sponsorSearchVector} @@ ${searchQuery}`))
          .groupBy(billSponsors.billId)
  const versionSnippetRows =
    versionCandidateIds.length === 0
      ? []
      : await database
          .select({
            billId: billDocuments.billId,
            snippet: sql<string | null>`min(ts_headline(
              'english',
              ${documentSections.text},
              ${searchQuery},
              'MaxFragments=2, MaxWords=35, MinWords=10'
            ))`
          })
          .from(documentSections)
          .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
          .where(
            and(
              inArray(billDocuments.billId, versionCandidateIds),
              eq(billDocuments.classification, "version"),
              eq(billDocuments.processingStatus, "processed"),
              sql`${documentSections.searchVector} @@ ${searchQuery}`
            )
          )
          .groupBy(billDocuments.billId)
  const billsById = new Map(billRows.map((row) => [row.bill.id, row]))
  const latestActionsByBillId = new Map(latestActionRows.map((row) => [row.billId, row.latestActionAt]))
  const sponsorSnippetsByBillId = new Map(sponsorSnippetRows.map((row) => [row.billId, row.snippet]))
  const versionSnippetsByBillId = new Map(versionSnippetRows.map((row) => [row.billId, row.snippet]))

  return rows.map((row) => {
    const bill = billsById.get(row.id)
    if (bill === undefined) {
      throw new Error(`Lexical bill candidate ${row.id} disappeared during hydration`)
    }
    return {
      ...bill.bill,
      latestActionAt: latestActionsByBillId.get(row.id) ?? null,
      lexicalScore: row.rank,
      matchedFields: billSearchMatchedFields(row),
      rerankScore: null,
      rank: row.rank,
      score: row.rank,
      semanticScore: null,
      snippet:
        row.billTextMatches || row.identifierMatches
          ? (bill.billSnippet ?? null)
          : (sponsorSnippetsByBillId.get(row.id) ?? versionSnippetsByBillId.get(row.id) ?? null)
    }
  })
}

export interface PassageSearchInput extends SearchInput {
  billIds?: string[]
  documentClassifications?: string[]
  documentIds?: string[]
  headings?: string[]
  mode?: "hybrid" | "lexical" | "semantic"
  pageFrom?: number
  pageTo?: number
  /** Internal generation token for the feature-gated ranked lexical index. */
  rankingGeneration?: string
  versionCodes?: string[]
}

/**
 * The query service returns only persisted search facts.  Keeping the source
 * records alongside a ranked section prevents the HTTP projection from
 * manufacturing document OCR state, bill provenance, or source offsets.
 */
export interface PassageSearchCandidate {
  bill: {
    classification: string[]
    createdAt: Date
    id: string
    identifier: string
    introducedAt: string | null
    jurisdictionId: string
    sessionId: string
    sourceUpdatedAt: Date | null
    sourceUrl: string
    status: string | null
    subjects: string[]
    title: string
    updatedAt: Date
    upstreamIds: Record<string, string>
  }
  distance?: number
  document: {
    billId: string
    classification: string
    contentHash: string | null
    contentType: string | null
    createdAt: Date
    documentDate: string | null
    id: string
    ocrCompletedAt: Date | null
    ocrPageCount: number | null
    ocrProvider: string | null
    ocrStatus: string | null
    processingErrorCategory: string | null
    processingStatus: string
    sourceUrl: string
    title: string
    updatedAt: Date
    versionCode: string | null
  }
  latestActionAt: Date | null
  lexicalScore: number | null
  matchedFields: Array<"heading" | "semantic" | "text">
  rank?: number
  rerankScore: number | null
  rerankText: string
  score: number
  section: {
    contentHash: string
    documentId: string
    heading: string | null
    id: string
    ordinal: number
    pageEnd: number | null
    pageStart: number | null
    sourceEndOffset: number
    sourceStartOffset: number
    text: string
  }
  semanticScore: number | null
  snippet: string | null
}

export interface PassageSearchResultPage extends SearchPage<PassageSearchCandidate> {
  search: {
    isReranked: boolean
    models: SearchModelUsage[]
  }
}

export function validatePassageSearchInput(input: PassageSearchInput): {
  limit: number
  offset: number
  query: string
} {
  const query = input.query.trim()
  if (query.length === 0 || query.length > MAXIMUM_QUERY_LENGTH) {
    throw new Error(`Search query must contain between 1 and ${MAXIMUM_QUERY_LENGTH} characters`)
  }
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  return { limit, offset: decodePassageSearchCursor(input.cursor, input), query }
}

/** A cursor is bound to every passage filter and the ranking mode. */
export function decodePassageSearchCursor(cursor: string | undefined, input: PassageSearchInput): number {
  if (cursor === undefined) {
    return 0
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof value !== "object" ||
      value === null ||
      !("binding" in value) ||
      !("offset" in value) ||
      !("version" in value) ||
      value.binding !== passageSearchCursorBinding(input) ||
      typeof value.offset !== "number" ||
      !Number.isSafeInteger(value.offset) ||
      value.offset < 0 ||
      value.version !== 1
    ) {
      throw new Error("invalid cursor")
    }
    return value.offset
  } catch {
    throw new Error("Invalid passage search cursor")
  }
}

export function encodePassageSearchCursor(offset: number, input: PassageSearchInput): string {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Passage search cursor offset must be a non-negative safe integer")
  }
  return Buffer.from(JSON.stringify({ binding: passageSearchCursorBinding(input), offset, version: 1 })).toString(
    "base64url"
  )
}

function passageSearchCursorBinding(input: PassageSearchInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        billIds: sortedValues(input.billIds),
        classifications: sortedValues(input.classifications),
        documentClassifications: sortedValues(input.documentClassifications),
        documentIds: sortedValues(input.documentIds),
        headings: sortedValues(input.headings),
        jurisdictionIds: sortedValues(input.jurisdictionIds),
        introducedFrom: input.introducedFrom,
        introducedTo: input.introducedTo,
        mode: input.mode ?? "lexical",
        pageFrom: input.pageFrom,
        pageTo: input.pageTo,
        query: input.query.trim(),
        rankingGeneration: input.rankingGeneration,
        sessionIds: sortedValues(input.sessionIds),
        sponsorIds: sortedValues(input.sponsorIds),
        statuses: sortedValues(input.statuses),
        subjects: sortedValues(input.subjects),
        updatedFrom: input.updatedFrom?.toISOString(),
        updatedTo: input.updatedTo?.toISOString(),
        updatedToExclusive: input.updatedToExclusive?.toISOString(),
        versionCodes: sortedValues(input.versionCodes)
      })
    )
    .digest("base64url")
}

export type RankedPassageHydrationHit = Readonly<{
  contentHash: string
  documentId: string
  documentTitle: string
  heading: string | null
  pageEnd: number | null
  pageStart: number | null
  score: number
  sectionId: string
}>

export class RankedPassageHydrationError extends Error {
  readonly reason:
    | "canonical_filter_mismatch"
    | "content_mismatch"
    | "duplicate_section"
    | "indexed_projection_mismatch"

  constructor(
    reason: "canonical_filter_mismatch" | "content_mismatch" | "duplicate_section" | "indexed_projection_mismatch"
  ) {
    super(`Ranked passage search hydration failed: ${reason}`)
    this.name = "RankedPassageHydrationError"
    this.reason = reason
  }
}

/**
 * Hydrates ranked identifiers from the authoritative canonical database.
 * A stale search-copy hit fails the page so callers can retry after synchronization;
 * it is never silently dropped or represented with copied metadata.
 */
export async function hydrateRankedPassageSearch(
  database: LegislationDatabase,
  input: PassageSearchInput,
  hits: readonly RankedPassageHydrationHit[]
): Promise<SearchPage<PassageSearchCandidate>> {
  const { limit, offset, query } = validatePassageSearchInput(input)
  if (hits.length === 0) {
    return { items: [], nextCursor: undefined, truncated: false }
  }
  const sectionIds = hits.map((hit) => hit.sectionId)
  if (new Set(sectionIds).size !== sectionIds.length) {
    throw new RankedPassageHydrationError("duplicate_section")
  }
  const rows = await buildRankedPassageHydrationQuery(database, input, sectionIds, query)
  const rowsById = new Map(rows.map((row) => [row.section.id, row]))
  const items = hits.slice(0, limit).map((hit) => {
    const row = rowsById.get(hit.sectionId)
    if (row === undefined || row.document.id !== hit.documentId) {
      throw new RankedPassageHydrationError("canonical_filter_mismatch")
    }
    assertRankedPassageHydrationFreshness(row, hit)
    const { headingMatched: matchedHeading, ...candidate } = row
    const matchedFields: PassageSearchCandidate["matchedFields"] = matchedHeading ? ["heading", "text"] : ["text"]
    return {
      ...candidate,
      lexicalScore: hit.score,
      matchedFields,
      rank: hit.score,
      rerankScore: null,
      score: hit.score,
      semanticScore: null
    }
  })
  if (rows.length !== hits.length) {
    throw new RankedPassageHydrationError("canonical_filter_mismatch")
  }
  return {
    items,
    nextCursor: hits.length > limit ? encodePassageSearchCursor(offset + limit, input) : undefined,
    truncated: hits.length > limit
  }
}

export function assertRankedPassageHydrationFreshness(
  canonical: Readonly<{
    document: Readonly<{ title: string }>
    section: Readonly<{
      contentHash: string
      heading: string | null
      pageEnd: number | null
      pageStart: number | null
    }>
  }>,
  hit: RankedPassageHydrationHit
): void {
  if (canonical.section.contentHash !== hit.contentHash) {
    throw new RankedPassageHydrationError("content_mismatch")
  }
  if (
    canonical.section.heading !== hit.heading ||
    canonical.section.pageStart !== hit.pageStart ||
    canonical.section.pageEnd !== hit.pageEnd ||
    canonical.document.title !== hit.documentTitle
  ) {
    throw new RankedPassageHydrationError("indexed_projection_mismatch")
  }
}

export function buildRankedPassageHydrationQuery(
  database: LegislationDatabase,
  input: PassageSearchInput,
  sectionIds: readonly string[],
  normalizedQuery = input.query.trim()
) {
  const searchQuery = sql`websearch_to_tsquery('english', ${normalizedQuery})`
  const headingMatched = sql<boolean>`coalesce(to_tsvector('english', coalesce(${documentSections.heading}, '')) @@ ${searchQuery}, false)`
  const snippet = sql<
    string | null
  >`ts_headline('english', ${documentSections.text}, ${searchQuery}, 'MaxFragments=3, MaxWords=45, MinWords=12')`
  return database
    .select({ ...passageSelection(sql<number>`0`, snippet), headingMatched })
    .from(documentSections)
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        inArray(documentSections.id, sectionIds),
        eq(billDocuments.processingStatus, "processed"),
        ...passageFilters(input)
      )
    )
}

function passageFilters(input: Omit<PassageSearchInput, "query">): SQL[] {
  return [
    input.billIds === undefined ? undefined : inArray(bills.id, input.billIds),
    input.documentIds === undefined ? undefined : inArray(billDocuments.id, input.documentIds),
    input.documentClassifications === undefined
      ? undefined
      : inArray(billDocuments.classification, input.documentClassifications),
    input.versionCodes === undefined ? undefined : inArray(billDocuments.versionCode, input.versionCodes),
    input.headings === undefined ? undefined : inArray(documentSections.heading, input.headings),
    input.pageTo === undefined ? undefined : lte(documentSections.pageStart, input.pageTo),
    input.pageFrom === undefined ? undefined : gte(documentSections.pageEnd, input.pageFrom),
    ...billFilters(input)
  ].filter((condition): condition is SQL => condition !== undefined)
}

function passageSelection(rank: SQL<number>, snippet: SQL<string | null>, distance?: SQL<number>) {
  return {
    bill: {
      classification: bills.classification,
      createdAt: bills.createdAt,
      id: bills.id,
      identifier: bills.identifier,
      introducedAt: bills.introducedAt,
      jurisdictionId: bills.jurisdictionId,
      sessionId: bills.sessionId,
      sourceUpdatedAt: bills.sourceUpdatedAt,
      sourceUrl: bills.sourceUrl,
      status: bills.status,
      subjects: bills.subjects,
      title: bills.title,
      updatedAt: bills.updatedAt,
      upstreamIds: bills.upstreamIds
    },
    ...(distance === undefined ? {} : { distance }),
    document: {
      billId: billDocuments.billId,
      classification: billDocuments.classification,
      contentHash: billDocuments.contentHash,
      contentType: billDocuments.contentType,
      createdAt: billDocuments.createdAt,
      documentDate: billDocuments.documentDate,
      id: billDocuments.id,
      ocrCompletedAt: billDocuments.ocrCompletedAt,
      ocrPageCount: billDocuments.ocrPageCount,
      ocrProvider: billDocuments.ocrProvider,
      ocrStatus: billDocuments.ocrStatus,
      processingErrorCategory: billDocuments.processingErrorCategory,
      processingStatus: billDocuments.processingStatus,
      sourceUrl: billDocuments.sourceUrl,
      title: billDocuments.title,
      updatedAt: billDocuments.updatedAt,
      versionCode: billDocuments.versionCode
    },
    latestActionAt: sql<Date | null>`(
      select max(${billActionTimestamp()})
      from ${billActions}
      where ${billActions.billId} = ${bills.id}
    )`.mapWith(billActions.actionAt),
    rank,
    rerankText: sql<string>`left(concat_ws(E'\\n', ${documentSections.heading}, ${documentSections.text}), 4000)`,
    section: {
      contentHash: documentSections.contentHash,
      documentId: documentSections.documentId,
      heading: documentSections.heading,
      id: documentSections.id,
      ordinal: documentSections.ordinal,
      pageEnd: documentSections.pageEnd,
      pageStart: documentSections.pageStart,
      sourceEndOffset: documentSections.sourceEndOffset,
      sourceStartOffset: documentSections.sourceStartOffset,
      text: documentSections.text
    },
    snippet
  }
}

export async function lexicalPassageSearch(
  database: LegislationDatabase,
  input: PassageSearchInput,
  candidateSectionIds?: readonly string[]
): Promise<SearchPage<PassageSearchCandidate>> {
  if (candidateSectionIds?.length === 0) {
    return { items: [], nextCursor: undefined, truncated: false }
  }
  const { limit, offset } = validatePassageSearchInput(input)
  const rows = await buildLexicalPassageSearchQuery(database, input, candidateSectionIds)
  return {
    items: rows.slice(0, limit).map(({ headingMatched: matchedHeading, ...row }) => ({
      ...row,
      lexicalScore: row.rank,
      matchedFields: matchedHeading ? ["heading", "text"] : ["text"],
      rerankScore: null,
      score: row.rank,
      semanticScore: null
    })),
    nextCursor: rows.length > limit ? encodePassageSearchCursor(offset + limit, input) : undefined,
    truncated: rows.length > limit
  }
}

export function buildLexicalPassageSearchQuery(
  database: LegislationDatabase,
  input: PassageSearchInput,
  candidateSectionIds?: readonly string[]
) {
  const { limit, offset, query } = validatePassageSearchInput(input)
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const rank = sql<number>`ts_rank_cd(${documentSections.searchVector}, ${searchQuery})`
  const headingMatched = sql<boolean>`coalesce(to_tsvector('english', coalesce(${documentSections.heading}, '')) @@ ${searchQuery}, false)`
  const snippet = sql<
    string | null
  >`ts_headline('english', ${documentSections.text}, ${searchQuery}, 'MaxFragments=3, MaxWords=45, MinWords=12')`
  // Rank only identifiers and scores. Carrying section text and document metadata
  // through the corpus-wide sort spills wide rows before LIMIT can help.
  const page = database.$with("lexical_passage_page").as(
    database
      .select({ sectionId: documentSections.id, rank: rank.as("rank") })
      .from(documentSections)
      .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
      .innerJoin(bills, eq(billDocuments.billId, bills.id))
      .where(
        and(
          sql`${documentSections.searchVector} @@ ${searchQuery}`,
          candidateSectionIds === undefined ? undefined : inArray(documentSections.id, candidateSectionIds),
          eq(billDocuments.processingStatus, "processed"),
          ...passageFilters(input)
        )
      )
      .orderBy(desc(rank), asc(documentSections.id))
      .limit(limit + 1)
      .offset(offset)
  )
  return database
    .with(page)
    .select({ ...passageSelection(sql<number>`${page.rank}`, snippet), headingMatched })
    .from(page)
    .innerJoin(documentSections, eq(documentSections.id, page.sectionId))
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .orderBy(desc(page.rank), asc(page.sectionId))
}

export function embeddingLiteral(embedding: number[], dimensions: number): SQL {
  if (embedding.length !== dimensions || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding must contain ${dimensions} finite numbers`)
  }
  return sql`${JSON.stringify(embedding)}::vector`
}

/** Parentheses keep PostgreSQL from evaluating integer subtraction against a vector before cosine distance. */
export function semanticSimilarityScore(distance: SQL<number>): SQL<number> {
  return sql<number>`1 - (${distance})`
}

export async function semanticBillSearch(
  database: LegislationDatabase,
  input: Omit<SearchInput, "query"> & { embedding: number[] }
): Promise<SearchPage<BillSearchCandidate>> {
  const route = embeddingRouteFor("bill")
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  const offset = decodeSearchCursor(input.cursor)
  const distance = sql<number>`${billEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  const latestActions = database
    .select({
      latestActionAt: sql<Date | null>`max(${billActionTimestamp()})`
        .mapWith(billActions.actionAt)
        .as("latest_action_at")
    })
    .from(billActions)
    .where(eq(billActions.billId, bills.id))
    .as("bill_semantic_latest_actions")
  const rows = await database
    .select({
      bill: bills,
      distance,
      latestActionAt: latestActions.latestActionAt
    })
    .from(bills)
    .innerJoin(billEmbeddings, eq(billEmbeddings.billId, bills.id))
    .leftJoinLateral(latestActions, sql`true`)
    .where(
      and(
        eq(billEmbeddings.model, route.model),
        eq(billEmbeddings.inputContract, route.embeddingInputContract),
        ...billFilters(input)
      )
    )
    .orderBy(asc(distance), asc(bills.id))
    .limit(limit + 1)
    .offset(offset)
  return paginateSearchDatabaseRows(
    rows.map((row) => ({
      ...row.bill,
      latestActionAt: row.latestActionAt,
      lexicalScore: null,
      matchedFields: ["semantic"],
      rerankScore: null,
      distance: row.distance,
      score: 1 - row.distance,
      semanticScore: 1 - row.distance,
      snippet: `${row.bill.identifier} ${row.bill.title}${row.bill.summary === null ? "" : ` ${row.bill.summary}`}`
    })),
    limit,
    offset
  )
}

export async function semanticPassageSearch(
  database: LegislationDatabase,
  input: Omit<PassageSearchInput, "query"> & { embedding: number[] }
): Promise<SearchPage<PassageSearchCandidate>> {
  const route = embeddingRouteFor("document-section")
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  const offset = decodePassageSearchCursor(input.cursor, { ...input, query: "semantic" })
  const distance = sql<number>`${documentSectionEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  const snippet = sql<string | null>`left(${documentSections.text}, 1200)`
  const rows = await database
    .select(passageSelection(semanticSimilarityScore(distance), snippet, distance))
    .from(documentSections)
    .innerJoin(documentSectionEmbeddings, eq(documentSectionEmbeddings.sectionId, documentSections.id))
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        eq(documentSectionEmbeddings.model, route.model),
        eq(documentSectionEmbeddings.inputContract, route.embeddingInputContract),
        eq(billDocuments.processingStatus, "processed"),
        ...passageFilters(input)
      )
    )
    .orderBy(asc(distance), asc(documentSections.id))
    .limit(limit + 1)
    .offset(offset)
  return {
    items: rows.slice(0, limit).map((row) => {
      if (row.distance === undefined) {
        throw new Error("Semantic passage search did not return a vector distance")
      }
      return {
        ...row,
        distance: row.distance,
        lexicalScore: null,
        matchedFields: ["semantic"],
        rerankScore: null,
        score: 1 - row.distance,
        semanticScore: 1 - row.distance,
        snippet: row.section.text.slice(0, 1_200)
      }
    }),
    nextCursor:
      rows.length > limit ? encodePassageSearchCursor(offset + limit, { ...input, query: "semantic" }) : undefined,
    truncated: rows.length > limit
  }
}

export async function semanticStructuredAmendmentSearch(
  database: LegislationDatabase,
  input: Readonly<{
    billId?: string
    embedding: number[]
    jurisdictionId?: string
    limit?: number
    sponsorPersonId?: string
  }>
) {
  const route = embeddingRouteFor("structured-amendment")
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAXIMUM_LIMIT)
  const distance = sql<number>`${amendmentEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  return database
    .select({ amendment: amendments, distance })
    .from(amendments)
    .innerJoin(amendmentEmbeddings, eq(amendmentEmbeddings.amendmentId, amendments.id))
    .where(
      and(
        eq(amendmentEmbeddings.model, route.model),
        eq(amendmentEmbeddings.inputContract, route.embeddingInputContract),
        input.billId === undefined ? undefined : eq(amendments.billId, input.billId),
        input.jurisdictionId === undefined ? undefined : eq(amendments.jurisdictionId, input.jurisdictionId),
        input.sponsorPersonId === undefined ? undefined : eq(amendments.sponsorPersonId, input.sponsorPersonId)
      )
    )
    .orderBy(asc(distance), asc(amendments.id))
    .limit(limit)
}

export async function semanticDocumentAmendmentSearch(
  database: LegislationDatabase,
  input: Readonly<{ billId?: string; embedding: number[]; jurisdictionId?: string; limit?: number }>
) {
  const route = embeddingRouteFor("document-backed-amendment-section")
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAXIMUM_LIMIT)
  const distance = sql<number>`${documentSectionEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  return database
    .select({
      distance,
      document: billDocuments,
      jurisdictionId: bills.jurisdictionId,
      sectionId: documentSections.id
    })
    .from(documentSections)
    .innerJoin(documentSectionEmbeddings, eq(documentSectionEmbeddings.sectionId, documentSections.id))
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        eq(documentSectionEmbeddings.model, route.model),
        eq(documentSectionEmbeddings.inputContract, route.embeddingInputContract),
        eq(billDocuments.classification, "amendment"),
        input.billId === undefined ? undefined : eq(billDocuments.billId, input.billId),
        input.jurisdictionId === undefined ? undefined : eq(bills.jurisdictionId, input.jurisdictionId)
      )
    )
    .orderBy(asc(distance), asc(documentSections.id))
    .limit(limit)
}

export async function semanticSupportingMaterialSearch(
  database: LegislationDatabase,
  input: Readonly<{
    amendmentIds?: readonly string[]
    billIds?: readonly string[]
    classifications?: readonly string[]
    documentFrom?: string
    documentTo?: string
    embedding: number[]
    eventIds?: readonly string[]
    jurisdictionIds?: readonly string[]
    limit?: number
    organizationIds?: readonly string[]
    processingStatus?: "failed" | "pending" | "processed" | "processing" | "unsupported"
    sessionIds?: readonly string[]
    updatedFrom?: Date
    updatedTo?: Date
    updatedToExclusive?: Date
  }>
) {
  const route = embeddingRouteFor("supporting-material-section")
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAXIMUM_LIMIT)
  const distance = sql<number>`${supportingMaterialSectionEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  return database
    .select({ distance, material: supportingMaterialSummaryColumns, sectionId: supportingMaterialSections.id })
    .from(supportingMaterialSections)
    .innerJoin(
      supportingMaterialSectionEmbeddings,
      eq(supportingMaterialSectionEmbeddings.sectionId, supportingMaterialSections.id)
    )
    .innerJoin(supportingMaterials, eq(supportingMaterialSections.materialId, supportingMaterials.id))
    .leftJoin(supportingMaterialLinks, eq(supportingMaterialLinks.materialId, supportingMaterials.id))
    .leftJoin(bills, eq(bills.id, supportingMaterialLinks.billId))
    .where(
      and(
        eq(supportingMaterialSectionEmbeddings.model, route.model),
        eq(supportingMaterialSectionEmbeddings.inputContract, route.embeddingInputContract),
        input.jurisdictionIds === undefined
          ? undefined
          : inArray(supportingMaterials.jurisdictionId, input.jurisdictionIds),
        input.classifications === undefined
          ? undefined
          : inArray(supportingMaterials.classification, input.classifications),
        input.billIds === undefined ? undefined : inArray(supportingMaterialLinks.billId, input.billIds),
        input.amendmentIds === undefined ? undefined : inArray(supportingMaterialLinks.amendmentId, input.amendmentIds),
        input.eventIds === undefined ? undefined : inArray(supportingMaterialLinks.eventId, input.eventIds),
        input.organizationIds === undefined
          ? undefined
          : inArray(supportingMaterialLinks.organizationId, input.organizationIds),
        input.documentFrom === undefined ? undefined : gte(supportingMaterials.documentDate, input.documentFrom),
        input.documentTo === undefined ? undefined : lte(supportingMaterials.documentDate, input.documentTo),
        input.processingStatus === undefined
          ? undefined
          : eq(supportingMaterials.processingStatus, input.processingStatus),
        input.sessionIds === undefined ? undefined : inArray(bills.sessionId, input.sessionIds),
        input.updatedFrom === undefined ? undefined : gte(supportingMaterials.updatedAt, input.updatedFrom),
        input.updatedTo === undefined ? undefined : lte(supportingMaterials.updatedAt, input.updatedTo),
        input.updatedToExclusive === undefined
          ? undefined
          : sql`${supportingMaterials.updatedAt} < ${input.updatedToExclusive}`
      )
    )
    .orderBy(asc(distance), asc(supportingMaterialSections.id))
    .limit(limit)
}

export function reciprocalRankFusion<T extends { id: string }>(lexical: T[], semantic: T[], limit: number): T[] {
  const scores = new Map<string, { item: T; score: number }>()
  for (const [index, item] of lexical.entries()) {
    scores.set(item.id, { item, score: 1 / (60 + index + 1) })
  }
  for (const [index, item] of semantic.entries()) {
    const existing = scores.get(item.id)
    scores.set(item.id, { item: existing?.item ?? item, score: (existing?.score ?? 0) + 1 / (60 + index + 1) })
  }
  return [...scores.values()]
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit)
    .map(({ item }) => item)
}

export function reciprocalRankFusionWithScores<T extends { id: string }>(
  lexical: T[],
  semantic: T[],
  limit: number
): Array<T & { score: number }> {
  const scores = new Map<string, { item: T; score: number }>()
  for (const [index, item] of lexical.entries()) {
    scores.set(item.id, { item, score: 1 / (60 + index + 1) })
  }
  for (const [index, item] of semantic.entries()) {
    const existing = scores.get(item.id)
    scores.set(item.id, { item: existing?.item ?? item, score: (existing?.score ?? 0) + 1 / (60 + index + 1) })
  }
  return [...scores.values()]
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item, score }))
}
