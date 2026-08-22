import { and, eq, inArray } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { upsertCongressCommitteeReportSnapshot } from "../../db/queries/congress-reports.js"
import { supportingMaterials, syncCheckpoints } from "../../db/schema/schema.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { CongressClient } from "./client.js"
import { normalizeCongressCommitteeReportBundle } from "./reports.js"
import { isCongressRequestBudgetExhaustedError } from "./request-budget.js"

export interface CongressCommitteeReportSyncResult {
  checkpoint?: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export async function synchronizeCongressCommitteeReports(
  database: LegislationDatabase,
  client: Pick<CongressClient, "committeeReports" | "getCommitteeReportBundle">,
  congress: number,
  options: Readonly<{ limit?: number; restart?: boolean; sourceStore?: SourceStore }> = {}
): Promise<CongressCommitteeReportSyncResult> {
  const stream = `committee-reports-${congress}`
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "congress"), eq(syncCheckpoints.stream, stream))
  })
  const checkpointOffset = checkpoint?.cursor.nextOffset
  const startOffset =
    options.restart !== true && typeof checkpointOffset === "number" && checkpointOffset >= 0 ? checkpointOffset : 0
  const counts = createJobCounts()
  const failures: CongressCommitteeReportSyncResult["failures"] = []
  let nextOffset = startOffset

  for await (const item of client.committeeReports(congress, startOffset)) {
    counts.discovered += 1
    try {
      const bundle = await client.getCommitteeReportBundle(item.reference)
      await options.sourceStore?.put("congress", stream, new TextEncoder().encode(JSON.stringify(bundle)), {
        sourceUrl: item.reference.url
      })
      const snapshot = normalizeCongressCommitteeReportBundle(bundle)
      const materialIds = snapshot.materials.map((entry) => entry.material.id)
      const existing =
        materialIds.length === 0
          ? []
          : await database
              .select({ id: supportingMaterials.id, sourceUpdatedAt: supportingMaterials.sourceUpdatedAt })
              .from(supportingMaterials)
              .where(inArray(supportingMaterials.id, materialIds))
      counts.read += 1
      const sourceUpdatedAt = snapshot.materials[0]?.material.sourceUpdatedAt
      if (
        existing.length === materialIds.length &&
        sourceUpdatedAt !== undefined &&
        sourceUpdatedAt !== null &&
        existing.every((material) => material.sourceUpdatedAt !== null && material.sourceUpdatedAt >= sourceUpdatedAt)
      ) {
        counts.unchanged += 1
      } else {
        await upsertCongressCommitteeReportSnapshot(database, snapshot)
        if (existing.length === 0) {
          counts.inserted += 1
        } else {
          counts.updated += 1
        }
      }
      nextOffset = item.offset + 1
      await saveCheckpoint(database, stream, nextOffset)
      if (options.limit !== undefined && counts.read >= options.limit) {
        break
      }
    } catch (error) {
      if (isCongressRequestBudgetExhaustedError(error)) {
        throw error
      }
      counts.failed += 1
      failures.push({
        identifier: `${item.reference.congress}-${item.reference.type}-${item.reference.number}`,
        message: error instanceof Error ? error.message : "Unknown Congress.gov committee report failure",
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
