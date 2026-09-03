import { task, wait } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { AzureDocumentIntelligenceClient } from "../../ingestion/documents/ocr-client.js"
import {
  findOcrDocumentRetryState,
  listOcrProcessedDocuments,
  type OcrProcessedDocumentIdentity,
  type OcrDocumentBatchResult,
  processOcrRequiredDocuments,
  recoverOwnedOcrDocuments
} from "../../ingestion/documents/ocr-jobs.js"
import {
  findOcrSupportingMaterialRetryState,
  type OcrSupportingMaterialBatchResult,
  processOcrRequiredSupportingMaterials,
  recoverOwnedOcrSupportingMaterials
} from "../../ingestion/documents/supporting-material-ocr-jobs.js"
import { dispatchPostOcrEmbeddingRefreshes } from "./document-section-embedding-tasks.js"

const ocrWorkerQueue = { concurrencyLimit: 12, name: "legislation-document-ocr" }
const ocrTargetedPayloadSchema = z
  .object({ documentIds: z.array(z.string().trim().min(1).max(500)).min(1).max(100) })
  .strict()
const ocrTargetedMaterialPayloadSchema = z
  .object({ materialIds: z.array(z.string().trim().min(1).max(500)).min(1).max(100) })
  .strict()
const ocrWorkerPayloadSchema = z.union([ocrTargetedPayloadSchema, ocrTargetedMaterialPayloadSchema])

interface TargetedOcrDependencies {
  deferRetries?: boolean
  process: (itemIds: readonly string[]) => Promise<OcrDocumentBatchResult | OcrSupportingMaterialBatchResult>
  retryState: (itemIds: readonly string[]) => Promise<Readonly<{ itemIds: string[]; nextAttemptAt?: Date }>>
  waitUntil: (date: Date) => Promise<void>
}

interface OcrEmbeddingHandoffDependencies {
  dispatch: (documents: readonly OcrProcessedDocumentIdentity[], ocrRunId: string) => Promise<number>
  listProcessed: (documentIds: readonly string[]) => Promise<OcrProcessedDocumentIdentity[]>
}

export async function handOffProcessedOcrDocumentsToEmbeddings(
  documentIds: readonly string[],
  ocrRunId: string,
  dependencies: OcrEmbeddingHandoffDependencies
): Promise<number> {
  const processedDocumentIds = await dependencies.listProcessed(documentIds)
  return await dependencies.dispatch(processedDocumentIds, ocrRunId)
}

export async function runTargetedOcrItems(itemIds: readonly string[], dependencies: TargetedOcrDependencies) {
  let remaining = [...itemIds]
  let claimed = 0
  let failed = 0
  let pages = 0
  let processed = 0
  let rerouted = 0
  while (remaining.length > 0) {
    const result = await dependencies.process(remaining)
    claimed += result.claimed
    failed += result.failed
    pages += result.pages
    processed += result.processed
    rerouted += result.rerouted
    const retry = await dependencies.retryState(remaining)
    remaining = retry.itemIds
    if (dependencies.deferRetries && remaining.length > 0) {
      return {
        claimed,
        complete: false,
        failed,
        ...(retry.nextAttemptAt === undefined ? {} : { nextAttemptAt: retry.nextAttemptAt }),
        pages,
        processed,
        remaining: remaining.length,
        rerouted,
        targeted: itemIds.length
      }
    }
    if (retry.nextAttemptAt !== undefined) {
      await dependencies.waitUntil(retry.nextAttemptAt)
    }
  }
  return { claimed, complete: true, failed, pages, processed, rerouted, targeted: itemIds.length }
}

export const ocrDocumentWorker = task({
  id: "ocr-document-worker",
  machine: "medium-1x",
  maxDuration: 3_600,
  queue: ocrWorkerQueue,
  retry: {
    outOfMemory: { machine: "large-2x" }
  },
  run: async (unparsedPayload: unknown, { ctx }) => {
    const payload = ocrWorkerPayloadSchema.parse(unparsedPayload)
    const config = loadConfig()
    if (config.azure.storageAccount === undefined || config.ocr.endpoint === undefined) {
      throw new Error("OCR requires Azure Blob Storage and Azure Document Intelligence configuration")
    }
    const { database, pool } = createDatabase({
      ...config.database,
      connectionTimeoutMs: Math.max(config.database.connectionTimeoutMs, 120_000),
      maxConnections: 1
    })
    try {
      if (ctx.attempt.number > 1) {
        await Promise.all([
          recoverOwnedOcrDocuments(database, ctx.run.id),
          recoverOwnedOcrSupportingMaterials(database, ctx.run.id)
        ])
      }
      const artifactStore = new AzureBlobArtifactStore(
        config.azure.storageAccount,
        config.azure.normalizedDocumentContainer
      )
      const ocr = new AzureDocumentIntelligenceClient(config.ocr.endpoint)
      if ("documentIds" in payload) {
        const result = await runTargetedOcrItems(payload.documentIds, {
          process: async (documentIds) =>
            await processOcrRequiredDocuments(database, {
              artifactStore,
              batchSize: documentIds.length,
              concurrency: 1,
              documentIds,
              maximumAttempts: config.ocr.maximumAttempts,
              ocr,
              ownerId: ctx.run.id
            }),
          retryState: async (documentIds) => {
            const retry = await findOcrDocumentRetryState(database, {
              documentIds,
              maximumAttempts: config.ocr.maximumAttempts
            })
            return { itemIds: retry.documentIds, nextAttemptAt: retry.nextAttemptAt }
          },
          waitUntil: async (date) => {
            await wait.until({ date })
          }
        })
        const embeddingRefreshesScheduled = await handOffProcessedOcrDocumentsToEmbeddings(
          payload.documentIds,
          ctx.run.id,
          {
            dispatch: dispatchPostOcrEmbeddingRefreshes,
            listProcessed: async (documentIds) => await listOcrProcessedDocuments(database, documentIds)
          }
        )
        return { ...result, embeddingRefreshesScheduled }
      }
      if ("materialIds" in payload) {
        return await runTargetedOcrItems(payload.materialIds, {
          deferRetries: true,
          process: async (materialIds) =>
            await processOcrRequiredSupportingMaterials(database, {
              artifactStore,
              concurrency: 1,
              materialIds,
              maximumAttempts: config.ocr.maximumAttempts,
              ocr,
              ownerId: ctx.run.id
            }),
          retryState: async (materialIds) => {
            const retry = await findOcrSupportingMaterialRetryState(database, {
              materialIds,
              maximumAttempts: config.ocr.maximumAttempts
            })
            return { itemIds: retry.materialIds, nextAttemptAt: retry.nextAttemptAt }
          },
          waitUntil: async (date) => {
            await wait.until({ date })
          }
        })
      }
      throw new Error("OCR payload must target documentIds or materialIds")
    } finally {
      await pool.end()
    }
  }
})
