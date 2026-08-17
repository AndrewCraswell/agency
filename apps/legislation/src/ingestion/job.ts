import { randomUUID } from "node:crypto"
import { and, eq, lt, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import { ingestionLocks, ingestionRuns } from "../db/schema/schema.js"
import { withIngestionRun } from "./run-context.js"

const JOB_LEASE_DURATION = sql.raw("interval '5 minutes'")
const JOB_LEASE_HEARTBEAT_MS = 60_000

export const JOB_EXIT_CODE = {
  failed: 1,
  invalid: 2,
  partial: 3,
  succeeded: 0
} as const

export interface JobCounts {
  discovered: number
  failed: number
  inserted: number
  read: number
  skipped: number
  unchanged: number
  updated: number
}

export interface JobResult {
  checkpoint?: Readonly<Record<string, unknown>>
  correlationId: string
  counts: JobCounts
  failures: ReadonlyArray<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
  operation: string
  runId: string
  source: string
  status: "failed" | "partial" | "succeeded"
  workflowExecutionId?: string
}

type JobOperationResult = Omit<JobResult, "correlationId" | "operation" | "runId" | "source" | "status">

export class JobAlreadyRunningError extends Error {
  constructor(source: string, operation: string) {
    super(`A ${source} ${operation} job is already running`)
    this.name = "JobAlreadyRunningError"
  }
}

export async function recoverInterruptedIngestionJob(
  database: LegislationDatabase,
  input: Readonly<{ before: Date; operation: string; source: string }>
): Promise<{ releasedLease: boolean; runIds: string[] }> {
  return database.transaction(async (transaction) => {
    const released = await transaction
      .delete(ingestionLocks)
      .where(
        and(
          eq(ingestionLocks.source, input.source),
          eq(ingestionLocks.operation, input.operation),
          lt(ingestionLocks.acquiredAt, input.before)
        )
      )
      .returning({ source: ingestionLocks.source })
    if (released.length === 0) {
      return { releasedLease: false, runIds: [] }
    }
    const recovered = await transaction
      .update(ingestionRuns)
      .set({
        completedAt: new Date(),
        errorSummary: "Job execution ended before releasing its renewable lease",
        status: "failed"
      })
      .where(
        and(
          eq(ingestionRuns.source, input.source),
          eq(ingestionRuns.operation, input.operation),
          eq(ingestionRuns.status, "running"),
          lt(ingestionRuns.startedAt, input.before)
        )
      )
      .returning({ id: ingestionRuns.id })
    return { releasedLease: true, runIds: recovered.map((run) => run.id) }
  })
}

export function createJobCounts(overrides: Partial<JobCounts> = {}): JobCounts {
  return { discovered: 0, failed: 0, inserted: 0, read: 0, skipped: 0, unchanged: 0, updated: 0, ...overrides }
}

export async function runIngestionJob(
  database: LegislationDatabase,
  input: Readonly<{
    correlationId: string
    operation: string
    scope: Readonly<Record<string, unknown>>
    source: string
    workflowExecutionId?: string
  }>,
  operation: (runId: string) => Promise<JobOperationResult>
): Promise<JobResult> {
  const ownerId = randomUUID()
  const lock = await database.execute<{ owner_id: string }>(sql`
    insert into legislation.ingestion_locks (source, operation, owner_id, expires_at)
    values (${input.source}, ${input.operation}, ${ownerId}::uuid, now() + ${JOB_LEASE_DURATION})
    on conflict (source, operation) do update
      set owner_id = excluded.owner_id, expires_at = excluded.expires_at, acquired_at = now()
      where legislation.ingestion_locks.expires_at < now()
    returning owner_id
  `)
  if (lock.rows.length === 0) {
    throw new JobAlreadyRunningError(input.source, input.operation)
  }
  await database
    .update(ingestionRuns)
    .set({
      completedAt: new Date(),
      errorSummary: "Job lease expired before the execution produced a terminal result",
      status: "failed"
    })
    .where(
      and(
        eq(ingestionRuns.source, input.source),
        eq(ingestionRuns.operation, input.operation),
        eq(ingestionRuns.status, "running")
      )
    )
  let heartbeatError: unknown
  let heartbeatInFlight: Promise<void> | undefined
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight !== undefined) {
      return
    }
    heartbeatInFlight = renewJobLease(database, input.source, input.operation, ownerId)
      .then((renewed) => {
        if (!renewed) {
          heartbeatError = new Error("Ingestion job lost its renewable lease")
        }
      })
      .catch((error: unknown) => {
        heartbeatError = error
      })
      .finally(() => {
        heartbeatInFlight = undefined
      })
  }, JOB_LEASE_HEARTBEAT_MS)
  heartbeat.unref()
  let runId: string | undefined
  try {
    const inserted = await database
      .insert(ingestionRuns)
      .values({
        correlationId: input.correlationId,
        operation: input.operation,
        scope: input.scope,
        source: input.source,
        workflowExecutionId: input.workflowExecutionId
      })
      .returning({ id: ingestionRuns.id })
    runId = inserted[0]?.id
    if (runId === undefined) {
      throw new Error("Unable to create ingestion run")
    }

    const currentRunId = runId
    const result = await withIngestionRun(currentRunId, () => operation(currentRunId))
    await heartbeatInFlight
    if (heartbeatError !== undefined || !(await renewJobLease(database, input.source, input.operation, ownerId))) {
      throw heartbeatError ?? new Error("Ingestion job lost its renewable lease before completion")
    }
    const status: JobResult["status"] = result.counts.failed > 0 ? "partial" : "succeeded"
    await database
      .update(ingestionRuns)
      .set({
        completedAt: new Date(),
        counts: { ...result.counts },
        errorSummary:
          result.failures
            .slice(0, 20)
            .map((failure) => failure.message)
            .join("; ") || null,
        status
      })
      .where(eq(ingestionRuns.id, runId))
    const completed = {
      ...result,
      correlationId: input.correlationId,
      operation: input.operation,
      runId,
      source: input.source,
      status
    }
    return input.workflowExecutionId === undefined
      ? completed
      : { ...completed, workflowExecutionId: input.workflowExecutionId }
  } catch (error) {
    if (runId !== undefined) {
      await database
        .update(ingestionRuns)
        .set({ completedAt: new Date(), errorSummary: "Job failed before producing a result", status: "failed" })
        .where(eq(ingestionRuns.id, runId))
    }
    throw error
  } finally {
    clearInterval(heartbeat)
    await database.execute(sql`
      delete from legislation.ingestion_locks
      where source = ${input.source} and operation = ${input.operation} and owner_id = ${ownerId}::uuid
    `)
  }
}

async function renewJobLease(
  database: LegislationDatabase,
  source: string,
  operation: string,
  ownerId: string
): Promise<boolean> {
  const renewed = await database.execute<{ owner_id: string }>(sql`
    update legislation.ingestion_locks
    set expires_at = now() + ${JOB_LEASE_DURATION}
    where source = ${source} and operation = ${operation} and owner_id = ${ownerId}::uuid
    returning owner_id
  `)
  return renewed.rows.length === 1
}

export async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++
      const value = values[index]
      if (value !== undefined) {
        results[index] = await operation(value, index)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), values.length) }, worker))
  return results
}
