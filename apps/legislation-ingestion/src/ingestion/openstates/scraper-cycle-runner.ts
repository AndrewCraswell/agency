import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { z } from "zod"
import { inspectScraperBillCycle } from "./scraper-cycle.js"
import { scraperBillBatchOwnershipSeconds } from "./scraper-execution.js"
import { resumeScraperBillCycle } from "./scraper-resume.js"

type Step = Awaited<ReturnType<typeof resumeScraperBillCycle>>

/** Bounded waves, not a hard cancellation deadline. Each admitted batch retains its own worker limit. */
export async function processScraperBillCycle(
  database: LegislationDatabase,
  input: Omit<Parameters<typeof resumeScraperBillCycle>[1], "runId"> & {
    maxBatches: number
    admissionBudgetSeconds: number
    concurrency?: number
    onProgress?: (step: Step) => Promise<void>
  },
  dependencies = {
    inspect: inspectScraperBillCycle,
    resume: resumeScraperBillCycle,
    now: () => performance.now(),
    createRunId: () => `resume-${randomUUID()}`
  }
) {
  const { maxBatches, admissionBudgetSeconds, concurrency = 1, onProgress, ...request } = input
  z.number().int().min(1).max(8).parse(concurrency)
  z.number().int().min(1).max(235).parse(maxBatches)
  z.number().int().min(scraperBillBatchOwnershipSeconds).max(86_400).parse(admissionBudgetSeconds)
  const startedAt = dependencies.now()
  let state = await dependencies.inspect(database, request.store, request.planPath)
  let completedSteps = 0
  while (state.pending.length > 0 && completedSteps < maxBatches) {
    // Reserve a full ownership window. Never release a worker by racing its promise against an outer timeout.
    if (dependencies.now() - startedAt + scraperBillBatchOwnershipSeconds * 1000 > admissionBudgetSeconds * 1000) {
      return { reason: "time_budget" as const, completedSteps, state }
    }
    const selected = state.pending.slice(0, Math.min(concurrency, maxBatches - completedSteps))
    const outcomes = await Promise.allSettled(
      selected.map(async (batch) => {
        const step = await dependencies.resume(database, {
          ...request,
          batchId: batch.id,
          runId: dependencies.createRunId()
        })
        await onProgress?.(step)
        return step
      })
    )
    // Drain every admitted worker before surfacing failures; never start a replacement wave after any failure.
    const failure = outcomes.find((outcome) => outcome.status === "rejected")
    if (failure?.status === "rejected") {
      throw failure.reason
    }
    completedSteps += outcomes.length
    state = await dependencies.inspect(database, request.store, request.planPath)
  }
  return {
    reason: state.pending.length === 0 ? ("cycle_promoted" as const) : ("batch_limit" as const),
    completedSteps,
    state
  }
}
