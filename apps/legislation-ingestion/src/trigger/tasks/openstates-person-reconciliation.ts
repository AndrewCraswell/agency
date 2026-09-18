import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { requireScraperActivation } from "../../ingestion/openstates/scraper-activation.js"
import {
  applyScraperPersonBackfillPlan,
  buildScraperPersonBackfillPlan,
  scraperPersonBackfillPlanSha256
} from "../../ingestion/openstates/scraper-person-backfill.js"

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const openStatesPersonReconciliationPayload = z.strictObject({
  inventoryId: digestSchema,
  session: z.string().regex(/^[A-Za-z0-9-]+$/),
  state: z.enum(["ak", "nc"])
})

/** Resolve only unique, source-evidenced people after a complete frozen bill cycle. */
export const openStatesPersonReconciliation = task({
  id: "openstates-scraper-person-reconcile",
  maxDuration: 600,
  run: async (raw: unknown) => {
    const payload = openStatesPersonReconciliationPayload.parse(raw)
    requireScraperActivation(payload.state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })
    try {
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
