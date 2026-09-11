import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { LegislationDatabase } from "../../db/database.js"
import { getBillById, upsertBillAggregate } from "../../db/queries/bill-aggregates.js"
import { syncCheckpoints } from "../../db/schema/schema.js"
import { federalBillId } from "../../legislation/identifiers.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts, type JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { CongressBillReference, CongressClient } from "./client.js"
import { normalizeCongressBillBundle } from "./normalize.js"
import { isCongressRequestBudgetExhaustedError } from "./request-budget.js"

export interface CongressSyncResult {
  checkpoint?: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export interface CongressSyncGap {
  from: string
  to: string
}

type CongressSyncCursor = Readonly<{
  canonicalId: string
  gaps?: readonly CongressSyncGap[]
  pendingScan?: CongressPendingScan
  recordRetries?: readonly CongressRecordRetry[]
  scannedThrough?: string
  updateDate: string
}>

const recordRetrySchema = z.object({
  reference: z.object({
    congress: z.number().int().positive(),
    number: z.string(),
    type: z.string(),
    url: z.string(),
    updateDate: z.string().optional()
  }),
  attempts: z.number().int().positive(),
  nextAttemptAt: z.iso.datetime(),
  message: z.string()
})
type CongressRecordRetry = z.infer<typeof recordRetrySchema>

type CongressPendingScan = Readonly<{
  from: string
  to: string
  completedReferences: readonly string[]
}>

const CONGRESS_GAP_ISOLATION_MINIMUM_MILLISECONDS = 60_000
const CONGRESS_RECEIPT_CHECKPOINT_BATCH_SIZE = 100
const CONGRESS_GAP_ISOLATION_MAXIMUM_RANGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000

export async function synchronizeCongress(
  database: LegislationDatabase,
  client: Pick<CongressClient, "getBillBundle" | "listUpdated">,
  options: Readonly<{
    dryRun?: boolean
    from?: Date
    overlapMilliseconds?: number
    onProgress?: (event: Readonly<Record<string, unknown>>) => void
    sourceStore?: SourceStore
    stream?: string
    to?: Date
  }> = {}
): Promise<CongressSyncResult> {
  const stream = options.stream ?? "bills"
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "congress"), eq(syncCheckpoints.stream, stream))
  })
  const overlapMilliseconds = options.overlapMilliseconds ?? 3_600_000
  const checkpointFrom =
    checkpoint?.watermark === null || checkpoint?.watermark === undefined
      ? undefined
      : new Date(checkpoint.watermark.getTime() - overlapMilliseconds)
  const pendingScan =
    options.dryRun !== true && options.from === undefined && options.to === undefined
      ? parsePendingScan(checkpoint?.cursor)
      : undefined
  const from = options.from ?? (pendingScan === undefined ? checkpointFrom : new Date(pendingScan.from)) ?? new Date(0)
  const to = options.to ?? (pendingScan === undefined ? new Date() : new Date(pendingScan.to))
  const completedReferences = new Set(pendingScan?.completedReferences ?? [])
  const retries = new Map(
    z
      .array(recordRetrySchema)
      .parse(checkpoint?.cursor?.recordRetries ?? [])
      .map((item) => [federalBillId(item.reference.congress, item.reference.type, item.reference.number), item])
  )
  const attempted = new Set<string>()
  const counts = createJobCounts()
  const failures: CongressSyncResult["failures"] = []
  const gaps = new Map(parseCongressSyncGaps(checkpoint?.cursor).map((gap) => [congressSyncGapKey(gap), gap]))
  let committedCursor = parseCongressSyncCursor(checkpoint?.cursor, checkpoint?.watermark ?? from)
  let persistedCheckpoint: CongressSyncCursor | undefined
  let proposed: { canonicalId: string; updateDate: string } | undefined
  options.onProgress?.({
    committedCheckpoint: checkpoint?.cursor,
    event: "checkpoint_start",
    replayFrom: from.toISOString(),
    to: to.toISOString()
  })

  const persistCheckpoint = async () => {
    if (options.dryRun === true) {
      return undefined
    }
    const cursor = withCongressSyncGaps(
      committedCursor.pendingScan === undefined
        ? committedCursor
        : {
            ...committedCursor,
            pendingScan: {
              from: from.toISOString(),
              to: to.toISOString(),
              completedReferences: [...completedReferences]
            }
          },
      gaps.values()
    )
    const savedCursor = { ...cursor, recordRetries: [...retries.values()] }
    await saveCongressCheckpoint(database, stream, savedCursor)
    persistedCheckpoint = savedCursor
    return savedCursor
  }

  // Keep the scan cutoff fixed across budget handoffs. A high-water date alone
  // cannot resume records tied on that date, and provider ordering is not an ID
  // ordering. Receipts are written only after processing succeeds.
  committedCursor = {
    ...committedCursor,
    pendingScan: { from: from.toISOString(), to: to.toISOString(), completedReferences: [...completedReferences] }
  }
  await persistCheckpoint()

  const processReference = async (reference: CongressBillReference, isCurrentRange: boolean) => {
    counts.discovered += 1
    const id = federalBillId(reference.congress, reference.type, reference.number)
    const referenceKey = JSON.stringify([id, reference.updateDate ?? null])
    const retry = retries.get(id)
    if (
      attempted.has(referenceKey) ||
      (retry !== undefined &&
        retry.reference.updateDate === reference.updateDate &&
        new Date(retry.nextAttemptAt) > new Date() &&
        options.from === undefined)
    ) {
      counts.skipped += 1
      return
    }
    if (isCurrentRange && completedReferences.has(referenceKey)) {
      counts.skipped += 1
      return
    }
    try {
      attempted.add(referenceKey)
      const bundle = await client.getBillBundle(reference)
      await options.sourceStore?.put("congress", stream, new TextEncoder().encode(JSON.stringify(bundle)), {
        sourceUrl: reference.url
      })
      const aggregate = normalizeCongressBillBundle(bundle, { retrievedAt: new Date() })
      counts.read += 1
      if (options.dryRun !== true) {
        const existing = await getBillById(database, aggregate.bill.id)
        const unchanged =
          existing?.upstreamIds.congress !== undefined &&
          existing.sourceUpdatedAt !== null &&
          existing.sourceUpdatedAt !== undefined &&
          aggregate.bill.sourceUpdatedAt !== null &&
          aggregate.bill.sourceUpdatedAt !== undefined &&
          existing.sourceUpdatedAt.getTime() >= aggregate.bill.sourceUpdatedAt.getTime()
        if (unchanged) {
          counts.unchanged += 1
        } else {
          await upsertBillAggregate(database, aggregate)
          if (existing === undefined) {
            counts.inserted += 1
          } else {
            counts.updated += 1
          }
        }
      } else {
        counts.skipped += 1
      }
      const updateDate = reference.updateDate ?? aggregate.bill.sourceUpdatedAt?.toISOString() ?? to.toISOString()
      const canonicalId = federalBillId(reference.congress, reference.type, reference.number)
      if (
        proposed === undefined ||
        updateDate > proposed.updateDate ||
        (updateDate === proposed.updateDate && canonicalId > proposed.canonicalId)
      ) {
        proposed = { canonicalId, updateDate }
      }
      if (options.dryRun !== true) {
        retries.delete(id)
        if (isCurrentRange) {
          completedReferences.add(referenceKey)
        }
        committedCursor = {
          ...committedCursor,
          ...proposed
        }
        if (!isCurrentRange || completedReferences.size % CONGRESS_RECEIPT_CHECKPOINT_BATCH_SIZE === 0) {
          await persistCheckpoint()
        }
      }
      options.onProgress?.({ canonicalId, event: "record_committed", proposedCheckpoint: proposed })
    } catch (error) {
      if (isCongressRequestBudgetExhaustedError(error)) {
        await persistCheckpoint()
        throw error
      }
      counts.failed += 1
      const message = error instanceof Error ? error.message : "Unknown Congress.gov record failure"
      const attempts = (retry?.attempts ?? 0) + 1
      retries.set(id, {
        reference,
        attempts,
        message: message.slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + Math.min(24, 2 ** Math.min(attempts - 1, 5)) * 3_600_000).toISOString()
      })
      await persistCheckpoint()
      failures.push({
        identifier: `${reference.congress}-${reference.type}-${reference.number}`,
        message,
        retryable: error instanceof ProviderHttpError && error.retryable
      })
      options.onProgress?.({
        event: "record_failed",
        identifier: `${reference.congress}-${reference.type}-${reference.number}`,
        message
      })
    }
  }

  const processRange = async (range: CongressSyncGap, isCurrentRange: boolean) => {
    const captured = new Map<string, Readonly<{ error: ProviderHttpError; gap: CongressSyncGap }>>()
    for await (const reference of listUpdatedWithGapIsolation(
      client,
      new Date(range.from),
      new Date(range.to),
      (gap, error) => {
        captured.set(congressSyncGapKey(gap), { error, gap })
      }
    )) {
      await processReference(reference, isCurrentRange)
    }

    for (const [key, gap] of gaps) {
      if (congressSyncGapContains(range, gap)) {
        gaps.delete(key)
      }
    }
    for (const [key, capturedGap] of captured) {
      gaps.set(key, capturedGap.gap)
      counts.skipped += 1
      options.onProgress?.({
        error: capturedGap.error.message,
        event: "window_deferred",
        from: capturedGap.gap.from,
        to: capturedGap.gap.to
      })
    }
    committedCursor = {
      ...committedCursor,
      scannedThrough: laterCongressSyncTime(committedCursor.scannedThrough, range.to)
    }
    await persistCheckpoint()
  }

  const currentRange = congressSyncGap(from, to)
  for (const gap of Array.from(gaps.values())) {
    if (!congressSyncGapContains(currentRange, gap)) {
      await processRange(gap, false)
    }
  }
  await processRange(currentRange, true)

  // Listing completed. Unavailable records are durably owned by recordRetries,
  // not by this scan cutoff, so they cannot hold newer source changes back.
  {
    const finishedCursor = { ...committedCursor }
    delete finishedCursor.pendingScan
    committedCursor = finishedCursor
    await persistCheckpoint()
  }

  // Fresh data gets the request budget first. Retry even records no longer in
  // the source listing, with a bounded batch and durable exponential backoff.
  for (const item of [...retries.values()].filter((item) => new Date(item.nextAttemptAt) <= new Date()).slice(0, 25)) {
    await processReference(item.reference, false)
  }

  options.onProgress?.({
    event: "record_retry_backlog",
    outstandingRecords: retries.size,
    earliestRetryAt: [...retries.values()].map((item) => item.nextAttemptAt).toSorted()[0]
  })

  if (failures.length === 0 && gaps.size === 0 && options.dryRun !== true) {
    const watermark = proposed === undefined ? to : new Date(proposed.updateDate)
    const cursor = proposed ?? { canonicalId: "", updateDate: watermark.toISOString() }
    committedCursor = { ...committedCursor, ...cursor, scannedThrough: to.toISOString() }
    const finalCursor = await persistCheckpoint()
    options.onProgress?.({ committedCheckpoint: finalCursor, event: "checkpoint_committed" })
    return { checkpoint: finalCursor, counts, failures }
  }
  return { checkpoint: persistedCheckpoint, counts, failures }
}

