import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
  type SQLWrapper
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { LegislationDatabase } from "../db/database.js"
import { findChangeEvents, type CanonicalChangeType } from "../db/queries/changes.js"
import {
  amendmentActions,
  amendments,
  billActions,
  billDocuments,
  billEmbeddings,
  billOrganizations,
  billRelations,
  billSponsors,
  bills,
  calendarEntries,
  documentSections,
  eventAgendaItems,
  eventBills,
  eventDocuments,
  eventOutcomeLinks,
  eventParticipants,
  legislativeEvents,
  legislativeSessions,
  legislativeTerms,
  organizationMemberships,
  organizations,
  people,
  jurisdictions,
  supportingMaterialLinks,
  supportingMaterialSections,
  supportingMaterials,
  votePositions,
  votes
} from "../db/schema/schema.js"
import { embeddingQueryRouteFor, embeddingRouteFor, type EmbeddingSearchTool } from "../models/embedding-routing.js"
import type { RetrievalModelClient } from "../models/openrouter-retrieval.js"
import type { BillSearchCandidate, BillSearchResultPage, PassageSearchInput, SearchInput } from "../search/search.js"
import {
  lexicalBillSearch,
  lexicalPassageSearch,
  paginateCappedSearchRows,
  paginateSearchRows,
  reciprocalRankFusionWithScores,
  semanticBillSearch,
  semanticDocumentAmendmentSearch,
  semanticPassageSearch,
  semanticStructuredAmendmentSearch,
  semanticSupportingMaterialSearch,
  validateSearchInput
} from "../search/search.js"
import { LegislationError } from "./errors.js"

const CHILD_LIMIT = 100
const SECTION_LIMIT = 50
const DETAIL_RESPONSE_TARGET_BYTES = 750_000
const DOCUMENT_AMENDMENT_ID_PREFIX = "amendment:document:"
const LEXICAL_SUPPORTING_MATERIAL_CANDIDATE_LIMIT = 250
const LEXICAL_SUPPORTING_MATERIAL_SEARCH_TIMEOUT_MS = 5_000

function coverageWarnings(itemCount: number, domain: string): string[] {
  return itemCount === 0
    ? [`No ${domain} matched. Availability is source-dependent; an empty result does not prove none exist.`]
    : []
}

export interface BillLookup {
  childCursor?: string
  childLimit?: number
  id: string
}

export interface VersionComparisonInput {
  billId: string
  documentIds: [string, string]
}

export interface EntityLookup {
  cursor?: string
  id: string
  limit?: number
}

export interface MembershipLookup {
  cursor?: string
  limit?: number
  organizationId?: string
  personId?: string
}

export interface PersonSearchInput {
  cursor?: string
  isActive?: boolean
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  query?: string
}

export interface OrganizationSearchInput {
  classification?: string
  cursor?: string
  isActive?: boolean
  jurisdictionId?: string
  limit?: number
  parentOrganizationId?: string
  query?: string
}

export interface EventSearchInput {
  classification?: string[]
  cursor?: string
  from?: Date
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  sort?: "starts-asc" | "starts-desc" | "updated-desc"
  status?: string[]
  to?: Date
}

type BillBrowseOrderColumns = {
  id: SQLWrapper
  identifier: SQLWrapper
  introducedAt: SQLWrapper
  sourceUpdatedAt: SQLWrapper
  updatedAt: SQLWrapper
}

function billBrowseOrder(
  sort: BillBrowseInput["sort"],
  latestActionAt: SQLWrapper,
  billTable: BillBrowseOrderColumns
): SQL[] {
  switch (sort) {
    case "identifier-asc":
      return [asc(billTable.identifier), asc(billTable.id)]
    case "introduced-desc":
      return [desc(billTable.introducedAt), asc(billTable.id)]
    case "updated-desc":
      return [desc(billTable.updatedAt), asc(billTable.id)]
    default:
      return [
        desc(sql`coalesce(${latestActionAt}, ${billTable.sourceUpdatedAt}, ${billTable.updatedAt})`),
        asc(billTable.id)
      ]
  }
}

function eventSearchOrder(sort: EventSearchInput["sort"]): SQL[] {
  switch (sort) {
    case "starts-desc":
      return [desc(legislativeEvents.startAt), asc(legislativeEvents.id)]
    case "updated-desc":
      return [desc(legislativeEvents.updatedAt), asc(legislativeEvents.id)]
    default:
      return [asc(legislativeEvents.startAt), asc(legislativeEvents.id)]
  }
}

export interface VoteSearchInput {
  billId?: string
  cursor?: string
  from?: Date
  limit?: number
  organizationId?: string
  personId?: string
}

export interface AmendmentSearchInput {
  billId?: string
  cursor?: string
  jurisdictionId?: string
  limit?: number
  mode?: "hybrid" | "lexical" | "semantic"
  query?: string
  sponsorPersonId?: string
}

export interface DocumentBackedAmendment {
  billId: string
  documentId: string
  id: string
  jurisdictionId: string
  printedIdentifier: string
  recordType: "document"
  sourceUrl: string
  submittedDate: null | string
  title: string
}

type AmendmentSearchItem =
  | (DocumentBackedAmendment & { distance?: number; score?: number })
  | (typeof amendments.$inferSelect & { distance?: number; recordType: "structured"; score?: number })

interface AmendmentSearchResult {
  items: AmendmentSearchItem[]
  nextCursor?: string
  truncated: boolean
  warnings: string[]
}

export function documentBackedAmendmentId(documentId: string): string {
  return `${DOCUMENT_AMENDMENT_ID_PREFIX}${documentId}`
}

function documentIdFromAmendmentId(amendmentId: string): string | undefined {
  return amendmentId.startsWith(DOCUMENT_AMENDMENT_ID_PREFIX)
    ? amendmentId.slice(DOCUMENT_AMENDMENT_ID_PREFIX.length)
    : undefined
}

export function projectDocumentBackedAmendment(
  document: typeof billDocuments.$inferSelect,
  jurisdictionId: string
): DocumentBackedAmendment {
  return {
    billId: document.billId,
    documentId: document.id,
    id: documentBackedAmendmentId(document.id),
    jurisdictionId,
    printedIdentifier: document.title,
    recordType: "document",
    sourceUrl: document.sourceUrl,
    submittedDate: document.documentDate,
    title: document.title
  }
}

function amendmentSortKey(amendment: {
  id: string
  recordType: "document" | "structured"
  submittedDate?: null | string
}) {
  return `${amendment.submittedDate ?? ""}\u0000${amendment.id}`
}

export interface SupportingMaterialSearchInput {
  amendmentId?: string
  amendmentIds?: readonly string[]
  billId?: string
  billIds?: readonly string[]
  classification?: string
  classifications?: readonly string[]
  cursor?: string
  documentFrom?: string
  documentTo?: string
  eventId?: string
  eventIds?: readonly string[]
  jurisdictionId?: string
  jurisdictionIds?: readonly string[]
  limit?: number
  mode?: "hybrid" | "lexical" | "semantic"
  organizationId?: string
  organizationIds?: readonly string[]
  processingStatus?: "failed" | "pending" | "processed" | "processing" | "unsupported"
  query?: string
  sessionIds?: readonly string[]
  sort?: "document-desc" | "title-asc" | "updated-desc"
  updatedFrom?: Date
  updatedTo?: Date
  updatedToExclusive?: Date
}

const { text: _supportingMaterialText, ...supportingMaterialSummaryColumns } = getTableColumns(supportingMaterials)
type SupportingMaterialSummary = Omit<typeof supportingMaterials.$inferSelect, "text">
type SupportingMaterialLexicalEvidence = {
  lexicalScore: number
  matchedFields: readonly ("sectionText" | "title")[]
  section: typeof supportingMaterialSections.$inferSelect
  snippet: string | null
}

type SupportingMaterialRanked = SupportingMaterialSummary & {
  distance?: number
  lexicalEvidence?: SupportingMaterialLexicalEvidence
  score?: number
  semanticSectionId?: string
}

export type SupportingMaterialRead = SupportingMaterialRanked & {
  amendmentIds: string[]
  billIds: string[]
  meetingIds: string[]
  organizationIds: string[]
}

interface SupportingMaterialSearchResult {
  items: SupportingMaterialRead[]
  nextCursor?: string
  search?: Readonly<{
    isReranked: false
    models: readonly Readonly<{ model: string; purpose: "embedding" }>[]
  }>
  truncated: boolean
  warnings: string[]
}

export type SupportingMaterialSearchHitRead = SupportingMaterialRead & {
  lexicalScore: number | null
  matchedFields: readonly ("sectionText" | "semantic" | "title")[]
  rerankScore: null
  score: number
  section: typeof supportingMaterialSections.$inferSelect
  semanticScore: number | null
  snippet: string | null
}

export interface SupportingMaterialSearchHitResult {
  items: SupportingMaterialSearchHitRead[]
  nextCursor?: string
  search: Readonly<{
    isReranked: false
    models: readonly Readonly<{ model: string; purpose: "embedding" }>[]
  }>
  truncated: boolean
  warnings: string[]
}

function supportingMaterialFilterValues(
  values: readonly string[] | undefined,
  value: string | undefined
): readonly string[] | undefined {
  if (values !== undefined) {
    return values
  }
  return value === undefined ? undefined : [value]
}

function supportingMaterialFilter(
  values: readonly string[] | undefined,
  value: string | undefined,
  single: (item: string) => SQL,
  multiple: (items: readonly string[]) => SQL
): SQL | undefined {
  if (values !== undefined) {
    return multiple(values)
  }
  if (value !== undefined) {
    return single(value)
  }
  return undefined
}

function supportingMaterialSearchScore(
  mode: "hybrid" | "lexical" | "semantic",
  lexicalScore: number | null,
  semanticScore: number | null,
  hybridScore: number | undefined
): number | null | undefined {
  switch (mode) {
    case "lexical":
      return lexicalScore
    case "semantic":
      return semanticScore
    case "hybrid":
      return hybridScore
  }
}

function supportingMaterialOrder(sort: SupportingMaterialSearchInput["sort"]): SQL[] {
  switch (sort) {
    case "title-asc":
      return [asc(supportingMaterials.title), asc(supportingMaterials.id)]
    case "updated-desc":
      return [desc(supportingMaterials.updatedAt), asc(supportingMaterials.id)]
    default:
      return [desc(supportingMaterials.documentDate), asc(supportingMaterials.id)]
  }
}

