import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, schedules, task } from "@trigger.dev/sdk"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { AzureDocumentIntelligenceClient } from "../../ingestion/documents/ocr-client.js"
import { requeueVerifiedExtraction } from "../../ingestion/documents/requeue-verified-extraction.js"
import { processStateContentBatch } from "../../ingestion/openstates/state-content.js"
import {
  requireStateContentActivation,
  requireStateRepairScope,
  requireSuccessfulStateContentResult,
  runStateContentContinuations,
  stateContentControllerPayload,
  stateContentPayload,
  stateContentSchedulePlan
} from "./state-content-policy.js"

export const stateContentWorker = task({
  id: "openstates-content-worker",
  // This worker runs the same PDF/OCR path as the dedicated OCR worker.
  machine: "medium-1x",
  retry: { outOfMemory: { machine: "large-2x" } },
  maxDuration: 7_200,
  queue: { name: "openstates-content", concurrencyLimit: 2 },
  run: async (raw: unknown, { ctx }) => {
    const payload = stateContentPayload.parse(raw)
    requireStateContentActivation(payload.state, process.env.OPENSTATES_CONTENT_ENABLED_STATES)
    requireStateRepairScope(payload.state, payload.session, payload.extractionRepairs ?? [])
    const config = loadConfig()
    if (!config.azure.storageAccount || !config.ocr.endpoint || !config.model.apiKey) {
      throw new Error("Hosted state content requires configured artifact storage, OCR and embeddings")
    }
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 4 })
    try {
      for (const repair of payload.extractionRepairs ?? []) {
        await requeueVerifiedExtraction(database, repair)
      }
      const result = await processStateContentBatch(
        { config, database, correlationId: ctx.run.id, workflowExecutionId: ctx.run.id },
        {
          state: payload.state,
          session: payload.session,
          billConcurrency: payload.billConcurrency,
          billLimit: payload.billLimit,
          priorityBillIds: (payload.extractionRepairs ?? []).map((repair) => repair.billId),
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

// No cron: an operator must explicitly create a schedule after hosted acceptance.
// Canonical pending records and checkpoints are the durable backlog, not a transient promotion callback.
export const stateContentSchedule = schedules.task({
  id: "openstates-content-schedule",
  maxDuration: 60,
  run: async (payload) => {
    const plan = stateContentSchedulePlan(payload.externalId, process.env.OPENSTATES_CONTENT_ENABLED_STATES)
    const handle = await stateContentController.trigger(plan.payload, {
      concurrencyKey: plan.identity,
      idempotencyKey: `openstates-content:${payload.scheduleId}:${payload.timestamp.toISOString()}`
    })
    return { identity: plan.identity, workerRunId: handle.id, ingestionComplete: false }
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
            billLimit: payload.billLimit,
            extractionRepairs: continuation === 0 ? payload.extractionRepairs : undefined
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
