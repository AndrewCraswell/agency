import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  bills,
  billDocuments,
  documentSections,
  supportingMaterials,
  supportingMaterialSections
} from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, count, eq, gt, gte, lte, or, sql, type SQL } from "drizzle-orm"
import type { PgColumn } from "drizzle-orm/pg-core"
import { isIsoDate } from "../../../request-handling/api/canonical-projection.js"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export type DocumentClassification = "amendment" | "analysis" | "fiscal-note" | "supplemental" | "version"
export type ProcessingStatus = "failed" | "pending" | "processed" | "processing" | "unsupported"
export type OcrStatus = "failed" | "not-required" | "pending" | "processed" | "processing" | "unsupported"

export interface BillDocumentListInput {
  billId: string
  classification?: DocumentClassification
  cursor?: string
  limit?: number
  processingStatus?: ProcessingStatus
  versionCode?: string
}

export interface DocumentSectionListInput {
  cursor?: string
  documentId: string
  heading?: string
  limit?: number
  pageFrom?: number
  pageTo?: number
}

export interface DocumentSectionDetailInput {
  documentId: string
  sectionId: string
}

export interface SupportingMaterialSectionListInput {
  cursor?: string
  heading?: string
  limit?: number
  materialId: string
  pageFrom?: number
  pageTo?: number
}

export interface DocumentPage<T> {
  items: T[]
  nextCursor?: string
  truncated: boolean
}

/**
 * Canonical read facts deliberately keep internal blob paths out of the HTTP
 * projection. A blob path identifies storage, not a public artifact URL.
 */
export interface CanonicalDocumentRead {
  billId: string
  byteSize: null
  classification: DocumentClassification
  contentHash: string | null
  createdAt: Date
  documentDate: string | null
  failureCategory: string | null
  id: string
  mimeType: string | null
  ocrCompletedAt: Date | null
  ocrProvider: string | null
  ocrStatus: OcrStatus
  pageCount: number | null
  processingStatus: ProcessingStatus
  sourceUrl: string
  storedUrl: null
  title: string
  updatedAt: Date
  versionCode: string | null
}

export interface CanonicalDocumentDetailRead extends CanonicalDocumentRead {
  sectionCount: number
  textCharacterCount: number
}

export type DocumentPersistenceRead = Pick<
  typeof billDocuments.$inferSelect,
  | "billId"
  | "classification"
  | "contentHash"
  | "contentType"
  | "createdAt"
  | "documentDate"
  | "id"
  | "ocrCompletedAt"
  | "ocrPageCount"
  | "ocrProvider"
  | "ocrStatus"
  | "processingErrorCategory"
  | "processingStatus"
  | "sourceUrl"
  | "title"
  | "updatedAt"
  | "versionCode"
>

export interface CanonicalDocumentSectionRead {
  document: {
    billId: string
    createdAt: Date
    id: string
    sourceUrl: string
    updatedAt: Date
  }
  section: {
    contentHash: string
    heading: string | null
    id: string
    ordinal: number
    pageEnd: number | null
    pageStart: number | null
    sourceEndOffset: number
    sourceStartOffset: number
    text: string
  }
}

export type DocumentSectionPersistenceRead = Pick<
  typeof documentSections.$inferSelect,
  | "contentHash"
  | "documentId"
  | "heading"
  | "id"
  | "ordinal"
  | "pageEnd"
  | "pageStart"
  | "sourceEndOffset"
  | "sourceStartOffset"
  | "text"
>

export interface CanonicalSupportingMaterialSectionRead {
  material: {
    createdAt: Date
    id: string
    sourceUpdatedAt: Date | null
    sourceUrl: string
    updatedAt: Date
  }
  section: {
    contentHash: string
    heading: string | null
    id: string
    ordinal: number
    pageEnd: number | null
    pageStart: number | null
    text: string
  }
}

export type SupportingMaterialPersistenceRead = Pick<
  typeof supportingMaterials.$inferSelect,
  "createdAt" | "id" | "sourceUpdatedAt" | "sourceUrl" | "updatedAt"
>

export type SupportingMaterialSectionPersistenceRead = Pick<
  typeof supportingMaterialSections.$inferSelect,
  "contentHash" | "heading" | "id" | "ordinal" | "pageEnd" | "pageStart" | "text"