/**
 * Lexical material search deliberately has a bounded retrieval window. It
 * preserves title and section-text matches, but runs both candidate sources
 * under a short transaction-local deadline. The title source lacks a GIN
 * index, and a deadline is preferable to silently returning partial results
 * while index maintenance is in progress.
 */
export function lexicalSupportingMaterialCandidateLimit(limit: number, offset: number): number {
  return Math.min(
    Math.max(limit + offset + 1, embeddingQueryRouteFor("search_supporting_materials").candidateLimit),
    LEXICAL_SUPPORTING_MATERIAL_CANDIDATE_LIMIT
  )
}

export function lexicalSupportingMaterialCandidateWindowCapped(
  candidateLimit: number,
  titleCandidateCount: number,
  sectionCandidateCount: number
): boolean {
  return titleCandidateCount > candidateLimit || sectionCandidateCount > candidateLimit
}

export function lexicalSupportingMaterialPageState(
  offset: number,
  limit: number,
  rowCount: number,
  candidateWindowCapped: boolean
): { nextCursor: string | undefined; truncated: boolean } {
  const pageLength = Math.min(rowCount, limit)
  const truncated = rowCount > limit || candidateWindowCapped
  return {
    nextCursor: truncated && pageLength > 0 ? encodeOffset(offset + pageLength) : undefined,
    truncated
  }
}

function supportingMaterialLexicalLinkFilter(input: SupportingMaterialSearchInput): SQL | undefined {
  const billIds = supportingMaterialFilterValues(input.billIds, input.billId)
  const amendmentIds = supportingMaterialFilterValues(input.amendmentIds, input.amendmentId)
  const eventIds = supportingMaterialFilterValues(input.eventIds, input.eventId)
  const organizationIds = supportingMaterialFilterValues(input.organizationIds, input.organizationId)
  if (
    billIds === undefined &&
    amendmentIds === undefined &&
    eventIds === undefined &&
    organizationIds === undefined &&
    input.sessionIds === undefined
  ) {
    return undefined
  }
  const linkPredicates =
    and(
      billIds === undefined ? undefined : inArray(supportingMaterialLinks.billId, billIds),
      amendmentIds === undefined ? undefined : inArray(supportingMaterialLinks.amendmentId, amendmentIds),
      eventIds === undefined ? undefined : inArray(supportingMaterialLinks.eventId, eventIds),
      organizationIds === undefined ? undefined : inArray(supportingMaterialLinks.organizationId, organizationIds)
    ) ?? sql`true`
  if (input.sessionIds === undefined) {
    return sql`exists (
      select 1
      from ${supportingMaterialLinks}
      where ${supportingMaterialLinks.materialId} = ${supportingMaterials.id}
        and ${linkPredicates}
    )`
  }
  return sql`exists (
    select 1
    from ${supportingMaterialLinks}
    inner join ${bills} on ${bills.id} = ${supportingMaterialLinks.billId}
    where ${supportingMaterialLinks.materialId} = ${supportingMaterials.id}
      and ${linkPredicates}
      and ${inArray(bills.sessionId, input.sessionIds)}
  )`
}

function supportingMaterialLexicalScope(input: SupportingMaterialSearchInput): SQL | undefined {
  return and(
    supportingMaterialFilter(
      input.jurisdictionIds,
      input.jurisdictionId,
      (value) => eq(supportingMaterials.jurisdictionId, value),
      (values) => inArray(supportingMaterials.jurisdictionId, values)
    ),
    supportingMaterialFilter(
      input.classifications,
      input.classification,
      (value) => eq(supportingMaterials.classification, value),
      (values) => inArray(supportingMaterials.classification, values)
    ),
    supportingMaterialLexicalLinkFilter(input),
    input.documentFrom === undefined ? undefined : gte(supportingMaterials.documentDate, input.documentFrom),
    input.documentTo === undefined ? undefined : lte(supportingMaterials.documentDate, input.documentTo),
    input.updatedFrom === undefined ? undefined : gte(supportingMaterials.updatedAt, input.updatedFrom),
    input.updatedTo === undefined ? undefined : lte(supportingMaterials.updatedAt, input.updatedTo),
    input.updatedToExclusive === undefined
      ? undefined
      : sql`${supportingMaterials.updatedAt} < ${input.updatedToExclusive}`,
    input.processingStatus === undefined ? undefined : eq(supportingMaterials.processingStatus, input.processingStatus)
  )
}

interface LexicalSupportingMaterialCandidate {
  [key: string]: unknown
  candidateWindowCapped: boolean
  id: string
  lexicalScore: number
  matchedSectionId: null | string
  sectionId: string
  sectionScore: null | number
  snippet: null | string
  titleScore: null | number
}

/**
 * Retrieve bounded title and section candidate windows before material-level
 * ranking. Section headlines are calculated only after their rank window is
 * selected, because headline generation scans text and is too expensive for
 * common-term matches. Both candidate sources must complete: a timeout is
 * surfaced as dependency_unavailable instead of returning title or section
 * matches selectively.
 */
export function buildLexicalSupportingMaterialCandidateQuery(
  input: SupportingMaterialSearchInput,
  query: string,
  limit: number,
  offset: number
): SQL {
  const searchQuery = sql`websearch_to_tsquery('english', ${query})`
  const titleRank = sql<number>`ts_rank_cd(to_tsvector('english', ${supportingMaterials.title}), ${searchQuery})`
  const titleMatches = sql`to_tsvector('english', ${supportingMaterials.title}) @@ ${searchQuery}`
  const sectionRank = sql<number>`ts_rank_cd(${supportingMaterialSections.searchVector}, ${searchQuery})`
  const sectionMatches = sql`${supportingMaterialSections.searchVector} @@ ${searchQuery}`
  const scope = supportingMaterialLexicalScope(input)
  const titleScope = scope ?? sql`true`
  const sectionMaterialJoin =
    scope === undefined
      ? sql``
      : sql`inner join ${supportingMaterials} on ${supportingMaterials.id} = ${supportingMaterialSections.materialId}`
  const sectionScope = scope ?? sql`true`
  const candidateLimit = lexicalSupportingMaterialCandidateLimit(limit, offset)
  const candidateProbeLimit = candidateLimit + 1
  return sql`
    with title_candidate_probe as (
      select
        ${supportingMaterials.id} as material_id,
        ${titleRank} as title_score
      from ${supportingMaterials}
      where ${titleMatches} and ${titleScope}
      order by ${titleRank} desc, ${supportingMaterials.id} asc
      limit ${candidateProbeLimit}
    ),
    title_candidates as (
      select material_id, title_score
      from title_candidate_probe
      order by title_score desc, material_id asc
      limit ${candidateLimit}
    ),
    section_candidate_probe as (
      select
        ${supportingMaterialSections.materialId} as material_id,
        ${supportingMaterialSections.id} as section_id
      from ${supportingMaterialSections}
      ${sectionMaterialJoin}
      where ${sectionMatches} and ${sectionScope}
      limit ${candidateProbeLimit}
    ),
    candidate_materials as (
      select material_id from title_candidates
      union
      select material_id from section_candidate_probe
    ),
    section_ranked_candidates as (
      select
        ${supportingMaterialSections.materialId} as material_id,
        ${supportingMaterialSections.id} as section_id,
        ${sectionRank} as section_score,
        row_number() over (
          partition by ${supportingMaterialSections.materialId}
          order by ${sectionRank} desc, ${supportingMaterialSections.id} asc
        ) as section_rank
      from ${supportingMaterialSections}
      inner join candidate_materials on candidate_materials.material_id = ${supportingMaterialSections.materialId}
      where ${sectionMatches}
    ),
    section_candidates as (
      select
        section_ranked_candidates.material_id,
        section_ranked_candidates.section_id,
        section_ranked_candidates.section_score,
        ts_headline(
          'english',
          ${supportingMaterialSections.text},
          ${searchQuery},
          'MaxFragments=2, MaxWords=35, MinWords=10'
        ) as section_snippet
      from section_ranked_candidates
      inner join ${supportingMaterialSections}
        on ${supportingMaterialSections.id} = section_ranked_candidates.section_id
      where section_ranked_candidates.section_rank = 1
    ),
    candidate_scores as (
      select
        material_id,
        title_score,
        null::text as section_id,
        null::real as section_score,
        null::text as section_snippet
      from title_candidates
      union all
      select
        material_id,
        null::real as title_score,
        section_id,
        section_score,
        section_snippet
      from section_candidates
    ),
    ranked_candidates as (
      select
        material_id,
        max(title_score) as title_score,
        max(section_score) as section_score,
        greatest(coalesce(max(title_score), 0), coalesce(max(section_score), 0)) as lexical_score,
        (array_agg(section_id order by section_score desc nulls last, section_id asc) filter (where section_id is not null))[1] as matched_section_id,
        (array_agg(section_snippet order by section_score desc nulls last, section_id asc) filter (where section_id is not null))[1] as section_snippet
      from candidate_scores
      group by material_id
    ),
    candidate_window as (
      select
        (
          exists (select 1 from title_candidate_probe offset ${candidateLimit})
          or exists (select 1 from section_candidate_probe offset ${candidateLimit})
        ) as capped
    )
    select
      ranked_candidates.material_id as id,
      ranked_candidates.lexical_score as lexical_score,
      ranked_candidates.title_score as title_score,
      ranked_candidates.section_score as section_score,
      ranked_candidates.matched_section_id as matched_section_id,
      coalesce(ranked_candidates.matched_section_id, fallback_section.id) as section_id,
      ranked_candidates.section_snippet as snippet,
      candidate_window.capped as candidate_window_capped
    from ranked_candidates
    inner join lateral (
      select ${supportingMaterialSections.id}
      from ${supportingMaterialSections}
      where ${supportingMaterialSections.materialId} = ranked_candidates.material_id
      order by ${supportingMaterialSections.ordinal} asc, ${supportingMaterialSections.id} asc
      limit 1
    ) as fallback_section on true
    cross join candidate_window
    order by ranked_candidates.lexical_score desc, ranked_candidates.material_id asc
    limit ${limit + 1}
    offset ${offset}
  `
}

function materialLinkIds(
  links: readonly (typeof supportingMaterialLinks.$inferSelect)[],
  key: "amendmentId" | "billId" | "eventId" | "organizationId"
): string[] {
  return [...new Set(links.flatMap((link) => (link[key] === null ? [] : [link[key]])))].sort()
}

