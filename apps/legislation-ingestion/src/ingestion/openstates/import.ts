import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { and, eq } from "drizzle-orm"
import { upsertBillAggregates } from "../../persistence/bill-aggregates.js"
import { createJobCounts } from "../job-result.js"
import type { JobCounts } from "../job.js"
import { normalizeOpenStatesBill, type NormalizationDiagnostic, type OpenStatesContext } from "./normalize.js"

export interface OpenStatesImportResult {
  checkpoint: Readonly<Record<string, unknown>>
  counts: JobCounts
  diagnostics: NormalizationDiagnostic[]
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

interface ImportOptions {
  batchSize?: number
  concurrency: number
  contentHash: string
  force?: boolean
  stream: string
}

type PreparedRecord = { aggregate: CanonicalBillAggregate; identifier?: string; record: unknown }
type RecordResult =
  | { failure: { identifier?: string; message: string; retryable: boolean }; status: "failed" }
  | { record: unknown; status: "inserted" | "prepared" | "updated" }

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
  const batchSize = Math.max(options.concurrency, options.batchSize ?? 96)
  let canAdvanceCheckpoint = true
  let durableIndex = startingIndex
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize)
    const prepared = batch.map((record): PreparedRecord | RecordResult => {
      try {
        const result = normalizeOpenStatesBill(record, context)
        diagnostics.push(...result.diagnostics)
        return { aggregate: result.aggregate, identifier: recordIdentifier(record), record }
      } catch (error) {
        return {
          failure: {
            identifier: recordIdentifier(record),
            message: error instanceof Error ? error.message : "Unknown Open States record failure",
            retryable: false
          },
          status: "failed"
        }
      }
    })
    const batchResults: RecordResult[] = prepared.map((result) =>
      "aggregate" in result ? { record: result.record, status: "prepared" } : result
    )
    await persistPrepared(
      database,
      prepared.filter((result): result is PreparedRecord => "aggregate" in result),
      batchResults
    )
    for (const result of batchResults) {
      if (result.status === "failed") {
        counts.failed += 1
        failures.push(result.failure)
      } else if (result.status !== "prepared") {
        counts.read += 1
        counts[result.status] += 1
      }
    }
    if (canAdvanceCheckpoint) {
      const firstFailure = batchResults.findIndex((result) => result.status === "failed")
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

async function persistPrepared(
  database: LegislationDatabase,
  prepared: readonly PreparedRecord[],
  results: RecordResult[]
): Promise<void> {
  if (prepared.length === 0) {
    return
  }
  try {
    const existing = await upsertBillAggregates(
      database,
      prepared.map((item) => item.aggregate)
    )
    for (const item of prepared) {
      const result = results.find((candidate) => "record" in candidate && candidate.record === item.record)
      if (result !== undefined && "record" in result) {
        result.status = existing.has(item.aggregate.bill.id) ? "updated" : "inserted"
      }
    }
  } catch (error) {
    if (prepared.length > 1) {
      const midpoint = Math.ceil(prepared.length / 2)
      await persistPrepared(database, prepared.slice(0, midpoint), results)
      await persistPrepared(database, prepared.slice(midpoint), results)
      return
    }
    const item = prepared[0]
    if (item === undefined) {
      return
    }
    const index = results.findIndex((candidate) => "record" in candidate && candidate.record === item.record)
    if (index >= 0) {
      results[index] = {
        failure: {
          identifier: item.identifier,
          message: error instanceof Error ? error.message : "Unknown Open States persistence failure",
          retryable: error instanceof LegislationError && error.category === "dependency_unavailable"
        },
        status: "failed"
      }
    }
  }
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
