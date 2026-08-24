import { and, arrayOverlaps, asc, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm"
import { getTableColumns, type SQL } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
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
const MAXIMUM_LIMIT = 100
const MAXIMUM_QUERY_LENGTH = 500
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
}

export interface SearchInput extends SearchFilters {
  cursor?: string
  limit?: number
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

export function validateSearchInput(input: SearchInput): { limit: number; offset: number; query: string } {
  const query = input.query.trim()
  if (query.length === 0 || query.length > MAXIMUM_QUERY_LENGTH) {
    throw new Error(`Search query must contain between 1 and ${MAXIMUM_QUERY_LENGTH} characters`)
  }
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  return { limit, offset: decodeSearchCursor(input.cursor), query }
}

export function decodeSearchCursor(cursor: string | undefined): number {
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
    return value.offset
  } catch {
    throw new Error("Invalid search cursor")
  }
}

export function encodeSearchCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url")
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
export function paginateSearchDatabaseRows<T>(rows: T[], limit: number, offset: number): SearchPage<T> {
  const truncated = rows.length > limit
  return {
    items: rows.slice(0, limit),
    nextCursor: truncated ? encodeSearchCursor(offset + limit) : undefined,
    truncated
  }
}

export async function lexicalBillSearch(
  database: LegislationDatabase,
  input: SearchInput
): Promise<SearchPage<BillSearchCandidate>> {
  const { limit, offset, query } = validateSearchInput(input)
  const rows = await buildLexicalBillSearchQuery(database, input, query, limit, offset)
  return paginateSearchDatabaseRows(
    rows.map((row) => ({
      ...row.bill,
      latestActionAt: row.latestActionAt,
      lexicalScore: row.rank,
      matchedFields: billSearchMatchedFields(row),
      rerankScore: null,
      rank: row.rank,
      score: row.rank,
      semanticScore: null,
      snippet:
        row.billTextMatches || row.identifierMatches
          ? (row.billSnippet ?? null)
          : (row.sponsorSnippet ?? row.versionSnippet)
    })),
    limit,
    offset
  )
}

export function buildLexicalBillSearchQuery(
  database: LegislationDatabase,
  input: SearchInput,
  query: string,
  limit: number,
  offset: number
) {
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const identifierMatches = sql<boolean>`to_tsvector('english', ${bills.identifier}) @@ ${searchQuery}`
  const titleMatches = sql<boolean>`to_tsvector('english', ${bills.title}) @@ ${searchQuery}`
  const abstractMatches = sql<boolean>`to_tsvector('english', coalesce(${bills.summary}, '')) @@ ${searchQuery}`
  const subjectMatches = sql<boolean>`to_tsvector('english', array_to_string(${bills.subjects}, ' ')) @@ ${searchQuery}`
  const sponsorSearchVector = sql`to_tsvector('english', ${billSponsors.name})`
  const sponsorMatches = database
    .select({
      rank: sql<number | null>`max(ts_rank_cd(${sponsorSearchVector}, ${searchQuery}))`.as("rank"),
      snippet: sql<
        string | null
      >`min(ts_headline('english', ${billSponsors.name}, ${searchQuery}, 'MaxFragments=1, MaxWords=20, MinWords=5'))`.as(
        "snippet"
      )
    })
    .from(billSponsors)
    .where(and(eq(billSponsors.billId, bills.id), sql`${sponsorSearchVector} @@ ${searchQuery}`))
    .as("bill_sponsor_matches")
  const versionMatches = database
    .select({
      rank: sql<number | null>`max(ts_rank_cd(${documentSections.searchVector}, ${searchQuery}))`.as("rank"),
      snippet: sql<
        string | null
      >`min(ts_headline('english', ${documentSections.text}, ${searchQuery}, 'MaxFragments=2, MaxWords=35, MinWords=10'))`.as(
        "snippet"
      )
    })
    .from(documentSections)
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .where(
      and(
        eq(billDocuments.billId, bills.id),
        eq(billDocuments.classification, "version"),
        eq(billDocuments.processingStatus, "processed"),
        sql`${documentSections.searchVector} @@ ${searchQuery}`
      )
    )
    .as("bill_version_matches")
  const latestActions = database
    .select({
      latestActionAt: sql<Date | null>`max(coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp))`.as(
        "latest_action_at"
      )
    })
    .from(billActions)
    .where(eq(billActions.billId, bills.id))
    .as("bill_search_latest_actions")
  const rank = sql<number>`
    ts_rank_cd(${bills.searchVector}, ${searchQuery})
    + case when ${identifierMatches} then 1 else 0 end
    + coalesce(${sponsorMatches.rank}, 0)
    + coalesce(${versionMatches.rank}, 0)
  `
  return database
    .select({
      abstractMatches,
      bill: bills,
      billSnippet: sql<string | null>`ts_headline(
        'english',
        concat_ws(' ', ${bills.identifier}, ${bills.title}, ${bills.summary}, array_to_string(${bills.subjects}, ' ')),
        ${searchQuery},
        'MaxFragments=2, MaxWords=35, MinWords=10'
      )`,
      billTextMatches: sql<boolean>`${bills.searchVector} @@ ${searchQuery}`,
      identifierMatches,
      latestActionAt: latestActions.latestActionAt,
      rank,
      sponsorRank: sponsorMatches.rank,
      sponsorSnippet: sponsorMatches.snippet,
      subjectMatches,
      titleMatches,
      versionRank: versionMatches.rank,
      versionSnippet: versionMatches.snippet
    })
    .from(bills)
    .leftJoinLateral(sponsorMatches, sql`true`)
    .leftJoinLateral(versionMatches, sql`true`)
    .leftJoinLateral(latestActions, sql`true`)
    .where(
      and(
        or(
          sql`${bills.searchVector} @@ ${searchQuery}`,
          identifierMatches,
          isNotNull(sponsorMatches.rank),
          isNotNull(versionMatches.rank)
        ),
        ...billFilters(input)
      )
    )
    .orderBy(desc(rank), asc(bills.id))
    .limit(limit + 1)
    .offset(offset)
}

