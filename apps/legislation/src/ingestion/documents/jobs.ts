import { createHash } from "node:crypto"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, bills } from "../../db/schema/schema.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { artifactPath, type ArtifactStore } from "./artifact-store.js"
import { downloadDocument } from "./download.js"
import {
  boundedProcessingError,
  isTerminalDocumentFailure,
  markDocumentProcessingFailure,
  persistProcessedDocument
} from "./process.js"

export interface DocumentJobResult {
  counts: JobCounts & { processed: number; unsupported: number }
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function requeueFailedDocuments(database: LegislationDatabase): Promise<number> {
  const result = await database.execute<{ requeued: number }>(sql`
    with requeued as (
      update legislation.bill_documents
      set processing_error = null, processing_status = 'pending', updated_at = now()
      where processing_status = 'failed'
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
    fetch?: typeof fetch
    force?: boolean
    jurisdictionId?: string
    limit?: number
    shardCount?: number
    shardIndex?: number
    status?: "failed" | "pending" | "unsupported"
    timeoutMs?: number
  }>
): Promise<DocumentJobResult> {
  const limit = Math.min(options.limit ?? 100, 1000)
  let processingSelection = inArray(billDocuments.processingStatus, ["pending", "failed"])
  if (options.documentId !== undefined) {
    processingSelection = eq(billDocuments.id, options.documentId)
  } else if (options.status !== undefined) {
    processingSelection = eq(billDocuments.processingStatus, options.status)
  }
  const records = await database
    .select({
      blobPath: billDocuments.blobPath,
      contentType: billDocuments.contentType,
      id: billDocuments.id,
      processingStatus: billDocuments.processingStatus,
      sourceUrl: billDocuments.sourceUrl
    })
    .from(billDocuments)
    .innerJoin(bills, eq(billDocuments.billId, bills.id))
    .where(
      and(
        processingSelection,
        options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
        options.jurisdictionId === undefined ? undefined : eq(bills.jurisdictionId, options.jurisdictionId),
        (options.shardCount ?? 1) === 1
          ? undefined
          : sql`((hashtextextended(${billDocuments.id}, 0) % ${options.shardCount ?? 1}) + ${options.shardCount ?? 1}) % ${options.shardCount ?? 1} = ${options.shardIndex ?? 0}`
      )
    )
    .orderBy(asc(billDocuments.id))
    .limit(limit)
  const counts = { ...createJobCounts({ discovered: records.length }), processed: 0, unsupported: 0 }
  const failures: DocumentJobResult["failures"] = []

  await mapConcurrent(records, options.concurrency, async (record) => {
    if (record.processingStatus === "processed" && options.force !== true) {
      counts.skipped += 1
      counts.unchanged += 1
      return
    }
    await database
      .update(billDocuments)
      .set({
        lastAttemptAt: new Date(),
        processingAttempts: sql`${billDocuments.processingAttempts} + 1`,
        processingError: null,
        processingStatus: "processing",
        updatedAt: new Date()
      })
      .where(eq(billDocuments.id, record.id))
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
      const message = boundedProcessingError(
        error instanceof Error ? error.message : "Unknown document processing failure"
      )
      const unsupported = isTerminalDocumentFailure(message)
      await markDocumentProcessingFailure(database, record.id, unsupported ? "unsupported" : "failed", message)
      counts.failed += 1
      if (unsupported) {
        counts.unsupported += 1
      }
      failures.push({ identifier: record.id, message, retryable: !unsupported })
    }
  })
  return { counts, failures }
}
