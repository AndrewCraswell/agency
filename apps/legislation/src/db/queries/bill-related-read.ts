import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm"
import { projectBillSummaryRead, type BillSummaryRead } from "../../api/canonical-read.js"
import { LegislationError } from "../../legislation/errors.js"
import { embeddingRouteFor } from "../../models/embedding-routing.js"
import { semanticBillSearch } from "../../search/search.js"
import type { LegislationDatabase } from "../database.js"
import { billActions, billEmbeddings, billRelations, bills } from "../schema/schema.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const SEMANTIC_CANDIDATE_LIMIT = 25

export const BILL_RELATION_CLASSIFICATIONS = [
  "companion",
  "replacement",
  "replaced-by",
  "prior-session",
  "related",
  "other"
] as const

export type BillRelationClassification = (typeof BILL_RELATION_CLASSIFICATIONS)[number]
export type BillRelatedMode = "all" | "explicit" | "similar"
export type BillRelationDirection = "incoming" | "outgoing"

export interface BillRelatedListInput {
  billId: string
  classifications?: readonly BillRelationClassification[]
  cursor?: string
  limit?: number
  mode: BillRelatedMode
}

export interface BillRelationRead {
  canonicalFactsComplete: boolean
  classification: string
  direction: BillRelationDirection
  provenanceComplete: boolean
  sourceIsOfficial: boolean | null
  sourceProvider: string | null
  sourceRetrievedAt: Date | null
  sourceUpdatedAt: Date | null
  sourceUrl: string | null
}

export interface BillRelatedHitRead {
  bill: BillSummaryRead
  relationship: BillRelationRead | null
  similarityScore: number | null
}

export interface BillRelatedPage {
  items: BillRelatedHitRead[]
  nextCursor?: string
  truncated: boolean
}

interface BillRelationCursorScope {
  billId: string
  classifications: BillRelationClassification[]
  mode: BillRelatedMode
}

export interface BillRelationCursor {
  billId: string
  classification: string | null
  direction: BillRelationDirection | null
  kind: "explicit" | "similar"
  scope: BillRelationCursorScope
  similarityScore: number | null
  version: 1
}

interface ExplicitRow {
  bill: typeof bills.$inferSelect
  direction: BillRelationDirection
  latestActionAt: Date | null
  relation: typeof billRelations.$inferSelect
}

interface RelatedCandidate {
  bill: BillSummaryRead
  classification: string | null
  direction: BillRelationDirection | null
  kind: "explicit" | "similar"
  relationship: BillRelationRead | null
  similarityScore: number | null
}

type SemanticPage = Awaited<ReturnType<typeof semanticBillSearch>>

export function buildBillExistenceQuery(database: LegislationDatabase, billId: string) {
  return database
    .select({ id: bills.id, jurisdictionId: bills.jurisdictionId, sessionId: bills.sessionId })
    .from(bills)
    .where(eq(bills.id, requiredBillId(billId)))
    .limit(1)
}

export async function assertBillRelatedParentExists(database: LegislationDatabase, billId: string): Promise<void> {
  if ((await buildBillExistenceQuery(database, billId))[0] === undefined) {
    throw new LegislationError("not_found", `Bill ${billId} was not found`)
  }
}

