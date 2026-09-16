import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  amendmentActions,
  amendments,
  billDocuments,
  bills,
  people
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm"
import type { SQLWrapper } from "drizzle-orm"
import {
  projectAmendmentDetail,
  projectAmendmentSummary,
  projectPersonSummary,
  projectSourceReferences,
  type AmendmentAction,
  type AmendmentDetail,
  type AmendmentSummary,
  type AmendmentSummaryProjectionInput,
  type DocumentSummary,
  type Sponsor
} from "../../../request-handling/api/canonical-projection.js"
import { sourceProjectionContext } from "../../../request-handling/api/canonical-read.js"
import { projectDocumentDetailRead } from "../../../request-handling/api/document-read-routes.js"
import { getDocumentDetail } from "./document-reads.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const MAX_DETAIL_ACTIONS = 1_000

export type AmendmentRecordType = "document" | "structured"
export type AmendmentSort = "identifier-asc" | "submitted-desc" | "updated-desc"

export type AmendmentReadInput = Readonly<{
  billId?: string
  cursor?: string
  jurisdictionId?: string
  limit?: number
  recordType?: AmendmentRecordType
  recordTypes?: readonly AmendmentRecordType[]
  sponsorPersonId?: string
  status?: string
  statuses?: readonly string[]
  submittedFrom?: string
  submittedTo?: string
  sort?: AmendmentSort
}>

export type AmendmentReadPage<T> = Readonly<{
  items: readonly T[]
  nextCursor?: string
  truncated: boolean
}>

export type AmendmentCursorScope = Readonly<{
  billId: string | null
  jurisdictionId: string | null
  recordType: AmendmentRecordType | null
  recordTypes: readonly AmendmentRecordType[] | null
  sponsorPersonId: string | null
  status: string | null
  statuses: readonly string[] | null
  submittedFrom: string | null
  submittedTo: string | null
  sort: AmendmentSort
}>

export type AmendmentCursor = Readonly<{
  id: string
  recordType: AmendmentRecordType
  scope: AmendmentCursorScope
  sortValue: string | null
  version: 1
}>

type AmendmentKey = Readonly<{ id: string; recordType: AmendmentRecordType; sortValue: string | null }>

/**
 * Every public amendment has a durable bill parent. The table retains legacy
 * detached rows, so collection queries apply the explicit predicate below;
 * direct reads still report such a row as unprocessable.
 */
export async function listAmendmentReads(
  database: LegislationDatabase,
  input: AmendmentReadInput,
  apiBaseUrl: string
): Promise<AmendmentReadPage<AmendmentSummary>> {
  const limit = parseLimit(input.limit)
  const scope = amendmentReadCursorScope(input)
  const cursor = decodeAmendmentCursor(input.cursor, scope)
  const sort = scope.sort
  const [structuredRows, documentRows] = await Promise.all([
    amendmentRecordTypes(input).includes("structured") === false
      ? Promise.resolve([])
      : buildStructuredAmendmentListQuery(database, input, cursor, sort, limit),
    amendmentRecordTypes(input).includes("document") === false ||
    input.sponsorPersonId !== undefined ||
    amendmentStatuses(input).length > 0
      ? Promise.resolve([])
      : buildDocumentAmendmentListQuery(database, input, cursor, sort, limit)
  ])
  const merged = [
    ...structuredRows.map((row) => projectStructuredAmendment(row, apiBaseUrl)),
    ...documentRows.map((row) => projectDocumentAmendment(row.document, row.jurisdictionId, apiBaseUrl))
  ].toSorted((left, right) => compareAmendmentReadOrder(left, right, sort))
  const items = merged.slice(0, limit)
  const truncated = merged.length > limit
  const last = items.at(-1)
  return {
    items,
    nextCursor: truncated && last !== undefined ? encodeAmendmentCursor(amendmentKey(last, sort), scope) : undefined,
    truncated
  }
}

