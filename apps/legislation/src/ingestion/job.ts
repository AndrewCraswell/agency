import { randomUUID } from "node:crypto"
import { and, eq, lt, lte, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import { ingestionLocks, ingestionRuns, syncCheckpoints } from "../db/schema/schema.js"
import { isDeferredIngestionError } from "./deferred.js"
import { ingestionErrorSummary, sanitizeIngestionMessage } from "./errors.js"
import { withIngestionRun } from "./run-context.js"

const DEFAULT_JOB_LEASE_DURATION_MINUTES = 5
const MAXIMUM_JOB_LEASE_DURATION_MINUTES = 60
const JOB_LEASE_HEARTBEAT_MS = 60_000
const JOB_LEASE_HANDOFF_MARGIN_MS = 10_000

export const JOB_EXIT_CODE = {
  deferred: 0,
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
  deferKind?: string
  failures: ReadonlyArray<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
  operation: string
  retryAt?: Date
  runId: string
  source: string
  status: "deferred" | "failed" | "partial" | "succeeded"
  workflowExecutionId?: string
}

type JobOperationResult = Omit<JobResult, "correlationId" | "operation" | "runId" | "source" | "status">

export function ingestionFailureSummary(
  failures: ReadonlyArray<Readonly<{ identifier?: string; message: string }>>
): string | null {
  return (
    failures
      .slice(0, 20)
      .map((failure) =>
        sanitizeIngestionMessage(
          failure.identifier === undefined ? failure.message : `${failure.identifier}: ${failure.message}`
        )
      )
      .join("; ")
      .slice(0, 8000) || null
  )
}

export class JobAlreadyRunningError extends Error {
  readonly operation: string
  readonly scopeKey: string
  readonly source: string

  constructor(source: string, operation: string, scopeKey: string) {
    super(`A ${source} ${operation} job is already running for ${scopeKey}`)
    this.name = "JobAlreadyRunningError"
    this.operation = operation
    this.scopeKey = scopeKey
    this.source = source
  }
}

/**
 * Returns the earliest point at which a worker that lost an ingestion lease
 * may try again. Callers use this only after `runIngestionJob` rejected their
 * acquisition, so returning a short guarded retry when the row disappeared
 * during that race is sufficient.
 */
export async function ingestionJobHandoffRetryAt(
  database: LegislationDatabase,
  input: Readonly<{ operation: string; scopeKey: string; source: string }>,
  now = new Date()
): Promise<Date> {
  validateLeaseIdentity(input)
  const scopeGroup = input.scopeKey.includes(":") ? input.scopeKey.slice(0, input.scopeKey.indexOf(":")) : undefined
  const groupScopeKey = scopeGroup === undefined ? input.scopeKey : `${scopeGroup}:all`
  const groupPattern = scopeGroup === undefined ? input.scopeKey : `${scopeGroup}:%`
  const isGroupScope = input.scopeKey === groupScopeKey
  const result = await database.execute<{ expires_at: unknown }>(sql`
    select expires_at
    from legislation.ingestion_locks
    where source = ${input.source}
      and operation = ${input.operation}
      and expires_at >= now()
      and (
        scope_key = ${input.scopeKey}
        or scope_key = ${groupScopeKey}
        or (${isGroupScope} and scope_key like ${groupPattern})
      )
    order by expires_at asc
    limit 1
  `)
  return ingestionLeaseHandoffAt(result.rows[0]?.expires_at, now)
}

export function ingestionLeaseHandoffAt(expiresAt: unknown, now = new Date()): Date {
  let parsed: Date | undefined
  if (expiresAt instanceof Date) {
    parsed = expiresAt
  } else if (typeof expiresAt === "string" || typeof expiresAt === "number") {
    parsed = new Date(expiresAt)
  }
  return new Date(
    (parsed !== undefined && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : now.getTime()) +
      JOB_LEASE_HANDOFF_MARGIN_MS
  )
}

export async function recoverInterruptedIngestionJob(
  database: LegislationDatabase,
  input: Readonly<{ before: Date; operation: string; scopeKey: string; source: string }>
): Promise<{ releasedLease: boolean; runIds: string[] }> {
  validateLeaseIdentity(input)
  return database.transaction(async (transaction) => {
    const released = await transaction
      .delete(ingestionLocks)
      .where(
        and(
          eq(ingestionLocks.source, input.source),
          eq(ingestionLocks.operation, input.operation),
          eq(ingestionLocks.scopeKey, input.scopeKey),
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
          sql`${ingestionRuns.scope} ->> 'scopeKey' = ${input.scopeKey}`,
          eq(ingestionRuns.status, "running"),
          lt(ingestionRuns.startedAt, input.before)
        )
      )
      .returning({ id: ingestionRuns.id })
    return { releasedLease: true, runIds: recovered.map((run) => run.id) }
  })
}

/**
 * Recovers only an interrupted attempt that belongs to the current Trigger run.
 * Trigger keeps the same run ID when it retries an OOM/system-killed attempt,
 * but the killed process cannot release its database lease. The acquired-at
 * guard prevents a delayed retry from deleting a lease subsequently acquired
 * by a different workflow execution.
 */
export async function recoverRetriedIngestionJob(
  database: LegislationDatabase,
  input: Readonly<{ operation: string; scopeKey: string; source: string; workflowExecutionId: string }>
): Promise<{ releasedLease: boolean; runIds: string[]; startedAt?: Date }> {
  validateLeaseIdentity(input)
  if (input.workflowExecutionId.trim().length === 0) {
    throw new Error("workflowExecutionId must not be empty")
  }
  return database.transaction(async (transaction) => {
    const interrupted = await transaction
      .select({ id: ingestionRuns.id, startedAt: ingestionRuns.startedAt })
      .from(ingestionRuns)
      .where(
        and(
          eq(ingestionRuns.source, input.source),
          eq(ingestionRuns.operation, input.operation),
          sql`${ingestionRuns.scope} ->> 'scopeKey' = ${input.scopeKey}`,
          eq(ingestionRuns.status, "running"),
          eq(ingestionRuns.workflowExecutionId, input.workflowExecutionId)
        )
      )
      .limit(1)
    const ownedRun = interrupted[0]
    if (ownedRun === undefined) {
      return { releasedLease: false, runIds: [] }
    }
    const released = await transaction
      .delete(ingestionLocks)
      .where(
        and(
          eq(ingestionLocks.source, input.source),
          eq(ingestionLocks.operation, input.operation),
          eq(ingestionLocks.scopeKey, input.scopeKey),
          lte(ingestionLocks.acquiredAt, ownedRun.startedAt)
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
        errorSummary: "Trigger retried after the prior attempt ended before releasing its renewable lease",
        status: "failed"
      })
      .where(
        and(
          eq(ingestionRuns.source, input.source),
          eq(ingestionRuns.operation, input.operation),
          sql`${ingestionRuns.scope} ->> 'scopeKey' = ${input.scopeKey}`,
          eq(ingestionRuns.status, "running"),
          eq(ingestionRuns.workflowExecutionId, input.workflowExecutionId)
        )
      )
      .returning({ id: ingestionRuns.id })
    return { releasedLease: true, runIds: recovered.map((run) => run.id), startedAt: ownedRun.startedAt }
  })
}

export function createJobCounts(overrides: Partial<JobCounts> = {}): JobCounts {
  return { discovered: 0, failed: 0, inserted: 0, read: 0, skipped: 0, unchanged: 0, updated: 0, ...overrides }
}

export async function runIngestionJob(
  database: LegislationDatabase,
  input: Readonly<{
    correlationId: string
    checkpointStream?: string
    leaseDurationMinutes?: number
    operation: string
    scope: Readonly<Record<string, unknown>>
    scopeKey: string
    source: string
    workflowExecutionId?: string
  }>,
  operation: (runId: string) => Promise<JobOperationResult>
): Promise<JobResult> {
  validateLeaseIdentity(input)
  const leaseDurationMinutes = validateLeaseDurationMinutes(input.leaseDurationMinutes)
  const ownerId = randomUUID()
  const acquired = await database.transaction(async (transaction) => {
    const scopeGroup = input.scopeKey.includes(":") ? input.scopeKey.slice(0, input.scopeKey.indexOf(":")) : undefined
    const groupScopeKey = scopeGroup === undefined ? input.scopeKey : `${scopeGroup}:all`
    const groupPattern = scopeGroup === undefined ? input.scopeKey : `${scopeGroup}:%`
    const isGroupScope = input.scopeKey === groupScopeKey
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([input.source, input.operation])}, 0))`
    )
    const lock = await transaction.execute<{ owner_id: string }>(sql`
      insert into legislation.ingestion_locks (source, operation, scope_key, owner_id, expires_at)
      select ${input.source}, ${input.operation}, ${input.scopeKey}, ${ownerId}::uuid,
        now() + make_interval(mins => ${leaseDurationMinutes})
      where not exists (
        select 1
        from legislation.ingestion_locks
        where source = ${input.source}
          and operation = ${input.operation}
          and expires_at >= now()
          and (
            scope_key = ${input.scopeKey}
            or scope_key = ${groupScopeKey}
            or (${isGroupScope} and scope_key like ${groupPattern})
          )
      )
      on conflict (source, operation, scope_key) do update
        set owner_id = excluded.owner_id, expires_at = excluded.expires_at, acquired_at = now()
        where legislation.ingestion_locks.expires_at < now()
      returning owner_id
    `)
    return lock.rows.length === 1
  })
  if (!acquired) {
    throw new JobAlreadyRunningError(input.source, input.operation, input.scopeKey)
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
        sql`${ingestionRuns.scope} ->> 'scopeKey' = ${input.scopeKey}`,
        eq(ingestionRuns.status, "running")
      )
    )
  let heartbeatError: unknown
  let heartbeatInFlight: Promise<void> | undefined
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight !== undefined) {
      return
    }
    heartbeatInFlight = renewJobLease(
      database,
      input.source,
      input.operation,
      input.scopeKey,
      ownerId,
      leaseDurationMinutes
    )
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
  let operationFailed = false
  try {
    const inserted = await database
      .insert(ingestionRuns)
      .values({
        correlationId: input.correlationId,
        operation: input.operation,
        scope: { ...input.scope, scopeKey: input.scopeKey },
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
    if (
      heartbeatError !== undefined ||
      !(await renewJobLease(database, input.source, input.operation, input.scopeKey, ownerId, leaseDurationMinutes))
    ) {
      throw heartbeatError ?? new Error("Ingestion job lost its renewable lease before completion")
    }
    const status: JobResult["status"] = result.counts.failed > 0 ? "partial" : "succeeded"
    if (status === "succeeded" && input.checkpointStream !== undefined) {
      await database
        .insert(syncCheckpoints)
        .values({
          cursor: result.checkpoint === undefined ? {} : { ...result.checkpoint },
          source: input.source,
          stream: input.checkpointStream,
          watermark: new Date()
        })
        .onConflictDoUpdate({
          set: {
            cursor: result.checkpoint === undefined ? {} : { ...result.checkpoint },
            updatedAt: new Date(),
            watermark: new Date()
          },
          target: [syncCheckpoints.source, syncCheckpoints.stream]
        })
    }
    await database
      .update(ingestionRuns)
      .set({
        completedAt: new Date(),
        counts: { ...result.counts },
        errorSummary: ingestionFailureSummary(result.failures),
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
    operationFailed = true
    if (runId !== undefined) {
      if (isDeferredIngestionError(error)) {
        await database
          .update(ingestionRuns)
          .set({
            completedAt: new Date(),
            errorSummary: `Deferred until ${error.retryAt.toISOString()}: ${error.message}`,
            scope: {
              ...input.scope,
              ...(error.deferKind === undefined ? {} : { deferKind: error.deferKind }),
              retryAt: error.retryAt.toISOString(),
              scopeKey: input.scopeKey
            },
            status: "deferred"
          })
          .where(eq(ingestionRuns.id, runId))
        const deferred = {
          correlationId: input.correlationId,
          counts: createJobCounts(),
          ...(error.deferKind === undefined ? {} : { deferKind: error.deferKind }),
          failures: [],
          operation: input.operation,
          retryAt: error.retryAt,
          runId,
          source: input.source,
          status: "deferred" as const
        }
        return input.workflowExecutionId === undefined
          ? deferred
          : { ...deferred, workflowExecutionId: input.workflowExecutionId }
      }
      try {
        await database
          .update(ingestionRuns)
          .set({ completedAt: new Date(), errorSummary: ingestionErrorSummary(error), status: "failed" })
          .where(eq(ingestionRuns.id, runId))
      } catch {
        // The original failure remains the task's cause if recording it also fails.
      }
    }
    throw error
  } finally {
    clearInterval(heartbeat)
    await database
      .execute(sql`
      delete from legislation.ingestion_locks
      where source = ${input.source}
        and operation = ${input.operation}
        and scope_key = ${input.scopeKey}
        and owner_id = ${ownerId}::uuid
      `)
      .catch((error: unknown) => {
        if (!operationFailed) {
          throw error
        }
      })
  }
}

function validateLeaseIdentity(input: Readonly<{ operation: string; scopeKey: string; source: string }>): void {
  if (input.source.trim() === "" || input.operation.trim() === "" || input.scopeKey.trim() === "") {
    throw new Error("Ingestion lease source, operation, and scope key must be nonempty")
  }
}

async function renewJobLease(
  database: LegislationDatabase,
  source: string,
  operation: string,
  scopeKey: string,
  ownerId: string,
  leaseDurationMinutes: number
): Promise<boolean> {
  const renewed = await database.execute<{ owner_id: string }>(sql`
    update legislation.ingestion_locks
    set expires_at = now() + make_interval(mins => ${leaseDurationMinutes})
    where source = ${source} and operation = ${operation} and scope_key = ${scopeKey} and owner_id = ${ownerId}::uuid
    returning owner_id
  `)
  return renewed.rows.length === 1
}

function validateLeaseDurationMinutes(value: number | undefined): number {
  const duration = value ?? DEFAULT_JOB_LEASE_DURATION_MINUTES
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > MAXIMUM_JOB_LEASE_DURATION_MINUTES) {
    throw new Error(`Job lease duration must be an integer from 1 to ${MAXIMUM_JOB_LEASE_DURATION_MINUTES} minutes`)
  }
  return duration
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
