import { hostname } from "node:os"
import { z } from "zod"
import type { LegislationDatabase } from "../../db/database.js"
import { claimBillBatchOwnership, releaseBillBatchOwnership } from "../../db/queries/bill-batch-ownership.js"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { readScraperBillPlan } from "./scraper-batches.js"
import { inspectScraperBillCycle } from "./scraper-cycle.js"
import { archiveScraperBillDispatch } from "./scraper-dispatch.js"
import {
  scraperBillBatchOwnership,
  scraperBillPromotionOwnership,
  promoteArchivedScraperBillBatch
} from "./scraper-promotion.js"
import { ScraperBatchAlreadyPromotedError, ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

type Extraction = {
  runId: string
  dispatchPath: string
  billIds: readonly string[]
  maxDurationSeconds: number
  runtimeId?: string
}

/** The adapter must stop its entire worker before settling, including on failure, and retain its output archive. */
type ExtractAndArchive = (request: Extraction) => Promise<{ manifestPath: string }>

export const scraperBillBatchOwnershipSeconds = 1800

/** One frozen batch. No scheduling or activation; callers provide an approved, bounded runtime adapter. */
export async function executeScraperBillBatch(
  database: LegislationDatabase,
  input: {
    store: ArtifactStore
    planPath: string
    batchId: string
    runId: string
    approvedBuildInputsSha256: string
    runtimeId?: string
    extractAndArchive: ExtractAndArchive
  },
  dependencies = {
    claim: claimBillBatchOwnership,
    release: releaseBillBatchOwnership,
    promote: promoteArchivedScraperBillBatch,
    inspect: inspectScraperBillCycle,
    now: () => new Date()
  }
) {
  z.string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(input.runId)
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.approvedBuildInputsSha256)
  const plan = await readScraperBillPlan(input.store, input.planPath)
  const batch = plan.batches.find((entry) => entry.id === input.batchId)
  if (!batch) {
    throw new Error("Batch is not part of this frozen inventory")
  }
  const scope = scraperBillPromotionOwnership(plan)
  const owner = scraperBillBatchOwnership(plan.inventoryId, input.batchId, input.runId, scope)
  // Persist the confirmation requirement before starting a worker, including for crashes or DB outages afterward.
  const isNewOwner = await dependencies.claim(database, owner, scraperBillBatchOwnershipSeconds, {
    requireConfirmedRelease: true,
    group: { stream: scope.stream, cohort: plan.inventoryId },
    executor: { host: hostname(), pid: process.pid, runtimeId: input.runtimeId }
  })
  if (!isNewOwner) {
    throw new Error("This attempt already owns the lease; duplicate execution is not permitted")
  }
  let isWorkerStopped = true
  try {
    // Selection may have happened before another worker committed. Recheck under session ownership.
    const cycle = await dependencies.inspect(database, input.store, input.planPath)
    if (!cycle.pending.some((entry) => entry.id === input.batchId)) {
      throw new ScraperBatchAlreadyPromotedError()
    }
    const issuedAt = dependencies.now()
    const dispatch = await archiveScraperBillDispatch(input.store, {
      planPath: input.planPath,
      batchId: input.batchId,
      runId: input.runId,
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + scraperBillBatchOwnershipSeconds * 1000)
    })
    const archive = await input.extractAndArchive({
      runId: input.runId,
      dispatchPath: dispatch.path,
      billIds: batch.billIds,
      maxDurationSeconds: 1500,
      runtimeId: input.runtimeId
    })
    const retrievedAt = dependencies.now()
    return await dependencies.promote(database, {
      store: input.store,
      planPath: input.planPath,
      batchId: input.batchId,
      manifestPath: archive.manifestPath,
      approvedBuildInputsSha256: input.approvedBuildInputsSha256,
      dispatchPath: dispatch.path,
      now: retrievedAt,
      retrievedAt
    })
  } catch (error) {
    isWorkerStopped = !(error instanceof ScraperWorkerStopUnconfirmedError)
    throw error
  } finally {
    // Never race a timeout promise against a still-running worker and release ownership early.
    if (isWorkerStopped) {
      await dependencies.release(database, owner)
    }
  }
}
