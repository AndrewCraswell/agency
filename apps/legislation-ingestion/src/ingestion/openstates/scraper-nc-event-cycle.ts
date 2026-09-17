import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { z } from "zod"
import { claimBillBatchOwnership, releaseBillBatchOwnership } from "../../persistence/bill-batch-ownership.js"
import { upsertEventSnapshots } from "../../persistence/events.js"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { dispatchCloudScraperAttempt, northCarolinaEventCloudRequest } from "./scraper-cloud.js"
import { prepareArchivedNcScraperEvents } from "./scraper-normalize.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const currentCalendarCohort = createHash("sha256").update("nc-events:current-calendar:v1").digest("hex")

function receiptStream(manifestSha256: string) {
  return `nc-events:current:${manifestSha256}`
}

/** Extract and atomically promote one current NC calendar snapshot without claiming historical completeness. */
export async function executeNorthCarolinaEventCloudCycle(
  database: LegislationDatabase,
  input: {
    store: ArtifactStore
    approvedBuildInputsSha256: string
    storageAccount: string
    queueName: string
    runId?: string
  },
  dependencies = {
    dispatch: dispatchCloudScraperAttempt,
    claim: claimBillBatchOwnership,
    release: releaseBillBatchOwnership,
    promote: upsertEventSnapshots,
    prepare: prepareArchivedNcScraperEvents,
    now: () => new Date()
  }
) {
  const approvedBuildInputsSha256 = digest.parse(input.approvedBuildInputsSha256)
  const runId = z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(input.runId ?? `nc-event-${randomUUID()}`)
  const group = { stream: "ownership:nc-events", cohort: currentCalendarCohort }
  const owner = { source: "openstates", stream: `${group.stream}:${group.cohort}:current-calendar`, token: runId }
  const claimed = await dependencies.claim(database, owner, 1800, {
    requireConfirmedRelease: true,
    group,
    executor: { host: hostname(), pid: process.pid, runtimeId: "azure-container-apps-queue" }
  })
  if (!claimed) throw new Error("Duplicate North Carolina event cloud attempt")
  let settled = true
  try {
    const archive = await dependencies.dispatch({
      store: input.store,
      runId,
      request: northCarolinaEventCloudRequest(),
      storageAccount: input.storageAccount,
      queueName: input.queueName,
      maxWaitSeconds: 1800
    })
    const prepared = await dependencies.prepare({
      store: input.store,
      manifestPath: archive.manifestPath,
      approvedBuildInputsSha256,
      retrievedAt: dependencies.now()
    })
    await dependencies.promote(database, prepared.snapshots, {
      ownership: owner,
      receipt: {
        source: "openstates",
        stream: receiptStream(prepared.provenance.manifestSha256),
        cursor: {
          status: "promoted",
          manifestPath: archive.manifestPath,
          settlementPath: archive.settlementPath,
          manifestSha256: prepared.provenance.manifestSha256,
          build: approvedBuildInputsSha256,
          events: prepared.snapshots.length,
          scope: "current-calendar"
        }
      }
    })
    return {
      status: "promoted" as const,
      events: prepared.snapshots.length,
      manifestSha256: prepared.provenance.manifestSha256,
      runId
    }
  } catch (error) {
    settled = !(error instanceof ScraperWorkerStopUnconfirmedError)
    throw error
  } finally {
    if (settled) await dependencies.release(database, owner)
  }
}