export function buildBillRelatedExplicitQuery(
  database: LegislationDatabase,
  input: Pick<BillRelatedListInput, "billId" | "classifications"> & {
    cursor?: BillRelationCursor
    limit?: number
  }
) {
  const id = requiredBillId(input.billId)
  const relatedBills = bills
  const latestActionAt = sql<Date | null>`(
    select max(coalesce(${billActions.actionAt}, ${billActions.actionDate}::timestamp))
    from ${billActions}
    where ${billActions.billId} = ${relatedBills.id}
  )`.mapWith(billActions.actionAt)
  const classificationFilter =
    input.classifications === undefined || input.classifications.length === 0
      ? undefined
      : inArray(billRelations.classification, input.classifications)
  const candidateLimit = input.limit ?? MAX_LIMIT + 1
  const cursorFilter = (direction: BillRelationDirection) => {
    const cursor = input.cursor
    if (
      cursor === undefined ||
      cursor.kind !== "explicit" ||
      cursor.classification === null ||
      cursor.direction === null
    ) {
      return undefined
    }
    const afterDirection =
      direction === "outgoing" && cursor.direction === "incoming"
        ? and(eq(relatedBills.id, cursor.billId), eq(billRelations.classification, cursor.classification))
        : undefined
    return or(
      gt(relatedBills.id, cursor.billId),
      and(eq(relatedBills.id, cursor.billId), gt(billRelations.classification, cursor.classification)),
      afterDirection
    )
  }
  return {
    incoming: database
      .select({
        bill: relatedBills,
        direction: sql<BillRelationDirection>`'incoming'`.as("direction"),
        latestActionAt,
        relation: billRelations
      })
      .from(billRelations)
      .innerJoin(relatedBills, eq(billRelations.billId, relatedBills.id))
      .where(and(eq(billRelations.relatedBillId, id), classificationFilter, cursorFilter("incoming")))
      .orderBy(asc(relatedBills.id), asc(billRelations.classification))
      .limit(candidateLimit),
    outgoing: database
      .select({
        bill: relatedBills,
        direction: sql<BillRelationDirection>`'outgoing'`.as("direction"),
        latestActionAt,
        relation: billRelations
      })
      .from(billRelations)
      .innerJoin(relatedBills, eq(billRelations.relatedBillId, relatedBills.id))
      .where(and(eq(billRelations.billId, id), classificationFilter, cursorFilter("outgoing")))
      .orderBy(asc(relatedBills.id), asc(billRelations.classification))
      .limit(candidateLimit)
  }
}

/**
 * Returns every explicit relation target for semantic de-duplication. This is
 * intentionally unpaged: semantic results must not repeat a relation that was
 * outside the current explicit page window.
 */
export function buildBillRelatedExplicitIdQueries(database: LegislationDatabase, billId: string) {
  const id = requiredBillId(billId)
  return {
    incoming: database
      .select({ billId: billRelations.billId })
      .from(billRelations)
      .where(eq(billRelations.relatedBillId, id)),
    outgoing: database
      .select({ billId: billRelations.relatedBillId })
      .from(billRelations)
      .where(eq(billRelations.billId, id))
  }
}

export function excludeExplicitRelatedBills<T extends { id: string }>(
  candidates: readonly T[],
  sourceBillId: string,
  explicitRelationBillIds: ReadonlySet<string>
): T[] {
  return candidates.filter((candidate) => candidate.id !== sourceBillId && !explicitRelationBillIds.has(candidate.id))
}