export async function getAmendmentRead(
  database: LegislationDatabase,
  amendmentId: string,
  apiBaseUrl: string
): Promise<AmendmentDetail> {
  const id = requiredId(amendmentId, "amendmentId")
  const documentId = documentIdFromAmendmentId(id)
  if (documentId !== undefined) {
    const rows = await database
      .select({ document: billDocuments, jurisdictionId: bills.jurisdictionId })
      .from(billDocuments)
      .innerJoin(bills, eq(bills.id, billDocuments.billId))
      .where(and(eq(billDocuments.id, documentId), eq(billDocuments.classification, "amendment")))
      .limit(1)
    const row = rows[0]
    if (row === undefined) {
      throw new LegislationError("not_found", `Amendment ${id} was not found`)
    }
    const amendmentInput = documentAmendmentInput(row.document, row.jurisdictionId)
    const document = documentSummaryFromDocumentDetail(await getDocumentDetail(database, row.document.id), apiBaseUrl)
    return projectAmendmentDetail(
      { actions: [], amendment: amendmentInput, description: null, documents: [document], sponsors: [] },
      sourceProjectionContext(row.document, apiBaseUrl)
    )
  }

  const rows = await database.select().from(amendments).where(eq(amendments.id, id)).limit(1)
  const amendment = rows[0]
  if (amendment === undefined) {
    throw new LegislationError("not_found", `Amendment ${id} was not found`)
  }
  const actions = await database
    .select()
    .from(amendmentActions)
    .where(eq(amendmentActions.amendmentId, id))
    .orderBy(asc(amendmentActions.ordinal), asc(amendmentActions.id))
    .limit(MAX_DETAIL_ACTIONS + 1)
  if (actions.length > MAX_DETAIL_ACTIONS) {
    throw incomplete("Amendment actions exceed the canonical persistence maximum")
  }
  const amendmentInput = structuredAmendmentInput(amendment)
  const summary = projectAmendmentSummary(amendmentInput, sourceProjectionContext(amendment, apiBaseUrl))
  const sponsor = await projectStructuredSponsor(database, amendment, summary, apiBaseUrl)
  return projectAmendmentDetail(
    {
      actions: actions.map((action) => projectStructuredAction(action, summary, apiBaseUrl)),
      amendment: amendmentInput,
      description: amendment.description,
      documents: [],
      sponsors: sponsor === undefined ? [] : [sponsor]
    },
    sourceProjectionContext(amendment, apiBaseUrl)
  )
}

/**
 * Reads only structured amendments that have a persisted bill parent. Detached
 * historical rows remain queryable by their internal ID but are not public
 * collection members because AmendmentSummary requires a billId.
 */
export function buildStructuredAmendmentListQuery(
  database: LegislationDatabase,
  input: AmendmentReadInput,
  cursor: AmendmentCursor | undefined,
  sort: AmendmentSort,
  limit: number
) {
  return database
    .select()
    .from(amendments)
    .where(
      and(
        input.billId === undefined ? undefined : eq(amendments.billId, requiredId(input.billId, "billId")),
        input.jurisdictionId === undefined
          ? undefined
          : eq(amendments.jurisdictionId, requiredId(input.jurisdictionId, "jurisdictionId")),
        input.sponsorPersonId === undefined
          ? undefined
          : eq(amendments.sponsorPersonId, requiredId(input.sponsorPersonId, "sponsorPersonId")),
        isNotNull(amendments.billId),
        amendmentStatuses(input).length === 0 ? undefined : inArray(amendments.status, amendmentStatuses(input)),
        input.submittedFrom === undefined ? undefined : gte(amendments.submittedDate, input.submittedFrom),
        input.submittedTo === undefined ? undefined : lte(amendments.submittedDate, input.submittedTo),
        structuredAfterCursor(cursor, sort)
      )
    )
    .orderBy(...structuredOrder(sort))
    .limit(limit + 1)
}

export function buildDocumentAmendmentListQuery(
  database: LegislationDatabase,
  input: AmendmentReadInput,
  cursor: AmendmentCursor | undefined,
  sort: AmendmentSort,
  limit: number
) {
  return database
    .select({ document: billDocuments, jurisdictionId: bills.jurisdictionId })
    .from(billDocuments)
    .innerJoin(bills, eq(bills.id, billDocuments.billId))
    .where(
      and(
        eq(billDocuments.classification, "amendment"),
        input.billId === undefined ? undefined : eq(billDocuments.billId, requiredId(input.billId, "billId")),
        input.jurisdictionId === undefined
          ? undefined
          : eq(bills.jurisdictionId, requiredId(input.jurisdictionId, "jurisdictionId")),
        input.submittedFrom === undefined ? undefined : gte(billDocuments.documentDate, input.submittedFrom),
        input.submittedTo === undefined ? undefined : lte(billDocuments.documentDate, input.submittedTo),
        documentAfterCursor(cursor, sort)
      )
    )
    .orderBy(...documentOrder(sort))
    .limit(limit + 1)
}

