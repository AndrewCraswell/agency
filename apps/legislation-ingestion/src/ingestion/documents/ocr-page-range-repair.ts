import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { billDocuments, documentSections } from "@repo/legislation-core/database/schema/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import type { ArtifactStore } from "./artifact-store.js"
import { detectDocumentContentType } from "./download.js"
import { extractDocument } from "./extract.js"
import type { OcrClient, OcrResult } from "./ocr-client.js"
import { mapOcrPagesToDocumentSections, type DocumentSectionPageRange } from "./ocr-page-mapping.js"

const MAXIMUM_EXPLICIT_REPAIR_DOCUMENTS = 25

export interface OcrPageRangeRepairSnapshot {
  blobPath: string
  contentHash: string
  contentType: string
  id: string
  ocrCompletedAt: Date
  ocrPageCount: number
  ocrProvider: string
  ocrStatus: string
  processingStatus: string
  sections: OcrPageRangeRepairSectionSnapshot[]
  text: string
  updatedAt: Date
}

export interface OcrPageRangeRepairSectionSnapshot {
  contentHash: string
  documentId: string
  heading: string | null
  id: string
  ordinal: number
  pageEnd: number | null
  pageStart: number | null
  sectionIdentifier: string | null
  sourceEndOffset: number
  sourceStartOffset: number
  text: string
}

export interface OcrPageRangeRepairResult {
  alreadyComplete: number
  pages: number
  repaired: number
  targeted: number
}

export class OcrPageRangeRepairError extends Error {
  readonly documentId: string

  constructor(documentId: string, message: string) {
    super(`OCR page-range repair refused ${documentId}: ${message}`)
    this.documentId = documentId
    this.name = "OcrPageRangeRepairError"
  }
}

/**
 * Re-OCRs a bounded, explicit set of processed documents solely to recover
 * page ranges. Existing document text, sections, OCR state, and embeddings are
 * immutable in this operation.
 */
export async function repairOcrDocumentPageRanges(
  database: LegislationDatabase,
  input: Readonly<{
    artifactStore: ArtifactStore
    documentIds: readonly string[]
    ocr: OcrClient
  }>
): Promise<OcrPageRangeRepairResult> {
  const documentIds = validateExplicitDocumentIds(input.documentIds)
  let alreadyComplete = 0
  let pages = 0
  let repaired = 0

  for (const documentId of documentIds) {
    const snapshot = await loadRepairSnapshot(database, documentId)
    if (hasCompletePageRanges(snapshot.sections, snapshot.ocrPageCount)) {
      alreadyComplete += 1
      continue
    }
    if (!hasEmptyPageRanges(snapshot.sections)) {
      throw new OcrPageRangeRepairError(documentId, "existing section page ranges are partially populated")
    }

    const sourceBytes = await input.artifactStore.read(snapshot.blobPath)
    const contentType = detectDocumentContentType(sourceBytes, snapshot.contentType)
    const ocrResult = await input.ocr.recognize({ bytes: sourceBytes, contentType, documentId })
    const ranges = await createOcrPageRangeRepairPlan(snapshot, sourceBytes, ocrResult)

    const outcome = await applyPageRangesIfUnchanged(database, snapshot, ranges)
    if (outcome === "already-complete") {
      alreadyComplete += 1
    } else {
      repaired += 1
    }
    pages += snapshot.ocrPageCount
  }

  return { alreadyComplete, pages, repaired, targeted: documentIds.length }
}

export async function createOcrPageRangeRepairPlan(
  snapshot: OcrPageRangeRepairSnapshot,
  sourceBytes: Uint8Array,
  ocrResult: OcrResult
): Promise<ReadonlyMap<string, DocumentSectionPageRange>> {
  const sourceHash = createHash("sha256").update(sourceBytes).digest("hex")
  if (sourceHash !== snapshot.contentHash) {
    throw new OcrPageRangeRepairError(snapshot.id, "retained artifact SHA-256 does not match content_hash")
  }
  if (ocrResult.pageCount === undefined || ocrResult.pageCount !== snapshot.ocrPageCount) {
    throw new OcrPageRangeRepairError(snapshot.id, "provider page count does not match stored OCR page count")
  }
  if (ocrResult.pages === undefined || ocrResult.pages.length !== ocrResult.pageCount) {
    throw new OcrPageRangeRepairError(
      snapshot.id,
      `provider did not return a complete page-span sequence${
        ocrResult.pageSpanIssue === undefined ? "" : `: ${ocrResult.pageSpanIssue}`
      }`
    )
  }

  const extraction = await extractDocument(snapshot.id, new TextEncoder().encode(ocrResult.text), "text/plain")
  if (extraction.text !== snapshot.text) {
    throw new OcrPageRangeRepairError(snapshot.id, "normalized OCR text changed")
  }
  assertSectionsUnchanged(snapshot.id, snapshot.sections, extraction.sections)

  const ranges = mapOcrPagesToDocumentSections(ocrResult.text, extraction.text, extraction.sections, ocrResult.pages)
  if (ranges.size !== snapshot.sections.length) {
    throw new OcrPageRangeRepairError(snapshot.id, "not every persisted section received an exact page range")
  }
  return ranges
}

