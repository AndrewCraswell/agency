import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { billDocuments, documentSections } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { and, asc, eq, gt, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm"
import type { PgColumn } from "drizzle-orm/pg-core"
import type { CanonicalDocumentSectionRead, DocumentPage } from "./document-reads"
import { documentSectionReadFromPersistence } from "./document-reads"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * The MCP-compatible bill-text traversal is deliberately limited to the
 * authoritative, processed version documents. It does not conflate bill
 * analyses, amendments, or incomplete extraction attempts with bill text.
 */
export interface BillTextSectionListInput {
  billId: string
  cursor?: string
  documentIds?: readonly string[]
  heading?: string
  limit?: number
  pageFrom?: number
  pageTo?: number
  versionCodes?: readonly string[]
}

export interface NormalizedBillTextSectionListInput {
  billId: string
  cursor?: string
  documentIds?: readonly string[]
  heading?: string
  limit: number
  pageFrom?: number
  pageTo?: number
  versionCodes?: readonly string[]
}

type BillTextCursorScope = {
  billId: string
  documentIds: readonly string[] | null
  heading: string | null
  pageFrom: number | null
  pageTo: number | null
  versionCodes: readonly string[] | null
}

type BillTextCursor = {
  documentDate: string | null
  documentId: string
  ordinal: number
  scope: BillTextCursorScope
  sectionId: string
  version: 1
  versionCode: string | null
}

/**
 * Normalizes collection filters before either the parent check or the SQL
 * query. That keeps malformed and cursor-scope-mismatched requests from
 * turning an otherwise unnecessary parent lookup into a database call.
 */
export function normalizeBillTextSectionListInput(input: BillTextSectionListInput): NormalizedBillTextSectionListInput {
  const normalized: NormalizedBillTextSectionListInput = {
    billId: requiredInputText(input.billId, "billId"),
    cursor: input.cursor === undefined ? undefined : requiredInputText(input.cursor, "cursor", 4_096),
    documentIds: normalizeFilterSet(input.documentIds, "documentId"),
    heading: input.heading === undefined ? undefined : requiredInputText(input.heading, "heading"),
    limit: parseLimit(input.limit),
    pageFrom: input.pageFrom,
    pageTo: input.pageTo,
    versionCodes: normalizeFilterSet(input.versionCodes, "versionCode")
  }
  validatePageRange(normalized.pageFrom, normalized.pageTo)
  decodeBillTextCursor(normalized.cursor, billTextCursorScope(normalized))
  return normalized
}

export function buildBillTextSectionListQuery(database: LegislationDatabase, input: BillTextSectionListInput) {
  const normalized = normalizeBillTextSectionListInput(input)
  const cursor = decodeBillTextCursor(normalized.cursor, billTextCursorScope(normalized))
  return database
    .select({
      document: {
        billId: billDocuments.billId,
        createdAt: billDocuments.createdAt,
        documentDate: billDocuments.documentDate,
        id: billDocuments.id,
        sourceUrl: billDocuments.sourceUrl,
        updatedAt: billDocuments.updatedAt,
        versionCode: billDocuments.versionCode
      },
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
      }
    })
    .from(documentSections)
    .innerJoin(billDocuments, eq(billDocuments.id, documentSections.documentId))
    .where(
      and(
        eq(billDocuments.billId, normalized.billId),
        eq(billDocuments.classification, "version"),
        eq(billDocuments.processingStatus, "processed"),
        normalized.documentIds === undefined ? undefined : inArray(billDocuments.id, normalized.documentIds),
        normalized.versionCodes === undefined ? undefined : inArray(billDocuments.versionCode, normalized.versionCodes),
        normalized.heading === undefined ? undefined : eq(documentSections.heading, normalized.heading),
        pageRangePredicate(documentSections.pageStart, documentSections.pageEnd, normalized),
        billTextCursorPredicate(cursor)
      )
    )
    .orderBy(
      asc(billDocuments.documentDate),
      asc(billDocuments.versionCode),
      asc(billDocuments.id),
      asc(documentSections.ordinal),
      asc(documentSections.id)
    )
    .limit(normalized.limit + 1)
}

export async function listBillTextSections(
  database: LegislationDatabase,
  input: BillTextSectionListInput
): Promise<DocumentPage<CanonicalDocumentSectionRead>> {
  const normalized = normalizeBillTextSectionListInput(input)
  const rows = await buildBillTextSectionListQuery(database, normalized)
  const truncated = rows.length > normalized.limit
  const items = rows
    .slice(0, normalized.limit)
    .map((row) => documentSectionReadFromPersistence(row.document, row.section))
  const last = rows.at(Math.min(rows.length, normalized.limit) - 1)
  return {
    items,
    nextCursor:
      truncated && last !== undefined
        ? encodeBillTextCursor(last.document, last.section, billTextCursorScope(normalized))
        : undefined,
    truncated
  }
}

