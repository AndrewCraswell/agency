import { task } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { AzureDocumentIntelligenceClient } from "../../ingestion/documents/ocr-client.js"
import { repairOcrDocumentPageRanges } from "../../ingestion/documents/ocr-page-range-repair.js"

export const ocrPageRangeRepairPayloadSchema = z
  .object({
    documentIds: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(25)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "documentIds must be unique"
      })
  })
  .strict()

interface OcrPageRangeRepairTaskDependencies {
  repair(
    documentIds: readonly string[]
  ): Promise<Readonly<{ alreadyComplete: number; pages: number; repaired: number; targeted: number }>>
}

export async function runOcrPageRangeRepairTask(
  unparsedPayload: unknown,
  dependencies: OcrPageRangeRepairTaskDependencies
) {
  const payload = ocrPageRangeRepairPayloadSchema.parse(unparsedPayload)
  return await dependencies.repair(payload.documentIds)
}

export const ocrPageRangeRepair = task({
  id: "ocr-document-page-range-repair",
  machine: "medium-1x",
  maxDuration: 3_600,
  queue: { concurrencyLimit: 4, name: "legislation-ocr-page-range-repair" },
  run: async (payload: unknown) => {
    const config = loadConfig()
    if (config.azure.storageAccount === undefined || config.ocr.endpoint === undefined) {
      throw new Error("OCR page-range repair requires Azure Blob Storage and Azure Document Intelligence configuration")
    }
    const { database, pool } = createDatabase({
      ...config.database,
      connectionTimeoutMs: Math.max(config.database.connectionTimeoutMs, 120_000),
      maxConnections: 1
    })
    try {
      const artifactStore = new AzureBlobArtifactStore(
        config.azure.storageAccount,
        config.azure.normalizedDocumentContainer
      )
      const ocr = new AzureDocumentIntelligenceClient(config.ocr.endpoint)
      return await runOcrPageRangeRepairTask(payload, {
        repair: async (documentIds) => await repairOcrDocumentPageRanges(database, { artifactStore, documentIds, ocr })
      })
    } finally {
      await pool.end()
    }
  }
})