async function saveCongressCheckpoint(database: LegislationDatabase, stream: string, cursor: CongressSyncCursor) {
  const watermark = new Date(cursor.scannedThrough ?? cursor.updateDate)
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: "congress", stream, watermark })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date(), watermark },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}

export async function* listUpdatedWithGapIsolation(
  client: Pick<CongressClient, "listUpdated">,
  from: Date,
  to: Date,
  onGap: (gap: CongressSyncGap, error: ProviderHttpError) => void,
  minimumGapMilliseconds = CONGRESS_GAP_ISOLATION_MINIMUM_MILLISECONDS
): AsyncGenerator<CongressBillReference> {
  const range = congressSyncGap(from, to)
  if (
    new Date(range.to).getTime() - new Date(range.from).getTime() >
    CONGRESS_GAP_ISOLATION_MAXIMUM_RANGE_MILLISECONDS
  ) {
    yield* client.listUpdated(new Date(range.from), new Date(range.to))
    return
  }
  yield* listUpdatedRange(client, range, onGap, minimumGapMilliseconds)
}

async function* listUpdatedRange(
  client: Pick<CongressClient, "listUpdated">,
  range: CongressSyncGap,
  onGap: (gap: CongressSyncGap, error: ProviderHttpError) => void,
  minimumGapMilliseconds: number
): AsyncGenerator<CongressBillReference> {
  const references: CongressBillReference[] = []
  try {
    for await (const reference of client.listUpdated(new Date(range.from), new Date(range.to))) {
      references.push(reference)
    }
  } catch (error) {
    if (!isCongressNullDateListError(error)) {
      throw error
    }
    const split = splitCongressSyncGap(range, minimumGapMilliseconds)
    if (split === undefined) {
      onGap(range, error)
      return
    }
    yield* listUpdatedRange(client, split[0], onGap, minimumGapMilliseconds)
    yield* listUpdatedRange(client, split[1], onGap, minimumGapMilliseconds)
    return
  }
  yield* references
}