export async function listBillRelatedBills(
  database: LegislationDatabase,
  input: BillRelatedListInput
): Promise<BillRelatedPage> {
  const limit = parseLimit(input.limit)
  const classifications = normalizeClassifications(input.classifications)
  const scope: BillRelationCursorScope = {
    billId: requiredBillId(input.billId),
    classifications,
    mode: input.mode
  }
  const cursor = decodeCursor(input.cursor, scope)
  const parent = await buildBillExistenceQuery(database, input.billId)
  const parentBill = parent[0]
  if (parentBill === undefined) {
    throw new LegislationError("not_found", `Bill ${input.billId} was not found`)
  }

  let explicitRows: ExplicitRow[] = []
  if (input.mode !== "similar" && cursor?.kind !== "similar") {
    const explicitQueries = buildBillRelatedExplicitQuery(database, {
      billId: input.billId,
      classifications,
      cursor: cursor?.kind === "explicit" ? cursor : undefined,
      limit: limit + 1
    })
    const [incoming, outgoing] = await Promise.all([explicitQueries.incoming, explicitQueries.outgoing])
    explicitRows = [...incoming, ...outgoing]
  }
  const explicitRelationBillIds = new Set<string>()
  if (input.mode === "all") {
    const explicitIdQueries = buildBillRelatedExplicitIdQueries(database, input.billId)
    const [incoming, outgoing] = await Promise.all([explicitIdQueries.incoming, explicitIdQueries.outgoing])
    for (const row of [...incoming, ...outgoing]) {
      explicitRelationBillIds.add(row.billId)
    }
  }
  const semantic: SemanticPage =
    input.mode === "explicit"
      ? { items: [], truncated: false }
      : await semanticRelatedBills(database, input.billId, parentBill.jurisdictionId, parentBill.sessionId)
  const candidates: RelatedCandidate[] = [
    ...(input.mode === "similar" ? [] : explicitRows.map((row) => explicitCandidate(row))),
    ...excludeExplicitRelatedBills(semantic.items, input.billId, explicitRelationBillIds)
      .filter((candidate) => candidate.semanticScore !== null)
      .map((candidate) => semanticCandidate(candidate))
  ].toSorted(compareCandidates)
  const visible = cursor === undefined ? candidates : candidates.filter((candidate) => isAfter(candidate, cursor))
  const pageItems = visible.slice(0, limit).map(({ bill, relationship, similarityScore }) => ({
    bill,
    relationship,
    similarityScore
  }))
  const hasNext = visible.length > limit
  const last = visible.at(Math.min(limit, visible.length) - 1)
  return {
    items: pageItems,
    nextCursor:
      hasNext && last !== undefined
        ? encodeCursor({
            billId: last.bill.id,
            classification: last.classification,
            direction: last.direction,
            kind: last.kind,
            scope,
            similarityScore: last.similarityScore,
            version: 1
          })
        : undefined,
    truncated: hasNext
  }
}

async function semanticRelatedBills(
  database: LegislationDatabase,
  billId: string,
  jurisdictionId: string,
  sessionId: string
): Promise<SemanticPage> {
  const route = embeddingRouteFor("bill")
  let source: { embedding: number[] }[]
  try {
    source = await database
      .select({ embedding: billEmbeddings.embedding })
      .from(billEmbeddings)
      .where(
        and(
          eq(billEmbeddings.billId, billId),
          eq(billEmbeddings.model, route.model),
          eq(billEmbeddings.inputContract, route.embeddingInputContract)
        )
      )
      .limit(1)
  } catch {
    throw semanticUnavailable("The source bill embedding is unavailable")
  }
  const embedding = source[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length !== route.dimensions) {
    throw semanticUnavailable("The source bill does not have the required embedding")
  }
  let indexResult: { rows: { indisready: boolean; indisvalid: boolean }[] }
  try {
    indexResult = await database.execute<{ indisready: boolean; indisvalid: boolean }>(sql`
      select indexrelid::regclass::text as index_name, indisready, indisvalid
      from pg_index
      where indexrelid = 'legislation.bill_embeddings_hnsw_idx'::regclass
    `)
  } catch {
    throw semanticUnavailable("The bill similarity index is unavailable")
  }
  const index = indexResult.rows[0]
  if (index?.indisready !== true || index.indisvalid !== true) {
    throw semanticUnavailable("The bill similarity index is not ready")
  }
  try {
    return await semanticBillSearch(database, {
      embedding,
      jurisdictionIds: [jurisdictionId],
      limit: SEMANTIC_CANDIDATE_LIMIT,
      sessionIds: [sessionId]
    })
  } catch (error) {
    if (error instanceof LegislationError && error.category === "dependency_unavailable") {
      throw error
    }
    throw semanticUnavailable("The bill similarity search is unavailable")
  }
}