function isPostgresStatementTimeout(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "57014"
}

export interface ChangeSearchInput {
  billId?: string
  changeType?: CanonicalChangeType
  cursor?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  personId?: string
  recordId?: string
  recordType?: string
  observedFrom?: Date
  observedTo?: Date
}

export interface JurisdictionSearchInput {
  classification?: string
  cursor?: string
  isActive?: boolean
  limit?: number
  query?: string
}

export interface SessionSearchInput {
  cursor?: string
  from?: string
  isActive?: boolean
  jurisdictionId?: string
  limit?: number
  to?: string
}

export interface BillBrowseInput {
  classification?: string[]
  cursor?: string
  identifier?: string
  introducedFrom?: string
  introducedTo?: string
  jurisdictionId?: string
  limit?: number
  organizationId?: string
  sessionId?: string
  sort?: "identifier-asc" | "introduced-desc" | "latest-action-desc" | "updated-desc"
  status?: string[]
  subject?: string[]
  sponsorPersonId?: string
  updatedFrom?: Date
}

export function buildBillBrowseQuery(
  database: LegislationDatabase,
  input: BillBrowseInput,
  limit: number,
  offset: number
) {
  const browseBill = alias(bills, "browse_bill")
  const billActionPredicate = eq(billActions.billId, browseBill.id)
  const latestActions = database
    .select({
      latestActionAt: sql<Date | null>`max(coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp))`
        .mapWith(billActions.actionAt)
        .as("latest_action_at")
    })
    .from(billActions)
    .where(billActionPredicate)
    .as("latest_actions")

  return database
    .select({
      bill: browseBill,
      latestActionAt: latestActions.latestActionAt
    })
    .from(browseBill)
    .leftJoinLateral(latestActions, sql`true`)
    .where(
      and(
        input.jurisdictionId === undefined ? undefined : eq(browseBill.jurisdictionId, input.jurisdictionId),
        input.sessionId === undefined ? undefined : eq(browseBill.sessionId, input.sessionId),
        input.identifier === undefined ? undefined : sql`${browseBill.identifier} ilike ${`${input.identifier}%`}`,
        input.classification === undefined ? undefined : arrayOverlaps(browseBill.classification, input.classification),
        input.status === undefined ? undefined : inArray(browseBill.status, input.status),
        input.subject === undefined ? undefined : arrayContains(browseBill.subjects, input.subject),
        input.sponsorPersonId === undefined
          ? undefined
          : sql`exists (select 1 from ${billSponsors} where ${billSponsors.billId} = ${browseBill.id} and ${billSponsors.personId} = ${input.sponsorPersonId})`,
        input.organizationId === undefined
          ? undefined
          : sql`exists (select 1 from ${billOrganizations} where ${billOrganizations.billId} = ${browseBill.id} and ${billOrganizations.organizationId} = ${input.organizationId})`,
        input.introducedFrom === undefined ? undefined : gte(browseBill.introducedAt, input.introducedFrom),
        input.introducedTo === undefined ? undefined : lte(browseBill.introducedAt, input.introducedTo),
        input.updatedFrom === undefined ? undefined : gte(browseBill.updatedAt, input.updatedFrom)
      )
    )
    .orderBy(...billBrowseOrder(input.sort, latestActions.latestActionAt, browseBill))
    .limit(limit + 1)
    .offset(offset)
}

export interface DocumentSectionLookup {
  cursor?: string
  documentId: string
  limit?: number
}

export interface SupportingMaterialSectionLookup {
  materialId: string
  sectionId: string
}

type FusedBillResult = BillSearchCandidate

export function billSearchExecution(embeddingModel: string, rerankModel: string, rerankedCandidateCount: number) {
  if (!Number.isSafeInteger(rerankedCandidateCount) || rerankedCandidateCount < 0) {
    throw new Error("Reranked candidate count must be a nonnegative safe integer")
  }
  return rerankedCandidateCount === 0
    ? { isReranked: false, models: [{ model: embeddingModel, purpose: "embedding" as const }] }
    : {
        isReranked: true,
        models: [
          { model: embeddingModel, purpose: "embedding" as const },
          { model: rerankModel, purpose: "reranking" as const }
        ]
      }
}

function comparisonClassification(before: string | undefined, after: string | undefined) {
  if (before === undefined) {
    return "added"
  }
  if (after === undefined) {
    return "removed"
  }
  return before === after ? "unchanged" : "changed"
}

function encodeOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url")
}

function decodeOffset(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("offset" in parsed) ||
      typeof parsed.offset !== "number" ||
      !Number.isSafeInteger(parsed.offset) ||
      parsed.offset < 0
    ) {
      throw new Error("invalid")
    }
    return parsed.offset
  } catch {
    throw new LegislationError("invalid_request", "Invalid pagination cursor")
  }
}

function encodeChangeCursor(value: { id: string; observedAt: Date }): string {
  return Buffer.from(JSON.stringify({ id: value.id, observedAt: value.observedAt.toISOString() })).toString("base64url")
}

function decodeChangeCursor(cursor: string | undefined): { id?: string; observedAt?: Date } {
  if (cursor === undefined) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      typeof parsed.id !== "string" ||
      !("observedAt" in parsed) ||
      typeof parsed.observedAt !== "string"
    ) {
      throw new Error("invalid")
    }
    const observedAt = new Date(parsed.observedAt)
    if (Number.isNaN(observedAt.getTime())) {
      throw new Error("invalid")
    }
    return { id: parsed.id, observedAt }
  } catch {
    throw new LegislationError("invalid_request", "Invalid change pagination cursor")
  }
}

export class LegislationQueryService {
  readonly #database: LegislationDatabase
  readonly #retrievalClient?: RetrievalModelClient

  constructor(database: LegislationDatabase, retrievalClient?: RetrievalModelClient) {
    this.#database = database
    this.#retrievalClient = retrievalClient
  }

