import { and, eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { upsertCongressHouseVoteSnapshot } from "../../db/queries/votes.js"
import { syncCheckpoints, votes } from "../../db/schema/schema.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { CongressClient } from "./client.js"
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
  options: Readonly<{ limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
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

  for await (const item of client.houseVotes(congress, session, startOffset)) {
    counts.discovered += 1
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
      await upsertCongressHouseVoteSnapshot(database, snapshot)
      if (existing[0] === undefined) {
        counts.inserted += 1
      } else {
        counts.updated += 1
      }
      nextOffset = item.offset + 1
      await saveCheckpoint(database, stream, nextOffset)
      if (options.limit !== undefined && counts.read >= options.limit) {
        break
      }
    } catch (error) {
      counts.failed += 1
      failures.push({
        identifier: `${item.reference.congress}-${item.reference.sessionNumber}-${item.reference.rollCallNumber}`,
        message: error instanceof Error ? error.message : "Unknown Congress.gov House vote failure",
        retryable: error instanceof ProviderHttpError && error.retryable
      })
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