function explicitCandidate(row: ExplicitRow): RelatedCandidate {
  const relation = row.relation
  return {
    bill: { ...row.bill, latestActionAt: row.latestActionAt },
    classification: relation.classification,
    direction: row.direction,
    kind: "explicit",
    relationship: {
      canonicalFactsComplete: relation.canonicalFactsComplete && isRelationDirection(relation.direction),
      classification: relation.classification,
      direction: row.direction,
      provenanceComplete: relation.provenanceComplete,
      sourceIsOfficial: relation.sourceIsOfficial,
      sourceProvider: relation.sourceProvider,
      sourceRetrievedAt: relation.sourceRetrievedAt,
      sourceUpdatedAt: relation.sourceUpdatedAt,
      sourceUrl: relation.sourceUrl
    },
    similarityScore: null
  }
}

function semanticCandidate(candidate: SemanticPage["items"][number]): RelatedCandidate {
  const score = candidate.semanticScore
  if (score === null || !Number.isFinite(score)) {
    throw semanticUnavailable("The bill similarity result has no finite score")
  }
  return {
    bill: { ...candidate, latestActionAt: candidate.latestActionAt },
    classification: null,
    direction: null,
    kind: "similar",
    relationship: null,
    similarityScore: clamp(score)
  }
}

function compareCandidates(left: RelatedCandidate, right: RelatedCandidate): number {
  return compareCandidateKeys(
    {
      billId: left.bill.id,
      classification: left.classification,
      direction: left.direction,
      kind: left.kind,
      similarityScore: left.similarityScore
    },
    {
      billId: right.bill.id,
      classification: right.classification,
      direction: right.direction,
      kind: right.kind,
      similarityScore: right.similarityScore
    }
  )
}

interface RelatedCandidateKey {
  billId: string
  classification: string | null
  direction: BillRelationDirection | null
  kind: "explicit" | "similar"
  similarityScore: number | null
}

function compareCandidateKeys(left: RelatedCandidateKey, right: RelatedCandidateKey): number {
  if (left.kind !== right.kind) {
    return left.kind === "explicit" ? -1 : 1
  }
  if (left.kind === "similar" && right.kind === "similar") {
    const scoreOrder = (right.similarityScore ?? 0) - (left.similarityScore ?? 0)
    if (scoreOrder !== 0) {
      return scoreOrder
    }
  }
  const billOrder = left.billId.localeCompare(right.billId)
  if (billOrder !== 0) {
    return billOrder
  }
  const classificationOrder = (left.classification ?? "").localeCompare(right.classification ?? "")
  if (classificationOrder !== 0) {
    return classificationOrder
  }
  return (left.direction ?? "").localeCompare(right.direction ?? "")
}

function isAfter(candidate: RelatedCandidate, cursor: BillRelationCursor): boolean {
  return (
    compareCandidateKeys(
      {
        billId: candidate.bill.id,
        classification: candidate.classification,
        direction: candidate.direction,
        kind: candidate.kind,
        similarityScore: candidate.similarityScore
      },
      {
        billId: cursor.billId,
        classification: cursor.classification,
        direction: cursor.direction,
        kind: cursor.kind,
        similarityScore: cursor.similarityScore
      }
    ) > 0
  )
}