  async searchChanges(input: ChangeSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const cursor = decodeChangeCursor(input.cursor)
    const rows = await findChangeEvents(this.#database, {
      before: cursor.observedAt,
      beforeId: cursor.id,
      changeType: input.changeType,
      jurisdictionId: input.jurisdictionId,
      limit: limit + 1,
      organizationId: input.organizationId,
      personId: input.personId,
      recordId: input.billId ?? input.recordId,
      recordType: input.billId === undefined ? input.recordType : "bill",
      observedFrom: input.observedFrom,
      observedTo: input.observedTo
    })
    const truncated = rows.length > limit
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
      items,
      nextCursor: truncated && last !== undefined ? encodeChangeCursor(last) : undefined,
      truncated
    }
  }

  async listJurisdictions(input: JurisdictionSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(jurisdictions)
      .where(
        and(
          input.classification === undefined ? undefined : eq(jurisdictions.classification, input.classification),
          input.query === undefined ? undefined : sql`${jurisdictions.name} ilike ${`${input.query}%`}`
        )
      )
      .orderBy(asc(jurisdictions.name), asc(jurisdictions.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(rows.length, "jurisdictions")
    }
  }

  async getJurisdiction(id: string) {
    const rows = await this.#database.select().from(jurisdictions).where(eq(jurisdictions.id, id)).limit(1)
    if (rows[0] === undefined) {
      throw new LegislationError("not_found", `Jurisdiction ${id} was not found`)
    }
    return rows[0]
  }

  async listSessions(input: SessionSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(legislativeSessions)
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(legislativeSessions.jurisdictionId, input.jurisdictionId),
          input.isActive === undefined ? undefined : eq(legislativeSessions.isActive, input.isActive),
          input.from === undefined ? undefined : gte(legislativeSessions.endDate, input.from),
          input.to === undefined ? undefined : lte(legislativeSessions.startDate, input.to)
        )
      )
      .orderBy(asc(legislativeSessions.startDate), asc(legislativeSessions.name), asc(legislativeSessions.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(rows.length, "sessions")
    }
  }

  async getSession(id: string) {
    const rows = await this.#database.select().from(legislativeSessions).where(eq(legislativeSessions.id, id)).limit(1)
    if (rows[0] === undefined) {
      throw new LegislationError("not_found", `Session ${id} was not found`)
    }
    return rows[0]
  }

  async browseBills(input: BillBrowseInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await buildBillBrowseQuery(this.#database, input, limit, offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map(({ bill, latestActionAt }) => ({ ...bill, latestActionAt })),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(rows.length, "bills")
    }
  }

  async getDocument(lookup: EntityLookup) {
    const document = await this.#database.select().from(billDocuments).where(eq(billDocuments.id, lookup.id)).limit(1)
    if (document[0] === undefined) {
      throw new LegislationError("not_found", `Document ${lookup.id} was not found`)
    }
    const sections = await this.getDocumentSections({
      cursor: lookup.cursor,
      documentId: lookup.id,
      limit: lookup.limit
    })
    return { document: document[0], sections }
  }

  async getDocumentSections(input: DocumentSectionLookup) {
    const limit = Math.min(Math.max(input.limit ?? SECTION_LIMIT, 1), SECTION_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, input.documentId))
      .orderBy(asc(documentSections.ordinal))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(rows.length, "document sections")
    }
  }

  async getDocumentSection(input: Readonly<{ documentId: string; sectionId: string }>) {
    const rows = await this.#database
      .select({ document: billDocuments, section: documentSections })
      .from(documentSections)
      .innerJoin(billDocuments, eq(documentSections.documentId, billDocuments.id))
      .where(and(eq(documentSections.documentId, input.documentId), eq(documentSections.id, input.sectionId)))
      .limit(1)
    if (rows[0] === undefined) {
      throw new LegislationError("not_found", `Document section ${input.sectionId} was not found`)
    }
    return rows[0]
  }

  async getPerson(lookup: EntityLookup) {
    const person = await this.#database.select().from(people).where(eq(people.id, lookup.id)).limit(1)
    if (person[0] === undefined) {
      throw new LegislationError("not_found", `Person ${lookup.id} was not found`)
    }
    const [terms, memberships, sponsoredBills] = await Promise.all([
      this.#database
        .select()
        .from(legislativeTerms)
        .where(eq(legislativeTerms.personId, lookup.id))
        .orderBy(asc(legislativeTerms.startDate), asc(legislativeTerms.id)),
      this.getMemberships({ limit: lookup.limit, personId: lookup.id }),
      this.getSponsoredBills({ ...lookup, id: lookup.id })
    ])
    return { memberships, person: person[0], sponsoredBills, terms }
  }

  async searchPeople(input: PersonSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .selectDistinct({ person: people })
      .from(people)
      .leftJoin(organizationMemberships, eq(organizationMemberships.personId, people.id))
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(people.jurisdictionId, input.jurisdictionId),
          input.organizationId === undefined
            ? undefined
            : eq(organizationMemberships.organizationId, input.organizationId),
          input.isActive === undefined ? undefined : eq(people.isActive, input.isActive),
          input.query === undefined
            ? undefined
            : sql`(${people.name} ilike ${`%${input.query}%`} or ${people.givenName} ilike ${`%${input.query}%`} or ${people.familyName} ilike ${`%${input.query}%`} or ${people.party} ilike ${`%${input.query}%`})`
        )
      )
      .orderBy(asc(people.name), asc(people.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map((row) => row.person)
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(items.length, "people")
    }
  }

  async getOrganization(lookup: EntityLookup) {
    const organization = await this.#database
      .select()
      .from(organizations)
      .where(eq(organizations.id, lookup.id))
      .limit(1)
    if (organization[0] === undefined) {
      throw new LegislationError("not_found", `Organization ${lookup.id} was not found`)
    }
    const [children, memberships, billActivity] = await Promise.all([
      this.#database
        .select()
        .from(organizations)
        .where(eq(organizations.parentOrganizationId, lookup.id))
        .orderBy(asc(organizations.name)),
      this.getMemberships({ limit: lookup.limit, organizationId: lookup.id }),
      this.getCommitteeBillActivity(lookup)
    ])
    return { billActivity, children, memberships, organization: organization[0] }
  }

  async searchOrganizations(input: OrganizationSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(organizations)
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(organizations.jurisdictionId, input.jurisdictionId),
          input.parentOrganizationId === undefined
            ? undefined
            : eq(organizations.parentOrganizationId, input.parentOrganizationId),
          input.classification === undefined ? undefined : eq(organizations.classification, input.classification),
          input.isActive === undefined ? undefined : eq(organizations.isActive, input.isActive),
          input.query === undefined ? undefined : sql`${organizations.name} ilike ${`%${input.query}%`}`
        )
      )
      .orderBy(asc(organizations.name), asc(organizations.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    const items = rows.slice(0, limit)
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(items.length, "organizations")
    }
  }

  async getMemberships(input: MembershipLookup) {
    if (input.organizationId === undefined && input.personId === undefined) {
      throw new LegislationError("invalid_request", "Select a person or organization for membership lookup")
    }
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select({ membership: organizationMemberships, organization: organizations, person: people })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .innerJoin(people, eq(organizationMemberships.personId, people.id))
      .where(
        and(
          input.organizationId === undefined
            ? undefined
            : eq(organizationMemberships.organizationId, input.organizationId),
          input.personId === undefined ? undefined : eq(organizationMemberships.personId, input.personId)
        )
      )
      .orderBy(asc(organizations.name), asc(people.name), asc(organizationMemberships.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getSponsoredBills(lookup: EntityLookup) {
    const limit = Math.min(Math.max(lookup.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(lookup.cursor)
    const rows = await this.#database
      .select({ bill: bills, sponsorship: billSponsors })
      .from(billSponsors)
      .innerJoin(bills, eq(billSponsors.billId, bills.id))
      .where(eq(billSponsors.personId, lookup.id))
      .orderBy(asc(bills.introducedAt), asc(bills.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getCommitteeBillActivity(lookup: EntityLookup) {
    const limit = Math.min(Math.max(lookup.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(lookup.cursor)
    const linkedRows = await this.#database
      .select({ bill: bills })
      .from(billOrganizations)
      .innerJoin(bills, eq(billOrganizations.billId, bills.id))
      .where(eq(billOrganizations.organizationId, lookup.id))
      .orderBy(asc(bills.introducedAt), asc(bills.id))
      .limit(limit + 1)
      .offset(offset)
    const organization =
      linkedRows.length > 0
        ? undefined
        : await this.#database
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, lookup.id))
            .limit(1)
    const fallbackRows =
      organization?.[0] === undefined
        ? []
        : await this.#database
            .select({ bill: bills })
            .from(bills)
            .where(sql`${organization[0].name} = any(${bills.committees})`)
            .orderBy(asc(bills.introducedAt), asc(bills.id))
            .limit(limit + 1)
            .offset(offset)
    const rows = linkedRows.length > 0 ? linkedRows : fallbackRows
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.bill),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: linkedRows.length > 0 ? [] : ["Unlinked records use bounded committee-name matching"]
    }
  }

  async searchEvents(input: EventSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select({ event: legislativeEvents })
      .from(legislativeEvents)
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(legislativeEvents.jurisdictionId, input.jurisdictionId),
          input.organizationId === undefined
            ? undefined
            : sql`exists (select 1 from ${eventParticipants} where ${eventParticipants.eventId} = ${legislativeEvents.id} and ${eventParticipants.organizationId} = ${input.organizationId})`,
          input.classification === undefined
            ? undefined
            : inArray(legislativeEvents.classification, input.classification),
          input.status === undefined ? undefined : inArray(legislativeEvents.status, input.status),
          input.from === undefined ? undefined : gte(legislativeEvents.startAt, input.from),
          input.to === undefined ? undefined : lte(legislativeEvents.startAt, input.to),
          eq(legislativeEvents.isDeleted, false)
        )
      )
      .orderBy(...eventSearchOrder(input.sort))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map((row) => row.event)
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(items.length, "events")
    }
  }

  async getEvent(lookup: EntityLookup) {
    const event = await this.#database
      .select()
      .from(legislativeEvents)
      .where(eq(legislativeEvents.id, lookup.id))
      .limit(1)
    if (event[0] === undefined) {
      throw new LegislationError("not_found", `Event ${lookup.id} was not found`)
    }
    const [agendaItems, documents, participants, relatedBills, outcomes] = await Promise.all([
      this.#database
        .select()
        .from(eventAgendaItems)
        .where(eq(eventAgendaItems.eventId, lookup.id))
        .orderBy(asc(eventAgendaItems.ordinal)),
      this.#database
        .select()
        .from(eventDocuments)
        .where(eq(eventDocuments.eventId, lookup.id))
        .orderBy(asc(eventDocuments.id)),
      this.#database
        .select({ participant: eventParticipants, organization: organizations, person: people })
        .from(eventParticipants)
        .leftJoin(organizations, eq(eventParticipants.organizationId, organizations.id))
        .leftJoin(people, eq(eventParticipants.personId, people.id))
        .where(eq(eventParticipants.eventId, lookup.id))
        .orderBy(asc(eventParticipants.id)),
      this.#database
        .select({ bill: bills, classification: eventBills.classification })
        .from(eventBills)
        .innerJoin(bills, eq(eventBills.billId, bills.id))
        .where(eq(eventBills.eventId, lookup.id))
        .orderBy(asc(bills.id)),
      this.#database
        .select()
        .from(eventOutcomeLinks)
        .where(eq(eventOutcomeLinks.eventId, lookup.id))
        .orderBy(asc(eventOutcomeLinks.createdAt), asc(eventOutcomeLinks.id))
    ])
    return { agendaItems, documents, event: event[0], outcomes, participants, relatedBills }
  }

  async getBillSchedule(input: EventSearchInput & { billId: string }) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select({ event: legislativeEvents })
      .from(eventBills)
      .innerJoin(legislativeEvents, eq(eventBills.eventId, legislativeEvents.id))
      .where(
        and(
          eq(eventBills.billId, input.billId),
          input.from === undefined ? undefined : gte(legislativeEvents.startAt, input.from),
          input.to === undefined ? undefined : lte(legislativeEvents.startAt, input.to)
        )
      )
      .orderBy(asc(legislativeEvents.startAt), asc(legislativeEvents.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    return {
      items: rows.slice(0, limit).map((row) => row.event),
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated
    }
  }

  async getCalendar(input: EventSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .select()
      .from(calendarEntries)
      .where(
        and(
          input.jurisdictionId === undefined ? undefined : eq(calendarEntries.jurisdictionId, input.jurisdictionId),
          input.organizationId === undefined ? undefined : eq(calendarEntries.organizationId, input.organizationId),
          input.from === undefined ? undefined : gte(calendarEntries.startAt, input.from),
          input.to === undefined ? undefined : lte(calendarEntries.startAt, input.to)
        )
      )
      .orderBy(asc(calendarEntries.startAt), asc(calendarEntries.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    const items = rows.slice(0, limit)
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(items.length, "calendar entries")
    }
  }

  async searchVotes(input: VoteSearchInput) {
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .selectDistinct({ vote: votes })
      .from(votes)
      .leftJoin(votePositions, eq(votePositions.voteId, votes.id))
      .where(
        and(
          input.billId === undefined ? undefined : eq(votes.billId, input.billId),
          input.organizationId === undefined ? undefined : eq(votes.organizationId, input.organizationId),
          input.personId === undefined ? undefined : eq(votePositions.personId, input.personId),
          input.from === undefined ? undefined : gte(votes.heldAt, input.from)
        )
      )
      .orderBy(asc(votes.heldAt), asc(votes.id))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    const items = rows.slice(0, limit).map((row) => row.vote)
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(items.length, "votes")
    }
  }

  async getVote(lookup: EntityLookup) {
    const vote = await this.#database.select().from(votes).where(eq(votes.id, lookup.id)).limit(1)
    if (vote[0] === undefined) {
      throw new LegislationError("not_found", `Vote ${lookup.id} was not found`)
    }
    const positions = await this.#database
      .select({ person: people, position: votePositions })
      .from(votePositions)
      .leftJoin(people, eq(votePositions.personId, people.id))
      .where(eq(votePositions.voteId, lookup.id))
      .orderBy(asc(votePositions.option), asc(votePositions.sourceIdentity))
    return { positions, vote: vote[0] }
  }

  async getBillVotes(input: Readonly<{ billId: string; cursor?: string; limit?: number }>) {
    const offset = decodeOffset(input.cursor)
    const page = await this.searchVotes({
      billId: input.billId,
      cursor: input.cursor,
      limit: Math.min(input.limit ?? 25, 25)
    })
    const items = []
    let responseBytes = 0
    for (const vote of page.items) {
      const detail = await this.getVote({ id: vote.id })
      const itemBytes = Buffer.byteLength(JSON.stringify(detail), "utf8")
      if (items.length > 0 && responseBytes + itemBytes > DETAIL_RESPONSE_TARGET_BYTES) {
        break
      }
      items.push(detail)
      responseBytes += itemBytes
    }
    const truncated = page.truncated || items.length < page.items.length
    return {
      ...page,
      items,
      nextCursor: truncated ? encodeOffset(offset + items.length) : undefined,
      truncated
    }
  }

  async searchAmendments(input: AmendmentSearchInput): Promise<AmendmentSearchResult> {
    const mode = input.mode ?? "lexical"
    if (input.query !== undefined && mode !== "lexical") {
      const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
      const offset = decodeOffset(input.cursor)
      const candidateLimit = embeddingQueryRouteFor("search_amendments").candidateLimit
      const embedding = await this.#embedQuery("search_amendments", input.query)
      const [structuredRows, documentRows] = await Promise.all([
        semanticStructuredAmendmentSearch(this.#database, {
          billId: input.billId,
          embedding,
          jurisdictionId: input.jurisdictionId,
          limit: candidateLimit,
          sponsorPersonId: input.sponsorPersonId
        }),
        input.sponsorPersonId === undefined
          ? semanticDocumentAmendmentSearch(this.#database, {
              billId: input.billId,
              embedding,
              jurisdictionId: input.jurisdictionId,
              limit: candidateLimit
            })
          : Promise.resolve([])
      ])
      const structured = structuredRows.map(({ amendment, distance }) => ({
        ...amendment,
        distance,
        id: amendment.id,
        recordType: "structured" as const
      }))
      const documents = [
        ...new Map(
          documentRows.map(({ distance, document, jurisdictionId }) => {
            const amendment = projectDocumentBackedAmendment(document, jurisdictionId)
            return [amendment.id, { ...amendment, distance }] as const
          })
        ).values()
      ]
      const semantic = reciprocalRankFusionWithScores<AmendmentSearchItem>(structured, documents, candidateLimit)
      const ranked =
        mode === "semantic"
          ? semantic
          : reciprocalRankFusionWithScores(
              (
                await this.searchAmendments({
                  ...input,
                  cursor: undefined,
                  limit: candidateLimit,
                  mode: "lexical"
                })
              ).items.map((item) => ({ ...item, id: item.id })),
              semantic,
              candidateLimit
            )
      const page = paginateSearchRows(ranked, limit, offset, ranked.length === candidateLimit)
      const includesDocumentBackedAmendment = page.items.some((item) => item.recordType === "document")
      return {
        ...page,
        warnings: [
          ...coverageWarnings(page.items.length, "amendments"),
          ...(includesDocumentBackedAmendment
            ? [
                "Some state amendments are document-backed records. They include the published file metadata but do not claim normalized sponsors, actions, or votes."
              ]
            : [])
        ]
      }
    }
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const candidateLimit = offset + limit + 1
    const [structuredRows, documentRows] = await Promise.all([
      this.#database
        .select()
        .from(amendments)
        .where(
          and(
            input.billId === undefined ? undefined : eq(amendments.billId, input.billId),
            input.jurisdictionId === undefined ? undefined : eq(amendments.jurisdictionId, input.jurisdictionId),
            input.sponsorPersonId === undefined ? undefined : eq(amendments.sponsorPersonId, input.sponsorPersonId),
            input.query === undefined
              ? undefined
              : sql`(${amendments.printedIdentifier} ilike ${`%${input.query}%`} or ${amendments.purpose} ilike ${`%${input.query}%`} or ${amendments.description} ilike ${`%${input.query}%`})`
          )
        )
        .orderBy(asc(amendments.submittedDate), asc(amendments.id))
        .limit(candidateLimit),
      input.sponsorPersonId === undefined
        ? this.#database
            .select({ document: billDocuments, jurisdictionId: bills.jurisdictionId })
            .from(billDocuments)
            .innerJoin(bills, eq(billDocuments.billId, bills.id))
            .where(
              and(
                eq(billDocuments.classification, "amendment"),
                input.billId === undefined ? undefined : eq(billDocuments.billId, input.billId),
                input.jurisdictionId === undefined ? undefined : eq(bills.jurisdictionId, input.jurisdictionId),
                input.query === undefined ? undefined : sql`${billDocuments.title} ilike ${`%${input.query}%`}`
              )
            )
            .orderBy(asc(billDocuments.documentDate), asc(billDocuments.id))
            .limit(candidateLimit)
        : Promise.resolve([])
    ])
    const merged = [
      ...structuredRows.map((amendment) => ({ ...amendment, recordType: "structured" as const })),
      ...documentRows.map(({ document, jurisdictionId }) => projectDocumentBackedAmendment(document, jurisdictionId))
    ].sort((left, right) => amendmentSortKey(left).localeCompare(amendmentSortKey(right)))
    const items = merged.slice(offset, offset + limit)
    const truncated = merged.length > offset + limit
    const includesDocumentBackedAmendment = items.some((item) => item.recordType === "document")
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: [
        ...coverageWarnings(items.length, "amendments"),
        ...(includesDocumentBackedAmendment
          ? [
              "Some state amendments are document-backed records. They include the published file metadata but do not claim normalized sponsors, actions, or votes."
            ]
          : [])
      ]
    }
  }

  async getAmendment(lookup: EntityLookup) {
    const documentId = documentIdFromAmendmentId(lookup.id)
    if (documentId !== undefined) {
      const rows = await this.#database
        .select({ document: billDocuments, jurisdictionId: bills.jurisdictionId })
        .from(billDocuments)
        .innerJoin(bills, eq(billDocuments.billId, bills.id))
        .where(and(eq(billDocuments.id, documentId), eq(billDocuments.classification, "amendment")))
        .limit(1)
      const row = rows[0]
      if (row === undefined) {
        throw new LegislationError("not_found", `Amendment ${lookup.id} was not found`)
      }
      return {
        actions: [],
        amendment: projectDocumentBackedAmendment(row.document, row.jurisdictionId),
        document: row.document,
        materials: [],
        votes: []
      }
    }
    const amendment = await this.#database.select().from(amendments).where(eq(amendments.id, lookup.id)).limit(1)
    if (amendment[0] === undefined) {
      throw new LegislationError("not_found", `Amendment ${lookup.id} was not found`)
    }
    const [actions, materials, amendmentVotes] = await Promise.all([
      this.#database
        .select()
        .from(amendmentActions)
        .where(eq(amendmentActions.amendmentId, lookup.id))
        .orderBy(asc(amendmentActions.ordinal)),
      this.#database
        .select({ link: supportingMaterialLinks, material: supportingMaterialSummaryColumns })
        .from(supportingMaterialLinks)
        .innerJoin(supportingMaterials, eq(supportingMaterialLinks.materialId, supportingMaterials.id))
        .where(eq(supportingMaterialLinks.amendmentId, lookup.id))
        .orderBy(asc(supportingMaterials.documentDate), asc(supportingMaterials.id)),
      this.#database.select().from(votes).where(eq(votes.amendmentId, lookup.id)).orderBy(asc(votes.heldAt))
    ])
    return {
      actions,
      amendment: { ...amendment[0], recordType: "structured" as const },
      materials,
      votes: amendmentVotes
    }
  }

  async searchSupportingMaterials(input: SupportingMaterialSearchInput): Promise<SupportingMaterialSearchResult> {
    const mode = input.mode ?? "lexical"
    if (input.query !== undefined && mode === "lexical") {
      return await this.#searchLexicalSupportingMaterials(input)
    }
    if (input.query !== undefined && mode !== "lexical") {
      const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
      const offset = decodeOffset(input.cursor)
      const candidateLimit = embeddingQueryRouteFor("search_supporting_materials").candidateLimit
      const queryEmbedding = await this.#embedQueryWithModel("search_supporting_materials", input.query)
      const semanticRows = await semanticSupportingMaterialSearch(this.#database, {
        amendmentIds: supportingMaterialFilterValues(input.amendmentIds, input.amendmentId),
        billIds: supportingMaterialFilterValues(input.billIds, input.billId),
        classifications: supportingMaterialFilterValues(input.classifications, input.classification),
        documentFrom: input.documentFrom,
        documentTo: input.documentTo,
        embedding: queryEmbedding.embedding,
        eventIds: supportingMaterialFilterValues(input.eventIds, input.eventId),
        jurisdictionIds: supportingMaterialFilterValues(input.jurisdictionIds, input.jurisdictionId),
        limit: candidateLimit,
        organizationIds: supportingMaterialFilterValues(input.organizationIds, input.organizationId),
        processingStatus: input.processingStatus,
        sessionIds: input.sessionIds,
        updatedFrom: input.updatedFrom,
        updatedTo: input.updatedTo,
        updatedToExclusive: input.updatedToExclusive
      })
      const semantic: SupportingMaterialRanked[] = [
        ...new Map(
          semanticRows.map(
            ({ distance, material, sectionId }) =>
              [material.id, { ...material, distance, id: material.id, semanticSectionId: sectionId }] as const
          )
        ).values()
      ]
      const ranked: SupportingMaterialRanked[] =
        mode === "semantic"
          ? semantic
          : reciprocalRankFusionWithScores(
              (
                await this.searchSupportingMaterials({
                  ...input,
                  cursor: undefined,
                  limit: candidateLimit,
                  mode: "lexical"
                })
              ).items.map(
                ({
                  amendmentIds: _amendmentIds,
                  billIds: _billIds,
                  meetingIds: _meetingIds,
                  organizationIds: _organizationIds,
                  ...item
                }) => ({ ...item, id: item.id })
              ),
              semantic,
              candidateLimit
            )
      const semanticById = new Map(semantic.map((item) => [item.id, item]))
      const page = paginateCappedSearchRows(
        ranked.map((item) => {
          const semanticItem = semanticById.get(item.id)
          return semanticItem === undefined
            ? item
            : {
                ...item,
                distance: semanticItem.distance,
                semanticSectionId: semanticItem.semanticSectionId
              }
        }),
        limit,
        offset,
        ranked.length === candidateLimit
      )
      const items = await this.#withSupportingMaterialLinkIds(page.items)
      return {
        ...page,
        items,
        search: { isReranked: false, models: [{ model: queryEmbedding.model, purpose: "embedding" as const }] },
        warnings: coverageWarnings(items.length, "supporting materials")
      }
    }
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    const rows = await this.#database
      .selectDistinct({ material: supportingMaterialSummaryColumns })
      .from(supportingMaterials)
      .leftJoin(supportingMaterialLinks, eq(supportingMaterialLinks.materialId, supportingMaterials.id))
      .where(
        and(
          supportingMaterialFilter(
            input.jurisdictionIds,
            input.jurisdictionId,
            (value) => eq(supportingMaterials.jurisdictionId, value),
            (values) => inArray(supportingMaterials.jurisdictionId, values)
          ),
          supportingMaterialFilter(
            input.classifications,
            input.classification,
            (value) => eq(supportingMaterials.classification, value),
            (values) => inArray(supportingMaterials.classification, values)
          ),
          supportingMaterialFilter(
            input.billIds,
            input.billId,
            (value) => eq(supportingMaterialLinks.billId, value),
            (values) => inArray(supportingMaterialLinks.billId, values)
          ),
          supportingMaterialFilter(
            input.amendmentIds,
            input.amendmentId,
            (value) => eq(supportingMaterialLinks.amendmentId, value),
            (values) => inArray(supportingMaterialLinks.amendmentId, values)
          ),
          supportingMaterialFilter(
            input.eventIds,
            input.eventId,
            (value) => eq(supportingMaterialLinks.eventId, value),
            (values) => inArray(supportingMaterialLinks.eventId, values)
          ),
          supportingMaterialFilter(
            input.organizationIds,
            input.organizationId,
            (value) => eq(supportingMaterialLinks.organizationId, value),
            (values) => inArray(supportingMaterialLinks.organizationId, values)
          ),
          input.documentFrom === undefined ? undefined : gte(supportingMaterials.documentDate, input.documentFrom),
          input.documentTo === undefined ? undefined : lte(supportingMaterials.documentDate, input.documentTo),
          input.processingStatus === undefined
            ? undefined
            : eq(supportingMaterials.processingStatus, input.processingStatus),
          input.query === undefined
            ? undefined
            : sql`(to_tsvector('english', ${supportingMaterials.title}) @@ websearch_to_tsquery('english', ${input.query}) or exists (
                select 1 from ${supportingMaterialSections}
                where ${supportingMaterialSections.materialId} = ${supportingMaterials.id}
                  and ${supportingMaterialSections.searchVector} @@ websearch_to_tsquery('english', ${input.query})
              ))`
        )
      )
      .orderBy(...supportingMaterialOrder(input.sort))
      .limit(limit + 1)
      .offset(offset)
    const truncated = rows.length > limit
    const items = await this.#withSupportingMaterialLinkIds(rows.slice(0, limit).map((row) => row.material))
    return {
      items,
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      truncated,
      warnings: coverageWarnings(items.length, "supporting materials")
    }
  }

  async #searchLexicalSupportingMaterials(
    input: SupportingMaterialSearchInput
  ): Promise<SupportingMaterialSearchResult> {
    const query = input.query
    if (query === undefined) {
      throw new LegislationError("invalid_request", "Supporting material lexical search requires query")
    }
    const limit = Math.min(Math.max(input.limit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const offset = decodeOffset(input.cursor)
    let rows: LexicalSupportingMaterialCandidate[]
    try {
      rows = await this.#database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select set_config('statement_timeout', ${String(LEXICAL_SUPPORTING_MATERIAL_SEARCH_TIMEOUT_MS)}, true)`
        )
        const candidateRows = await transaction.execute<LexicalSupportingMaterialCandidate>(
          buildLexicalSupportingMaterialCandidateQuery(input, query, limit, offset)
        )
        return candidateRows.rows
      })
    } catch (error) {
      if (isPostgresStatementTimeout(error)) {
        throw new LegislationError(
          "dependency_unavailable",
          "Supporting material lexical search is temporarily unavailable"
        )
      }
      throw error
    }
    const pageCandidates = rows.slice(0, limit)
    const candidateIds = pageCandidates.map((row) => row.id)
    const candidateSectionIds = pageCandidates.map((row) => row.sectionId)
    const summariesAndSections =
      candidateIds.length === 0
        ? []
        : await this.#database
            .select({ material: supportingMaterialSummaryColumns, section: supportingMaterialSections })
            .from(supportingMaterials)
            .innerJoin(supportingMaterialSections, eq(supportingMaterialSections.materialId, supportingMaterials.id))
            .where(
              and(
                inArray(supportingMaterials.id, candidateIds),
                inArray(supportingMaterialSections.id, candidateSectionIds)
              )
            )
    const summariesAndSectionsByMaterialId = new Map(
      summariesAndSections.map(({ material, section }) => [material.id, { material, section }])
    )
    const rankedMaterials = pageCandidates.flatMap((row) => {
      const value = summariesAndSectionsByMaterialId.get(row.id)
      if (value === undefined) {
        return []
      }
      const matchedFields = [
        ...(row.titleScore === null ? [] : (["title"] as const)),
        ...(row.sectionScore === null ? [] : (["sectionText"] as const))
      ]
      return [
        {
          ...value.material,
          id: value.material.id,
          lexicalEvidence: {
            lexicalScore: row.lexicalScore,
            matchedFields,
            section: value.section,
            snippet: row.matchedSectionId === value.section.id ? row.snippet : null
          },
          score: row.lexicalScore
        }
      ]
    })
    const pageState = lexicalSupportingMaterialPageState(
      offset,
      limit,
      rows.length,
      rows[0]?.candidateWindowCapped === true
    )
    const items = await this.#withSupportingMaterialLinkIds(rankedMaterials)
    return {
      items,
      nextCursor: pageState.nextCursor,
      truncated: pageState.truncated,
      warnings: coverageWarnings(items.length, "supporting materials")
    }
  }

  /**
   * The public search endpoint needs more than collection rows: each result
   * must identify the persisted section that supports the match and preserve
   * the ranking values actually returned by PostgreSQL/vector search. The MCP
   * collection method above remains summary-oriented.
   */
  async searchSupportingMaterialHits(input: SupportingMaterialSearchInput): Promise<SupportingMaterialSearchHitResult> {
    if (input.query === undefined) {
      throw new LegislationError("invalid_request", "Supporting material search requires query")
    }
    const mode = input.mode ?? "lexical"
    const page = await this.searchSupportingMaterials(input)
    const semanticSectionIds = [
      ...new Set(
        page.items.flatMap((material) => (material.semanticSectionId === undefined ? [] : [material.semanticSectionId]))
      )
    ]
    const semanticSections =
      semanticSectionIds.length === 0
        ? []
        : await this.#database
            .select()
            .from(supportingMaterialSections)
            .where(inArray(supportingMaterialSections.id, semanticSectionIds))
    const semanticSectionsById = new Map(semanticSections.map((section) => [section.id, section]))
    const items = page.items.map((material) => this.#supportingMaterialSearchHit(material, mode, semanticSectionsById))
    return {
      ...page,
      items,
      search: page.search ?? { isReranked: false, models: [] }
    }
  }

  #supportingMaterialSearchHit(
    material: SupportingMaterialRead,
    mode: "hybrid" | "lexical" | "semantic",
    semanticSectionsById: ReadonlyMap<string, typeof supportingMaterialSections.$inferSelect>
  ): SupportingMaterialSearchHitRead {
    if (mode === "lexical") {
      const lexical = material.lexicalEvidence
      if (lexical === undefined) {
        throw new LegislationError(
          "unprocessable",
          "Supporting material lexical search did not preserve match evidence"
        )
      }
      return {
        ...material,
        lexicalScore: lexical.lexicalScore,
        matchedFields: lexical.matchedFields,
        rerankScore: null,
        score: lexical.lexicalScore,
        section: lexical.section,
        semanticScore: null,
        snippet: lexical.snippet
      }
    }
    const semanticScore = material.distance === undefined ? null : 1 - material.distance
    if ((mode === "semantic" || mode === "hybrid") && semanticScore !== null && !Number.isFinite(semanticScore)) {
      throw new LegislationError("unprocessable", "Supporting material semantic score is not finite")
    }
    if (mode === "semantic" && semanticScore === null) {
      throw new LegislationError("unprocessable", "Supporting material semantic search did not preserve a vector score")
    }

    const lexicalEvidence = material.lexicalEvidence
    const lexical =
      lexicalEvidence === undefined
        ? { matchedFields: [] as const, score: null, section: undefined, sectionId: undefined, snippet: null }
        : {
            matchedFields: lexicalEvidence.matchedFields,
            score: lexicalEvidence.lexicalScore,
            section: lexicalEvidence.section,
            sectionId: lexicalEvidence.section.id,
            snippet: lexicalEvidence.snippet
          }
    const preferredSectionId = material.semanticSectionId ?? lexical.sectionId
    let section =
      lexical.section !== undefined && preferredSectionId === lexical.section.id ? lexical.section : undefined
    if (section === undefined && preferredSectionId !== undefined) {
      section = semanticSectionsById.get(preferredSectionId)
    }
    if (section === undefined || section.materialId !== material.id) {
      throw new LegislationError("unprocessable", "Supporting material search result has no persisted matching section")
    }
    const matchedFields = [
      ...new Set([...lexical.matchedFields, ...(semanticScore === null ? [] : (["semantic"] as const))])
    ]
    if (matchedFields.length === 0) {
      throw new LegislationError("unprocessable", "Supporting material search did not preserve a match explanation")
    }
    const score = supportingMaterialSearchScore(mode, lexical.score, semanticScore, material.score)
    if (score === null || score === undefined || !Number.isFinite(score)) {
      throw new LegislationError("unprocessable", "Supporting material search did not preserve a ranking score")
    }
    return {
      ...material,
      lexicalScore: lexical.score,
      matchedFields,
      rerankScore: null,
      score,
      section,
      semanticScore,
      snippet: section.id === lexical.sectionId ? lexical.snippet : null
    }
  }

  async getSupportingMaterial(lookup: EntityLookup) {
    const material = await this.#database
      .select(supportingMaterialSummaryColumns)
      .from(supportingMaterials)
      .where(eq(supportingMaterials.id, lookup.id))
      .limit(1)
    if (material[0] === undefined) {
      throw new LegislationError("not_found", `Supporting material ${lookup.id} was not found`)
    }
    const limit = Math.min(Math.max(lookup.limit ?? SECTION_LIMIT, 1), SECTION_LIMIT)
    const offset = decodeOffset(lookup.cursor)
    const [links, sections, aggregate] = await Promise.all([
      this.#database.select().from(supportingMaterialLinks).where(eq(supportingMaterialLinks.materialId, lookup.id)),
      this.#database
        .select()
        .from(supportingMaterialSections)
        .where(eq(supportingMaterialSections.materialId, lookup.id))
        .orderBy(asc(supportingMaterialSections.ordinal))
        .limit(limit + 1)
        .offset(offset),
      this.#database
        .select({
          sectionCount: sql<number>`count(*)::integer`,
          textCharacterCount: sql<number>`coalesce(sum(length(${supportingMaterialSections.text})), 0)::integer`
        })
        .from(supportingMaterialSections)
        .where(eq(supportingMaterialSections.materialId, lookup.id))
    ])
    const truncated = sections.length > limit
    const materialRead = this.#supportingMaterialRead(material[0], links)
    return {
      links,
      material: {
        ...materialRead,
        byteSize: null,
        pageCount: null,
        sectionCount: aggregate[0]?.sectionCount ?? 0,
        storedUrl: null,
        textCharacterCount: aggregate[0]?.textCharacterCount ?? 0
      },
      nextCursor: truncated ? encodeOffset(offset + limit) : undefined,
      sections: sections.slice(0, limit),
      truncated
    }
  }

  async #withSupportingMaterialLinkIds(
    materials: readonly SupportingMaterialRanked[]
  ): Promise<SupportingMaterialRead[]> {
    if (materials.length === 0) {
      return []
    }
    const links = await this.#database
      .select()
      .from(supportingMaterialLinks)
      .where(
        inArray(
          supportingMaterialLinks.materialId,
          materials.map((material) => material.id)
        )
      )
      .orderBy(
        asc(supportingMaterialLinks.materialId),
        asc(supportingMaterialLinks.billId),
        asc(supportingMaterialLinks.amendmentId),
        asc(supportingMaterialLinks.eventId),
        asc(supportingMaterialLinks.organizationId)
      )
    const byMaterial = new Map<string, (typeof links)[number][]>()
    for (const link of links) {
      const current = byMaterial.get(link.materialId)
      if (current === undefined) {
        byMaterial.set(link.materialId, [link])
      } else {
        current.push(link)
      }
    }
    return materials.map((material) => this.#supportingMaterialRead(material, byMaterial.get(material.id) ?? []))
  }

  #supportingMaterialRead(
    material: SupportingMaterialRanked,
    links: readonly (typeof supportingMaterialLinks.$inferSelect)[]
  ): SupportingMaterialRead {
    return {
      ...material,
      amendmentIds: materialLinkIds(links, "amendmentId"),
      billIds: materialLinkIds(links, "billId"),
      meetingIds: materialLinkIds(links, "eventId"),
      organizationIds: materialLinkIds(links, "organizationId")
    }
  }

  async getSupportingMaterialSection(input: SupportingMaterialSectionLookup) {
    const rows = await this.#database
      .select({ material: supportingMaterials, section: supportingMaterialSections })
      .from(supportingMaterialSections)
      .innerJoin(supportingMaterials, eq(supportingMaterialSections.materialId, supportingMaterials.id))
      .where(
        and(
          eq(supportingMaterialSections.materialId, input.materialId),
          eq(supportingMaterialSections.id, input.sectionId)
        )
      )
      .limit(1)
    if (rows[0] === undefined) {
      throw new LegislationError("not_found", `Supporting material section ${input.sectionId} was not found`)
    }
    return rows[0]
  }

  async searchBills(input: SearchInput & { mode?: "hybrid" | "lexical" | "semantic" }): Promise<BillSearchResultPage> {
    const mode = input.mode ?? "hybrid"
    if (mode === "lexical") {
      return { ...(await lexicalBillSearch(this.#database, input)), search: { isReranked: false, models: [] } }
    }
    const queryEmbedding = await this.#embedQueryWithModel("search_bills", input.query)
    const { limit, offset } = validateSearchInput(input)
    const candidateLimit = embeddingQueryRouteFor("search_bills").candidateLimit
    const rerankModel = embeddingQueryRouteFor("search_bills").rerank?.model
    if (rerankModel === undefined) {
      throw new LegislationError("dependency_unavailable", "Bill search reranking is not configured")
    }
    if (mode === "semantic") {
      const semantic = await semanticBillSearch(this.#database, {
        ...input,
        cursor: undefined,
        embedding: queryEmbedding.embedding,
        limit: candidateLimit
      })
      const reranked = await this.#rerank(
        "search_bills",
        input.query,
        semantic.items,
        (item) => item.id,
        (item) => [item.title, item.summary].filter((value): value is string => value !== null).join("\n")
      )
      return {
        ...paginateCappedSearchRows(
          reranked.map((item) => ({ ...item, score: item.rerankScore })),
          limit,
          offset,
          semantic.truncated
        ),
        search: billSearchExecution(queryEmbedding.model, rerankModel, semantic.items.length)
      }
    }
    const [lexical, semantic] = await Promise.all([
      lexicalBillSearch(this.#database, { ...input, cursor: undefined, limit: candidateLimit }),
      semanticBillSearch(this.#database, {
        ...input,
        cursor: undefined,
        embedding: queryEmbedding.embedding,
        limit: candidateLimit
      })
    ])
    const lexicalItems: FusedBillResult[] = lexical.items
    const semanticItems: FusedBillResult[] = semantic.items
    const lexicalById = new Map(lexicalItems.map((item) => [item.id, item]))
    const semanticById = new Map(semanticItems.map((item) => [item.id, item]))
    const candidates = reciprocalRankFusionWithScores(lexicalItems, semanticItems, candidateLimit).map((candidate) => {
      const lexicalCandidate = lexicalById.get(candidate.id)
      const semanticCandidate = semanticById.get(candidate.id)
      return {
        ...candidate,
        lexicalScore: lexicalCandidate?.lexicalScore ?? null,
        matchedFields: [
          ...new Set([...(lexicalCandidate?.matchedFields ?? []), ...(semanticCandidate?.matchedFields ?? [])])
        ],
        semanticScore: semanticCandidate?.semanticScore ?? null,
        snippet: lexicalCandidate?.snippet ?? semanticCandidate?.snippet ?? null
      }
    })
    const reranked = await this.#rerank(
      "search_bills",
      input.query,
      candidates,
      (item) => item.id,
      (item) => [item.title, item.summary].filter((value): value is string => value !== null).join("\n")
    )
    return {
      ...paginateCappedSearchRows(
        reranked.map((item) => ({ ...item, score: item.rerankScore })),
        limit,
        offset,
        lexical.truncated || semantic.truncated
      ),
      search: billSearchExecution(queryEmbedding.model, rerankModel, candidates.length)
    }
  }

  async getBill(lookup: BillLookup) {
    const childLimit = Math.min(Math.max(lookup.childLimit ?? CHILD_LIMIT, 1), CHILD_LIMIT)
    const childOffset = decodeOffset(lookup.childCursor)
    const bill = await this.#database.select().from(bills).where(eq(bills.id, lookup.id)).limit(1)
    if (bill[0] === undefined) {
      throw new LegislationError("not_found", `Bill ${lookup.id} was not found`)
    }
    const [
      actions,
      sponsors,
      billVotes,
      documents,
      relations,
      linkedOrganizations,
      structuredBillAmendments,
      documentBillAmendments
    ] = await Promise.all([
      this.#database
        .select()
        .from(billActions)
        .where(eq(billActions.billId, lookup.id))
        .orderBy(asc(billActions.ordinal))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select({
          classification: billSponsors.classification,
          isPrimary: billSponsors.isPrimary,
          name: billSponsors.name,
          personId: people.id
        })
        .from(billSponsors)
        .leftJoin(people, eq(billSponsors.personId, people.id))
        .where(eq(billSponsors.billId, lookup.id))
        .orderBy(asc(billSponsors.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(votes)
        .where(eq(votes.billId, lookup.id))
        .orderBy(asc(votes.heldAt), asc(votes.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(billDocuments)
        .where(eq(billDocuments.billId, lookup.id))
        .orderBy(asc(billDocuments.documentDate), asc(billDocuments.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(billRelations)
        .where(eq(billRelations.billId, lookup.id))
        .orderBy(asc(billRelations.relatedBillId))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select({ link: billOrganizations, organization: organizations })
        .from(billOrganizations)
        .innerJoin(organizations, eq(billOrganizations.organizationId, organizations.id))
        .where(eq(billOrganizations.billId, lookup.id))
        .orderBy(asc(organizations.name), asc(organizations.id))
        .limit(childLimit + 1)
        .offset(childOffset),
      this.#database
        .select()
        .from(amendments)
        .where(eq(amendments.billId, lookup.id))
        .orderBy(asc(amendments.submittedDate), asc(amendments.id))
        .limit(childOffset + childLimit + 1),
      this.#database
        .select()
        .from(billDocuments)
        .where(and(eq(billDocuments.billId, lookup.id), eq(billDocuments.classification, "amendment")))
        .orderBy(asc(billDocuments.documentDate), asc(billDocuments.id))
        .limit(childOffset + childLimit + 1)
    ])
    const billAmendments = [
      ...structuredBillAmendments.map((amendment) => ({ ...amendment, recordType: "structured" as const })),
      ...documentBillAmendments.map((document) => projectDocumentBackedAmendment(document, bill[0].jurisdictionId))
    ]
      .sort((left, right) => amendmentSortKey(left).localeCompare(amendmentSortKey(right)))
      .slice(childOffset, childOffset + childLimit + 1)
    const truncated = [actions, sponsors, billVotes, documents, relations, linkedOrganizations, billAmendments].some(
      (collection) => collection.length > childLimit
    )
    return {
      actions: actions.slice(0, childLimit),
      amendments: billAmendments.slice(0, childLimit),
      bill: bill[0],
      documents: documents.slice(0, childLimit),
      nextChildCursor: truncated ? encodeOffset(childOffset + childLimit) : undefined,
      organizations: linkedOrganizations.slice(0, childLimit),
      relations: relations.slice(0, childLimit),
      sponsors: sponsors.slice(0, childLimit),
      truncated,
      votes: billVotes.slice(0, childLimit),
      warnings: truncated ? ["One or more child collections have another page"] : []
    }
  }

  async getBillTimeline(lookup: BillLookup) {
    const detail = await this.getBill(lookup)
    const events = [
      ...detail.actions.map((action) => ({
        date: action.actionAt?.toISOString() ?? action.actionDate,
        description: action.description,
        id: action.id,
        sourceUrl: action.sourceUrl,
        type: "action" as const
      })),
      ...detail.votes.map((vote) => ({
        date: vote.heldAt?.toISOString(),
        description: vote.motion,
        id: vote.id,
        result: vote.result,
        sourceUrl: vote.sourceUrl,
        type: "vote" as const
      }))
    ].sort(
      (left, right) => (left.date ?? "9999").localeCompare(right.date ?? "9999") || left.id.localeCompare(right.id)
    )
    return {
      billId: lookup.id,
      events,
      nextChildCursor: detail.nextChildCursor,
      truncated: detail.truncated,
      warnings: detail.warnings
    }
  }

  async searchBillText(input: PassageSearchInput & { mode?: "hybrid" | "lexical" | "semantic" }) {
    const mode = input.mode ?? "lexical"
    if (mode === "lexical") {
      return lexicalPassageSearch(this.#database, input)
    }
    const embedding = await this.#embedQuery("search_bill_text", input.query)
    const { limit, offset } = validateSearchInput(input)
    const candidateLimit = embeddingQueryRouteFor("search_bill_text").candidateLimit
    if (mode === "semantic") {
      const semantic = await semanticPassageSearch(this.#database, {
        ...input,
        cursor: undefined,
        embedding,
        limit: candidateLimit
      })
      const reranked = await this.#rerank(
        "search_bill_text",
        input.query,
        semantic.items,
        (item) => item.sectionId,
        (item) => item.rerankText
      )
      return paginateSearchRows(
        reranked.map(({ rerankText: _rerankText, ...item }) => item),
        limit,
        offset,
        semantic.truncated
      )
    }
    const [lexical, semantic] = await Promise.all([
      lexicalPassageSearch(this.#database, { ...input, cursor: undefined, limit: candidateLimit }),
      semanticPassageSearch(this.#database, { ...input, cursor: undefined, embedding, limit: candidateLimit })
    ])
    const lexicalCandidates = lexical.items.map(({ rank: _rank, ...item }) => ({ ...item, id: item.sectionId }))
    const semanticCandidates = semantic.items.map(({ distance: _distance, ...item }) => ({
      ...item,
      id: item.sectionId
    }))
    const candidates = reciprocalRankFusionWithScores(lexicalCandidates, semanticCandidates, candidateLimit).map(
      ({ id: _id, ...item }) => item
    )
    const reranked = await this.#rerank(
      "search_bill_text",
      input.query,
      candidates,
      (item) => item.sectionId,
      (item) => item.rerankText
    )
    return paginateSearchRows(
      reranked.map(({ rerankText: _rerankText, ...item }) => item),
      limit,
      offset,
      lexical.truncated || semantic.truncated
    )
  }

  async getBillText(input: BillLookup & { cursor?: string; documentId?: string; versionCode?: string }) {
    const offset = decodeOffset(input.cursor)
    const documents = await this.#database
      .select()
      .from(billDocuments)
      .where(
        and(
          eq(billDocuments.billId, input.id),
          input.documentId === undefined ? undefined : eq(billDocuments.id, input.documentId),
          input.versionCode === undefined ? undefined : eq(billDocuments.versionCode, input.versionCode)
        )
      )
      .orderBy(asc(billDocuments.documentDate), asc(billDocuments.id))
      .limit(2)
    if (documents[0] === undefined) {
      throw new LegislationError("not_found", "No matching bill text document was found")
    }
    if (documents.length > 1 && input.documentId === undefined && input.versionCode === undefined) {
      throw new LegislationError("invalid_request", "Select a document or version when multiple texts are available")
    }
    if (documents[0].processingStatus !== "processed") {
      throw new LegislationError(
        documents[0].processingStatus === "failed" ? "dependency_unavailable" : "conflict",
        `Document text is ${documents[0].processingStatus}`
      )
    }
    const sections = await this.#database
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, documents[0].id))
      .orderBy(asc(documentSections.ordinal))
      .limit(SECTION_LIMIT + 1)
      .offset(offset)
    const truncated = sections.length > SECTION_LIMIT
    return {
      billId: input.id,
      document: documents[0],
      nextCursor: truncated ? encodeOffset(offset + SECTION_LIMIT) : undefined,
      sections: sections.slice(0, SECTION_LIMIT),
      truncated
    }
  }

  async compareBillVersions(input: VersionComparisonInput) {
    const documents = await this.#database
      .select()
      .from(billDocuments)
      .where(and(eq(billDocuments.billId, input.billId), inArray(billDocuments.id, input.documentIds)))
    if (documents.length !== 2) {
      throw new LegislationError("invalid_request", "Both selected documents must belong to the requested bill")
    }
    const sections = await this.#database
      .select()
      .from(documentSections)
      .where(inArray(documentSections.documentId, input.documentIds))
      .orderBy(asc(documentSections.ordinal))
    const byDocument = new Map(
      input.documentIds.map((documentId) => [
        documentId,
        sections.filter((section) => section.documentId === documentId)
      ])
    )
    const left = byDocument.get(input.documentIds[0]) ?? []
    const right = byDocument.get(input.documentIds[1]) ?? []
    const sectionKey = (section: (typeof sections)[number]) => section.sectionIdentifier ?? `ordinal:${section.ordinal}`
    const leftByKey = new Map(left.map((section) => [sectionKey(section), section]))
    const rightByKey = new Map(right.map((section) => [sectionKey(section), section]))
    const keys = [...left.map(sectionKey), ...right.map(sectionKey).filter((key) => !leftByKey.has(key))]
    const maximum = Math.min(keys.length, CHILD_LIMIT)
    const changes = Array.from({ length: maximum }, (_value, index) => {
      const key = keys[index]
      const before = key === undefined ? undefined : leftByKey.get(key)
      const after = key === undefined ? undefined : rightByKey.get(key)
      return {
        after: after?.text,
        before: before?.text,
        classification: comparisonClassification(before?.text, after?.text),
        identifier: after?.sectionIdentifier ?? before?.sectionIdentifier,
        ordinal: index
      }
    })
    return { billId: input.billId, changes, documents, truncated: keys.length > CHILD_LIMIT }
  }

  async findRelatedBills(input: BillLookup & { includeSemantic?: boolean; limit?: number }) {
    const limit = Math.min(input.limit ?? 20, CHILD_LIMIT)
    const [outgoing, incoming] = await Promise.all([
      this.#database
        .select({ classification: billRelations.classification, bill: bills })
        .from(billRelations)
        .innerJoin(bills, eq(billRelations.relatedBillId, bills.id))
        .where(eq(billRelations.billId, input.id))
        .orderBy(asc(bills.id))
        .limit(limit + 1),
      this.#database
        .select({ classification: billRelations.classification, bill: bills })
        .from(billRelations)
        .innerJoin(bills, eq(billRelations.billId, bills.id))
        .where(eq(billRelations.relatedBillId, input.id))
        .orderBy(asc(bills.id))
        .limit(limit + 1)
    ])
    const relations = [
      ...new Map([...outgoing, ...incoming].map((relation) => [relation.bill.id, relation])).values()
    ].toSorted((left, right) => left.bill.id.localeCompare(right.bill.id))
    const explicit = relations.slice(0, limit).map((relation) => ({ ...relation, method: "explicit" as const }))
    if (input.includeSemantic !== true || explicit.length >= limit) {
      return { items: explicit, truncated: relations.length > limit }
    }
    const route = embeddingRouteFor("bill")
    const source = await this.#database
      .select({ embedding: billEmbeddings.embedding })
      .from(billEmbeddings)
      .where(
        and(
          eq(billEmbeddings.billId, input.id),
          eq(billEmbeddings.model, route.model),
          eq(billEmbeddings.inputContract, route.embeddingInputContract)
        )
      )
      .limit(1)
    if (source[0]?.embedding === null || source[0]?.embedding === undefined) {
      return { items: explicit, truncated: relations.length > limit, warnings: ["Source bill has no embedding"] }
    }
    const semantic = await semanticBillSearch(this.#database, {
      embedding: source[0].embedding,
      limit: Math.min(limit + explicit.length + 1, 100)
    })
    const seen = new Set([input.id, ...explicit.map((item) => item.bill.id)])
    const semanticItems = semantic.items
      .filter(
        (bill): bill is typeof bill & { semanticScore: number } => !seen.has(bill.id) && bill.semanticScore !== null
      )
      .slice(0, limit - explicit.length)
      .map((bill) => ({
        bill,
        classification: "semantic",
        method: "semantic" as const,
        similarity: bill.semanticScore
      }))
    return { items: [...explicit, ...semanticItems], truncated: relations.length > limit || semantic.truncated }
  }

  async #embedQuery(tool: EmbeddingSearchTool, query: string): Promise<number[]> {
    return (await this.#embedQueryWithModel(tool, query)).embedding
  }

  async #embedQueryWithModel(
    tool: EmbeddingSearchTool,
    query: string
  ): Promise<{ embedding: number[]; model: string }> {
    if (this.#retrievalClient === undefined) {
      throw new LegislationError("dependency_unavailable", "Semantic search is not configured")
    }
    const route = embeddingQueryRouteFor(tool)
    const response = await this.#retrievalClient.embed(route.queryEmbeddingProduct, [query])
    const embedding = response.embeddings[0]
    if (embedding === undefined) {
      throw new LegislationError("dependency_unavailable", "Embedding provider returned no query vector")
    }
    return { embedding, model: response.model }
  }

  async #rerank<Item>(
    tool: EmbeddingSearchTool,
    query: string,
    items: Item[],
    identify: (item: Item) => string,
    text: (item: Item) => string
  ): Promise<Array<Item & { rerankScore: number }>> {
    if (items.length === 0) {
      return []
    }
    if (this.#retrievalClient === undefined) {
      throw new LegislationError("dependency_unavailable", "Reranking is not configured")
    }
    const reranked = await this.#retrievalClient.rerank(
      tool,
      query,
      items.map((item) => ({ id: identify(item), text: text(item) }))
    )
    const byId = new Map(items.map((item) => [identify(item), item]))
    return reranked.flatMap((candidate) => {
      const item = byId.get(candidate.id)
      return item === undefined ? [] : [{ ...item, rerankScore: candidate.relevanceScore }]
    })
  }
}
