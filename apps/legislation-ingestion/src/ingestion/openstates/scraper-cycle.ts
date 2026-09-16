import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq, like } from "drizzle-orm"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { pendingScraperBillBatches, readScraperBillPlan } from "./scraper-batches.js"

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const receiptSchema = z.strictObject({
  status: z.literal("promoted"),
  inventoryId: digest,
  cycleId: z.string().min(1),
  batchId: digest,
  dispatchPath: z.string(),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/),
  manifestPath: z.string(),
  manifestSha256: digest,
  buildInputsSha256: digest,
  bills: z.number().int().positive(),
  unresolvedSponsors: z.number().int().nonnegative(),
  unresolvedPositions: z.number().int().nonnegative()
})

/** Validate committed ledger evidence, not scraper status. Does not establish archive health or identity completeness. */
export function assessScraperBillCycle(
  plan: Awaited<ReturnType<typeof readScraperBillPlan>>,
  records: readonly { stream: string; cursor: unknown }[]
) {
  const seen = new Set<string>()
  const receipts = records.map((record) => {
    const receipt = receiptSchema.parse(record.cursor)
    const batch = plan.batches.find((entry) => entry.id === receipt.batchId)
    if (
      receipt.inventoryId !== plan.inventoryId ||
      receipt.cycleId !== plan.cycleId ||
      record.stream !== `${plan.jurisdiction}-bills:${plan.session}:${plan.inventoryId}:${receipt.batchId}` ||
      !batch ||
      receipt.bills !== batch.billIds.length ||
      seen.has(receipt.batchId) ||
      receipt.dispatchPath !== `openstates/scraper-dispatches/${plan.jurisdiction}/${receipt.runId}.json` ||
      !new RegExp(
        `^openstates/scrapers/[a-f0-9]{40}/${plan.jurisdiction}/bills/${receipt.runId}/retained\\.json$`
      ).test(receipt.manifestPath)
    ) {
      throw new Error("Committed bill receipt does not match its frozen cycle")
    }
    seen.add(receipt.batchId)
    return receipt
  })
  const remaining = pendingScraperBillBatches(plan, receipts)
  return {
    cycleId: plan.cycleId,
    inventoryId: plan.inventoryId,
    totalBatches: plan.batches.length,
    promotedBatches: receipts.length,
    totalBills: plan.batches.reduce((sum, batch) => sum + batch.billIds.length, 0),
    promotedBills: receipts.reduce((sum, receipt) => sum + receipt.bills, 0),
    unresolvedSponsors: receipts.reduce((sum, receipt) => sum + receipt.unresolvedSponsors, 0),
    unresolvedPositions: receipts.reduce((sum, receipt) => sum + receipt.unresolvedPositions, 0),
    promotionComplete: remaining.complete,
    pending: remaining.pending,
    productionReady: false as const
  }
}

/** Read-only resume inventory. A new cycle has its own receipt namespace; prior cycles cannot suppress refreshes. */
export async function inspectScraperBillCycle(
  database: LegislationDatabase,
  store: Pick<ArtifactStore, "read">,
  planPath: string
) {
  const plan = await readScraperBillPlan(store, planPath)
  const records = await database
    .select({ stream: syncCheckpoints.stream, cursor: syncCheckpoints.cursor })
    .from(syncCheckpoints)
    .where(
      and(
        eq(syncCheckpoints.source, "openstates"),
        like(syncCheckpoints.stream, `${plan.jurisdiction}-bills:${plan.session}:${plan.inventoryId}:%`)
      )
    )
  return assessScraperBillCycle(plan, records)
}
