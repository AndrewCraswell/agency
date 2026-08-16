import { and, eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { getBillById, upsertBillAggregate } from "../../db/queries/bill-aggregates.js"
import { syncCheckpoints } from "../../db/schema/schema.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { GovInfoBillStatusPackage, GovInfoClient } from "./client.js"
import { normalizeGovInfoBillStatus } from "./normalize.js"

export interface GovInfoImportResult {
  checkpoint: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function importGovInfoPackages(
  database: LegislationDatabase,
  client: GovInfoClient,
  packages: readonly GovInfoBillStatusPackage[],
  options: Readonly<{ force?: boolean; sourceStore?: SourceStore; stream: string }>
): Promise<GovInfoImportResult> {
  const counts = createJobCounts({ discovered: packages.length })
  const failures: GovInfoImportResult["failures"] = []
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "govinfo"), eq(syncCheckpoints.stream, options.stream))
  })
  const startIndex =
    options.force === true || typeof checkpoint?.cursor.index !== "number"
      ? 0
      : Math.min(checkpoint.cursor.index, packages.length)
  counts.skipped = startIndex
  let canAdvanceCheckpoint = true
  let durableIndex = startIndex

  for (let index = startIndex; index < packages.length; index += 1) {
    const source = packages[index]
    if (source === undefined) {
      continue
    }
    try {
      const xml = await client.getBillStatus(source)
      await options.sourceStore?.put("govinfo", options.stream, new TextEncoder().encode(xml), {
        packageId: source.packageId,
        sourceUrl: source.url.href
      })
      const aggregate = normalizeGovInfoBillStatus(xml, { sourceUrl: source.url.href })
      counts.read += 1
      const existing = await getBillById(database, aggregate.bill.id)
      await upsertBillAggregate(database, aggregate)
      if (existing === undefined) {
        counts.inserted += 1
      } else {
        counts.updated += 1
      }
      if (canAdvanceCheckpoint) {
        durableIndex = index + 1
      }
    } catch (error) {
      canAdvanceCheckpoint = false
      counts.failed += 1
      failures.push({
        identifier: source.packageId,
        message: error instanceof Error ? error.message : "Unknown GovInfo package failure",
        retryable: error instanceof ProviderHttpError && error.retryable
      })
    }
    await saveCheckpoint(database, options.stream, durableIndex, false)
  }

  const complete = failures.length === 0
  const completed = { complete, index: complete ? packages.length : durableIndex }
  await saveCheckpoint(database, options.stream, completed.index, complete)
  return { checkpoint: completed, counts, failures }
}

async function saveCheckpoint(database: LegislationDatabase, stream: string, index: number, complete: boolean) {
  const cursor = { complete, index }
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: "govinfo", stream })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}
