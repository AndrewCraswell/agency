import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints, votes } from "@repo/legislation-core/database/schema/schema"
import { and, eq } from "drizzle-orm"
import { upsertFederalVoteSnapshot } from "../../persistence/votes.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts } from "../job-result.js"
import type { JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { CongressClient } from "./client.js"
import { isCongressRequestBudgetExhaustedError } from "./request-budget.js"
import { normalizeCongressHouseVote } from "./votes.js"

export interface CongressHouseVoteSyncResult {
  checkpoint?: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function synchronizeCongressHouseVotes(
  database: LegislationDatabase,
  client: Pick<CongressClient, "getHouseVoteBundle" | "houseVotes">,
  congress: number,
  session: number,
  options: Readonly<{ concurrency?: number; limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
): Promise<CongressHouseVoteSyncResult> {
  const stream = `house-votes-${congress}-${session}`
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "congress"), eq(syncCheckpoints.stream, stream))
  })
  const checkpointOffset = checkpoint?.cursor.nextOffset
  const startOffset =
    options.restart !== true && typeof checkpointOffset === "number" && checkpointOffset >= 0 ? checkpointOffset : 0
  const counts = createJobCounts()
  const failures: CongressHouseVoteSyncResult["failures"] = []
  let nextOffset = startOffset
  let scheduled = 0
  const concurrency = Math.max(1, options.concurrency ?? 1)
  const iterator = client.houseVotes(congress, session, startOffset)[Symbol.asyncIterator]()

  while (options.limit === undefined || scheduled < options.limit) {
    const batch: Array<Awaited<ReturnType<typeof iterator.next>>["value"]> = []
    const maximumBatchSize = Math.min(
      concurrency,
      options.limit === undefined ? concurrency : options.limit - scheduled
    )
    while (batch.length < maximumBatchSize) {
      const next = await iterator.next()
      if (next.done) {
        break
      }
      batch.push(next.value)
    }
    if (batch.length === 0) {
      break
    }
    scheduled += batch.length
    counts.discovered += batch.length
    const outcomes = await mapConcurrent(batch, concurrency, async (item) => {
      try {
        const bundle = await client.getHouseVoteBundle(item.reference)
        await options.sourceStore?.put("congress", stream, new TextEncoder().encode(JSON.stringify(bundle)), {
          sourceUrl: item.reference.url
        })
        const snapshot = normalizeCongressHouseVote(bundle)
        const existing = await database
          .select({ id: votes.id })
          .from(votes)
          .where(eq(votes.id, snapshot.vote.id))
          .limit(1)
        counts.read += 1
        await upsertFederalVoteSnapshot(database, snapshot)
        if (existing[0] === undefined) {
          counts.inserted += 1
        } else {
          counts.updated += 1
        }
        return { item, succeeded: true as const }
      } catch (error) {
        if (isCongressRequestBudgetExhaustedError(error)) {
          throw error
        }
        counts.failed += 1
        return {
          failure: {
            identifier: `${item.reference.congress}-${item.reference.sessionNumber}-${item.reference.rollCallNumber}`,
            message: error instanceof Error ? error.message : "Unknown Congress.gov House vote failure",
            retryable: error instanceof ProviderHttpError && error.retryable
          },
          item,
          succeeded: false as const
        }
      }
    })
    const firstFailure = outcomes.findIndex((outcome) => !outcome.succeeded)
    failures.push(...outcomes.flatMap((outcome) => (outcome.succeeded ? [] : [outcome.failure])))
    const contiguous = firstFailure === -1 ? outcomes : outcomes.slice(0, firstFailure)
    for (const outcome of contiguous) {
      nextOffset = outcome.item.offset + 1
      await saveCheckpoint(database, stream, nextOffset)
    }
    if (firstFailure !== -1) {
      break
    }
  }

  return { checkpoint: { nextOffset }, counts, failures }
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