function structuredOrder(sort: AmendmentSort): SQL[] {
  switch (sort) {
    case "identifier-asc":
      return [asc(amendments.printedIdentifier), asc(amendments.id)]
    case "updated-desc":
      return [desc(amendments.updatedAt), asc(amendments.id)]
    default:
      return [asc(sql`${amendments.submittedDate} is null`), desc(amendments.submittedDate), asc(amendments.id)]
  }
}

function documentOrder(sort: AmendmentSort): SQL[] {
  switch (sort) {
    case "identifier-asc":
      return [asc(billDocuments.title), asc(billDocuments.id)]
    case "updated-desc":
      return [desc(billDocuments.updatedAt), asc(billDocuments.id)]
    default:
      return [asc(sql`${billDocuments.documentDate} is null`), desc(billDocuments.documentDate), asc(billDocuments.id)]
  }
}

function structuredAfterCursor(cursor: AmendmentCursor | undefined, sort: AmendmentSort): SQL | undefined {
  if (cursor === undefined || cursor.recordType !== "structured") {
    return cursor === undefined ? undefined : structuredAfterOtherRecord(cursor, sort)
  }
  return afterKey(amendments.id, sortColumn(amendments, sort), cursor.sortValue, cursorRowId(cursor), sort)
}

function documentAfterCursor(cursor: AmendmentCursor | undefined, sort: AmendmentSort): SQL | undefined {
  if (cursor === undefined || cursor.recordType !== "document") {
    return cursor === undefined ? undefined : documentAfterOtherRecord(cursor, sort)
  }
  return afterKey(billDocuments.id, sortColumn(billDocuments, sort), cursor.sortValue, cursorRowId(cursor), sort)
}

function structuredAfterOtherRecord(cursor: AmendmentCursor, sort: AmendmentSort): SQL {
  // At an equal sort value, document rows sort after structured rows. A cursor
  // on a document therefore excludes all equal structured rows.
  return afterOtherRecord(sortColumn(amendments, sort), cursor.sortValue, sort, false)
}

function documentAfterOtherRecord(cursor: AmendmentCursor, sort: AmendmentSort): SQL {
  // See structuredAfterOtherRecord: structured precedes document for exact
  // ties, so a structured cursor keeps document records at the same key.
  return afterOtherRecord(sortColumn(billDocuments, sort), cursor.sortValue, sort, cursor.recordType === "structured")
}

function afterOtherRecord(column: SQLWrapper, value: string | null, sort: AmendmentSort, includeEqual: boolean): SQL {
  const afterValue = afterSortValue(column, value, sort)
  if (!includeEqual) {
    return afterValue
  }
  if (value === null) {
    return isNull(column) as SQL
  }
  return or(afterValue, eq(column, value)) as SQL
}

function afterKey(
  id: SQLWrapper,
  column: SQLWrapper,
  value: string | null,
  cursorId: string,
  sort: AmendmentSort
): SQL {
  if (value === null && sort === "submitted-desc") {
    return and(isNull(column), gt(id, cursorId)) as SQL
  }
  return or(afterSortValue(column, value, sort), and(eq(column, value as string), gt(id, cursorId))) as SQL
}

function afterSortValue(column: SQLWrapper, value: string | null, sort: AmendmentSort): SQL {
  if (sort === "submitted-desc") {
    if (value === null) {
      return sql`false`
    }
    return or(lt(column, value), isNull(column)) as SQL
  }
  if (value === null) {
    throw new LegislationError("invalid_request", "The cursor is not valid for this amendment ordering")
  }
  return sort === "updated-desc" ? (lt(column, value) as SQL) : (gt(column, value) as SQL)
}

