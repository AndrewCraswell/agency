import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
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

export const openStatesBillPlanPayload = z.strictObject({ state: stateSchema })
export const openStatesBillDispatchPayload = z.strictObject({ state: stateSchema, planPath: planPathSchema })
export const openStatesBillCloudPayload = openStatesBillDispatchPayload.extend({ batchId: digestSchema.optional() })

function stateConcurrencyKey(state: "ak" | "nc") {
  return `production:openstates-scraper:bills:${state}`
}

function attemptId(state: "ak" | "nc", triggerRunId: string) {
  return `${state}-bill-${createHash("sha256").update(triggerRunId).digest("hex").slice(0, 32)}`
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
    const { state } = openStatesBillPlanPayload.parse(raw)
    requireScraperActivation(state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const inventory = await acquireStateBillPlan(store, state)
    const key = await idempotencyKeys.create(`${state}-bills:dispatch:${inventory.inventoryId}`, { scope: "global" })
    const handle = await tasks.trigger(
      "openstates-bill-scraper-dispatch",
      { state, planPath: inventory.planPath },
      { concurrencyKey: stateConcurrencyKey(state), idempotencyKey: key }
    )
    return { ...inventory, status: "dispatched" as const, dispatchRunId: handle.id }
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
    const first = state.pending[0]
    if (!first) return { status: "cycle_promoted" as const, inventoryId: state.inventoryId }
    const key = await idempotencyKeys.create(`${payload.state}-bills:${state.inventoryId}:${first.id}`, {
      scope: "global"
    })
    const handle = await tasks.trigger(
      "openstates-bill-scraper-cloud",
      { ...payload, batchId: first.id },
      { concurrencyKey: stateConcurrencyKey(payload.state), idempotencyKey: key }
    )
    return { status: "dispatched" as const, inventoryId: state.inventoryId, batchId: first.id, runId: handle.id }
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
        return { status: "cycle_promoted" as const, inventoryId, completed: before.promotedBatches, pending: 0 }
      }
      const runId = attemptId(payload.state, ctx.run.id)
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
      nextBatchId = after.pending[0]?.id
    } finally {
      await pool.end()
    }
    if (!nextBatchId) return { ...result, status: "cycle_promoted" as const, inventoryId, pending: 0 }
    const key = await idempotencyKeys.create(`${payload.state}-bills:${inventoryId}:${nextBatchId}`, {
      scope: "global"
    })
    const continuation = await tasks.trigger(
      "openstates-bill-scraper-cloud",
      { ...payload, batchId: nextBatchId },
      { concurrencyKey: stateConcurrencyKey(payload.state), idempotencyKey: key }
    )
    return { ...result, inventoryId, nextBatchId, continuationRunId: continuation.id }
  }
})