function validateExplicitDocumentIds(documentIds: readonly string[]): string[] {
  if (documentIds.length === 0 || documentIds.length > MAXIMUM_EXPLICIT_REPAIR_DOCUMENTS) {
    throw new RangeError(`OCR page-range repair requires 1 through ${MAXIMUM_EXPLICIT_REPAIR_DOCUMENTS} document IDs`)
  }
  const normalized = documentIds.map((id) => id.trim())
  if (normalized.some((id) => id.length === 0 || id.length > 500)) {
    throw new RangeError("OCR page-range repair document IDs must contain 1 through 500 characters")
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new RangeError("OCR page-range repair document IDs must be unique")
  }
  return normalized
}

async function loadRepairSnapshot(
  database: LegislationDatabase,
  documentId: string
): Promise<OcrPageRangeRepairSnapshot> {
  const [document] = await database
    .select({
      blobPath: billDocuments.blobPath,
      contentHash: billDocuments.contentHash,
      contentType: billDocuments.contentType,
      id: billDocuments.id,
      ocrCompletedAt: billDocuments.ocrCompletedAt,
      ocrPageCount: billDocuments.ocrPageCount,
      ocrProvider: billDocuments.ocrProvider,
      ocrStatus: billDocuments.ocrStatus,
      processingStatus: billDocuments.processingStatus,
      text: billDocuments.text,
      updatedAt: billDocuments.updatedAt
    })
    .from(billDocuments)
    .where(eq(billDocuments.id, documentId))
    .limit(1)
  if (document === undefined) {
    throw new OcrPageRangeRepairError(documentId, "document does not exist")
  }
  assertRepairableDocument(documentId, document)

  const sections = await selectRepairSections(database, documentId)
  if (sections.length === 0) {
    throw new OcrPageRangeRepairError(documentId, "document has no persisted sections")
  }
  return { ...document, sections }
}

function assertRepairableDocument(
  documentId: string,
  document: Readonly<{
    blobPath: string | null
    contentHash: string | null
    contentType: string | null
    ocrCompletedAt: Date | null
    ocrPageCount: number | null
    ocrProvider: string | null
    ocrStatus: string | null
    processingStatus: string
    text: string | null
    updatedAt: Date
  }>
): asserts document is typeof document & {
  blobPath: string
  contentHash: string
  contentType: string
  ocrCompletedAt: Date
  ocrPageCount: number
  ocrProvider: string
  ocrStatus: string
  text: string
} {
  if (document.processingStatus !== "processed" || document.ocrStatus !== "processed") {
    throw new OcrPageRangeRepairError(documentId, "document is not in processed OCR state")
  }
  if (
    document.blobPath === null ||
    document.contentHash === null ||
    document.contentType === null ||
    document.ocrCompletedAt === null ||
    document.ocrPageCount === null ||
    document.ocrProvider === null ||
    document.text === null
  ) {
    throw new OcrPageRangeRepairError(documentId, "required processed-document metadata is missing")
  }
}

function selectRepairSections(database: LegislationDatabase, documentId: string) {
  return database
    .select({
      contentHash: documentSections.contentHash,
      documentId: documentSections.documentId,
      heading: documentSections.heading,
      id: documentSections.id,
      ordinal: documentSections.ordinal,
      pageEnd: documentSections.pageEnd,
      pageStart: documentSections.pageStart,
      sectionIdentifier: documentSections.sectionIdentifier,
      sourceEndOffset: documentSections.sourceEndOffset,
      sourceStartOffset: documentSections.sourceStartOffset,
      text: documentSections.text
    })
    .from(documentSections)
    .where(eq(documentSections.documentId, documentId))
    .orderBy(asc(documentSections.ordinal), asc(documentSections.id))
}

