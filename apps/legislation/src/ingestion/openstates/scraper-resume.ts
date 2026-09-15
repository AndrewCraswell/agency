import type { LegislationDatabase } from "../../db/database.js"
import { inspectScraperBillCycle } from "./scraper-cycle.js"
import { executeScraperBillBatch } from "./scraper-execution.js"
import { ScraperBatchAlreadyPromotedError } from "./scraper-worker-error.js"

/** One dependency-ready batch per invocation. No timers, recursive fan-out, deployment or implicit retries. */
export async function resumeScraperBillCycle(
  database: LegislationDatabase,
  input: Omit<Parameters<typeof executeScraperBillBatch>[1], "batchId"> & { batchId?: string },
  dependencies = { inspect: inspectScraperBillCycle, execute: executeScraperBillBatch }
) {
  const before = await dependencies.inspect(database, input.store, input.planPath)
  const next = input.batchId ? { id: input.batchId } : before.pending[0]
  if (!next) {
    return { status: "cycle_promoted" as const, batchId: null, state: before }
  }
  let status: "promoted" | "already_promoted" = "promoted"
  try {
    await dependencies.execute(database, { ...input, batchId: next.id })
  } catch (error) {
    if (!(error instanceof ScraperBatchAlreadyPromotedError)) {
      throw error
    }
    status = "already_promoted"
  }
  const after = await dependencies.inspect(database, input.store, input.planPath)
  if (after.pending.some((batch) => batch.id === next.id)) {
    throw new Error("Completed execution is missing its committed batch receipt")
  }
  return { status, batchId: next.id, state: after }
}
