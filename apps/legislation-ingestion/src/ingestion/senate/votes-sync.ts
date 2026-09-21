import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints, votes } from "@repo/legislation-core/database/schema/schema"
import { and, eq } from "drizzle-orm"
import { upsertFederalVoteSnapshot } from "../../persistence/votes.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts } from "../job-result.js"
import type { JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { SenateClient } from "./client.js"
import { normalizeSenateVote } from "./votes.js"

const REFRESH_VOTE_COUNT = 25

export interface SenateVoteSyncResult {
  checkpoint?: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function synchronizeSenateVotes(
  database: LegislationDatabase,
  client: Pick<SenateClient, "getMemberIdentifiers" | "getVote" | "listVotes">,
  congress: number,
  session: number,
  options: Readonly<{ limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
): Promise<SenateVoteSyncResult> {
  const stream = `senate-votes-${congress}-${session}`
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "senate"), eq(syncCheckpoints.stream, stream))
  })
  const checkpointVoteNumber = options.restart === true ? 1 : nextVoteNumber(checkpoint?.cursor)
  const counts = createJobCounts()
  const failures: SenateVoteSyncResult["failures"] = []
  const [directory, menu] = await Promise.all([client.getMemberIdentifiers(), client.listVotes(congress, session)])
  await Promise.all([
    options.sourceStore?.put("senate", "member-directory", directory.bytes, { sourceUrl: directory.sourceUrl }),
    options.sourceStore?.put("senate", stream, menu.bytes, { sourceUrl: menu.sourceUrl })
  ])
  const orderedReferences = menu.value.toSorted((left, right) => left.voteNumber - right.voteNumber)
  const newReferences = orderedReferences.filter((reference) => reference.voteNumber >= checkpointVoteNumber)
  const references =
    newReferences.length === 0 && options.restart !== true
      ? orderedReferences.slice(-REFRESH_VOTE_COUNT)
      : newReferences.slice(0, options.limit)
  counts.discovered += references.length
  let next = checkpointVoteNumber

  for (const reference of references) {
    try {
      const source = await client.getVote(reference)
      await options.sourceStore?.put("senate", stream, source.bytes, { sourceUrl: source.sourceUrl })
      const snapshot = normalizeSenateVote(source.value, reference, directory.value)
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
      if (reference.voteNumber >= next) {
        next = reference.voteNumber + 1
        await saveCheckpoint(database, stream, next)
      }
    } catch (error) {
      counts.failed += 1
      failures.push({
        identifier: `${congress}-${session}-${reference.voteNumber}`,
        message: error instanceof Error ? error.message : "Unknown Senate vote failure",
        retryable: error instanceof ProviderHttpError && error.retryable
      })
      if (reference.voteNumber >= checkpointVoteNumber) {
        break
      }
    }
  }

  return { checkpoint: { nextVoteNumber: next }, counts, failures }
}

function nextVoteNumber(cursor: Readonly<Record<string, unknown>> | undefined): number {
  const value = cursor?.nextVoteNumber
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 1
}

async function saveCheckpoint(database: LegislationDatabase, stream: string, nextVoteNumber: number) {
  const cursor = { nextVoteNumber }
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: "senate", stream })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}
