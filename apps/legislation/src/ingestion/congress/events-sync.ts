import { and, eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { upsertCongressEventSnapshot } from "../../db/queries/congress-events.js"
import { legislativeEvents, syncCheckpoints } from "../../db/schema/schema.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { CongressClient } from "./client.js"
import { normalizeCongressCommitteeMeeting, normalizeCongressHearing } from "./events.js"
import { isCongressRequestBudgetExhaustedError } from "./request-budget.js"

type CongressEventDomain = "hearings" | "meetings"

export interface CongressEventSyncResult {
  checkpoint?: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function synchronizeCongressEvents(
  database: LegislationDatabase,
  client: Pick<CongressClient, "committeeMeetings" | "getCommitteeMeeting" | "getHearing" | "hearings">,
  congress: number,
  domain: CongressEventDomain,
  options: Readonly<{ limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
): Promise<CongressEventSyncResult> {
  const stream = `${domain}-${congress}`
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "congress"), eq(syncCheckpoints.stream, stream))
  })
  const checkpointOffset = checkpoint?.cursor.nextOffset
  const startOffset =
    options.restart !== true && typeof checkpointOffset === "number" && checkpointOffset >= 0 ? checkpointOffset : 0
  const counts = createJobCounts()
  const failures: CongressEventSyncResult["failures"] = []
  let nextOffset = startOffset
  const processItem = async (
    item: Readonly<{ offset: number; reference: Readonly<{ url: string }> }>,
    load: () => Promise<unknown>
  ): Promise<boolean> => {
    counts.discovered += 1
    try {
      const source = await load()
      await options.sourceStore?.put("congress", stream, new TextEncoder().encode(JSON.stringify(source)), {
        sourceUrl: item.reference.url
      })
      const snapshot =
        domain === "meetings" ? normalizeCongressCommitteeMeeting(source) : normalizeCongressHearing(source)
      if (snapshot === undefined) {
        counts.skipped += 1
        nextOffset = item.offset + 1
        await saveCheckpoint(database, stream, nextOffset)
        return false
      }
      const existing = await database
        .select({ sourceUpdatedAt: legislativeEvents.sourceUpdatedAt })
        .from(legislativeEvents)
        .where(eq(legislativeEvents.id, snapshot.event.id))
        .limit(1)
      counts.read += 1
      if (
        existing[0]?.sourceUpdatedAt !== undefined &&
        existing[0].sourceUpdatedAt !== null &&
        snapshot.event.sourceUpdatedAt !== undefined &&
        snapshot.event.sourceUpdatedAt !== null &&
        existing[0].sourceUpdatedAt >= snapshot.event.sourceUpdatedAt
      ) {
        counts.unchanged += 1
      } else {
        await upsertCongressEventSnapshot(database, snapshot)
        if (existing[0] === undefined) {
          counts.inserted += 1
        } else {
          counts.updated += 1
        }
      }
      nextOffset = item.offset + 1
      await saveCheckpoint(database, stream, nextOffset)
      return options.limit !== undefined && counts.read >= options.limit
    } catch (error) {
      if (isCongressRequestBudgetExhaustedError(error)) {
        throw error
      }
      counts.failed += 1
      failures.push({
        identifier: `${congress}-${domain}-${item.offset}`,
        message: error instanceof Error ? error.message : "Unknown Congress.gov event failure",
        retryable: error instanceof ProviderHttpError && error.retryable
      })
      return true
    }
  }
  if (domain === "meetings") {
    for await (const item of client.committeeMeetings(congress, startOffset)) {
      if (await processItem(item, () => client.getCommitteeMeeting(item.reference))) {
        break
      }
    }
  } else {
    for await (const item of client.hearings(congress, startOffset)) {
      if (await processItem(item, () => client.getHearing(item.reference))) {
        break
      }
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
