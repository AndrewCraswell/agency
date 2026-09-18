import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, schedules, task, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  approvedScraperBuildInputsSha256,
  legacyAlaskaEventBuildInputsSha256,
  requireApprovedAlaskaEventReceiptBuild,
  requireScraperActivation
} from "../../ingestion/openstates/scraper-activation.js"
import {
  executeAlaskaEventCloudBatch,
  inspectAlaskaEventCycle,
  reconcileAlaskaEventCycleBatch
} from "../../ingestion/openstates/scraper-event-cycle.js"
import { acquireAlaskaEventPlan } from "../../ingestion/openstates/scraper-event-plan.js"
import { executeNorthCarolinaEventCloudCycle } from "../../ingestion/openstates/scraper-nc-event-cycle.js"

const payloadSchema = z.strictObject({
  planPath: z.string().regex(/^openstates\/scraper-plans\/ak\/events\/[A-Za-z0-9/_.-]+\.json$/),
  approvedBuildInputsSha256: z.literal(approvedScraperBuildInputsSha256),
  batchId: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
})
const reconciliationPayloadSchema = payloadSchema.omit({ batchId: true, approvedBuildInputsSha256: true }).extend({
  approvedBuildInputsSha256: z.union([
    z.literal(approvedScraperBuildInputsSha256),
    z.literal(legacyAlaskaEventBuildInputsSha256)
  ]),
  batchIndex: z.number().int().nonnegative().default(0)
})

function requireAlaskaScraperActivation(value: string | undefined) {
  requireScraperActivation("ak", value)
}

function attemptId(triggerRunId: string) {
  return `ak-event-${createHash("sha256").update(triggerRunId).digest("hex").slice(0, 32)}`
}

const concurrencyKey = "production:openstates-scraper:events:ak"
const northCarolinaConcurrencyKey = "production:openstates-scraper:events:nc"

async function dispatchAlaskaEventReconciliation(
  planPath: z.infer<typeof payloadSchema>["planPath"],
  approvedBuildInputsSha256: z.infer<typeof payloadSchema>["approvedBuildInputsSha256"],
  inventoryId: string
) {
  const key = await idempotencyKeys.create(`ak-events:reconcile:${inventoryId}:0`, { scope: "global" })
  return await tasks.trigger(
    "openstates-alaska-events-reconcile",
    { planPath, approvedBuildInputsSha256, batchIndex: 0 },
    { concurrencyKey, idempotencyKey: key }
  )
}

