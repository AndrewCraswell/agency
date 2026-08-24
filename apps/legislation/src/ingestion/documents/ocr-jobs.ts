import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments } from "../../db/schema/schema.js"
import { mapConcurrent } from "../job.js"
import { ArtifactNotFoundError, type ArtifactStore } from "./artifact-store.js"
import { detectDocumentContentType } from "./download.js"
import type { OcrClient } from "./ocr-client.js"
import { classifyOcrFailure, OCR_MAXIMUM_ATTEMPTS, type OcrFailureClassification } from "./ocr-retry.js"
import { markDocumentProcessingFailure, persistOcrDocument } from "./process.js"

interface OcrCandidate {
  blobPath: string
  contentType: string | null
  id: string
  processingAttempts: number
  sourceUrl: string
}

export interface OcrDocumentBatchResult {
  claimed: number
  failed: number
  failures: Array<Readonly<{ identifier: string; message: string; retryable: boolean }>>
  pages: number
  processed: number
  rerouted: number
}

export interface OcrDocumentRetryState {
  documentIds: string[]
  nextAttemptAt?: Date
}

const permanentUnsupportedOcrFailureCategories = new Set([
  "download-permanent",
  "malformed-document",
  "not-found",
  "oversized",
  "source-inaccessible",
  "unsafe-url",
  "unsupported-format"
])

/** A completed OCR attempt is failed unless its source or content is terminally unsupported. */
export function ocrStatusForFailure(failure: OcrFailureClassification): "failed" | "unsupported" {
  return !failure.retryable && permanentUnsupportedOcrFailureCategories.has(failure.category) ? "unsupported" : "failed"
}

function ocrProcessingOwner(ownerId: string): string {
  return `ocr-owner:${ownerId}`
}

export async function recoverOwnedOcrDocuments(database: LegislationDatabase, ownerId: string): Promise<number> {
  const recovered = await database
    .update(billDocuments)
    .set({
      nextAttemptAt: null,
      processingAttempts: sql`greatest(${billDocuments.processingAttempts} - 1, 0)`,
      processingError: null,
      ocrCompletedAt: null,
      ocrPageCount: null,
      ocrProvider: null,
      ocrStatus: "pending",
      processingStatus: "unsupported",
      updatedAt: new Date()
    })
    .where(
      and(
        eq(billDocuments.processingStatus, "processing"),
        eq(billDocuments.processingErrorCategory, "ocr-required"),
        eq(billDocuments.processingError, ocrProcessingOwner(ownerId))
      )
    )
    .returning({ id: billDocuments.id })
  return recovered.length
}

export async function findOcrDocumentRetryState(
  database: LegislationDatabase,
  input: Readonly<{ documentIds: readonly string[]; maximumAttempts: number }>
): Promise<OcrDocumentRetryState> {
  if (input.documentIds.length === 0) {
    return { documentIds: [] }
  }
  const now = new Date()
  const maximumAttempts = Math.min(input.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)
  const records = await database
    .select({ id: billDocuments.id, nextAttemptAt: billDocuments.nextAttemptAt })
    .from(billDocuments)
    .where(
      and(
        inArray(billDocuments.id, [...input.documentIds]),
        eq(billDocuments.processingStatus, "unsupported"),
        eq(billDocuments.processingErrorCategory, "ocr-required"),
        sql`${billDocuments.processingAttempts} < ${maximumAttempts}`
      )
    )
    .orderBy(sql`${billDocuments.nextAttemptAt} nulls first`, asc(billDocuments.id))

  const due = records.filter(({ nextAttemptAt }) => nextAttemptAt === null || nextAttemptAt <= now)
  if (due.length > 0) {
    return { documentIds: records.map(({ id }) => id) }
  }
  const nextAttemptAt = records.reduce<Date | undefined>(
    (earliest, record) =>
      record.nextAttemptAt !== null && (earliest === undefined || record.nextAttemptAt < earliest)
        ? record.nextAttemptAt
        : earliest,
    undefined
  )
  return {
    documentIds: records.map(({ id }) => id),
    ...(nextAttemptAt === undefined ? {} : { nextAttemptAt })
  }
}

