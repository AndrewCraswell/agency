import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, schedules, task, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  approvedScraperBuildInputsSha256,
  requireScraperActivation
} from "../../ingestion/openstates/scraper-activation.js"
import { readScraperBillPlan } from "../../ingestion/openstates/scraper-batches.js"
import { acquireStateBillPlan } from "../../ingestion/openstates/scraper-bill-plan-acquisition.js"
import { billCloudRequest, dispatchCloudScraperAttempt } from "../../ingestion/openstates/scraper-cloud.js"
import { inspectScraperBillCycle } from "../../ingestion/openstates/scraper-cycle.js"
import { executeScraperBillBatch } from "../../ingestion/openstates/scraper-execution.js"

const stateSchema = z.enum(["ak", "nc"])
const planPathSchema = z
  .string()
  .regex(/^openstates\/scraper-plans\/(?:ak\/34|nc\/2025)\/[A-Za-z0-9][A-Za-z0-9-]{0,100}\/plan\.json$/)
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
const dispatchWidth = 2

export const openStatesBillPlanPayload = z.strictObject({
  state: stateSchema,
  refreshDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
})
export const openStatesBillDispatchPayload = z.strictObject({ state: stateSchema, planPath: planPathSchema })
export const openStatesBillCloudPayload = openStatesBillDispatchPayload.extend({ batchId: digestSchema.optional() })

function stateConcurrencyKey(state: "ak" | "nc") {
  return `production:openstates-scraper:bills:${state}`
}

export function billBatchConcurrencyKey(state: "ak" | "nc", batchId: string) {
  return `${stateConcurrencyKey(state)}:${digestSchema.parse(batchId)}`
}

export function attemptId(state: "ak" | "nc", triggerRunId: string, attemptNumber: number) {
  const attempt = z.number().int().positive().parse(attemptNumber)
  return `${state}-bill-${createHash("sha256").update(`${triggerRunId}:${attempt}`).digest("hex").slice(0, 32)}`
}

export function assertBillPlanState(state: "ak" | "nc", planPath: string) {
  const path = planPathSchema.parse(planPath)
  const expected = state === "ak" ? "openstates/scraper-plans/ak/34/" : "openstates/scraper-plans/nc/2025/"
  if (!path.startsWith(expected)) throw new Error("Frozen bill plan does not match requested state")
  return path
}

function queueName() {
  return z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/)
    .parse(process.env.OPENSTATES_SCRAPER_QUEUE)
}

