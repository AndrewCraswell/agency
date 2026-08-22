import { and, eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { upsertCongressAmendmentSnapshot } from "../../db/queries/amendments.js"
import { amendments, syncCheckpoints } from "../../db/schema/schema.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import { normalizeCongressAmendmentBundle } from "./amendments.js"
import type { CongressClient } from "./client.js"
import { isCongressRequestBudgetExhaustedError } from "./request-budget.js"

export interface CongressAmendmentSyncResult {
  checkpoint?: Readonly<{ complete: boolean; nextOffset: number }>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function synchronizeCongressAmendments(
  database: LegislationDatabase,
  client: Pick<CongressClient, "amendments" | "getAmendmentBundle">,
  congress: number,
  options: Readonly<{ limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
): Promise<CongressAmendmentSyncResult> {
  const stream = `amendments-${congress}`
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "congress"), eq(syncCheckpoints.stream, stream))
  })
  const checkpointOffset = checkpoint?.cursor.nextOffset
  const startOffset =
    options.restart !== true && typeof checkpointOffset === "number" && checkpointOffset >= 0 ? checkpointOffset : 0
  const counts = createJobCounts()
  const failures: CongressAmendmentSyncResult["failures"] = []
  let nextOffset = startOffset
  let complete = true

  for await (const item of client.amendments(congress, startOffset)) {
    counts.discovered += 1
    try {
      const bundle = await client.getAmendmentBundle(item.reference)
      await options.sourceStore?.put("congress", stream, new TextEncoder().encode(JSON.stringify(bundle)), {
        sourceUrl: item.reference.url
      })
      const snapshot = normalizeCongressAmendmentBundle(bundle)
      const existing = await database
        .select({ sourceUpdatedAt: amendments.sourceUpdatedAt })
        .from(amendments)
        .where(eq(amendments.id, snapshot.amendment.id))
        .limit(1)
      counts.read += 1
      if (
        existing[0]?.sourceUpdatedAt !== undefined &&
        snapshot.amendment.sourceUpdatedAt !== undefined &&
        snapshot.amendment.sourceUpdatedAt !== null &&
        existing[0].sourceUpdatedAt !== null &&
        existing[0].sourceUpdatedAt >= snapshot.amendment.sourceUpdatedAt
      ) {
        counts.unchanged += 1
      } else {
        await upsertCongressAmendmentSnapshot(database, snapshot)
        if (existing[0] === undefined) {
          counts.inserted += 1
        } else {
          counts.updated += 1
        }
      }
      nextOffset = item.offset + 1
      await saveCheckpoint(database, stream, nextOffset)
      if (options.limit !== undefined && counts.read >= options.limit) {
        complete = false
        break
      }
    } catch (error) {
      if (isCongressRequestBudgetExhaustedError(error)) {
        throw error
      }
      counts.failed += 1
      failures.push({
        identifier: `${item.reference.congress}-${item.reference.type}-${item.reference.number}`,
        message: error instanceof Error ? error.message : "Unknown Congress.gov amendment failure",
        retryable: error instanceof ProviderHttpError && error.retryable
      })
      break
    }
  }

  const cursor = { complete, nextOffset }
  return { checkpoint: cursor, counts, failures }
}

async function saveCheckpoint(database: LegislationDatabase, stream: string, nextOffset: number) {
  const cursor = { nextOffset }
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: "congress", stream })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}
