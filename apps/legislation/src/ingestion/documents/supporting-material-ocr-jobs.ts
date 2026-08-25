import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { supportingMaterials } from "../../db/schema/schema.js"
import { mapConcurrent } from "../job.js"
import { ArtifactNotFoundError, type ArtifactStore } from "./artifact-store.js"
import { detectDocumentContentType } from "./download.js"
import type { OcrClient } from "./ocr-client.js"
import { classifyOcrFailure, OCR_MAXIMUM_ATTEMPTS } from "./ocr-retry.js"
import { supportingMaterialShardSelection } from "./supporting-material-jobs.js"
import { markSupportingMaterialProcessingFailure, persistOcrSupportingMaterial } from "./supporting-material-process.js"

interface OcrSupportingMaterialCandidate {
  blobPath: string
  contentType: string | null
  id: string
  processingAttempts: number
}

export interface OcrSupportingMaterialBatchResult {
  claimed: number
  failed: number
  failures: Array<Readonly<{ identifier: string; message: string; retryable: boolean }>>
  pages: number
  processed: number
  rerouted: number
}

export interface OcrSupportingMaterialRetryState {
  materialIds: string[]
  nextAttemptAt?: Date
}

export async function listOcrRequiredSupportingMaterialIds(
  database: LegislationDatabase,
  input: Readonly<{
    limit?: number
    maximumAttempts: number
    shardCount: number
    shardIndex: number
  }>
): Promise<string[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100)
  const maximumAttempts = Math.min(input.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)
  const records = await database
    .select({ id: supportingMaterials.id })
    .from(supportingMaterials)
    .where(
      and(
        eq(supportingMaterials.processingStatus, "unsupported"),
        eq(supportingMaterials.processingErrorCategory, "ocr-required"),
        sql`${supportingMaterials.processingAttempts} < ${maximumAttempts}`,
        supportingMaterialShardSelection({ count: input.shardCount, index: input.shardIndex })
      )
    )
    .orderBy(
      sql`${supportingMaterials.nextAttemptAt} nulls first`,
      asc(supportingMaterials.updatedAt),
      asc(supportingMaterials.id)
    )
    .limit(limit)
  return records.map(({ id }) => id)
}

function ocrProcessingOwner(ownerId: string): string {
  return `ocr-owner:${ownerId}`
}

export async function recoverOwnedOcrSupportingMaterials(
  database: LegislationDatabase,
  ownerId: string
): Promise<number> {
  const recovered = await database
    .update(supportingMaterials)
    .set({
      nextAttemptAt: null,
      processingAttempts: sql`greatest(${supportingMaterials.processingAttempts} - 1, 0)`,
      processingError: null,
      processingStatus: "unsupported",
      updatedAt: new Date()
    })
    .where(
      and(
        eq(supportingMaterials.processingStatus, "processing"),
        eq(supportingMaterials.processingErrorCategory, "ocr-required"),
        eq(supportingMaterials.processingError, ocrProcessingOwner(ownerId))
      )
    )
    .returning({ id: supportingMaterials.id })
  return recovered.length
}

export async function findOcrSupportingMaterialRetryState(
  database: LegislationDatabase,
  input: Readonly<{ materialIds: readonly string[]; maximumAttempts: number }>
): Promise<OcrSupportingMaterialRetryState> {
  if (input.materialIds.length === 0) {
    return { materialIds: [] }
  }
  const now = new Date()
  const maximumAttempts = Math.min(input.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)
  const records = await database
    .select({ id: supportingMaterials.id, nextAttemptAt: supportingMaterials.nextAttemptAt })
    .from(supportingMaterials)
    .where(
      and(
        inArray(supportingMaterials.id, [...input.materialIds]),
        eq(supportingMaterials.processingStatus, "unsupported"),
        eq(supportingMaterials.processingErrorCategory, "ocr-required"),
        sql`${supportingMaterials.processingAttempts} < ${maximumAttempts}`
      )
    )
    .orderBy(sql`${supportingMaterials.nextAttemptAt} nulls first`, asc(supportingMaterials.id))

  const due = records.filter(({ nextAttemptAt }) => nextAttemptAt === null || nextAttemptAt <= now)
  if (due.length > 0) {
    return { materialIds: records.map(({ id }) => id) }
  }
  const nextAttemptAt = records.reduce<Date | undefined>(
    (earliest, record) =>
      record.nextAttemptAt !== null && (earliest === undefined || record.nextAttemptAt < earliest)
        ? record.nextAttemptAt
        : earliest,
    undefined
  )
  return {
    materialIds: records.map(({ id }) => id),
    ...(nextAttemptAt === undefined ? {} : { nextAttemptAt })
  }
}

