import { createHash } from "node:crypto"
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, bills } from "../../db/schema/schema.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { artifactPath, type ArtifactStore } from "./artifact-store.js"
import { downloadDocument } from "./download.js"
import {
  classifyDocumentFailure,
  markDocumentProcessingFailure,
  persistProcessedDocument,
  type DocumentFailureCategory
} from "./process.js"

const MAX_REPORTED_FAILURES = 20
const RETRY_BASE_DELAY_MS = 5 * 60 * 1000
const RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000

export interface DocumentJobResult {
  counts: JobCounts & { processed: number; unsupported: number }
  failures: Array<
    Readonly<{ category: DocumentFailureCategory; identifier?: string; message: string; retryable: boolean }>
  >
}

export function documentRetryAt(attempt: number, from = new Date()): Date {
  const exponent = Math.max(0, Math.min(attempt - 1, 30))
  const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS)
  return new Date(from.getTime() + delay)
}

export async function classifyTerminalDocumentFailures(
  database: LegislationDatabase,
  limit = 100_000
): Promise<{ inspected: number; updated: number }> {
  const records = await database
    .select({ id: billDocuments.id, processingError: billDocuments.processingError })
    .from(billDocuments)
    .where(eq(billDocuments.processingStatus, "failed"))
    .orderBy(asc(billDocuments.id))
    .limit(Math.min(Math.max(limit, 1), 100_000))
  const terminalByCategory = Map.groupBy(
    records.flatMap((record) => {
      if (record.processingError === null) {
        return []
      }
      const failure = classifyDocumentFailure(record.processingError)
      return failure.retryable ? [] : [{ category: failure.category, id: record.id }]
    }),
    (record) => record.category
  )
  let updated = 0
  for (const [category, terminalRecords] of terminalByCategory) {
    const terminalIds = terminalRecords.map((record) => record.id)
    updated += terminalIds.length
    await database
      .update(billDocuments)
      .set({
        nextAttemptAt: null,
        processingErrorCategory: category,
        processingStatus: "unsupported",
        updatedAt: new Date()
      })
      .where(inArray(billDocuments.id, terminalIds))
  }
  return { inspected: records.length, updated }
}

export async function requeueInterruptedDocuments(database: LegislationDatabase, before: Date): Promise<number> {
  const result = await database.execute<{ requeued: number }>(sql`
    with requeued as (
      update legislation.bill_documents
      set next_attempt_at = null,
        processing_error = null,
        processing_error_category = null,
        processing_status = 'pending',
        updated_at = now()
      where processing_status = 'processing' and last_attempt_at < ${before}
      returning id
    )
    select count(*)::int as requeued from requeued
  `)
  return result.rows[0]?.requeued ?? 0
}