function sortColumn(table: typeof amendments | typeof billDocuments, sort: AmendmentSort): SQLWrapper {
  switch (sort) {
    case "identifier-asc":
      return table === amendments ? amendments.printedIdentifier : billDocuments.title
    case "updated-desc":
      return table.updatedAt
    default:
      return table === amendments ? amendments.submittedDate : billDocuments.documentDate
  }
}

export function compareAmendmentReadOrder(
  left: AmendmentSummary,
  right: AmendmentSummary,
  sort: AmendmentSort
): number {
  const keyDifference = compareSortValue(amendmentSortValue(left, sort), amendmentSortValue(right, sort), sort)
  if (keyDifference !== 0) {
    return keyDifference
  }
  if (left.recordType !== right.recordType) {
    return left.recordType === "structured" ? -1 : 1
  }
  return left.id.localeCompare(right.id)
}

function compareSortValue(left: string | null, right: string | null, sort: AmendmentSort): number {
  if (left === right) {
    return 0
  }
  if (sort === "submitted-desc") {
    if (left === null) {
      return 1
    }
    if (right === null) {
      return -1
    }
    return right.localeCompare(left)
  }
  if (left === null || right === null) {
    throw incomplete("Amendment sort value is incomplete")
  }
  return sort === "updated-desc" ? right.localeCompare(left) : left.localeCompare(right)
}

function amendmentKey(item: AmendmentSummary, sort: AmendmentSort): AmendmentKey {
  return { id: item.id, recordType: item.recordType, sortValue: amendmentSortValue(item, sort) }
}

function cursorRowId(cursor: AmendmentCursor): string {
  if (cursor.recordType === "structured") {
    return cursor.id
  }
  const documentId = documentIdFromAmendmentId(cursor.id)
  if (documentId === undefined) {
    throw new LegislationError("invalid_request", "cursor is not valid for these amendment filters")
  }
  return documentId
}

function amendmentSortValue(item: AmendmentSummary, sort: AmendmentSort): string | null {
  switch (sort) {
    case "identifier-asc":
      return item.identifier
    case "updated-desc":
      return item.updatedAt
    default:
      return item.submittedDate
  }
}

export function amendmentReadCursorScope(input: AmendmentReadInput): AmendmentCursorScope {
  const recordTypes = amendmentRecordTypes(input)
  const statuses = amendmentStatuses(input)
  return {
    billId: input.billId ?? null,
    jurisdictionId: input.jurisdictionId ?? null,
    recordType: input.recordType ?? null,
    recordTypes: input.recordTypes === undefined ? null : recordTypes,
    sponsorPersonId: input.sponsorPersonId ?? null,
    status: input.status ?? null,
    statuses: input.statuses === undefined ? null : statuses,
    submittedFrom: input.submittedFrom ?? null,
    submittedTo: input.submittedTo ?? null,
    sort: input.sort ?? "submitted-desc"
  }
}

export function amendmentContinuationCursor(item: AmendmentSummary, input: AmendmentReadInput): string {
  return encodeAmendmentCursor(amendmentKey(item, input.sort ?? "submitted-desc"), amendmentReadCursorScope(input))
}

function encodeAmendmentCursor(key: AmendmentKey, scope: AmendmentCursorScope): string {
  return Buffer.from(JSON.stringify({ ...key, scope, version: 1 }), "utf8").toString("base64url")
}

export function decodeAmendmentContinuationCursor(
  cursor: string | undefined,
  input: AmendmentReadInput
): AmendmentCursor | undefined {
  return decodeAmendmentCursor(cursor, amendmentReadCursorScope(input))
}

function decodeAmendmentCursor(cursor: string | undefined, scope: AmendmentCursorScope): AmendmentCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (!isAmendmentCursor(value) || JSON.stringify(value.scope) !== JSON.stringify(scope)) {
      throw new Error("invalid")
    }
    return value
  } catch {
    throw new LegislationError("invalid_request", "cursor is not valid for these amendment filters")
  }
}

function isAmendmentCursor(value: unknown): value is AmendmentCursor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    (candidate.recordType === "document" || candidate.recordType === "structured") &&
    (typeof candidate.sortValue === "string" || candidate.sortValue === null) &&
    candidate.version === 1 &&
    isCursorScope(candidate.scope)
  )
}