>

type DocumentCursorScope = {
  billId: string
  classification: DocumentClassification | null
  processingStatus: ProcessingStatus | null
  versionCode: string | null
}

type DocumentCursor = {
  documentDate: string | null
  id: string
  scope: DocumentCursorScope
  version: 1
  versionCode: string | null
}

type SectionCursorScope = {
  heading: string | null
  pageFrom: number | null
  pageTo: number | null
  parentId: string
}

type SectionCursor = {
  id: string
  ordinal: number
  scope: SectionCursorScope
  version: 1
}

type PageRangeInput = Pick<DocumentSectionListInput, "pageFrom" | "pageTo">

/**
 * Parent-scoped document pages must distinguish an absent bill from a bill
 * which simply has no documents. Select only the stable key for that check;
 * a detail row may contain large text or embedding columns unrelated to the
 * collection request.
 */
export function buildBillExistenceQuery(database: LegislationDatabase, billId: string) {
  return database
    .select({ id: bills.id })
    .from(bills)
    .where(eq(bills.id, requiredInputText(billId, "billId")))
    .limit(1)
}

export async function assertBillExists(database: LegislationDatabase, billId: string): Promise<void> {
  const rows = await buildBillExistenceQuery(database, billId)
  if (rows[0] === undefined) {
    throw new LegislationError("not_found", `Bill ${billId} was not found`)
  }
}

export function buildBillDocumentListQuery(database: LegislationDatabase, input: BillDocumentListInput) {
  const limit = parseLimit(input.limit)
  const scope = documentCursorScope(input)
  const cursor = decodeDocumentCursor(input.cursor, scope)

  return database
    .select()
    .from(billDocuments)
    .where(
      and(
        eq(billDocuments.billId, requiredInputText(input.billId, "billId")),
        input.classification === undefined ? undefined : eq(billDocuments.classification, input.classification),
        input.processingStatus === undefined ? undefined : eq(billDocuments.processingStatus, input.processingStatus),
        input.versionCode === undefined
          ? undefined
          : eq(billDocuments.versionCode, requiredInputText(input.versionCode, "versionCode")),
        documentCursorPredicate(cursor)
      )
    )
    .orderBy(asc(billDocuments.documentDate), asc(billDocuments.versionCode), asc(billDocuments.id))
    .limit(limit + 1)
}

export async function listBillDocuments(
  database: LegislationDatabase,
  input: BillDocumentListInput
): Promise<DocumentPage<CanonicalDocumentRead>> {
  const limit = parseLimit(input.limit)
  const rows = await buildBillDocumentListQuery(database, input)
  const truncated = rows.length > limit
  const documents = rows.slice(0, limit).map(documentReadFromPersistence)
  const last = rows.at(Math.min(rows.length, limit) - 1)
  return {
    items: documents,
    nextCursor: truncated && last !== undefined ? encodeDocumentCursor(last, documentCursorScope(input)) : undefined,
    truncated
  }
}

export function buildDocumentDetailQuery(database: LegislationDatabase, documentId: string) {
  const aggregate = database
    .select({
      sectionCount: count(documentSections.id).mapWith(Number).as("section_count"),
      textCharacterCount: sql<number>`coalesce(sum(length(${documentSections.text})), 0)::integer`.as(
        "text_character_count"
      )
    })
    .from(documentSections)
    .where(eq(documentSections.documentId, billDocuments.id))
    .as("document_section_aggregate")

  return database
    .select({
      document: billDocuments,
      sectionCount: aggregate.sectionCount,
      textCharacterCount: aggregate.textCharacterCount
    })
    .from(billDocuments)
    .leftJoinLateral(aggregate, sql`true`)
    .where(eq(billDocuments.id, requiredInputText(documentId, "documentId")))
    .limit(1)
}

export async function getDocumentDetail(
  database: LegislationDatabase,
  documentId: string
): Promise<CanonicalDocumentDetailRead> {
  const rows = await buildDocumentDetailQuery(database, documentId)
  const row = rows[0]
  if (row === undefined || row.sectionCount === null || row.textCharacterCount === null) {
    throw new LegislationError("not_found", `Document ${documentId} was not found`)
  }
  return {
    ...documentReadFromPersistence(row.document),
    sectionCount: nonnegativeInteger(row.sectionCount, "document sectionCount"),
    textCharacterCount: nonnegativeInteger(row.textCharacterCount, "document textCharacterCount")
  }
}

