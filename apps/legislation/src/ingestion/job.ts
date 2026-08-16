import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import { ingestionRuns } from "../db/schema/schema.js"

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
  runId: string
  status: "failed" | "partial" | "succeeded"
}

export class JobAlreadyRunningError extends Error {
  constructor(source: string, operation: string) {
    super(`A ${source} ${operation} job is already running`)
    this.name = "JobAlreadyRunningError"
  }
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
  }>,
  operation: (runId: string) => Promise<Omit<JobResult, "correlationId" | "runId" | "status">>
): Promise<JobResult> {
  const ownerId = randomUUID()
  const lock = await database.execute<{ owner_id: string }>(sql`
    insert into legislation.ingestion_locks (source, operation, owner_id, expires_at)
    values (${input.source}, ${input.operation}, ${ownerId}::uuid, now() + interval '3 hours')
    on conflict (source, operation) do update
      set owner_id = excluded.owner_id, expires_at = excluded.expires_at, acquired_at = now()
      where legislation.ingestion_locks.expires_at < now()
    returning owner_id
  `)
  if (lock.rows.length === 0) {
    throw new JobAlreadyRunningError(input.source, input.operation)
  }
  let runId: string | undefined
  try {
    const inserted = await database
      .insert(ingestionRuns)
      .values({ operation: input.operation, scope: input.scope, source: input.source })
      .returning({ id: ingestionRuns.id })
    runId = inserted[0]?.id
    if (runId === undefined) {
      throw new Error("Unable to create ingestion run")
    }

    const result = await operation(runId)
    const status = result.counts.failed > 0 ? "partial" : "succeeded"
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
    return { ...result, correlationId: input.correlationId, runId, status }
  } catch (error) {
    if (runId !== undefined) {
      await database
        .update(ingestionRuns)
        .set({ completedAt: new Date(), errorSummary: "Job failed before producing a result", status: "failed" })
        .where(eq(ingestionRuns.id, runId))
    }
    throw error
  } finally {
    await database.execute(sql`
      delete from legislation.ingestion_locks
      where source = ${input.source} and operation = ${input.operation} and owner_id = ${ownerId}::uuid
    `)
  }
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