function isCursorScope(value: unknown): value is AmendmentCursorScope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  const scope = value as Record<string, unknown>
  return (
    nullableString(scope.billId) &&
    nullableString(scope.jurisdictionId) &&
    (scope.recordType === null || scope.recordType === "document" || scope.recordType === "structured") &&
    nullableAmendmentRecordTypes(scope.recordTypes) &&
    nullableString(scope.sponsorPersonId) &&
    nullableString(scope.status) &&
    nullableStringArray(scope.statuses) &&
    nullableString(scope.submittedFrom) &&
    nullableString(scope.submittedTo) &&
    (scope.sort === "identifier-asc" || scope.sort === "submitted-desc" || scope.sort === "updated-desc")
  )
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string"
}

function nullableStringArray(value: unknown): value is readonly string[] | null {
  return value === null || (Array.isArray(value) && value.every((item) => typeof item === "string"))
}

function nullableAmendmentRecordTypes(value: unknown): value is readonly AmendmentRecordType[] | null {
  return value === null || (Array.isArray(value) && value.every((item) => item === "document" || item === "structured"))
}

function amendmentRecordTypes(input: AmendmentReadInput): readonly AmendmentRecordType[] {
  const values = input.recordTypes ?? (input.recordType === undefined ? ["structured", "document"] : [input.recordType])
  return [...new Set(values)].toSorted()
}

function amendmentStatuses(input: AmendmentReadInput): readonly string[] {
  const values = input.statuses ?? (input.status === undefined ? [] : [input.status])
  return [...new Set(values.map((value) => requiredText(value, "status")))].toSorted()
}

export function projectStructuredAmendment(
  amendment: typeof amendments.$inferSelect,
  apiBaseUrl: string
): AmendmentSummary {
  return projectAmendmentSummary(structuredAmendmentInput(amendment), sourceProjectionContext(amendment, apiBaseUrl))
}

function structuredAmendmentInput(amendment: typeof amendments.$inferSelect): AmendmentSummaryProjectionInput {
  if (!isStructuredAmendmentComplete(amendment)) {
    throw incomplete("Structured amendment has no canonical bill parent")
  }
  return {
    billId: amendment.billId,
    documentId: null,
    id: amendment.id,
    identifier: amendment.printedIdentifier,
    jurisdictionId: amendment.jurisdictionId,
    recordType: "structured",
    sourceUrl: amendment.sourceUrl,
    status: amendment.status,
    submittedDate: amendment.submittedDate,
    title: structuredTitle(amendment)
  }
}

export function isStructuredAmendmentComplete(
  value: Readonly<{ billId: string | null }>
): value is Readonly<{ billId: string }> {
  return value.billId !== null
}

export type DocumentAmendmentSummaryRow = Pick<
  typeof billDocuments.$inferSelect,
  "id" | "billId" | "title" | "documentDate" | "sourceUrl" | "createdAt" | "updatedAt"
>

export function projectDocumentAmendment(
  document: DocumentAmendmentSummaryRow,
  jurisdictionId: string,
  apiBaseUrl: string
): AmendmentSummary {
  return projectAmendmentSummary(
    documentAmendmentInput(document, jurisdictionId),
    sourceProjectionContext(document, apiBaseUrl)
  )
}

function documentAmendmentInput(
  document: DocumentAmendmentSummaryRow,
  jurisdictionId: string
): AmendmentSummaryProjectionInput {
  return {
    billId: document.billId,
    documentId: document.id,
    id: documentBackedAmendmentId(document.id),
    identifier: document.title,
    jurisdictionId,
    recordType: "document",
    sourceUrl: document.sourceUrl,
    status: null,
    submittedDate: document.documentDate,
    title: document.title
  }
}

function structuredTitle(amendment: typeof amendments.$inferSelect): string {
  for (const candidate of [amendment.purpose, amendment.description, amendment.printedIdentifier]) {
    if (candidate !== null && candidate.trim().length > 0) {
      return candidate
    }
  }
  throw incomplete("Structured amendment has no canonical title")
}

