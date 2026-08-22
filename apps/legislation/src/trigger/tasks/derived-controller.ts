export interface DerivedShardIdentity {
  shardCount: number
  shardIndex: number
}

export interface DerivedShardRun {
  id: string
  ok: boolean
  output?: unknown
}

export interface DerivedShardBatchProgress {
  activeShardIndexes: number[]
  nextAttemptAt?: Date
}

export interface DerivedShardLoopOptions {
  maxContinuations: number
  now?: () => Date
  runContinuation: (continuation: number) => Promise<DerivedShardRun>
  shardCount: number
  shardIndex: number
  waitUntil: (date: Date) => Promise<void>
}

/**
 * Keeps only shards that still have work after a bounded controller
 * continuation. Trigger batch results are deliberately matched by the shard
 * identity returned by the worker, never by their response ordering.
 */
export function reconcileDerivedShardBatch(
  shardCount: number,
  activeShardIndexes: readonly number[],
  runs: readonly DerivedShardRun[]
): DerivedShardBatchProgress {
  const expected = new Set(activeShardIndexes)
  validateActiveShardIndexes(shardCount, expected)
  if (runs.length !== expected.size) {
    throw new Error(`Derived shard batch returned ${runs.length} runs for ${expected.size} active shards`)
  }

  const incomplete = new Set(expected)
  const reported = new Set<number>()
  let nextAttemptAt: Date | undefined
  for (const run of runs) {
    if (!run.ok) {
      throw new Error(`Derived shard ${run.id} did not succeed`)
    }
    const output = parseDerivedShardOutput(run.id, run.output)
    if (output.shard.shardCount !== shardCount) {
      throw new Error(`Derived shard ${run.id} reported an unexpected shard count`)
    }
    if (!expected.has(output.shard.shardIndex)) {
      throw new Error(`Derived shard ${run.id} reported an inactive shard index`)
    }
    if (reported.has(output.shard.shardIndex)) {
      throw new Error(`Derived shard ${run.id} duplicated shard ${output.shard.shardIndex}`)
    }
    reported.add(output.shard.shardIndex)
    if (output.complete) {
      incomplete.delete(output.shard.shardIndex)
      continue
    }
    nextAttemptAt = earliestDate(nextAttemptAt, output.nextAttemptAt)
  }
  if (reported.size !== expected.size) {
    throw new Error("Derived shard batch did not report every active shard")
  }
  return { activeShardIndexes: [...incomplete].sort((left, right) => left - right), nextAttemptAt }
}

/**
 * Drains one stable shard through bounded child runs. This helper deliberately
 * owns exactly one Trigger waitpoint at a time: callers run one instance per
 * coordinator task rather than placing multiple Trigger waits in Promise.all.
 */
export async function runDerivedShardLoop({
  maxContinuations,
  now = () => new Date(),
  runContinuation,
  shardCount,
  shardIndex,
  waitUntil
}: DerivedShardLoopOptions): Promise<void> {
  validateActiveShardIndexes(shardCount, new Set([shardIndex]))
  if (!Number.isSafeInteger(maxContinuations) || maxContinuations < 1) {
    throw new Error("Derived shard loop requires at least one continuation")
  }

  for (let continuation = 0; continuation < maxContinuations; continuation += 1) {
    const run = await runContinuation(continuation)
    const progress = reconcileDerivedShardBatch(shardCount, [shardIndex], [run])
    if (progress.activeShardIndexes.length === 0) {
      return
    }
    if (progress.nextAttemptAt !== undefined && progress.nextAttemptAt > now()) {
      await waitUntil(progress.nextAttemptAt)
    }
  }
  throw new Error(`Derived shard ${shardIndex} backfill exceeded ${maxContinuations} bounded continuations`)
}

function validateActiveShardIndexes(shardCount: number, activeShardIndexes: ReadonlySet<number>): void {
  if (!Number.isSafeInteger(shardCount) || shardCount < 1) {
    throw new Error("Derived shard count must be a positive integer")
  }
  if (activeShardIndexes.size === 0) {
    throw new Error("Derived shard batch requires at least one active shard")
  }
  for (const shardIndex of activeShardIndexes) {
    if (!Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
      throw new Error("Derived shard index is outside the configured shard count")
    }
  }
}

function parseDerivedShardOutput(
  runId: string,
  output: unknown
): Readonly<{ complete: boolean; nextAttemptAt?: Date; shard: DerivedShardIdentity }> {
  if (!isRecord(output) || !isRecord(output.shard) || !isRecord(output.checkpoint)) {
    throw new Error(`Derived shard ${runId} returned an invalid output`)
  }
  const { shard } = output
  const shardCount = shard.shardCount
  const shardIndex = shard.shardIndex
  if (
    typeof shardCount !== "number" ||
    typeof shardIndex !== "number" ||
    !Number.isSafeInteger(shardCount) ||
    !Number.isSafeInteger(shardIndex)
  ) {
    throw new Error(`Derived shard ${runId} returned an invalid shard identity`)
  }
  const nextAttemptAt = parseNextAttemptAt(output.checkpoint.nextAttemptAt)
  return {
    complete: output.checkpoint.complete === true,
    ...(nextAttemptAt === undefined ? {} : { nextAttemptAt }),
    shard: { shardCount, shardIndex }
  }
}

function parseNextAttemptAt(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function earliestDate(left: Date | undefined, right: Date | undefined): Date | undefined {
  if (left === undefined || (right !== undefined && right < left)) {
    return right
  }
  return left
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
