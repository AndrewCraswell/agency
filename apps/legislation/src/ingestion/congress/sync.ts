import { and, eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { getBillById, upsertBillAggregate } from "../../db/queries/bill-aggregates.js"
import { syncCheckpoints } from "../../db/schema/schema.js"
import { federalBillId } from "../../legislation/identifiers.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { CongressBillReference, CongressClient } from "./client.js"
import { normalizeCongressBillBundle } from "./normalize.js"

export interface CongressSyncResult {
  checkpoint?: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function synchronizeCongress(
  database: LegislationDatabase,
  client: Pick<CongressClient, "getBillBundle" | "listUpdated">,
  options: Readonly<{
    dryRun?: boolean
    from?: Date
    overlapMilliseconds?: number
    onProgress?: (event: Readonly<Record<string, unknown>>) => void
    sourceStore?: SourceStore
    stream?: string
    to?: Date
  }> = {}
): Promise<CongressSyncResult> {
  const stream = options.stream ?? "bills"
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "congress"), eq(syncCheckpoints.stream, stream))
  })
  const overlapMilliseconds = options.overlapMilliseconds ?? 3_600_000
  const checkpointFrom =
    checkpoint?.watermark === null || checkpoint?.watermark === undefined
      ? undefined
      : new Date(checkpoint.watermark.getTime() - overlapMilliseconds)
  const from = options.from ?? checkpointFrom ?? new Date(0)
  const to = options.to ?? new Date()
  const counts = createJobCounts()
  const failures: CongressSyncResult["failures"] = []
  let proposed: { canonicalId: string; updateDate: string } | undefined
  let canAdvanceCheckpoint = true
  options.onProgress?.({
    committedCheckpoint: checkpoint?.cursor,
    event: "checkpoint_start",
    replayFrom: from.toISOString(),
    to: to.toISOString()
  })

  for await (const reference of client.listUpdated(from, to)) {
    counts.discovered += 1
    try {
      const bundle = await client.getBillBundle(reference)
      await options.sourceStore?.put("congress", stream, new TextEncoder().encode(JSON.stringify(bundle)), {
        sourceUrl: reference.url
      })
      const aggregate = normalizeCongressBillBundle(bundle)
      counts.read += 1
      if (options.dryRun !== true) {
        const existing = await getBillById(database, aggregate.bill.id)
        const unchanged =
          existing?.upstreamIds.congress !== undefined &&
          existing.sourceUpdatedAt !== null &&
          existing.sourceUpdatedAt !== undefined &&
          aggregate.bill.sourceUpdatedAt !== null &&
          aggregate.bill.sourceUpdatedAt !== undefined &&
          existing.sourceUpdatedAt.getTime() >= aggregate.bill.sourceUpdatedAt.getTime()
        if (unchanged) {
          counts.unchanged += 1
        } else {
          await upsertBillAggregate(database, aggregate)
          if (existing === undefined) {
            counts.inserted += 1
          } else {
            counts.updated += 1
          }
        }
      } else {
        counts.skipped += 1
      }
      const updateDate = reference.updateDate ?? aggregate.bill.sourceUpdatedAt?.toISOString() ?? to.toISOString()
      const canonicalId = federalBillId(reference.congress, reference.type, reference.number)
      if (
        proposed === undefined ||
        updateDate > proposed.updateDate ||
        (updateDate === proposed.updateDate && canonicalId > proposed.canonicalId)
      ) {
        proposed = { canonicalId, updateDate }
      }
      if (canAdvanceCheckpoint && options.dryRun !== true && proposed !== undefined) {
        await saveCongressCheckpoint(database, stream, proposed)
      }
      options.onProgress?.({ canonicalId, event: "record_committed", proposedCheckpoint: proposed })
    } catch (error) {
      canAdvanceCheckpoint = false
      counts.failed += 1
      failures.push({
        identifier: `${reference.congress}-${reference.type}-${reference.number}`,
        message: error instanceof Error ? error.message : "Unknown Congress.gov record failure",
        retryable: error instanceof ProviderHttpError && error.retryable
      })
      options.onProgress?.({
        event: "record_failed",
        identifier: `${reference.congress}-${reference.type}-${reference.number}`
      })
    }
  }

  if (failures.length === 0 && options.dryRun !== true) {
    const watermark = proposed === undefined ? to : new Date(proposed.updateDate)
    const cursor = proposed ?? { canonicalId: "", updateDate: watermark.toISOString() }
    await saveCongressCheckpoint(database, stream, cursor)
    options.onProgress?.({ committedCheckpoint: cursor, event: "checkpoint_committed" })
    return { checkpoint: cursor, counts, failures }
  }
  return { counts, failures }
}

async function saveCongressCheckpoint(
  database: LegislationDatabase,
  stream: string,
  cursor: Readonly<{ canonicalId: string; updateDate: string }>
) {
  const watermark = new Date(cursor.updateDate)
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: "congress", stream, watermark })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date(), watermark },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}

export function compareCongressReferences(left: CongressBillReference, right: CongressBillReference): number {
  const dateComparison = (left.updateDate ?? "").localeCompare(right.updateDate ?? "")
  if (dateComparison !== 0) {
    return dateComparison
  }
  return federalBillId(left.congress, left.type, left.number).localeCompare(
    federalBillId(right.congress, right.type, right.number)
  )
}