export async function processPendingDocuments(
  database: LegislationDatabase,
  options: Readonly<{
    artifactStore: ArtifactStore
    billId?: string
    concurrency: number
    documentId?: string
    failureCategory?: DocumentFailureCategory
    fetch?: typeof fetch
    force?: boolean
    jurisdictionId?: string
    limit?: number
    maximumAttempts: number
    shardCount?: number
    shardIndex?: number
    status?: "failed" | "pending" | "unsupported"
    timeoutMs?: number
  }>
): Promise<DocumentJobResult> {
  const limit = Math.min(options.limit ?? 100, 1000)
  const claimStartedAt = new Date()
  let processingSelection = inArray(billDocuments.processingStatus, ["pending", "failed"])
  if (options.documentId !== undefined) {
    processingSelection = eq(billDocuments.id, options.documentId)
  } else if (options.status !== undefined) {
    processingSelection = eq(billDocuments.processingStatus, options.status)
  }
  const records = await database.transaction(async (transaction) => {
    const selected = await transaction
      .select({
        blobPath: billDocuments.blobPath,
        contentType: billDocuments.contentType,
        id: billDocuments.id,
        processingAttempts: billDocuments.processingAttempts,
        processingStatus: billDocuments.processingStatus,
        sourceUrl: billDocuments.sourceUrl
      })
      .from(billDocuments)
      .where(
        and(
          processingSelection,
          options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
          options.jurisdictionId === undefined
            ? undefined
            : sql`exists (select 1 from ${bills} where ${bills.id} = ${billDocuments.billId} and ${bills.jurisdictionId} = ${options.jurisdictionId})`,
          options.failureCategory === undefined
            ? undefined
            : eq(billDocuments.processingErrorCategory, options.failureCategory),
          options.force === true
            ? undefined
            : and(
                or(
                  eq(billDocuments.processingStatus, "processed"),
                  lt(billDocuments.processingAttempts, options.maximumAttempts)
                ),
                or(
                  sql`${billDocuments.processingStatus} <> 'failed'`,
                  isNull(billDocuments.nextAttemptAt),
                  lte(billDocuments.nextAttemptAt, claimStartedAt)
                )
              ),
          (options.shardCount ?? 1) === 1
            ? undefined
            : sql`((hashtextextended(${billDocuments.id}, 0) % ${options.shardCount ?? 1}) + ${options.shardCount ?? 1}) % ${options.shardCount ?? 1} = ${options.shardIndex ?? 0}`
        )
      )
      .orderBy(asc(billDocuments.id))
      .limit(limit)
      .for("update", { skipLocked: true })
    const claimedIds = selected
      .filter((record) => record.processingStatus !== "processed" || options.force === true)
      .map((record) => record.id)
    if (claimedIds.length > 0) {
      await transaction
        .update(billDocuments)
        .set({
          lastAttemptAt: claimStartedAt,
          nextAttemptAt: null,
          processingAttempts: sql`${billDocuments.processingAttempts} + 1`,
          processingError: null,
          processingErrorCategory: null,
          processingStatus: "processing",
          updatedAt: claimStartedAt
        })
        .where(inArray(billDocuments.id, claimedIds))
    }
    return selected
  })
  const counts = { ...createJobCounts({ discovered: records.length }), processed: 0, unsupported: 0 }
  const failures: DocumentJobResult["failures"] = []

  await mapConcurrent(records, options.concurrency, async (record) => {
    if (record.processingStatus === "processed" && options.force !== true) {
      counts.skipped += 1
      counts.unchanged += 1
      return
    }
    try {
      const existingArtifactPath = options.force === true ? null : record.blobPath
      const hasArtifact = existingArtifactPath !== null && (await options.artifactStore.exists(existingArtifactPath))
      const downloaded = hasArtifact
        ? {
            bytes: await options.artifactStore.read(existingArtifactPath),
            contentType: record.contentType ?? "application/octet-stream",
            sourceUrl: record.sourceUrl
          }
        : await downloadDocument(record.sourceUrl, {
            fetch: options.fetch,
            timeoutMs: options.timeoutMs
          })
      const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex")
      const path = artifactPath("documents", record.id, contentHash, downloaded.sourceUrl)
      if (!hasArtifact) {
        await options.artifactStore.put(path, downloaded.bytes)
      }
      await database
        .update(billDocuments)
        .set({ blobPath: path, contentType: downloaded.contentType })
        .where(eq(billDocuments.id, record.id))
      const outcome = await persistProcessedDocument(database, {
        bytes: downloaded.bytes,
        contentType: downloaded.contentType,
        documentId: record.id
      })
      counts.read += 1
      if (outcome === "unchanged") {
        counts.unchanged += 1
      } else {
        counts.processed += 1
        counts.updated += 1
      }
    } catch (error) {
      const failure = classifyDocumentFailure(error)
      const attempt = record.processingAttempts + 1
      const retryable = failure.retryable && attempt < options.maximumAttempts
      const unsupported = !failure.retryable
      await markDocumentProcessingFailure(database, record.id, {
        category: failure.category,
        nextAttemptAt: retryable ? documentRetryAt(attempt) : undefined,
        processingError: failure.message,
        status: unsupported ? "unsupported" : "failed"
      })
      counts.failed += 1
      if (unsupported) {
        counts.unsupported += 1
      }
      if (failures.length < MAX_REPORTED_FAILURES) {
        failures.push({
          category: failure.category,
          identifier: record.id,
          message: failure.message,
          retryable
        })
      }
    }
  })
  return { counts, failures }
}
