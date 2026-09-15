import { createHash } from "node:crypto"
import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { supportingMaterials } from "../../db/schema/schema.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { artifactPath, type ArtifactStore } from "./artifact-store.js"
import { detectDocumentContentType, downloadDocument } from "./download.js"
import type { DocumentHostLimiter } from "./host-limiter.js"
import { documentRetryAt, documentStatusForFailure } from "./jobs.js"
import { createPdfExtractionLimiter } from "./pdf-extraction-limiter.js"
import { classifyDocumentFailure } from "./process.js"
import {
  markSupportingMaterialProcessingFailure,
  persistProcessedSupportingMaterial
} from "./supporting-material-process.js"

export interface SupportingMaterialJobResult {
  counts: JobCounts & { processed: number; unsupported: number }
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
  ocrMaterialIds: string[]
}

export async function requeueFailedSupportingMaterials(
  database: LegislationDatabase,
  maximumAttempts = 4
): Promise<number> {
  const result = await database.execute<{ requeued: number }>(sql`
    with requeued as (
      update legislation.supporting_materials
      set next_attempt_at = null, processing_error = null, processing_status = 'pending', updated_at = now()
      where processing_status = 'failed'
        and processing_attempts < ${maximumAttempts}
      returning id
    )
    select count(*)::int as requeued from requeued
  `)
  return result.rows[0]?.requeued ?? 0
}

export async function requeueInterruptedSupportingMaterials(
  database: LegislationDatabase,
  before: Date,
  limit = 1_000,
  shard: Readonly<{ count: number; index: number }> = { count: 1, index: 0 },
  after = new Date(0)
): Promise<number> {
  const boundedLimit = Math.min(Math.max(limit, 1), 10_000)
  const result = await database.execute<{ requeued: number }>(sql`
    with candidates as materialized (
      select id
      from legislation.supporting_materials
      where processing_status = 'processing'
        and coalesce(last_attempt_at, updated_at) >= ${after}
        and (last_attempt_at < ${before} or (last_attempt_at is null and updated_at < ${before}))
        and ${supportingMaterialShardSelection(shard)}
      order by coalesce(last_attempt_at, updated_at), id
      limit ${boundedLimit}
      for update skip locked
    ), requeued as (
      update legislation.supporting_materials materials
      set next_attempt_at = null,
        processing_attempts = greatest(processing_attempts - 1, 0),
        processing_error = null,
        processing_status = 'pending',
        updated_at = now()
      from candidates
      where materials.id = candidates.id
      returning materials.id
    )
    select count(*)::int as requeued from requeued
  `)
  return result.rows[0]?.requeued ?? 0
}

export async function nextSupportingMaterialBackfillAttempt(
  database: LegislationDatabase,
  options: Readonly<{
    interruptedRecoveryAfter?: Date
    interruptedRecoveryDelayMs?: number
    maximumAttempts: number
    maximumOcrAttempts: number
    shardCount?: number
    shardIndex?: number
  }>
): Promise<Readonly<{ hasWork: boolean; nextAttemptAt?: Date }>> {
  const shard = normalizeSupportingMaterialShard(options)
  const records = await database
    .select({ nextAttemptAt: supportingMaterials.nextAttemptAt })
    .from(supportingMaterials)
    .where(
      and(
        or(
          eq(supportingMaterials.processingStatus, "pending"),
          and(
            eq(supportingMaterials.processingStatus, "failed"),
            lt(supportingMaterials.processingAttempts, options.maximumAttempts)
          ),
          and(
            eq(supportingMaterials.processingStatus, "unsupported"),
            eq(supportingMaterials.processingErrorCategory, "ocr-required"),
            lt(supportingMaterials.processingAttempts, options.maximumOcrAttempts)
          )
        ),
        supportingMaterialShardSelection(shard)
      )
    )
    .orderBy(
      sql`${supportingMaterials.nextAttemptAt} nulls first`,
      asc(supportingMaterials.updatedAt),
      asc(supportingMaterials.id)
    )
    .limit(1)
  const record = records[0]
  if (record !== undefined) {
    return record.nextAttemptAt === null ? { hasWork: true } : { hasWork: true, nextAttemptAt: record.nextAttemptAt }
  }
  if (options.interruptedRecoveryAfter === undefined || options.interruptedRecoveryDelayMs === undefined) {
    return { hasWork: false }
  }
  const interrupted = await database
    .select({ lastAttemptAt: supportingMaterials.lastAttemptAt, updatedAt: supportingMaterials.updatedAt })
    .from(supportingMaterials)
    .where(and(eq(supportingMaterials.processingStatus, "processing"), supportingMaterialShardSelection(shard)))
    .orderBy(
      sql`coalesce(${supportingMaterials.lastAttemptAt}, ${supportingMaterials.updatedAt})`,
      asc(supportingMaterials.id)
    )
    .limit(1)
  const interruptedAt = interrupted[0]?.lastAttemptAt ?? interrupted[0]?.updatedAt
  if (interruptedAt === undefined || interruptedAt === null) {
    return { hasWork: false }
  }
  if (interruptedAt < options.interruptedRecoveryAfter) {
    return { hasWork: true }
  }
  return { hasWork: true, nextAttemptAt: new Date(interruptedAt.getTime() + options.interruptedRecoveryDelayMs) }
}