/**
 * Reads a section through both its opaque ID and its document parent. The
 * parent predicate prevents a valid section ID from being exposed below an
 * unrelated document URL.
 */
export function buildDocumentSectionDetailQuery(database: LegislationDatabase, input: DocumentSectionDetailInput) {
  return database
    .select({ document: billDocuments, section: documentSections })
    .from(documentSections)
    .innerJoin(billDocuments, eq(billDocuments.id, documentSections.documentId))
    .where(
      and(
        eq(documentSections.documentId, requiredInputText(input.documentId, "documentId")),
        eq(documentSections.id, requiredInputText(input.sectionId, "sectionId"))
      )
    )
    .limit(1)
}

export async function getDocumentSection(
  database: LegislationDatabase,
  input: DocumentSectionDetailInput
): Promise<CanonicalDocumentSectionRead> {
  const rows = await buildDocumentSectionDetailQuery(database, input)
  const row = rows[0]
  if (row === undefined) {
    throw new LegislationError("not_found", `Document section ${input.sectionId} was not found`)
  }
  return documentSectionReadFromPersistence(row.document, row.section)
}

export function buildDocumentSectionListQuery(database: LegislationDatabase, input: DocumentSectionListInput) {
  const scope = sectionCursorScope(input.documentId, input)
  const cursor = decodeSectionCursor(input.cursor, scope)
  const pagePredicate = pageRangePredicate(documentSections.pageStart, documentSections.pageEnd, input)

  return database
    .select({ document: billDocuments, section: documentSections })
    .from(documentSections)
    .innerJoin(billDocuments, eq(billDocuments.id, documentSections.documentId))
    .where(
      and(
        eq(documentSections.documentId, requiredInputText(input.documentId, "documentId")),
        input.heading === undefined
          ? undefined
          : eq(documentSections.heading, requiredInputText(input.heading, "heading")),
        pagePredicate,
        sectionCursorPredicate(documentSections.ordinal, documentSections.id, cursor)
      )
    )
    .orderBy(asc(documentSections.ordinal), asc(documentSections.id))
    .limit(parseLimit(input.limit) + 1)
}

export async function listDocumentSections(
  database: LegislationDatabase,
  input: DocumentSectionListInput
): Promise<DocumentPage<CanonicalDocumentSectionRead>> {
  const limit = parseLimit(input.limit)
  const rows = await buildDocumentSectionListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows.slice(0, limit).map((row) => documentSectionReadFromPersistence(row.document, row.section))
  const last = rows.at(Math.min(rows.length, limit) - 1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodeSectionCursor(last.section, sectionCursorScope(input.documentId, input))
        : undefined,
    truncated
  }
}

export function buildSupportingMaterialSectionListQuery(
  database: LegislationDatabase,
  input: SupportingMaterialSectionListInput
) {
  const scope = sectionCursorScope(input.materialId, input)
  const cursor = decodeSectionCursor(input.cursor, scope)
  const pagePredicate = pageRangePredicate(
    supportingMaterialSections.pageStart,
    supportingMaterialSections.pageEnd,
    input
  )

  return database
    .select({
      material: {
        createdAt: supportingMaterials.createdAt,
        id: supportingMaterials.id,
        sourceUpdatedAt: supportingMaterials.sourceUpdatedAt,
        sourceUrl: supportingMaterials.sourceUrl,
        updatedAt: supportingMaterials.updatedAt
      },
      section: {
        contentHash: supportingMaterialSections.contentHash,
        heading: supportingMaterialSections.heading,
        id: supportingMaterialSections.id,
        ordinal: supportingMaterialSections.ordinal,
        pageEnd: supportingMaterialSections.pageEnd,
        pageStart: supportingMaterialSections.pageStart,
        text: supportingMaterialSections.text
      }
    })
    .from(supportingMaterialSections)
    .innerJoin(supportingMaterials, eq(supportingMaterials.id, supportingMaterialSections.materialId))
    .where(
      and(
        eq(supportingMaterialSections.materialId, requiredInputText(input.materialId, "materialId")),
        input.heading === undefined
          ? undefined
          : eq(supportingMaterialSections.heading, requiredInputText(input.heading, "heading")),
        pagePredicate,
        sectionCursorPredicate(supportingMaterialSections.ordinal, supportingMaterialSections.id, cursor)
      )
    )
    .orderBy(asc(supportingMaterialSections.ordinal), asc(supportingMaterialSections.id))
    .limit(parseLimit(input.limit) + 1)
}

