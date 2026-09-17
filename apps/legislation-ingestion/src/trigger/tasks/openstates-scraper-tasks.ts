import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, schedules, task, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  executeAlaskaEventCloudBatch,
  inspectAlaskaEventCycle
} from "../../ingestion/openstates/scraper-event-cycle.js"
import { acquireAlaskaEventPlan } from "../../ingestion/openstates/scraper-event-plan.js"
import { executeNorthCarolinaEventCloudCycle } from "../../ingestion/openstates/scraper-nc-event-cycle.js"

const approvedBuildInputsSha256 = "8dd4689bcfe72cf8b1cee5372c1106bd9f077845bea3187074fe17cc833beaeb"

const payloadSchema = z.strictObject({
  planPath: z.string().regex(/^openstates\/scraper-plans\/ak\/events\/[A-Za-z0-9/_.-]+\.json$/),
  approvedBuildInputsSha256: z.string().regex(/^[a-f0-9]{64}$/),
  batchId: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
})

function requireScraperActivation(jurisdiction: "ak" | "nc", value: string | undefined) {
  const states = new Set(
    (value ?? "")
      .split(",")
      .map((state) => state.trim().toLowerCase())
      .filter(Boolean)
  )
  if (!states.has(jurisdiction)) {
    throw new Error(`${jurisdiction === "ak" ? "Alaska" : "North Carolina"} self-hosted scraper is not activated`)
  }
}

function requireAlaskaScraperActivation(value: string | undefined) {
  requireScraperActivation("ak", value)
}

function attemptId(triggerRunId: string) {
  return `ak-event-${createHash("sha256").update(triggerRunId).digest("hex").slice(0, 32)}`
}

const concurrencyKey = "production:openstates-scraper:events:ak"
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
        approvedBuildInputsSha256,
        storageAccount: config.azure.storageAccount,
        queueName,
        runId: `nc-event-${createHash("sha256").update(ctx.run.id).digest("hex").slice(0, 32)}`
      })
    } finally {
      await pool.end()
    }
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
      { planPath: inventory.planPath, approvedBuildInputsSha256 },
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
    if (payload.externalId !== "ak-events-34") throw new Error("Unexpected Alaska event schedule identity")
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
        return { status: "cycle_promoted" as const, inventoryId, completed: before.completed.length, pending: 0 }
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
      return { ...result, status: "cycle_promoted" as const, inventoryId, pending: 0 }
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
    if (!first) return { status: "cycle_promoted" as const, inventoryId: state.plan.source_sha256 }
    const key = await idempotencyKeys.create(`ak-events:${state.plan.source_sha256}:${first.id}`, { scope: "global" })
    const handle = await tasks.trigger(
      "openstates-alaska-events-cloud",
      { ...payload, batchId: first.id },
      { concurrencyKey, idempotencyKey: key }
    )
    return { status: "dispatched" as const, inventoryId: state.plan.source_sha256, batchId: first.id, runId: handle.id }
  }
})
