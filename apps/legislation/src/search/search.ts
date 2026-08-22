import { and, arrayOverlaps, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import {
  amendmentEmbeddings,
  amendments,
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

export async function lexicalBillSearch(database: LegislationDatabase, input: SearchInput) {
  const { limit, offset, query } = validateSearchInput(input)
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const rank = sql<number>`ts_rank_cd(${bills.searchVector}, ${searchQuery})`
  const rows = await database
    .select({
      id: bills.id,
      identifier: bills.identifier,
      introducedAt: bills.introducedAt,
      jurisdictionId: bills.jurisdictionId,
      rank,
      sessionId: bills.sessionId,
      snippet: sql<string>`ts_headline('english', coalesce(${bills.summary}, ${bills.title}), ${searchQuery}, 'MaxFragments=2, MaxWords=35, MinWords=10')`,
      sourceUrl: bills.sourceUrl,
      status: bills.status,
      summary: bills.summary,
      title: bills.title
    })
    .from(bills)
    .where(and(sql`${bills.searchVector} @@ ${searchQuery}`, ...billFilters(input)))
    .orderBy(desc(rank), asc(bills.id))
    .limit(limit + 1)
    .offset(offset)
  return paginateSearchRows(rows, limit, 0)
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
) {
  const route = embeddingRouteFor("bill")
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAXIMUM_LIMIT) {
    throw new Error(`Search limit must be between 1 and ${MAXIMUM_LIMIT}`)
  }
  const offset = decodeSearchCursor(input.cursor)
  const distance = sql<number>`${billEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  const rows = await database
    .select({
      distance,
      id: bills.id,
      identifier: bills.identifier,
      introducedAt: bills.introducedAt,
      jurisdictionId: bills.jurisdictionId,
      sessionId: bills.sessionId,
      sourceUrl: bills.sourceUrl,
      status: bills.status,
      summary: bills.summary,
      title: bills.title
    })
    .from(bills)
    .innerJoin(billEmbeddings, eq(billEmbeddings.billId, bills.id))
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
  return paginateSearchRows(rows, limit, 0)
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
    amendmentId?: string
    billId?: string
    classification?: string
    embedding: number[]
    eventId?: string
    jurisdictionId?: string
    limit?: number
  }>
) {
  const route = embeddingRouteFor("supporting-material-section")
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAXIMUM_LIMIT)
  const distance = sql<number>`${supportingMaterialSectionEmbeddings.embedding} <=> ${embeddingLiteral(input.embedding, route.dimensions)}`
  return database
    .select({ distance, material: supportingMaterials, sectionId: supportingMaterialSections.id })
    .from(supportingMaterialSections)
    .innerJoin(
      supportingMaterialSectionEmbeddings,
      eq(supportingMaterialSectionEmbeddings.sectionId, supportingMaterialSections.id)
    )
    .innerJoin(supportingMaterials, eq(supportingMaterialSections.materialId, supportingMaterials.id))
    .leftJoin(supportingMaterialLinks, eq(supportingMaterialLinks.materialId, supportingMaterials.id))
    .where(
      and(
        eq(supportingMaterialSectionEmbeddings.model, route.model),
        eq(supportingMaterialSectionEmbeddings.inputContract, route.embeddingInputContract),
        input.jurisdictionId === undefined ? undefined : eq(supportingMaterials.jurisdictionId, input.jurisdictionId),
        input.classification === undefined ? undefined : eq(supportingMaterials.classification, input.classification),
        input.billId === undefined ? undefined : eq(supportingMaterialLinks.billId, input.billId),
        input.amendmentId === undefined ? undefined : eq(supportingMaterialLinks.amendmentId, input.amendmentId),
        input.eventId === undefined ? undefined : eq(supportingMaterialLinks.eventId, input.eventId)
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