export async function listSupportingMaterialSections(
  database: LegislationDatabase,
  input: SupportingMaterialSectionListInput
): Promise<DocumentPage<CanonicalSupportingMaterialSectionRead>> {
  const limit = parseLimit(input.limit)
  const rows = await buildSupportingMaterialSectionListQuery(database, input)
  const truncated = rows.length > limit
  const items = rows
    .slice(0, limit)
    .map((row) => supportingMaterialSectionReadFromPersistence(row.material, row.section))
  const last = rows.at(Math.min(rows.length, limit) - 1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodeSectionCursor(last.section, sectionCursorScope(input.materialId, input))
        : undefined,
    truncated
  }
}

export function buildSupportingMaterialExistenceQuery(database: LegislationDatabase, materialId: string) {
  return database
    .select({ id: supportingMaterials.id })
    .from(supportingMaterials)
    .where(eq(supportingMaterials.id, requiredInputText(materialId, "materialId")))
    .limit(1)
}

export async function assertSupportingMaterialExists(database: LegislationDatabase, materialId: string): Promise<void> {
  const rows = await buildSupportingMaterialExistenceQuery(database, materialId)
  if (rows[0] === undefined) {
    throw new LegislationError("not_found", `Supporting material ${materialId} was not found`)
  }
}

function documentCursorScope(input: BillDocumentListInput): DocumentCursorScope {
  return {
    billId: requiredInputText(input.billId, "billId"),
    classification: input.classification ?? null,
    processingStatus: input.processingStatus ?? null,
    versionCode: input.versionCode === undefined ? null : requiredInputText(input.versionCode, "versionCode")
  }
}

function sectionCursorScope(
  parentId: string,
  input: Pick<DocumentSectionListInput, "heading" | "pageFrom" | "pageTo">
): SectionCursorScope {
  validatePageRange(input.pageFrom, input.pageTo)
  return {
    heading: input.heading === undefined ? null : requiredInputText(input.heading, "heading"),
    pageFrom: input.pageFrom ?? null,
    pageTo: input.pageTo ?? null,
    parentId: requiredInputText(parentId, "parentId")
  }
}

function documentCursorPredicate(cursor: DocumentCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  return or(
    greaterAfterNullable(billDocuments.documentDate, cursor.documentDate),
    and(
      equalNullable(billDocuments.documentDate, cursor.documentDate),
      greaterAfterNullable(billDocuments.versionCode, cursor.versionCode)
    ),
    and(
      equalNullable(billDocuments.documentDate, cursor.documentDate),
      equalNullable(billDocuments.versionCode, cursor.versionCode),
      gt(billDocuments.id, cursor.id)
    )
  )
}

function sectionCursorPredicate(ordinal: PgColumn, id: PgColumn, cursor: SectionCursor | undefined): SQL | undefined {
  if (cursor === undefined) {
    return undefined
  }
  return or(gt(ordinal, cursor.ordinal), and(eq(ordinal, cursor.ordinal), gt(id, cursor.id)))
}

function pageRangePredicate(pageStart: PgColumn, pageEnd: PgColumn, input: PageRangeInput): SQL | undefined {
  validatePageRange(input.pageFrom, input.pageTo)
  return and(
    input.pageFrom === undefined ? undefined : gte(pageEnd, input.pageFrom),
    input.pageTo === undefined ? undefined : lte(pageStart, input.pageTo)
  )
}

function encodeDocumentCursor(row: typeof billDocuments.$inferSelect, scope: DocumentCursorScope): string {
  return encodeCursor({
    documentDate: row.documentDate,
    id: row.id,
    scope,
    version: 1,
    versionCode: row.versionCode
  })
}

function encodeSectionCursor(
  row:
    | Pick<typeof documentSections.$inferSelect, "id" | "ordinal">
    | Pick<typeof supportingMaterialSections.$inferSelect, "id" | "ordinal">,
  scope: SectionCursorScope
): string {
  return encodeCursor({ id: row.id, ordinal: row.ordinal, scope, version: 1 })
}

