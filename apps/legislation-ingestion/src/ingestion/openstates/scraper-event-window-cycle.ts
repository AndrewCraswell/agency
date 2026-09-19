import { randomUUID } from "node:crypto"
import { hostname } from "node:os"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { claimBillBatchOwnership, releaseBillBatchOwnership } from "../../persistence/bill-batch-ownership.js"
import { upsertEventSnapshots } from "../../persistence/events.js"
import { commitOwnedEmptyPromotion } from "../../persistence/promotion-receipt.js"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { dispatchCloudScraperAttempt, washingtonEventCloudRequest } from "./scraper-cloud.js"
import { readEventWindowPlan } from "./scraper-event-window-plan.js"
import { washingtonEventWindow } from "./scraper-event-window.js"
import { preparePlannedWashingtonEventWindow } from "./scraper-washington-events.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

async function readReceipt(
  database: LegislationDatabase,
  stream: string
): Promise<Record<string, unknown> | undefined> {
  const [row] = await database
    .select({ cursor: syncCheckpoints.cursor })
    .from(syncCheckpoints)
    .where(and(eq(syncCheckpoints.source, "openstates"), eq(syncCheckpoints.stream, stream)))
  return row?.cursor
}

/** One bounded item per invocation; committed receipts allow callers to resume a frozen plan safely. */
export async function executeWashingtonEventWindow(
  database: LegislationDatabase,
  input: {
    store: ArtifactStore
    planPath: string
    windowId: string
    approvedBuild: string
    storageAccount: string
    queueName: string
    runId?: string
  },
  dependencies = {
    readPlan: readEventWindowPlan,
    readReceipt,
    claim: claimBillBatchOwnership,
    release: releaseBillBatchOwnership,
    dispatch: dispatchCloudScraperAttempt,
    prepare: preparePlannedWashingtonEventWindow,
    promote: upsertEventSnapshots,
    promoteEmpty: commitOwnedEmptyPromotion,
    now: () => new Date()
  }
) {
  const build = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.approvedBuild)
  const plan = await dependencies.readPlan(input.store, input.planPath)
  if (plan.scope.jurisdiction !== "wa" || plan.scope.session !== "2025-2026")
    throw new Error("Unreviewed meeting plan scope")
  const selected = plan.windows.find((entry) => entry.id === input.windowId)
  if (!selected) throw new Error("Unknown planned meeting window")
  const window = washingtonEventWindow.parse(selected.window)
  const stream = `event-window:wa:2025-2026:${plan.id}:${selected.id}`
  const receiptSchema = z.object({
    status: z.literal("promoted"),
    planId: z.literal(plan.id),
    windowId: z.literal(selected.id),
    build: z.literal(build),
    events: z.number().int().nonnegative(),
    manifestPath: z.string().min(1),
    settlementPath: z.string().min(1)
  })
  const existing = await dependencies.readReceipt(database, stream)
  if (existing !== undefined)
    return { status: "already_promoted" as const, events: receiptSchema.parse(existing).events }
  const runId = z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(input.runId ?? `wa-event-${randomUUID()}`)
  // Distinct cycles cannot overlap, including after an uncertain worker shutdown.
  const group = { stream: "ownership:wa-events:2025-2026", cohort: plan.id }
  const owner = { source: "openstates", stream: `${group.stream}:${group.cohort}:${selected.id}`, token: runId }
  const claimed = await dependencies.claim(database, owner, 1800, {
    requireConfirmedRelease: true,
    group,
    executor: { host: hostname(), pid: process.pid, runtimeId: "azure-container-apps-queue" }
  })
  if (!claimed) throw new Error("Meeting window is already owned")
  let isSettled = true
  try {
    // A competing worker may have completed between the first read and lease admission.
    const committed = await dependencies.readReceipt(database, stream)
    if (committed !== undefined) {
      const receipt = receiptSchema.parse(committed)
      return { status: "already_promoted" as const, events: receipt.events }
    }
    const archive = await dependencies.dispatch({
      store: input.store,
      runId,
      storageAccount: input.storageAccount,
      queueName: input.queueName,
      maxWaitSeconds: 1800,
      request: washingtonEventCloudRequest(window)
    })
    const prepared = await dependencies.prepare({
      ...input,
      manifestPath: archive.manifestPath,
      retrievedAt: dependencies.now()
    })
    if (!prepared.completeWindow || prepared.planId !== plan.id || prepared.windowId !== selected.id)
      throw new Error("Meeting preparation did not confirm planned coverage")
    const receipt = {
      source: "openstates",
      stream,
      cursor: {
        status: "promoted",
        planId: plan.id,
        windowId: selected.id,
        build,
        events: prepared.snapshots.length,
        manifestPath: archive.manifestPath,
        settlementPath: archive.settlementPath
      }
    }
    receiptSchema.parse(receipt.cursor)
    if (prepared.snapshots.length)
      await dependencies.promote(database, prepared.snapshots, { ownership: owner, receipt })
    else await dependencies.promoteEmpty(database, owner, receipt)
    return { status: "promoted" as const, events: prepared.snapshots.length }
  } catch (error) {
    isSettled = !(error instanceof ScraperWorkerStopUnconfirmedError)
    throw error
  } finally {
    if (isSettled) await dependencies.release(database, owner)
  }
}