export async function processPendingSupportingMaterials(
  database: LegislationDatabase,
  options: Readonly<{
    artifactStore: ArtifactStore
    concurrency: number
    fetch?: typeof fetch
    force?: boolean
    hostLimiter?: DocumentHostLimiter
    jurisdictionId?: string
    limit?: number
    materialId?: string
    maximumAttempts?: number
    shardCount?: number
    shardIndex?: number
    status?: "failed" | "pending" | "unsupported"
    timeoutMs?: number
  }>
): Promise<SupportingMaterialJobResult> {
  const limit = Math.min(options.limit ?? 100, 1000)
  const maximumAttempts = options.maximumAttempts ?? 4
  const shard = normalizeSupportingMaterialShard(options)
  let processingSelection = or(
    eq(supportingMaterials.processingStatus, "pending"),
    and(
      eq(supportingMaterials.processingStatus, "failed"),
      lt(supportingMaterials.processingAttempts, maximumAttempts),
      or(isNull(supportingMaterials.nextAttemptAt), lte(supportingMaterials.nextAttemptAt, new Date()))
    )
  )
  if (options.materialId !== undefined) {
    processingSelection = eq(supportingMaterials.id, options.materialId)
  } else if (options.status !== undefined) {
    processingSelection = eq(supportingMaterials.processingStatus, options.status)
  }
  const records = await database
    .select({
      blobPath: supportingMaterials.blobPath,
      contentType: supportingMaterials.contentType,
      id: supportingMaterials.id,
      processingAttempts: supportingMaterials.processingAttempts,
      processingStatus: supportingMaterials.processingStatus,
      sourceUrl: supportingMaterials.sourceUrl
    })
    .from(supportingMaterials)
    .where(
      and(
        processingSelection,
        options.jurisdictionId === undefined
          ? undefined
          : eq(supportingMaterials.jurisdictionId, options.jurisdictionId),
        supportingMaterialShardSelection(shard)
      )
    )
    .orderBy(asc(supportingMaterials.id))
    .limit(limit)
  const counts = { ...createJobCounts({ discovered: records.length }), processed: 0, unsupported: 0 }
  const failures: SupportingMaterialJobResult["failures"] = []
  const ocrMaterialIds: string[] = []
  const pdfExtractionLimiter = createPdfExtractionLimiter()

  await mapConcurrent(records, options.concurrency, async (record) => {
    if (record.processingStatus === "processed" && options.force !== true) {
      counts.skipped += 1
      counts.unchanged += 1
      return
    }
    await database
      .update(supportingMaterials)
      .set({
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
        processingAttempts: sql`${supportingMaterials.processingAttempts} + 1`,
        processingError: null,
        processingErrorCategory: null,
        processingStatus: "processing",
        updatedAt: new Date()
      })
      .where(eq(supportingMaterials.id, record.id))
    try {
      const existingArtifactPath = options.force === true ? null : record.blobPath
      const hasArtifact = existingArtifactPath !== null && (await options.artifactStore.exists(existingArtifactPath))
      const downloaded = hasArtifact
        ? {
            bytes: await options.artifactStore.read(existingArtifactPath),
            contentType: record.contentType ?? "application/octet-stream",
            sourceUrl: record.sourceUrl
          }
        : await downloadWithHostLease(options.hostLimiter, record.sourceUrl, () =>
            downloadDocument(record.sourceUrl, {
              detectContentType: false,
              fetch: options.fetch,
              timeoutMs: options.timeoutMs
            })
          )
      const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex")
      const path = artifactPath("supporting-materials", record.id, contentHash, downloaded.sourceUrl)
      if (!hasArtifact) {
        await options.artifactStore.put(path, downloaded.bytes)
      }
      await database
        .update(supportingMaterials)
        .set({ blobPath: path, contentType: downloaded.contentType })
        .where(eq(supportingMaterials.id, record.id))
      downloaded.contentType = detectDocumentContentType(downloaded.bytes, downloaded.contentType)
      const outcome = await pdfExtractionLimiter.run(
        downloaded.contentType,
        async () =>
          await persistProcessedSupportingMaterial(database, {
            bytes: downloaded.bytes,
            contentType: downloaded.contentType,
            materialId: record.id
          })
      )
      counts.read += 1
      if (outcome === "unchanged") {
        counts.unchanged += 1
      } else {
        counts.processed += 1
        counts.updated += 1
      }
    } catch (error) {
      const failure = classifyDocumentFailure(error, record.sourceUrl)
      const attempt = record.processingAttempts + 1
      const status = documentStatusForFailure(failure, attempt, maximumAttempts)
      const nextAttemptAt = status === "pending" ? documentRetryAt(attempt) : undefined
      await markSupportingMaterialProcessingFailure(database, record.id, {
        category: failure.category,
        nextAttemptAt,
        processingError: failure.message,
        status
      })
      counts.failed += 1
      if (status === "unsupported") {
        counts.unsupported += 1
      }
      if (failure.category === "ocr-required") {
        ocrMaterialIds.push(record.id)
      }
      failures.push({ identifier: record.id, message: failure.message, retryable: failure.retryable })
    }
  })
  return { counts, failures, ocrMaterialIds }
}

function normalizeSupportingMaterialShard(input: Readonly<{ shardCount?: number; shardIndex?: number }>): {
  count: number
  index: number
} {
  const count = input.shardCount ?? 1
  const index = input.shardIndex ?? 0
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("Supporting-material shard count must be a positive integer")
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new Error("Supporting-material shard index must be a zero-based integer smaller than shard count")
  }
  return { count, index }
}

export function supportingMaterialShardSelection(shard: Readonly<{ count: number; index: number }>) {
  return shard.count === 1
    ? sql`true`
    : sql`mod(mod(hashtextextended(${supportingMaterials.id}, 0), ${shard.count}) + ${shard.count}, ${
        shard.count
      }) = ${shard.index}`
}

async function downloadWithHostLease<Result>(
  limiter: DocumentHostLimiter | undefined,
  sourceUrl: string,
  download: () => Promise<Result>
): Promise<Result> {
  return limiter === undefined ? download() : limiter.withLease(sourceUrl, download)
}