export async function processOcrRequiredDocuments(
  database: LegislationDatabase,
  input: Readonly<{
    artifactStore: ArtifactStore
    batchSize?: number
    concurrency?: number
    documentId?: string
    documentIds?: readonly string[]
    maximumAttempts: number
    ocr: OcrClient
    ownerId?: string
  }>
): Promise<OcrDocumentBatchResult> {
  const batchSize = Math.min(Math.max(input.batchSize ?? 10, 1), 100)
  const concurrency = Math.min(Math.max(input.concurrency ?? 1, 1), 8)
  if (input.documentId !== undefined && input.documentIds !== undefined) {
    throw new Error("OCR cannot target both documentId and documentIds")
  }

  const now = new Date()
  const maximumAttempts = Math.min(input.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)
  const candidates = await database.transaction(async (transaction) => {
    const records = await transaction
      .select({
        blobPath: billDocuments.blobPath,
        contentType: billDocuments.contentType,
        id: billDocuments.id,
        processingAttempts: billDocuments.processingAttempts,
        sourceUrl: billDocuments.sourceUrl
      })
      .from(billDocuments)
      .where(
        and(
          eq(billDocuments.processingStatus, "unsupported"),
          eq(billDocuments.processingErrorCategory, "ocr-required"),
          isNotNull(billDocuments.blobPath),
          sql`${billDocuments.processingAttempts} < ${maximumAttempts}`,
          input.documentId === undefined ? undefined : eq(billDocuments.id, input.documentId),
          input.documentIds === undefined ? undefined : inArray(billDocuments.id, [...input.documentIds]),
          or(sql`${billDocuments.nextAttemptAt} is null`, lte(billDocuments.nextAttemptAt, now))
        )
      )
      .orderBy(asc(billDocuments.updatedAt), asc(billDocuments.id))
      .limit(batchSize)
      .for("update", { skipLocked: true })
    if (records.length > 0) {
      await transaction
        .update(billDocuments)
        .set({
          lastAttemptAt: now,
          nextAttemptAt: null,
          processingAttempts: sql`${billDocuments.processingAttempts} + 1`,
          ...(input.ownerId === undefined ? {} : { processingError: ocrProcessingOwner(input.ownerId) }),
          ocrCompletedAt: null,
          ocrPageCount: null,
          ocrProvider: null,
          ocrStatus: "processing",
          processingStatus: "processing",
          updatedAt: now
        })
        .where(
          inArray(
            billDocuments.id,
            records.map(({ id }) => id)
          )
        )
    }
    return records.filter((record): record is OcrCandidate => record.blobPath !== null)
  })

  let pages = 0
  let processed = 0
  let rerouted = 0
  const failures: OcrDocumentBatchResult["failures"] = []
  await mapConcurrent(candidates, concurrency, async (record) => {
    try {
      const sourceBytes = await input.artifactStore.read(record.blobPath)
      const contentType = detectDocumentContentType(sourceBytes, record.contentType ?? "")
      const result = await input.ocr.recognize({
        bytes: sourceBytes,
        contentType,
        documentId: record.id
      })
      await persistOcrDocument(database, {
        blobPath: record.blobPath,
        contentType,
        documentId: record.id,
        pageCount: result.pageCount,
        pages: result.pages,
        provider: result.provider,
        sourceBytes,
        text: result.text
      })
      pages += result.pageCount ?? 0
      processed += 1
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        await requeueDocumentWithMissingOcrArtifact(database, record.id)
        rerouted += 1
        return
      }
      const attempt = record.processingAttempts + 1
      const failure = classifyOcrFailure(error, attempt)
      await markDocumentProcessingFailure(database, record.id, {
        category: failure.category,
        ...(failure.nextAttemptAt === undefined ? {} : { nextAttemptAt: failure.nextAttemptAt }),
        ocrStatus: ocrStatusForFailure(failure),
        processingError: failure.message,
        status: "unsupported"
      })
      failures.push({ identifier: record.id, message: failure.message, retryable: failure.retryable })
    }
  })
  return {
    claimed: candidates.length,
    failed: failures.length,
    failures: failures.slice(0, 20),
    pages,
    processed,
    rerouted
  }
}

async function requeueDocumentWithMissingOcrArtifact(database: LegislationDatabase, documentId: string): Promise<void> {
  await database
    .update(billDocuments)
    .set({
      blobPath: null,
      contentHash: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      processingAttempts: 0,
      processingError: null,
      processingErrorCategory: null,
      processingStatus: "pending",
      text: null,
      ocrCompletedAt: null,
      ocrPageCount: null,
      ocrProvider: null,
      ocrStatus: "pending",
      updatedAt: new Date()
    })
    .where(eq(billDocuments.id, documentId))
}