function decodeDocumentCursor(cursor: string | undefined, scope: DocumentCursorScope): DocumentCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const value = decodeCursor(cursor)
  if (
    value === undefined ||
    value.version !== 1 ||
    !isString(value.id) ||
    !isNullableString(value.documentDate) ||
    !isNullableString(value.versionCode) ||
    !sameScope(value.scope, scope)
  ) {
    throw new LegislationError("invalid_request", "Invalid bill document pagination cursor")
  }
  return { documentDate: value.documentDate, id: value.id, scope, version: 1, versionCode: value.versionCode }
}

function decodeSectionCursor(cursor: string | undefined, scope: SectionCursorScope): SectionCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const value = decodeCursor(cursor)
  if (
    value === undefined ||
    value.version !== 1 ||
    !isString(value.id) ||
    !isNonnegativeInteger(value.ordinal) ||
    !sameScope(value.scope, scope)
  ) {
    throw new LegislationError("invalid_request", "Invalid document section pagination cursor")
  }
  return { id: value.id, ordinal: value.ordinal, scope, version: 1 }
}

function decodeCursor(cursor: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function documentReadFromPersistence(row: DocumentPersistenceRead): CanonicalDocumentRead {
  return {
    billId: requiredId(row.billId, "document billId"),
    byteSize: null,
    classification: documentClassification(row.classification),
    contentHash: nullableHash(row.contentHash, "document contentHash"),
    createdAt: row.createdAt,
    documentDate: nullableIsoDate(row.documentDate, "document documentDate"),
    failureCategory: row.processingErrorCategory,
    id: requiredId(row.id, "document ID"),
    mimeType: row.contentType,
    ocrCompletedAt: row.ocrCompletedAt,
    ocrProvider: row.ocrProvider,
    ocrStatus: ocrStatus(row.ocrStatus, row.processingStatus),
    pageCount: nullablePositiveInteger(row.ocrPageCount, "document pageCount"),
    processingStatus: processingStatus(row.processingStatus),
    sourceUrl: requiredText(row.sourceUrl, "document sourceUrl"),
    storedUrl: null,
    title: requiredText(row.title, "document title"),
    updatedAt: row.updatedAt,
    versionCode: row.versionCode
  }
}

export function documentSectionReadFromPersistence(
  document: Pick<typeof billDocuments.$inferSelect, "billId" | "createdAt" | "sourceUrl" | "updatedAt">,
  section: DocumentSectionPersistenceRead
): CanonicalDocumentSectionRead {
  validateSectionPages(section.pageStart, section.pageEnd, "document section")
  validateSectionOffsets(section.sourceStartOffset, section.sourceEndOffset)
  return {
    document: {
      billId: requiredId(document.billId, "document section billId"),
      createdAt: document.createdAt,
      id: requiredId(section.documentId, "document section documentId"),
      sourceUrl: requiredText(document.sourceUrl, "document section sourceUrl"),
      updatedAt: document.updatedAt
    },
    section: {
      contentHash: requiredHash(section.contentHash, "document section contentHash"),
      heading: section.heading,
      id: requiredId(section.id, "document section ID"),
      ordinal: nonnegativeInteger(section.ordinal, "document section ordinal"),
      pageEnd: section.pageEnd,
      pageStart: section.pageStart,
      sourceEndOffset: nonnegativeInteger(section.sourceEndOffset, "document section sourceEndOffset"),
      sourceStartOffset: nonnegativeInteger(section.sourceStartOffset, "document section sourceStartOffset"),
      text: requiredText(section.text, "document section text")
    }
  }
}

export function supportingMaterialSectionReadFromPersistence(
  material: SupportingMaterialPersistenceRead,
  section: SupportingMaterialSectionPersistenceRead
): CanonicalSupportingMaterialSectionRead {
  validateSectionPages(section.pageStart, section.pageEnd, "supporting material section")
  return {
    material: {
      createdAt: material.createdAt,
      id: requiredId(material.id, "supporting material ID"),
      sourceUpdatedAt: material.sourceUpdatedAt,
      sourceUrl: requiredText(material.sourceUrl, "supporting material section sourceUrl"),
      updatedAt: material.updatedAt
    },
    section: {
      contentHash: requiredHash(section.contentHash, "supporting material section contentHash"),
      heading: section.heading,
      id: requiredId(section.id, "supporting material section ID"),
      ordinal: nonnegativeInteger(section.ordinal, "supporting material section ordinal"),
      pageEnd: section.pageEnd,
      pageStart: section.pageStart,
      text: requiredText(section.text, "supporting material section text")
    }
  }
}

function greaterAfterNullable(column: PgColumn, value: string | null): SQL {
  return value === null ? sql`false` : (or(gt(column, value), sql`${column} is null`) ?? sql`false`)
}

function equalNullable(column: PgColumn, value: string | null): SQL {
  return value === null ? sql`${column} is null` : eq(column, value)
}

function validatePageRange(pageFrom: number | undefined, pageTo: number | undefined): void {
  if (pageFrom !== undefined && !isPositiveInteger(pageFrom)) {
    throw new LegislationError("invalid_request", "pageFrom must be a positive integer")
  }
  if (pageTo !== undefined && !isPositiveInteger(pageTo)) {
    throw new LegislationError("invalid_request", "pageTo must be a positive integer")
  }
  if (pageFrom !== undefined && pageTo !== undefined && pageFrom > pageTo) {
    throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
  }
}

function validateSectionPages(pageStart: number | null, pageEnd: number | null, field: string): void {
  if (pageStart === null && pageEnd === null) {
    return
  }
  if (!isPositiveInteger(pageStart) || !isPositiveInteger(pageEnd) || pageEnd < pageStart) {
    throw new LegislationError("unprocessable", `${field} page mapping is incomplete or invalid`)
  }
}

function validateSectionOffsets(sourceStartOffset: number, sourceEndOffset: number): void {
  if (
    !isNonnegativeInteger(sourceStartOffset) ||
    !isNonnegativeInteger(sourceEndOffset) ||
    sourceEndOffset < sourceStartOffset
  ) {
    throw new LegislationError("unprocessable", "Document section source offsets are invalid")
  }
}

function nullableIsoDate(value: string | null, field: string): string | null {
  if (value !== null && !isIsoDate(value)) {
    throw new LegislationError("unprocessable", `${field} is invalid`)
  }
  return value
}

function documentClassification(value: string): DocumentClassification {
  switch (value) {
    case "amendment":
    case "analysis":
    case "fiscal-note":
    case "supplemental":
    case "version":
      return value
    default:
      throw new LegislationError("unprocessable", "Document classification is not canonical")
  }
}

function processingStatus(value: string): ProcessingStatus {
  switch (value) {
    case "failed":
    case "pending":
    case "processed":
    case "processing":
    case "unsupported":
      return value
    default:
      throw new LegislationError("unprocessable", "Document processing status is not canonical")
  }
}

function ocrStatus(value: string | null, documentProcessingStatus: string): OcrStatus {
  switch (value) {
    case "failed":
    case "not-required":
    case "pending":
    case "processed":
    case "processing":
    case "unsupported":
      return value
    default:
      if (value === null && documentProcessingStatus === "processed") {
        return "not-required"
      }
      throw new LegislationError("unprocessable", "Document OCR status is unavailable")
  }
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function requiredId(value: string, field: string): string {
  return requiredText(value, field)
}

function requiredText(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new LegislationError("unprocessable", `${field} is unavailable`)
  }
  return value
}

function requiredInputText(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new LegislationError("invalid_request", `${field} must not be empty`)
  }
  return value
}

function nullablePositiveInteger(value: number | null, field: string): number | null {
  if (value === null) {
    return null
  }
  return isPositiveInteger(value)
    ? value
    : (() => {
        throw new LegislationError("unprocessable", `${field} is invalid`)
      })()
}

function nonnegativeInteger(value: number, field: string): number {
  if (!isNonnegativeInteger(value)) {
    throw new LegislationError("unprocessable", `${field} is invalid`)
  }
  return value
}

function nullableHash(value: string | null, field: string): string | null {
  return value === null ? null : requiredHash(value, field)
}

function requiredHash(value: string, field: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new LegislationError("unprocessable", `${field} is invalid`)
  }
  return value
}

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function sameScope(value: unknown, expected: object): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
