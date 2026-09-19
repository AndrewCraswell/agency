import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  requireScraperActivation,
  washingtonScraperCandidateBuild
} from "../../ingestion/openstates/scraper-activation.js"
import {
  advanceWashingtonEventCycle,
  reconcileWashingtonEventWindow
} from "../../ingestion/openstates/scraper-event-window-cycle.js"
import { scraperQueueFor } from "../../ingestion/openstates/scraper-queue.js"

const payloadSchema = z.strictObject({
  planPath: z.string().regex(/^openstates\/event-window-plans\/wa\/2025-2026\/[a-f0-9]{64}\/plan\.json$/),
  approvedBuild: z.literal(washingtonScraperCandidateBuild)
})

// Deliberately no schedule: activation and the first dispatch require hosted acceptance.
export const openStatesEventWindows = task({
  id: "openstates-event-windows",
  maxDuration: 3600,
  queue: { name: "openstates-event-windows", concurrencyLimit: 1 },
  retry: { maxAttempts: 1 },
  run: async (raw: unknown, { ctx }) => {
    const payload = payloadSchema.parse(raw)
    requireScraperActivation("wa", process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted scraper requires Azure Storage")
    const queueName = scraperQueueFor("wa")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    let result: Awaited<ReturnType<typeof advanceWashingtonEventCycle>>
    try {
      result = await advanceWashingtonEventCycle(database, {
        ...payload,
        store,
        storageAccount: config.azure.storageAccount,
        queueName,
        runId: `wa-event-${createHash("sha256").update(ctx.run.id).digest("hex").slice(0, 32)}`
      })
    } finally {
      await pool.end()
    }
    if (!result.nextWindowId) return result
    const key = await idempotencyKeys.create(`event-windows:${result.planId}:${result.nextWindowId}`, {
      scope: "global"
    })
    const continuation = await tasks.trigger("openstates-event-windows", payload, {
      version: ctx.deployment?.version,
      concurrencyKey: "production:openstates-scraper:events:wa",
      idempotencyKey: key
    })
    return { ...result, continuationRunId: continuation.id }
  }
})

/** Bounded retained replay shares the live calendar queue; it never starts another scraper. */
export const openStatesEventWindowReconcile = task({
  id: "openstates-event-window-reconcile",
  maxDuration: 600,
  queue: { name: "openstates-event-windows", concurrencyLimit: 1 },
  retry: { maxAttempts: 1 },
  run: async (raw: unknown) => {
    const payload = payloadSchema.extend({ windowId: z.string().regex(/^[a-f0-9]{64}$/) }).parse(raw)
    requireScraperActivation("wa", process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Hosted replay requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    try {
      return await reconcileWashingtonEventWindow(database, { ...payload, store })
    } finally {
      await pool.end()
    }
  }
})