/** Manual, unscheduled entry point. Freeze publisher discovery before dispatching any extraction. */
export const openStatesBillScraperPlan = task({
  id: "openstates-bill-scraper-plan",
  maxDuration: 120,
  run: async (raw: unknown) => {
    const { state, refreshDate } = openStatesBillPlanPayload.parse(raw)
    requireScraperActivation(state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const inventory = await acquireStateBillPlan(store, state, { refreshDate })
    const key = await idempotencyKeys.create(`${state}-bills:dispatch:${inventory.inventoryId}`, { scope: "global" })
    const handle = await tasks.trigger(
      "openstates-bill-scraper-dispatch",
      { state, planPath: inventory.planPath },
      { concurrencyKey: stateConcurrencyKey(state), idempotencyKey: key }
    )
    return { ...inventory, status: "dispatched" as const, dispatchRunId: handle.id }
  }
})

const billScheduleIdentities = {
  "openstates-scraper:bills:ak:34": "ak",
  "openstates-scraper:bills:nc:2025": "nc"
} as const

export const openStatesBillScraperSchedule = schedules.task({
  id: "openstates-bill-scraper-schedule",
  maxDuration: 60,
  run: async (payload) => {
    const state = billScheduleIdentities[payload.externalId as keyof typeof billScheduleIdentities]
    if (state === undefined) throw new Error("Unexpected Open States bill scraper schedule identity")
    requireScraperActivation(state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const refreshDate = payload.timestamp.toISOString().slice(0, 10)
    const key = await idempotencyKeys.create(`${state}-bills:plan:${payload.scheduleId}:${refreshDate}`, {
      scope: "global"
    })
    const handle = await tasks.trigger(
      "openstates-bill-scraper-plan",
      { state, refreshDate },
      { concurrencyKey: stateConcurrencyKey(state), idempotencyKey: key }
    )
    return { status: "dispatched" as const, state, refreshDate, planRunId: handle.id }
  }
})

/** Read the canonical receipt ledger and dispatch only its first uncommitted frozen batch. */
export const openStatesBillScraperDispatch = task({
  id: "openstates-bill-scraper-dispatch",
  maxDuration: 60,
  run: async (raw: unknown) => {
    const payload = openStatesBillDispatchPayload.parse(raw)
    requireScraperActivation(payload.state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    assertBillPlanState(payload.state, payload.planPath)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })
    let state: Awaited<ReturnType<typeof inspectScraperBillCycle>>
    try {
      state = await inspectScraperBillCycle(database, store, payload.planPath)
    } finally {
      await pool.end()
    }
    const selected = state.available.slice(0, dispatchWidth)
    if (selected.length === 0) {
      return {
        status: state.promotionComplete ? ("cycle_promoted" as const) : ("awaiting_in_flight_batches" as const),
        inventoryId: state.inventoryId
      }
    }
    const runs = await Promise.all(
      selected.map(async (batch) => {
        const key = await idempotencyKeys.create(`${payload.state}-bills:${state.inventoryId}:${batch.id}`, {
          scope: "global"
        })
        const handle = await tasks.trigger(
          "openstates-bill-scraper-cloud",
          { ...payload, batchId: batch.id },
          { concurrencyKey: billBatchConcurrencyKey(payload.state, batch.id), idempotencyKey: key }
        )
        return { batchId: batch.id, runId: handle.id }
      })
    )
    return { status: "dispatched" as const, inventoryId: state.inventoryId, runs }
  }
})

/** One batch per run; committed promotion receipts, not worker exit status, drive continuation. */
export const openStatesBillScraperCloud = task({
  id: "openstates-bill-scraper-cloud",
  maxDuration: 3_600,
  queue: { name: "openstates-scraper-orchestration", concurrencyLimit: 3 },
  run: async (raw: unknown, { ctx }) => {
    const payload = openStatesBillCloudPayload.parse(raw)
    requireScraperActivation(payload.state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    assertBillPlanState(payload.state, payload.planPath)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const storageAccount = config.azure.storageAccount
    const storageQueue = queueName()
    const store = new AzureBlobArtifactStore(storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    let result: Awaited<ReturnType<typeof executeScraperBillBatch>> | undefined
    let inventoryId: string
    let nextBatchId: string | undefined
    try {
      const plan = await readScraperBillPlan(store, payload.planPath)
      if (plan.jurisdiction !== payload.state) throw new Error("Frozen bill plan state changed after admission")
      inventoryId = plan.inventoryId
      const before = await inspectScraperBillCycle(database, store, payload.planPath)
      const requested = payload.batchId && before.pending.some((batch) => batch.id === payload.batchId)
      const selected = requested ? payload.batchId : before.pending[0]?.id
      if (!selected) {
        if (before.promotionComplete) {
          return await dispatchStateContent(payload.state, plan.session, inventoryId, before.promotedBatches)
        }
        return {
          status: "awaiting_in_flight_batches" as const,
          inventoryId,
          completed: before.promotedBatches,
          pending: before.pending.length
        }
      }
      const runId = attemptId(payload.state, ctx.run.id, ctx.attempt.number)
      result = await executeScraperBillBatch(database, {
        store,
        planPath: payload.planPath,
        batchId: selected,
        runId,
        approvedBuildInputsSha256: approvedScraperBuildInputsSha256,
        extractAndArchive: async (request) => {
          const paths = await dispatchCloudScraperAttempt({
            store,
            runId: request.runId,
            request: billCloudRequest(payload.state, [...request.billIds]),
            storageAccount,
            queueName: storageQueue,
            maxWaitSeconds: 1_800
          })
          return { manifestPath: paths.manifestPath }
        }
      })
      const after = await inspectScraperBillCycle(database, store, payload.planPath)
      nextBatchId = after.available[0]?.id
      if (!nextBatchId && !after.promotionComplete) {
        return {
          ...result,
          status: "awaiting_in_flight_batches" as const,
          inventoryId,
          pending: after.pending.length
        }
      }
    } finally {
      await pool.end()
    }
    if (!nextBatchId) {
      const plan = await readScraperBillPlan(store, payload.planPath)
      return { ...result, ...(await dispatchStateContent(payload.state, plan.session, inventoryId)), pending: 0 }
    }
    const key = await idempotencyKeys.create(`${payload.state}-bills:${inventoryId}:${nextBatchId}`, {
      scope: "global"
    })
    const continuation = await tasks.trigger(
      "openstates-bill-scraper-cloud",
      { ...payload, batchId: nextBatchId },
      { concurrencyKey: billBatchConcurrencyKey(payload.state, nextBatchId), idempotencyKey: key }
    )
    return { ...result, inventoryId, nextBatchId, continuationRunId: continuation.id }
  }
})

async function dispatchStateContent(state: "ak" | "nc", session: string, inventoryId: string, completed?: number) {
  const key = await idempotencyKeys.create(`${state}-bills:content:${inventoryId}`, { scope: "global" })
  const handle = await tasks.trigger(
    "openstates-content-controller",
    { state, session, billConcurrency: 2, billLimit: 8, maxContinuations: 10 },
    { concurrencyKey: `${state}:${session}`, idempotencyKey: key }
  )
  return {
    status: "cycle_promoted" as const,
    inventoryId,
    ...(completed === undefined ? {} : { completed }),
    contentRunId: handle.id
  }
}