async function projectStructuredSponsor(
  database: LegislationDatabase,
  amendment: typeof amendments.$inferSelect,
  summary: AmendmentSummary,
  apiBaseUrl: string
): Promise<Sponsor | undefined> {
  if (amendment.sponsorName === null) {
    return undefined
  }
  const personRows =
    amendment.sponsorPersonId === null
      ? []
      : await database.select().from(people).where(eq(people.id, amendment.sponsorPersonId)).limit(1)
  const person = personRows[0]
  if (amendment.sponsorPersonId !== null && person === undefined) {
    throw incomplete("Structured amendment sponsor person is missing")
  }
  return {
    classification: "author",
    isPrimary: true,
    person: person === undefined ? null : projectAmendmentSponsorPerson(person, apiBaseUrl),
    sourceName: requiredText(amendment.sponsorName, "sponsorName"),
    sources: summary.sources
  }
}

function projectAmendmentSponsorPerson(person: typeof people.$inferSelect, apiBaseUrl: string) {
  if (
    !person.provenanceComplete ||
    person.jurisdictionId === null ||
    person.isActive === null ||
    person.sourceUrl === null ||
    person.sourceProvider === null ||
    person.sourceRetrievedAt === null ||
    person.sourceIsOfficial === null
  ) {
    throw incomplete("Structured amendment sponsor person canonical provenance is incomplete")
  }
  return projectPersonSummary(
    {
      familyName: person.familyName,
      givenName: person.givenName,
      id: person.id,
      imageUrl: null,
      isActive: person.isActive,
      jurisdictionIds: [person.jurisdictionId],
      name: person.name,
      party: person.party,
      sourceUrl: person.sourceUrl
    },
    sourceProjectionContext(
      {
        createdAt: person.createdAt,
        id: person.id,
        sourceUpdatedAt: person.sourceUpdatedAt,
        sourceUrl: person.sourceUrl,
        updatedAt: person.updatedAt,
        upstreamIds: person.upstreamIds
      },
      apiBaseUrl
    )
  )
}

function projectStructuredAction(
  action: typeof amendmentActions.$inferSelect,
  amendment: AmendmentSummary,
  apiBaseUrl: string
): AmendmentAction {
  const date = action.actionDate ?? action.actionAt?.toISOString().slice(0, 10)
  if (date === undefined) {
    throw incomplete("Amendment action has no canonical date")
  }
  return {
    amendmentId: amendment.id,
    canonicalUrl: `${amendment.canonicalUrl}#actions/${encodeURIComponent(action.id)}`,
    classifications: [...action.classification],
    date,
    description: action.description,
    id: action.id,
    occurredAt: action.actionAt?.toISOString() ?? null,
    sequence: action.ordinal,
    sources: projectSourceReferences(
      sourceProjectionContext(
        {
          createdAt: action.createdAt,
          id: action.id,
          sourceUrl: amendmentActionSourceUrl(action.sourceUrl),
          updatedAt: action.createdAt
        },
        apiBaseUrl
      ).sources
    ),
    type: "amendment-action",
    updatedAt: action.createdAt.toISOString()
  }
}

export function amendmentActionSourceUrl(sourceUrl: string | null): string {
  if (sourceUrl === null || sourceUrl.trim().length === 0) {
    throw incomplete("Amendment action canonical provenance is not persisted")
  }
  return sourceUrl
}

function documentSummaryFromDocumentDetail(
  document: Awaited<ReturnType<typeof getDocumentDetail>>,
  apiBaseUrl: string
): DocumentSummary {
  const {
    byteSize: _byteSize,
    failureCategory: _failureCategory,
    pageCount: _pageCount,
    sectionCount: _sectionCount,
    textCharacterCount: _textCharacterCount,
    ...summary
  } = projectDocumentDetailRead(document, apiBaseUrl)
  return summary
}

function documentBackedAmendmentId(documentId: string): string {
  return `amendment:document:${documentId}`
}

function documentIdFromAmendmentId(id: string): string | undefined {
  const prefix = "amendment:document:"
  return id.startsWith(prefix) ? id.slice(prefix.length) || undefined : undefined
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredId(value: string, name: string): string {
  const result = value.trim()
  if (result.length < 1 || result.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return result
}

function requiredText(value: string, name: string): string {
  const result = value.trim()
  if (result.length === 0) {
    throw incomplete(`${name} is not persisted`)
  }
  return result
}

function incomplete(message: string): LegislationError {
  return new LegislationError("unprocessable", message)
}