function isCongressNullDateListError(error: unknown): error is ProviderHttpError {
  return (
    error instanceof ProviderHttpError &&
    error.status === 500 &&
    error.message.includes("NoneType") &&
    error.message.includes("attribute 'date'")
  )
}

function splitCongressSyncGap(
  gap: CongressSyncGap,
  minimumGapMilliseconds: number
): readonly [CongressSyncGap, CongressSyncGap] | undefined {
  const from = new Date(gap.from).getTime()
  const to = new Date(gap.to).getTime()
  const seconds = Math.floor((to - from) / 1000) + 1
  if (seconds * 1000 <= minimumGapMilliseconds) {
    return undefined
  }
  const leftSeconds = Math.floor(seconds / 2)
  const leftTo = from + (leftSeconds - 1) * 1000
  return [congressSyncGap(new Date(from), new Date(leftTo)), congressSyncGap(new Date(leftTo + 1000), new Date(to))]
}

function parseCongressSyncCursor(
  cursor: Readonly<Record<string, unknown>> | undefined,
  fallback: Date
): CongressSyncCursor {
  return {
    canonicalId: typeof cursor?.canonicalId === "string" ? cursor.canonicalId : "",
    scannedThrough:
      typeof cursor?.scannedThrough === "string" && Number.isFinite(new Date(cursor.scannedThrough).getTime())
        ? cursor.scannedThrough
        : fallback.toISOString(),
    updateDate: typeof cursor?.updateDate === "string" ? cursor.updateDate : fallback.toISOString()
  }
}

