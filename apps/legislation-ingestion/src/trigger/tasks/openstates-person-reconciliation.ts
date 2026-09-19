import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { requireScraperActivation } from "../../ingestion/openstates/scraper-activation.js"
import { scraperBillState, scraperBillPlanPath } from "../../ingestion/openstates/scraper-bill-profiles.js"
import { inspectScraperBillCycle } from "../../ingestion/openstates/scraper-cycle.js"
import {
  applyScraperPersonBackfillPlan,
  buildScraperPersonBackfillPlan,
  scraperPersonBackfillPlanSha256
} from "../../ingestion/openstates/scraper-person-backfill.js"

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
const planPathSchema = scraperBillPlanPath
export const openStatesPersonReconciliationPayload = z.strictObject({
  inventoryId: digestSchema,
  planPath: planPathSchema,
  session: z.string().regex(/^[A-Za-z0-9-]+$/),
  state: scraperBillState
})

export function assertCompletedPersonReconciliationCycle(
  payload: z.infer<typeof openStatesPersonReconciliationPayload>,
  cycle: { inventoryId: string; promotionComplete: boolean }
) {
  const expectedPrefix = `openstates/scraper-plans/${payload.state}/${payload.session}/`
  if (!payload.planPath.startsWith(expectedPrefix)) {
    throw new Error("Person reconciliation plan does not match the requested state and session")
  }
  if (cycle.inventoryId !== payload.inventoryId) {
    throw new Error("Person reconciliation inventory does not match the frozen bill plan")
  }
  if (!cycle.promotionComplete) {
    throw new Error("Person reconciliation requires a fully promoted frozen bill plan")
  }
}

/** Resolve only unique, source-evidenced people after a complete frozen bill cycle. */
export const openStatesPersonReconciliation = task({
  id: "openstates-scraper-person-reconcile",
  maxDuration: 600,
  run: async (raw: unknown) => {
    const payload = openStatesPersonReconciliationPayload.parse(raw)
    requireScraperActivation(payload.state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Person reconciliation requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })
    try {
      const cycle = await inspectScraperBillCycle(database, store, payload.planPath)
      assertCompletedPersonReconciliationCycle(payload, cycle)
      const reconciliation = await database.transaction(async (transaction) => {
        await transaction.execute(sql`set local lock_timeout = '5s'`)
        const plan = await buildScraperPersonBackfillPlan(transaction, payload.state, payload.session)
        const planSha256 = scraperPersonBackfillPlanSha256(plan)
        const updates = await applyScraperPersonBackfillPlan(transaction, plan)
        return { planSha256, summary: plan.summary, updates }
      })
      const key = await idempotencyKeys.create(`${payload.state}-bills:content:${payload.inventoryId}`, {
        scope: "global"
      })
      const content = await tasks.trigger(
        "openstates-content-controller",
        { state: payload.state, session: payload.session, billConcurrency: 2, billLimit: 8, maxContinuations: 10 },
        { concurrencyKey: `${payload.state}:${payload.session}`, idempotencyKey: key }
      )
      return { status: "reconciled" as const, ...payload, ...reconciliation, contentRunId: content.id }
    } finally {
      await pool.end()
    }
  }
})
