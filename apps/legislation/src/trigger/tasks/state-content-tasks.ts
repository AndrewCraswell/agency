import { idempotencyKeys, task } from "@trigger.dev/sdk"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { AzureDocumentIntelligenceClient } from "../../ingestion/documents/ocr-client.js"
import { processStateContentBatch } from "../../ingestion/openstates/state-content.js"
import {
  requireStateContentActivation,
  requireSuccessfulStateContentResult,
  runStateContentContinuations,
  stateContentControllerPayload,
  stateContentPayload
} from "./state-content-policy.js"

export const stateContentWorker = task({
  id: "openstates-content-worker",
  maxDuration: 7_200,
  queue: { name: "openstates-content", concurrencyLimit: 2 },
  run: async (raw: unknown, { ctx }) => {
    const payload = stateContentPayload.parse(raw)
    requireStateContentActivation(payload.state, process.env.OPENSTATES_CONTENT_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount || !config.ocr.endpoint || !config.model.apiKey) {
      throw new Error("Hosted state content requires configured artifact storage, OCR and embeddings")
    }
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 4 })
    try {
      const result = await processStateContentBatch(
        { config, database, correlationId: ctx.run.id, workflowExecutionId: ctx.run.id },
        {
          state: payload.state,
          session: payload.session,
          billConcurrency: payload.billConcurrency,
          billLimit: payload.billLimit,
          artifactStore: new AzureBlobArtifactStore(
            config.azure.storageAccount,
            config.azure.normalizedDocumentContainer
          ),
          ocr: new AzureDocumentIntelligenceClient(config.ocr.endpoint)
        }
      )
      return requireSuccessfulStateContentResult(result)
    } finally {
      await pool.end()
    }
  }
})

export const stateContentController = task({
  id: "openstates-content-controller",
  maxDuration: 14_400,
  queue: { name: "openstates-content-controller", concurrencyLimit: 2 },
  run: async (raw: unknown, { ctx }) => {
    const payload = stateContentControllerPayload.parse(raw)
    requireStateContentActivation(payload.state, process.env.OPENSTATES_CONTENT_ENABLED_STATES)
    return await runStateContentContinuations(
      payload.maxContinuations,
      async (continuation) =>
        await stateContentWorker.triggerAndWait(
          {
            state: payload.state,
            session: payload.session,
            billConcurrency: payload.billConcurrency,
            billLimit: payload.billLimit
          },
          {
            idempotencyKey: await idempotencyKeys.create(`${ctx.run.id}:${payload.state}:${continuation}`, {
              scope: "global"
            })
          }
        )
    )
  }
})