export async function processOcrRequiredSupportingMaterials(
  database: LegislationDatabase,
  input: Readonly<{
    artifactStore: ArtifactStore
    concurrency?: number
    materialIds: readonly string[]
    maximumAttempts: number
    ocr: OcrClient
    ownerId?: string
  }>
): Promise<OcrSupportingMaterialBatchResult> {
  const concurrency = Math.min(Math.max(input.concurrency ?? 1, 1), 8)
  const now = new Date()
  const maximumAttempts = Math.min(input.maximumAttempts, OCR_MAXIMUM_ATTEMPTS)
  const candidates = await database.transaction(async (transaction) => {
    const records = await transaction
      .select({
        blobPath: supportingMaterials.blobPath,
        contentType: supportingMaterials.contentType,
        id: supportingMaterials.id,
        processingAttempts: supportingMaterials.processingAttempts
      })
      .from(supportingMaterials)
      .where(
        and(
          inArray(supportingMaterials.id, [...input.materialIds]),
          eq(supportingMaterials.processingStatus, "unsupported"),
          eq(supportingMaterials.processingErrorCategory, "ocr-required"),
          isNotNull(supportingMaterials.blobPath),
          sql`${supportingMaterials.processingAttempts} < ${maximumAttempts}`,
          or(sql`${supportingMaterials.nextAttemptAt} is null`, lte(supportingMaterials.nextAttemptAt, now))
        )
      )
      .orderBy(asc(supportingMaterials.updatedAt), asc(supportingMaterials.id))
      .limit(Math.min(input.materialIds.length, 100))
      .for("update", { skipLocked: true })
    if (records.length > 0) {
      await transaction
        .update(supportingMaterials)
        .set({
          lastAttemptAt: now,
          nextAttemptAt: null,
          processingAttempts: sql`${supportingMaterials.processingAttempts} + 1`,
          ...(input.ownerId === undefined ? {} : { processingError: ocrProcessingOwner(input.ownerId) }),
          processingStatus: "processing",
          updatedAt: now
        })
        .where(
          inArray(
            supportingMaterials.id,
            records.map(({ id }) => id)
          )
        )
    }
    return records.filter((record): record is OcrSupportingMaterialCandidate => record.blobPath !== null)
  })

  let pages = 0
  let processed = 0
  let rerouted = 0
  const failures: OcrSupportingMaterialBatchResult["failures"] = []
  await mapConcurrent(candidates, concurrency, async (record) => {
    try {
      const sourceBytes = await input.artifactStore.read(record.blobPath)
      const contentType = detectDocumentContentType(sourceBytes, record.contentType ?? "")
      const result = await input.ocr.recognize({
        bytes: sourceBytes,
        contentType,
        documentId: record.id
      })
      await persistOcrSupportingMaterial(database, {
        blobPath: record.blobPath,
        contentType,
        materialId: record.id,
        pages: result.pages,
        sourceBytes,
        text: result.text
      })
      pages += result.pageCount ?? 0
      processed += 1
    } catch (error) {
      if (error instanceof ArtifactNotFoundError) {
        await requeueSupportingMaterialWithMissingOcrArtifact(database, record.id)
        rerouted += 1
        return
      }
      const attempt = record.processingAttempts + 1
      const failure = classifyOcrFailure(error, attempt)
      await markSupportingMaterialProcessingFailure(database, record.id, {
        category: failure.category,
        ...(failure.nextAttemptAt === undefined ? {} : { nextAttemptAt: failure.nextAttemptAt }),
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

async function requeueSupportingMaterialWithMissingOcrArtifact(
  database: LegislationDatabase,
  materialId: string
): Promise<void> {
  await database
    .update(supportingMaterials)
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
      updatedAt: new Date()
    })
    .where(eq(supportingMaterials.id, materialId))
}