function assertSectionsUnchanged(
  documentId: string,
  persisted: readonly OcrPageRangeRepairSectionSnapshot[],
  extracted: readonly Readonly<{
    contentHash: string
    endOffset: number
    heading?: string
    id: string
    identifier?: string
    ordinal: number
    startOffset: number
    text: string
  }>[]
): void {
  if (persisted.length !== extracted.length) {
    throw new OcrPageRangeRepairError(documentId, "deterministic section count changed")
  }
  for (const [index, section] of persisted.entries()) {
    const candidate = extracted[index]
    if (
      candidate === undefined ||
      section.id !== candidate.id ||
      section.ordinal !== candidate.ordinal ||
      section.contentHash !== candidate.contentHash ||
      section.sourceStartOffset !== candidate.startOffset ||
      section.sourceEndOffset !== candidate.endOffset ||
      section.text !== candidate.text ||
      section.heading !== (candidate.heading ?? null) ||
      section.sectionIdentifier !== (candidate.identifier ?? null)
    ) {
      throw new OcrPageRangeRepairError(documentId, `deterministic section ${index} changed`)
    }
  }
}

async function applyPageRangesIfUnchanged(
  database: LegislationDatabase,
  snapshot: OcrPageRangeRepairSnapshot,
  ranges: ReadonlyMap<string, DocumentSectionPageRange>
): Promise<"already-complete" | "repaired"> {
  return await database.transaction(async (transaction) => {
    const [currentDocument] = await transaction
      .select({
        blobPath: billDocuments.blobPath,
        contentHash: billDocuments.contentHash,
        contentType: billDocuments.contentType,
        id: billDocuments.id,
        ocrCompletedAt: billDocuments.ocrCompletedAt,
        ocrPageCount: billDocuments.ocrPageCount,
        ocrProvider: billDocuments.ocrProvider,
        ocrStatus: billDocuments.ocrStatus,
        processingStatus: billDocuments.processingStatus,
        text: billDocuments.text,
        updatedAt: billDocuments.updatedAt
      })
      .from(billDocuments)
      .where(eq(billDocuments.id, snapshot.id))
      .limit(1)
      .for("update")
    if (currentDocument === undefined) {
      throw new OcrPageRangeRepairError(snapshot.id, "document changed while OCR was running")
    }

    const currentSections = await transaction
      .select({
        contentHash: documentSections.contentHash,
        documentId: documentSections.documentId,
        heading: documentSections.heading,
        id: documentSections.id,
        ordinal: documentSections.ordinal,
        pageEnd: documentSections.pageEnd,
        pageStart: documentSections.pageStart,
        sectionIdentifier: documentSections.sectionIdentifier,
        sourceEndOffset: documentSections.sourceEndOffset,
        sourceStartOffset: documentSections.sourceStartOffset,
        text: documentSections.text
      })
      .from(documentSections)
      .where(eq(documentSections.documentId, snapshot.id))
      .orderBy(asc(documentSections.ordinal), asc(documentSections.id))
      .for("update")
    const guardedState = validateOcrPageRangeRepairConcurrencyGuard(snapshot, currentDocument, currentSections, ranges)
    if (guardedState === "already-complete") {
      return guardedState
    }

    for (const section of currentSections) {
      const range = ranges.get(section.id)
      if (range === undefined) {
        throw new OcrPageRangeRepairError(snapshot.id, `section ${section.id} has no planned page range`)
      }
      const updated = await transaction
        .update(documentSections)
        .set({ pageEnd: range.pageEnd, pageStart: range.pageStart })
        .where(
          and(
            eq(documentSections.id, section.id),
            eq(documentSections.documentId, snapshot.id),
            eq(documentSections.contentHash, section.contentHash),
            eq(documentSections.sourceStartOffset, section.sourceStartOffset),
            eq(documentSections.sourceEndOffset, section.sourceEndOffset),
            isNull(documentSections.pageStart),
            isNull(documentSections.pageEnd)
          )
        )
        .returning({ id: documentSections.id })
      if (updated.length !== 1) {
        throw new OcrPageRangeRepairError(snapshot.id, `section ${section.id} failed its concurrency guard`)
      }
    }
    return "repaired"
  })
}