function parsePendingScan(cursor: Readonly<Record<string, unknown>> | undefined): CongressPendingScan | undefined {
  const value = cursor?.pendingScan
  if (
    typeof value !== "object" ||
    value === null ||
    !("from" in value) ||
    !("to" in value) ||
    !("completedReferences" in value)
  ) {
    return undefined
  }
  const ranges = parseCongressSyncGaps({ gaps: [value] })
  const range = ranges[0]
  if (
    range === undefined ||
    !Array.isArray(value.completedReferences) ||
    !value.completedReferences.every((key): key is string => typeof key === "string")
  ) {
    return undefined
  }
  return { ...range, completedReferences: value.completedReferences }
}

export function parseCongressSyncGaps(cursor: Readonly<Record<string, unknown>> | undefined): CongressSyncGap[] {
  if (!Array.isArray(cursor?.gaps)) {
    return []
  }
  return cursor.gaps.flatMap((value) => {
    if (typeof value !== "object" || value === null || !("from" in value) || !("to" in value)) {
      return []
    }
    const from = typeof value.from === "string" ? new Date(value.from) : undefined
    const to = typeof value.to === "string" ? new Date(value.to) : undefined
    return from !== undefined &&
      to !== undefined &&
      Number.isFinite(from.getTime()) &&
      Number.isFinite(to.getTime()) &&
      from <= to
      ? [congressSyncGap(from, to)]
      : []
  })
}

function congressSyncGap(from: Date, to: Date): CongressSyncGap {
  const normalizedFrom = new Date(Math.floor(from.getTime() / 1000) * 1000)
  const normalizedTo = new Date(Math.floor(to.getTime() / 1000) * 1000)
  if (normalizedTo < normalizedFrom) {
    throw new RangeError("Congress synchronization range must not end before it starts")
  }
  return { from: normalizedFrom.toISOString(), to: normalizedTo.toISOString() }
}

function congressSyncGapKey(gap: CongressSyncGap): string {
  return `${gap.from}/${gap.to}`
}

function congressSyncGapContains(container: CongressSyncGap, nested: CongressSyncGap): boolean {
  return container.from <= nested.from && container.to >= nested.to
}

function laterCongressSyncTime(left: string | undefined, right: string): string {
  return left === undefined || left < right ? right : left
}

function withCongressSyncGaps(cursor: CongressSyncCursor, gaps: Iterable<CongressSyncGap>): CongressSyncCursor {
  const sorted = [...gaps].toSorted(
    (left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to)
  )
  return sorted.length === 0 ? cursor : { ...cursor, gaps: sorted }
}

export function compareCongressReferences(left: CongressBillReference, right: CongressBillReference): number {
  const dateComparison = (left.updateDate ?? "").localeCompare(right.updateDate ?? "")
  if (dateComparison !== 0) {
    return dateComparison
  }
  return federalBillId(left.congress, left.type, left.number).localeCompare(
    federalBillId(right.congress, right.type, right.number)
  )
}
