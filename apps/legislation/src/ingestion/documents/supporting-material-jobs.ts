import { createHash } from "node:crypto"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { supportingMaterials } from "../../db/schema/schema.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { artifactPath, type ArtifactStore } from "./artifact-store.js"
import { downloadDocument } from "./download.js"
import { isTerminalDocumentFailure } from "./process.js"
import {
  markSupportingMaterialProcessingFailure,
  persistProcessedSupportingMaterial
} from "./supporting-material-process.js"

export interface SupportingMaterialJobResult {
  counts: JobCounts & { processed: number; unsupported: number }
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function processPendingSupportingMaterials(
  database: LegislationDatabase,
  options: Readonly<{
    artifactStore: ArtifactStore
    concurrency: number
    fetch?: typeof fetch
    force?: boolean
    jurisdictionId?: string
    limit?: number
    materialId?: string
    status?: "failed" | "pending" | "unsupported"
    timeoutMs?: number
  }>
): Promise<SupportingMaterialJobResult> {
  const limit = Math.min(options.limit ?? 100, 1000)
  let processingSelection = inArray(supportingMaterials.processingStatus, ["pending", "failed"])
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
      processingStatus: supportingMaterials.processingStatus,
      sourceUrl: supportingMaterials.sourceUrl
    })
    .from(supportingMaterials)
    .where(
      and(
        processingSelection,
        options.jurisdictionId === undefined
          ? undefined
          : eq(supportingMaterials.jurisdictionId, options.jurisdictionId)
      )
    )
    .orderBy(asc(supportingMaterials.id))
    .limit(limit)
  const counts = { ...createJobCounts({ discovered: records.length }), processed: 0, unsupported: 0 }
  const failures: SupportingMaterialJobResult["failures"] = []

  await mapConcurrent(records, options.concurrency, async (record) => {
    if (record.processingStatus === "processed" && options.force !== true) {
      counts.skipped += 1
      counts.unchanged += 1
      return
    }
    await database
      .update(supportingMaterials)
      .set({
        processingAttempts: sql`${supportingMaterials.processingAttempts} + 1`,
        processingError: null,
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
        : await downloadDocument(record.sourceUrl, { fetch: options.fetch, timeoutMs: options.timeoutMs })
      const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex")
      const path = artifactPath("supporting-materials", record.id, contentHash, downloaded.sourceUrl)
      if (!hasArtifact) {
        await options.artifactStore.put(path, downloaded.bytes)
      }
      await database
        .update(supportingMaterials)
        .set({ blobPath: path, contentType: downloaded.contentType })
        .where(eq(supportingMaterials.id, record.id))
      const outcome = await persistProcessedSupportingMaterial(database, {
        bytes: downloaded.bytes,
        contentType: downloaded.contentType,
        materialId: record.id
      })
      counts.read += 1
      if (outcome === "unchanged") {
        counts.unchanged += 1
      } else {
        counts.processed += 1
        counts.updated += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown supporting-material processing failure"
      const unsupported = isTerminalDocumentFailure(message)
      await markSupportingMaterialProcessingFailure(
        database,
        record.id,
        unsupported ? "unsupported" : "failed",
        message
      )
      counts.failed += 1
      if (unsupported) {
        counts.unsupported += 1
      }
      failures.push({ identifier: record.id, message, retryable: !unsupported })
    }
  })
  return { counts, failures }
}
