import { and, eq } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { getBillById, upsertBillAggregate } from "../../db/queries/bill-aggregates.js"
import { syncCheckpoints } from "../../db/schema/schema.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { normalizeOpenStatesBill, type NormalizationDiagnostic, type OpenStatesContext } from "./normalize.js"

export interface OpenStatesImportResult {
  checkpoint: Readonly<Record<string, unknown>>
  counts: JobCounts
  diagnostics: NormalizationDiagnostic[]
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

interface ImportOptions {
  concurrency: number
  contentHash: string
  force?: boolean
  stream: string
}

export async function importOpenStatesRecords(
  database: LegislationDatabase,
  context: OpenStatesContext,
  records: readonly unknown[],
  options: ImportOptions
): Promise<OpenStatesImportResult> {
  const counts = createJobCounts({ discovered: records.length })
  const failures: OpenStatesImportResult["failures"] = []
  const diagnostics: NormalizationDiagnostic[] = []
  const existingCheckpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "openstates"), eq(syncCheckpoints.stream, options.stream))
  })
  const existingCursor = existingCheckpoint?.cursor
  let startingIndex = 0
  if (
    options.force !== true &&
    existingCursor?.contentHash === options.contentHash &&
    typeof existingCursor.index === "number"
  ) {
    startingIndex = Math.min(existingCursor.index, records.length)
  }
  counts.skipped = startingIndex
  const pending = records.slice(startingIndex)
  let canAdvanceCheckpoint = true
  let durableIndex = startingIndex
  for (let offset = 0; offset < pending.length; offset += options.concurrency) {
    const batch = pending.slice(offset, offset + options.concurrency)
    const batchResults = await mapConcurrent(batch, options.concurrency, async (record) => {
      try {
        const result = normalizeOpenStatesBill(record, context)
        diagnostics.push(...result.diagnostics)
        counts.read += 1
        const existing = await getBillById(database, result.aggregate.bill.id)
        await upsertBillAggregate(database, result.aggregate)
        if (existing === undefined) {
          counts.inserted += 1
        } else {
          counts.updated += 1
        }
        return true
      } catch (error) {
        counts.failed += 1
        failures.push({
          identifier: recordIdentifier(record),
          message: error instanceof Error ? error.message : "Unknown Open States record failure",
          retryable: false
        })
        return false
      }
    })
    if (canAdvanceCheckpoint) {
      const firstFailure = batchResults.indexOf(false)
      if (firstFailure === -1) {
        durableIndex = startingIndex + offset + batch.length
      } else {
        durableIndex = startingIndex + offset + firstFailure
        canAdvanceCheckpoint = false
      }
    }
    await saveCheckpoint(database, options.stream, options.contentHash, durableIndex, false)
  }

  const complete = failures.length === 0
  const checkpoint = { complete, contentHash: options.contentHash, index: complete ? records.length : durableIndex }
  await saveCheckpoint(database, options.stream, options.contentHash, checkpoint.index, complete)
  return { checkpoint, counts, diagnostics, failures }
}

async function saveCheckpoint(
  database: LegislationDatabase,
  stream: string,
  contentHash: string,
  index: number,
  complete: boolean
) {
  await database
    .insert(syncCheckpoints)
    .values({ cursor: { complete, contentHash, index }, source: "openstates", stream })
    .onConflictDoUpdate({
      set: { cursor: { complete, contentHash, index }, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}

function recordIdentifier(record: unknown): string | undefined {
  if (
    typeof record === "object" &&
    record !== null &&
    "identifier" in record &&
    typeof record.identifier === "string"
  ) {
    return record.identifier
  }
  return undefined
}