function billSearchMatchedFields(value: {
  abstractMatches: boolean
  billSnippet: string | null
  billTextMatches: boolean
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

export interface PassageSearchInput extends SearchInput {
  billId?: string
  documentIds?: string[]
}

export async function lexicalPassageSearch(database: LegislationDatabase, input: PassageSearchInput) {
  const { limit, offset, query } = validateSearchInput(input)
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const rank = sql<number>`ts_rank_cd(${documentSections.searchVector}, ${searchQuery})`
  const rows = await database
    .select({
      billId: bills.id,
      documentId: billDocuments.id,
      heading: documentSections.heading,
      rank,
      rerankText: sql<string>`left(concat_ws(E'\n', ${documentSections.heading}, ${documentSections.text}), 4000)`,
      sectionId: documentSections.id,
      snippet: sql<string>`ts_headline('english', ${documentSections.text}, ${searchQuery}, 'MaxFragments=3, MaxWords=45, MinWords=12')`,
      sourceUrl: billDocuments.sourceUrl,
      versionCode: billDocuments.versionCode
    })
    .from(documentSections)
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        sql`${documentSections.searchVector} @@ ${searchQuery}`,
        input.billId === undefined ? undefined : eq(bills.id, input.billId),
        input.documentIds === undefined ? undefined : inArray(billDocuments.id, input.documentIds),
        ...billFilters(input)
      )
    )
    .orderBy(desc(rank), asc(documentSections.id))
    .limit(limit + 1)
    .offset(offset)
  return paginateSearchRows(rows, limit, 0)
}

function embeddingLiteral(embedding: number[], dimensions: number): SQL {
  if (embedding.length !== dimensions || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding must contain ${dimensions} finite numbers`)
  }
  return sql`${JSON.stringify(embedding)}::vector`
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
      latestActionAt: sql<Date | null>`max(coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp))`.as(
        "latest_action_at"
      )
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
) {
  const route = embeddingRouteFor("document-section")
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  const offset = decodeSearchCursor(input.cursor)
  const distance = sql<number>`${documentSectionEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  const rows = await database
    .select({
      billId: bills.id,
      distance,
      documentId: billDocuments.id,
      heading: documentSections.heading,
      rerankText: sql<string>`left(concat_ws(E'\n', ${documentSections.heading}, ${documentSections.text}), 4000)`,
      sectionId: documentSections.id,
      snippet: sql<string>`left(${documentSections.text}, 1200)`,
      sourceUrl: billDocuments.sourceUrl,
      versionCode: billDocuments.versionCode
    })
    .from(documentSections)
    .innerJoin(documentSectionEmbeddings, eq(documentSectionEmbeddings.sectionId, documentSections.id))
    .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        eq(documentSectionEmbeddings.model, route.model),
        eq(documentSectionEmbeddings.inputContract, route.embeddingInputContract),
        input.billId === undefined ? undefined : eq(bills.id, input.billId),
        input.documentIds === undefined ? undefined : inArray(billDocuments.id, input.documentIds),
        ...billFilters(input)
      )
    )
    .orderBy(asc(distance), asc(documentSections.id))
    .limit(limit + 1)
    .offset(offset)
  return paginateSearchRows(rows, limit, 0)
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
