import { logger, schedules, task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  countReadyPassageChanges,
  drainPassageChanges,
  enqueuePassageBackfill
} from "../../search/passage-search-queue.js"

/** Bounded invocation; deployment alone does not start a backfill or a schedule. */
export const passageSearchSynchronization = task({
  id: "passage-search-synchronization",
  maxDuration: 900,
  queue: { name: "passage-search-synchronization", concurrencyLimit: 1 },
  run: async (unparsedPayload: unknown) => {
    const payload = z
      .object({ enqueueBackfill: z.boolean().default(false) })
      .strict()
      .parse(unparsedPayload)
    return runSynchronizationCycle(payload.enqueueBackfill)
  }
})

// Explicit activation follows source-capture and target-schema verification.
export const passageSearchSynchronizationSchedule = schedules.task({
  id: "passage-search-synchronization-schedule",
  maxDuration: 900,
  queue: { name: "passage-search-synchronization", concurrencyLimit: 1 },
  run: async () => runSynchronizationCycle(true)
})

export async function runSynchronizationCycle(enqueueBackfill: boolean) {
  const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
  const sourceUrl = new URL(env.DATABASE_URL)
  const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
  if (targetUrl.pathname !== "/legislation_passage_search" || targetUrl.host === sourceUrl.host) {
    throw new Error("Passage target must be the isolated legislation_passage_search database")
  }
  const source = new pg.Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 10_000 })
  const target = new pg.Client({ connectionString: targetUrl.href, connectionTimeoutMillis: 10_000 })
  try {
    await source.connect()
    await target.connect()
    const deadline = Date.now() + 240_000
    const totals = { enqueued: 0, events: 0, documents: 0, sections: 0, deferred: 0 }
    while (deadline - Date.now() >= 30_000) {
      const ready = await countReadyPassageChanges(source)
      const enqueued = enqueueBackfill && ready < 100 ? await enqueuePassageBackfill(source) : 0
      totals.enqueued += enqueued
      if (ready === 0 && enqueued === 0) {
        break
      }
      const result = await drainPassageChanges(source, target, {
        budgetMs: Math.max(1000, Math.floor(deadline - Date.now()))
      })
      totals.events += result.events
      totals.documents += result.documents
      totals.sections += result.sections
      totals.deferred += result.deferred
      if (result.deferred > 0) {
        logger.warn("Passage search records remain deferred for retry", { deferred: result.deferred })
      }
      logger.info("Passage search synchronization batch committed", { enqueued, ...result })
    }
    return totals
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}