export const openStatesAlaskaEventsReconcile = task({
  id: "openstates-alaska-events-reconcile",
  maxDuration: 600,
  queue: { name: "openstates-scraper-orchestration", concurrencyLimit: 3 },
  run: async (raw: unknown) => {
    const payload = reconciliationPayloadSchema.parse(raw)
    requireApprovedAlaskaEventReceiptBuild(payload.approvedBuildInputsSha256)
    requireAlaskaScraperActivation(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    let result: Awaited<ReturnType<typeof reconcileAlaskaEventCycleBatch>>
    try {
      result = await reconcileAlaskaEventCycleBatch(database, { store, ...payload })
    } finally {
      await pool.end()
    }
    const nextBatchIndex = result.batchIndex + 1
    if (nextBatchIndex >= result.totalBatches) return { ...result, status: "cycle_reconciled" as const }
    const key = await idempotencyKeys.create(`ak-events:reconcile:${result.inventoryId}:${nextBatchIndex}`, {
      scope: "global"
    })
    const continuation = await tasks.trigger(
      "openstates-alaska-events-reconcile",
      { ...payload, batchIndex: nextBatchIndex },
      { concurrencyKey, idempotencyKey: key }
    )
    return { ...result, nextBatchIndex, continuationRunId: continuation.id }
  }
})
export const openStatesNorthCarolinaEventsCloud = task({
  id: "openstates-north-carolina-events-cloud",
  maxDuration: 3_600,
  queue: { name: "openstates-scraper-orchestration", concurrencyLimit: 3 },
  run: async (_raw: unknown, { ctx }) => {
    requireScraperActivation("nc", process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    const queueName = z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/)
      .parse(process.env.OPENSTATES_SCRAPER_QUEUE)
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    try {
      return await executeNorthCarolinaEventCloudCycle(database, {
        store,
        approvedBuildInputsSha256: approvedScraperBuildInputsSha256,
        storageAccount: config.azure.storageAccount,
        queueName,
        runId: `nc-event-${createHash("sha256").update(ctx.run.id).digest("hex").slice(0, 32)}`
      })
    } finally {
      await pool.end()
    }
  }
})

export const openStatesNorthCarolinaEventsSchedule = schedules.task({
  id: "openstates-north-carolina-events-schedule",
  maxDuration: 60,
  run: async (payload) => {
    requireScraperActivation("nc", process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    if (payload.externalId !== "openstates-scraper:events:nc:current") {
      throw new Error("Unexpected North Carolina event schedule identity")
    }
    const key = await idempotencyKeys.create(
      `nc-events:current:${payload.scheduleId}:${payload.timestamp.toISOString()}`,
      { scope: "global" }
    )
    const handle = await tasks.trigger(
      "openstates-north-carolina-events-cloud",
      {},
      { concurrencyKey: northCarolinaConcurrencyKey, idempotencyKey: key }
    )
    return { status: "dispatched" as const, eventRunId: handle.id }
  }
})

export const openStatesAlaskaEventsPlan = task({
  id: "openstates-alaska-events-plan",
  maxDuration: 120,
  run: async () => {
    requireAlaskaScraperActivation(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const inventory = await acquireAlaskaEventPlan(store)
    const key = await idempotencyKeys.create(`ak-events:dispatch:${inventory.inventoryId}`, { scope: "global" })
    const handle = await tasks.trigger(
      "openstates-alaska-events-dispatch",
      { planPath: inventory.planPath, approvedBuildInputsSha256: approvedScraperBuildInputsSha256 },
      { concurrencyKey, idempotencyKey: key }
    )
    return { ...inventory, status: "dispatched" as const, dispatchRunId: handle.id }
  }
})

// No cron: create the production schedule only after the first hosted cycle and recovery drill pass.
export const openStatesAlaskaEventsSchedule = schedules.task({
  id: "openstates-alaska-events-schedule",
  maxDuration: 60,
  run: async (payload) => {
    requireAlaskaScraperActivation(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    if (payload.externalId !== "openstates-scraper:events:ak:34") {
      throw new Error("Unexpected Alaska event schedule identity")
    }
    const key = await idempotencyKeys.create(
      `ak-events:plan:${payload.scheduleId}:${payload.timestamp.toISOString()}`,
      {
        scope: "global"
      }
    )
    const handle = await tasks.trigger("openstates-alaska-events-plan", {}, { concurrencyKey, idempotencyKey: key })
    return { status: "dispatched" as const, planRunId: handle.id }
  }
})

export const openStatesAlaskaEventsCloud = task({
  id: "openstates-alaska-events-cloud",
  maxDuration: 3_600,
  queue: { name: "openstates-scraper-orchestration", concurrencyLimit: 3 },
  run: async (raw: unknown, { ctx }) => {
    const payload = payloadSchema.parse(raw)
    requireAlaskaScraperActivation(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    const queueName = z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/)
      .parse(process.env.OPENSTATES_SCRAPER_QUEUE)
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    let result: Awaited<ReturnType<typeof executeAlaskaEventCloudBatch>>
    let nextBatchId: string | undefined
    let inventoryId: string
    try {
      const before = await inspectAlaskaEventCycle(database, store, payload.planPath)
      inventoryId = before.plan.source_sha256
      const selected = payload.batchId ?? before.pending[0]?.id
      if (!selected) {
        const reconciliation = await dispatchAlaskaEventReconciliation(
          payload.planPath,
          payload.approvedBuildInputsSha256,
          inventoryId
        )
        return {
          status: "cycle_promoted" as const,
          inventoryId,
          completed: before.completed.length,
          pending: 0,
          reconciliationRunId: reconciliation.id
        }
      }
      result = await executeAlaskaEventCloudBatch(database, {
        store,
        planPath: payload.planPath,
        batchId: selected,
        approvedBuildInputsSha256: payload.approvedBuildInputsSha256,
        storageAccount: config.azure.storageAccount,
        queueName,
        runId: attemptId(ctx.run.id)
      })
      const after = await inspectAlaskaEventCycle(database, store, payload.planPath)
      nextBatchId = after.pending[0]?.id
    } finally {
      await pool.end()
    }
    if (!nextBatchId) {
      const reconciliation = await dispatchAlaskaEventReconciliation(
        payload.planPath,
        payload.approvedBuildInputsSha256,
        inventoryId
      )
      return {
        ...result,
        status: "cycle_promoted" as const,
        inventoryId,
        pending: 0,
        reconciliationRunId: reconciliation.id
      }
    }
    const key = await idempotencyKeys.create(`ak-events:${inventoryId}:${nextBatchId}`, { scope: "global" })
    const continuation = await tasks.trigger(
      "openstates-alaska-events-cloud",
      { ...payload, batchId: nextBatchId },
      { concurrencyKey, idempotencyKey: key }
    )
    return { ...result, inventoryId, nextBatchId, continuationRunId: continuation.id }
  }
})

export const openStatesAlaskaEventsDispatch = task({
  id: "openstates-alaska-events-dispatch",
  maxDuration: 60,
  run: async (raw: unknown) => {
    const payload = payloadSchema.omit({ batchId: true }).parse(raw)
    requireAlaskaScraperActivation(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })
    let state: Awaited<ReturnType<typeof inspectAlaskaEventCycle>>
    try {
      state = await inspectAlaskaEventCycle(database, store, payload.planPath)
    } finally {
      await pool.end()
    }
    const first = state.pending[0]
    if (!first) {
      const reconciliation = await dispatchAlaskaEventReconciliation(
        payload.planPath,
        payload.approvedBuildInputsSha256,
        state.plan.source_sha256
      )
      return {
        status: "cycle_promoted" as const,
        inventoryId: state.plan.source_sha256,
        reconciliationRunId: reconciliation.id
      }
    }
    const key = await idempotencyKeys.create(`ak-events:${state.plan.source_sha256}:${first.id}`, { scope: "global" })
    const handle = await tasks.trigger(
      "openstates-alaska-events-cloud",
      { ...payload, batchId: first.id },
      { concurrencyKey, idempotencyKey: key }
    )
    return { status: "dispatched" as const, inventoryId: state.plan.source_sha256, batchId: first.id, runId: handle.id }
  }
})