function billTextCursorScope(input: NormalizedBillTextSectionListInput): BillTextCursorScope {
  return {
    billId: input.billId,
    documentIds: input.documentIds ?? null,
    heading: input.heading ?? null,
    pageFrom: input.pageFrom ?? null,
    pageTo: input.pageTo ?? null,
    versionCodes: input.versionCodes ?? null
  }
}

function billTextCursorPredicate(cursor: BillTextCursor | undefined): SQL | undefined {
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
      gt(billDocuments.id, cursor.documentId)
    ),
    and(
      equalNullable(billDocuments.documentDate, cursor.documentDate),
      equalNullable(billDocuments.versionCode, cursor.versionCode),
      eq(billDocuments.id, cursor.documentId),
      gt(documentSections.ordinal, cursor.ordinal)
    ),
    and(
      equalNullable(billDocuments.documentDate, cursor.documentDate),
      equalNullable(billDocuments.versionCode, cursor.versionCode),
      eq(billDocuments.id, cursor.documentId),
      eq(documentSections.ordinal, cursor.ordinal),
      gt(documentSections.id, cursor.sectionId)
    )
  )
}

function pageRangePredicate(
  pageStart: PgColumn,
  pageEnd: PgColumn,
  input: Pick<NormalizedBillTextSectionListInput, "pageFrom" | "pageTo">
): SQL | undefined {
  return and(
    input.pageFrom === undefined ? undefined : gte(pageEnd, input.pageFrom),
    input.pageTo === undefined ? undefined : lte(pageStart, input.pageTo)
  )
}

function encodeBillTextCursor(
  document: Readonly<{ documentDate: string | null; id: string; versionCode: string | null }>,
  section: Readonly<{ id: string; ordinal: number }>,
  scope: BillTextCursorScope
): string {
  return encodeCursor({
    documentDate: document.documentDate,
    documentId: document.id,
    ordinal: section.ordinal,
    scope,
    sectionId: section.id,
    version: 1,
    versionCode: document.versionCode
  })
}

function decodeBillTextCursor(cursor: string | undefined, scope: BillTextCursorScope): BillTextCursor | undefined {
  if (cursor === undefined) {
    return undefined
  }
  const value = decodeCursor(cursor)
  if (
    value === undefined ||
    value.version !== 1 ||
    !isNullableString(value.documentDate) ||
    !isString(value.documentId) ||
    !isNonnegativeInteger(value.ordinal) ||
    !isString(value.sectionId) ||
    !isNullableString(value.versionCode) ||
    !sameScope(value.scope, scope)
  ) {
    throw new LegislationError("invalid_request", "Invalid bill text pagination cursor")
  }
  return {
    documentDate: value.documentDate,
    documentId: value.documentId,
    ordinal: value.ordinal,
    scope,
    sectionId: value.sectionId,
    version: 1,
    versionCode: value.versionCode
  }
}

function normalizeFilterSet(values: readonly string[] | undefined, name: string): readonly string[] | undefined {
  if (values === undefined) {
    return undefined
  }
  if (values.length < 1 || values.length > 25) {
    throw new LegislationError("invalid_request", `${name} must contain between 1 and 25 values`)
  }
  const normalized = values.map((value) => requiredInputText(value, name))
  if (new Set(normalized).size !== normalized.length) {
    throw new LegislationError("invalid_request", `${name} values must be unique`)
  }
  return [...normalized].sort()
}

function parseLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be an integer between 1 and ${MAX_LIMIT}`)
  }
  return limit
}

function validatePageRange(pageFrom: number | undefined, pageTo: number | undefined): void {
  if (pageFrom !== undefined && (!Number.isSafeInteger(pageFrom) || pageFrom < 1)) {
    throw new LegislationError("invalid_request", "pageFrom must be a positive integer")
  }
  if (pageTo !== undefined && (!Number.isSafeInteger(pageTo) || pageTo < 1)) {
    throw new LegislationError("invalid_request", "pageTo must be a positive integer")
  }
  if (pageFrom !== undefined && pageTo !== undefined && pageFrom > pageTo) {
    throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
  }
}

function greaterAfterNullable(column: PgColumn, value: string | null): SQL {
  return value === null ? sql`false` : (or(gt(column, value), sql`${column} is null`) ?? sql`false`)
}

function equalNullable(column: PgColumn, value: string | null): SQL {
  return value === null ? sql`${column} is null` : eq(column, value)
}

function requiredInputText(value: string, field: string, maximumLength = 256): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new LegislationError("invalid_request", `${field} must be between 1 and ${maximumLength} characters`)
  }
  return normalized
}

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function decodeCursor(cursor: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

function sameScope(value: unknown, expected: BillTextCursorScope): boolean {
  return isRecord(value) && JSON.stringify(value) === JSON.stringify(expected)
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