export function validateOcrPageRangeRepairConcurrencyGuard(
  snapshot: OcrPageRangeRepairSnapshot,
  currentDocument: Readonly<{
    blobPath: string | null
    contentHash: string | null
    contentType: string | null
    id: string
    ocrCompletedAt: Date | null
    ocrPageCount: number | null
    ocrProvider: string | null
    ocrStatus: string | null
    processingStatus: string
    text: string | null
    updatedAt: Date
  }>,
  currentSections: readonly OcrPageRangeRepairSectionSnapshot[],
  ranges: ReadonlyMap<string, DocumentSectionPageRange>
): "already-complete" | "ready" {
  if (!sameDocumentSnapshot(snapshot, currentDocument)) {
    throw new OcrPageRangeRepairError(snapshot.id, "document changed while OCR was running")
  }
  if (sameSectionSnapshots(snapshot.sections, currentSections)) {
    return "ready"
  }
  if (hasPlannedPageRanges(currentSections, ranges)) {
    return "already-complete"
  }
  throw new OcrPageRangeRepairError(snapshot.id, "sections changed while OCR was running")
}

function sameDocumentSnapshot(
  expected: OcrPageRangeRepairSnapshot,
  actual: Readonly<{
    blobPath: string | null
    contentHash: string | null
    contentType: string | null
    id: string
    ocrCompletedAt: Date | null
    ocrPageCount: number | null
    ocrProvider: string | null
    ocrStatus: string | null
    processingStatus: string
    text: string | null
    updatedAt: Date
  }>
): boolean {
  return (
    expected.id === actual.id &&
    expected.blobPath === actual.blobPath &&
    expected.contentHash === actual.contentHash &&
    expected.contentType === actual.contentType &&
    sameDate(expected.ocrCompletedAt, actual.ocrCompletedAt) &&
    expected.ocrPageCount === actual.ocrPageCount &&
    expected.ocrProvider === actual.ocrProvider &&
    expected.ocrStatus === actual.ocrStatus &&
    expected.processingStatus === actual.processingStatus &&
    expected.text === actual.text &&
    sameDate(expected.updatedAt, actual.updatedAt)
  )
}

function sameSectionSnapshots(
  expected: readonly OcrPageRangeRepairSectionSnapshot[],
  actual: readonly OcrPageRangeRepairSectionSnapshot[]
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((section, index) => {
      const candidate = actual[index]
      return (
        candidate !== undefined &&
        section.id === candidate.id &&
        section.documentId === candidate.documentId &&
        section.ordinal === candidate.ordinal &&
        section.contentHash === candidate.contentHash &&
        section.sourceStartOffset === candidate.sourceStartOffset &&
        section.sourceEndOffset === candidate.sourceEndOffset &&
        section.text === candidate.text &&
        section.heading === candidate.heading &&
        section.sectionIdentifier === candidate.sectionIdentifier &&
        section.pageStart === candidate.pageStart &&
        section.pageEnd === candidate.pageEnd
      )
    })
  )
}

function hasEmptyPageRanges(
  sections: readonly Pick<OcrPageRangeRepairSectionSnapshot, "pageEnd" | "pageStart">[]
): boolean {
  return sections.every((section) => section.pageStart === null && section.pageEnd === null)
}

export function hasCompleteOcrPageRanges(
  sections: readonly Pick<OcrPageRangeRepairSectionSnapshot, "pageEnd" | "pageStart">[],
  pageCount: number
): boolean {
  return sections.every(
    (section) =>
      section.pageStart !== null &&
      section.pageEnd !== null &&
      section.pageStart > 0 &&
      section.pageEnd >= section.pageStart &&
      section.pageEnd <= pageCount
  )
}

function hasCompletePageRanges(
  sections: readonly Pick<OcrPageRangeRepairSectionSnapshot, "pageEnd" | "pageStart">[],
  pageCount: number
): boolean {
  return hasCompleteOcrPageRanges(sections, pageCount)
}

function sameDate(left: Date, right: Date | null): boolean {
  return right !== null && left.getTime() === right.getTime()
}

function hasPlannedPageRanges(
  sections: readonly Pick<OcrPageRangeRepairSectionSnapshot, "id" | "pageEnd" | "pageStart">[],
  ranges: ReadonlyMap<string, DocumentSectionPageRange>
): boolean {
  return (
    sections.length === ranges.size &&
    sections.every((section) => {
      const range = ranges.get(section.id)
      return range !== undefined && section.pageStart === range.pageStart && section.pageEnd === range.pageEnd
    })
  )
}
