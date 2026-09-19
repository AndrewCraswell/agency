import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { legislativeEvents, supportingMaterials, syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq, inArray } from "drizzle-orm"
import { upsertCongressEventSnapshot, upsertCongressHearingSnapshot } from "../../persistence/congress-events.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts } from "../job-result.js"
import type { JobCounts } from "../job.js"
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
  options: Readonly<{ forceRematerialize?: boolean; limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
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
      const normalizationContext = { retrievedAt: new Date() }
      if (domain === "hearings") {
        const publication = normalizeCongressHearing(source)
        if (publication === undefined) {
          counts.skipped += 1
          nextOffset = item.offset + 1
          await saveCheckpoint(database, stream, nextOffset)
          return false
        }
        const materialIds = publication.materials.map((item) => item.material.id)
        const existing = await database
          .select({ id: supportingMaterials.id, sourceUpdatedAt: supportingMaterials.sourceUpdatedAt })
          .from(supportingMaterials)
          .where(inArray(supportingMaterials.id, materialIds))
          .limit(materialIds.length)
        counts.read += 1
        const isUnchanged = publication.materials.every(({ material }) => {
          const stored = existing.find((item) => item.id === material.id)
          return (
            stored?.sourceUpdatedAt != null &&
            material.sourceUpdatedAt != null &&
            stored.sourceUpdatedAt >= material.sourceUpdatedAt
          )
        })
        if (!options.forceRematerialize && isUnchanged) {
          counts.unchanged += 1
        } else {
          await upsertCongressHearingSnapshot(database, publication)
          if (existing.length === 0) {
            counts.inserted += 1
          } else {
            counts.updated += 1
          }
        }
        nextOffset = item.offset + 1
        await saveCheckpoint(database, stream, nextOffset)
        return options.limit !== undefined && counts.read >= options.limit
      }
      const snapshot = normalizeCongressCommitteeMeeting(source, normalizationContext)
      const existing = await database
        .select({ sourceUpdatedAt: legislativeEvents.sourceUpdatedAt })
        .from(legislativeEvents)
        .where(eq(legislativeEvents.id, snapshot.event.id))
        .limit(1)
      counts.read += 1
      if (
        options.forceRematerialize !== true &&
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
