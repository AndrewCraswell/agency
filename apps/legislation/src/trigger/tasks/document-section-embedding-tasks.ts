import { createHash } from "node:crypto"
import { idempotencyKeys, task } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import type { OcrProcessedDocumentIdentity } from "../../ingestion/documents/ocr-jobs.js"
import {
  embedDocumentSections,
  type EmbeddingClient,
  type EmbeddingJobResult
} from "../../ingestion/embeddings/jobs.js"
import { embeddingRouteFor } from "../../models/embedding-routing.js"
import { OpenRouterEmbeddingClient } from "../../models/openrouter-embeddings.js"

const documentSectionEmbeddingPayloadSchema = z
  .object({
    documentId: z.string().trim().min(1).max(500),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    ocrRunId: z.string().trim().min(1).max(500)
  })
  .strict()

interface DocumentSectionEmbeddingDependencies {
  embed: (options: Readonly<{ afterId: string; documentId: string; rolloutId: string }>) => Promise<EmbeddingJobResult>
}

export interface DocumentSectionEmbeddingDispatch {
  idempotencyKey: string
  payload: Readonly<{ contentHash: string; documentId: string; ocrRunId: string }>
}

interface PostOcrEmbeddingDispatchDependencies {
  dispatch: (items: readonly DocumentSectionEmbeddingDispatch[]) => Promise<void>
}

/**
 * Refreshes every missing or stale section embedding for exactly one document.
 * The embedding job's input hashes make a retry safe after partial persistence.
 */
export async function runDocumentSectionEmbeddingRefresh(
  documentId: string,
  ocrRunId: string,
  dependencies: DocumentSectionEmbeddingDependencies
) {
  let afterId = ""
  let embedded = 0
  let scanned = 0
  let skipped = 0
  while (true) {
    const result = await dependencies.embed({ afterId, documentId, rolloutId: ocrRunId })
    if (!result.complete && result.cursor === afterId) {
      throw new Error("Document-section embedding cursor did not advance")
    }
    embedded += result.embedded
    scanned += result.scanned
    skipped += result.skipped
    if (result.complete) {
      if (scanned === 0) {
        throw new Error(`OCR document ${documentId} has no sections to embed`)
      }
      return { complete: true, documentId, embedded, scanned, skipped }
    }
    afterId = result.cursor
  }
}

export function postOcrEmbeddingIdempotencyKey(document: OcrProcessedDocumentIdentity): string {
  const workDigest = createHash("sha256")
    .update(`${document.id}\0${document.contentHash}\0document-section-embedding-v1`)
    .digest("base64url")
  return `ocr-document-section-embedding:${workDigest}`
}

/** Schedules one deduplicated, independently retryable embedding refresh per OCR document. */
export async function schedulePostOcrEmbeddingRefreshes(
  documents: readonly OcrProcessedDocumentIdentity[],
  ocrRunId: string,
  dependencies: PostOcrEmbeddingDispatchDependencies
): Promise<number> {
  const uniqueDocuments = [...new Map(documents.map((document) => [document.id, document])).values()].toSorted(
    (left, right) => left.id.localeCompare(right.id)
  )
  if (uniqueDocuments.length === 0) {
    return 0
  }
  await dependencies.dispatch(
    uniqueDocuments.map((document) => ({
      idempotencyKey: postOcrEmbeddingIdempotencyKey(document),
      payload: { contentHash: document.contentHash, documentId: document.id, ocrRunId }
    }))
  )
  return uniqueDocuments.length
}

export const documentSectionEmbeddingRefresh = task({
  id: "document-section-embedding-refresh",
  maxDuration: 3_600,
  queue: { concurrencyLimit: 4, name: "legislation-document-section-embedding" },
  run: async (unparsedPayload: unknown) => {
    const payload = documentSectionEmbeddingPayloadSchema.parse(unparsedPayload)
    const config = loadConfig()
    if (config.model.apiKey === undefined) {
      throw new Error("OPENROUTER_API_KEY is required for document-section embeddings")
    }
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })
    const client: EmbeddingClient = new OpenRouterEmbeddingClient({
      apiKey: config.model.apiKey,
      baseUrl: new URL(config.model.baseUrl),
      maximumAttempts: config.ingestion.maxAttempts,
      route: embeddingRouteFor("document-section"),
      timeoutMs: config.ingestion.requestTimeoutMs
    })
    try {
      return await runDocumentSectionEmbeddingRefresh(payload.documentId, payload.ocrRunId, {
        embed: async (options) =>
          await embedDocumentSections(database, client, {
            ...options,
            limit: 64,
            scanLimit: 512
          })
      })
    } finally {
      await pool.end()
    }
  }
})

export async function dispatchPostOcrEmbeddingRefreshes(
  documents: readonly OcrProcessedDocumentIdentity[],
  ocrRunId: string
): Promise<number> {
  return await schedulePostOcrEmbeddingRefreshes(documents, ocrRunId, {
    dispatch: async (items) => {
      await documentSectionEmbeddingRefresh.batchTrigger(
        await Promise.all(
          items.map(async (item) => ({
            options: {
              idempotencyKey: await idempotencyKeys.create(item.idempotencyKey, { scope: "global" })
            },
            payload: item.payload
          }))
        )
      )
    }
  })
}