function normalizeClassifications(
  value: readonly BillRelationClassification[] | undefined
): BillRelationClassification[] {
  const classifications = [...(value ?? [])]
  if (new Set(classifications).size !== classifications.length) {
    throw new LegislationError("invalid_request", "classification values must be unique")
  }
  return classifications.toSorted()
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredBillId(value: string): string {
  const normalized = value.trim()
  if (normalized.length < 1 || normalized.length > 256) {
    throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
  }
  return normalized
}

function encodeCursor(cursor: BillRelationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url")
}

function decodeCursor(value: string | undefined, scope: BillRelationCursorScope): BillRelationCursor | undefined {
  if (value === undefined) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
  } catch {
    throw invalidCursor()
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    typeof parsed.billId !== "string" ||
    (parsed.kind !== "explicit" && parsed.kind !== "similar") ||
    !sameScope(parsed.scope, scope) ||
    (parsed.classification !== null && typeof parsed.classification !== "string") ||
    (parsed.direction !== null && parsed.direction !== "incoming" && parsed.direction !== "outgoing") ||
    (parsed.similarityScore !== null &&
      (typeof parsed.similarityScore !== "number" || !Number.isFinite(parsed.similarityScore)))
  ) {
    throw invalidCursor()
  }
  if (parsed.kind === "similar" && parsed.similarityScore === null) {
    throw invalidCursor()
  }
  if (parsed.kind === "explicit" && (parsed.classification === null || parsed.direction === null)) {
    throw invalidCursor()
  }
  const classification = parsed.classification
  const direction = parsed.direction
  const similarityScore = parsed.similarityScore
  if (
    (classification !== null && typeof classification !== "string") ||
    (direction !== null && direction !== "incoming" && direction !== "outgoing") ||
    (similarityScore !== null && (typeof similarityScore !== "number" || !Number.isFinite(similarityScore)))
  ) {
    throw invalidCursor()
  }
  return {
    billId: parsed.billId,
    classification,
    direction,
    kind: parsed.kind,
    scope,
    similarityScore,
    version: 1
  }
}

function sameScope(value: unknown, expected: BillRelationCursorScope): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
}

function invalidCursor(): LegislationError {
  return new LegislationError("invalid_request", "Invalid related bills pagination cursor")
}

function semanticUnavailable(message: string): LegislationError {
  return new LegislationError("dependency_unavailable", message)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function projectBillRelatedRead(item: BillRelatedHitRead, apiBaseUrl: string) {
  const bill = projectBillSummaryRead(item.bill, apiBaseUrl)
  if (item.relationship === null) {
    if (item.similarityScore === null || !Number.isFinite(item.similarityScore)) {
      throw new LegislationError("unprocessable", "Related bill similarity is incomplete")
    }
    return { bill, relationship: null, similarityScore: clamp(item.similarityScore), sources: bill.sources }
  }
  if (
    item.relationship.canonicalFactsComplete !== true ||
    item.relationship.provenanceComplete !== true ||
    !isRelationClassification(item.relationship.classification) ||
    !isRelationDirection(item.relationship.direction) ||
    item.relationship.sourceUrl === null ||
    !isHttpsUrl(item.relationship.sourceUrl) ||
    item.relationship.sourceProvider === null ||
    item.relationship.sourceProvider.trim().length === 0 ||
    item.relationship.sourceRetrievedAt === null ||
    !(item.relationship.sourceRetrievedAt instanceof Date) ||
    Number.isNaN(item.relationship.sourceRetrievedAt.valueOf()) ||
    item.relationship.sourceIsOfficial === null ||
    item.relationship.sourceUpdatedAt === null ||
    !(item.relationship.sourceUpdatedAt instanceof Date) ||
    Number.isNaN(item.relationship.sourceUpdatedAt.valueOf())
  ) {
    throw new LegislationError("unprocessable", "Related bill relationship provenance is incomplete")
  }
  const source = {
    isOfficial: item.relationship.sourceIsOfficial,
    provider: item.relationship.sourceProvider,
    retrievedAt: item.relationship.sourceRetrievedAt.toISOString(),
    sourceUpdatedAt: item.relationship.sourceUpdatedAt.toISOString(),
    sourceUrl: item.relationship.sourceUrl
  }
  return {
    bill,
    relationship: { classification: item.relationship.classification, relatedBill: bill, sources: [source] },
    similarityScore: null,
    sources: [source]
  }
}

function isRelationClassification(value: string): value is BillRelationClassification {
  return (BILL_RELATION_CLASSIFICATIONS as readonly string[]).includes(value)
}

function isRelationDirection(value: unknown): value is BillRelationDirection {
  return value === "incoming" || value === "outgoing"
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:" && new URL(value).hostname.length > 0
  } catch {
    return false
  }
}
