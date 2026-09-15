import { queue, runs, task, tasks, wait } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { executeCongressEntityRangeBackfill } from "../../ingestion/backfill/congress-entities.js"
import { CongressClient } from "../../ingestion/congress/client.js"
import {
  CongressAssignedRequestBudget,
  CONGRESS_WAVE_CHILD_CONCURRENCY,
  CONGRESS_WAVE_REQUESTS_PER_SECOND,
  isCongressRequestBudgetExhaustedError,
  type CongressRequestBudgetAssignment
} from "../../ingestion/congress/request-budget.js"
import { congressWaveChildDatabaseConfig } from "../../ingestion/congress/wave-policy.js"
import {
  congressHistoryWaveScopes,
  congressRecurringWaveScopes,
  runCongressWave,
  type CongressWaveChildResult
} from "../../ingestion/congress/wave.js"
import { DOCUMENT_BACKFILL_SHARD_COUNT, documentBackfillJurisdictionLane } from "../../ingestion/documents/jobs.js"
import { RetryingHttpClient } from "../../ingestion/http-client.js"
import { ingestionJobHandoffRetryAt, JobAlreadyRunningError } from "../../ingestion/job.js"
import { executeSynchronization } from "../../ingestion/synchronization/synchronize.js"
import { parseSynchronizationIdentity } from "../identities.js"
import { requireSuccessfulSynchronizationResult } from "./synchronization-executor.js"

const congressWaveCoordinatorQueue = queue({ concurrencyLimit: 1, name: "congress-wave-coordinator" })
const congressWaveChildQueue = queue({
  concurrencyLimit: CONGRESS_WAVE_CHILD_CONCURRENCY,
  name: "congress-wave-child"
})

const activeCongressWaveStatuses = ["PENDING_VERSION", "QUEUED", "DEQUEUED", "EXECUTING", "WAITING", "DELAYED"] as const

const childPayloadSchema = z
  .object({
    assignment: z.object({
      attemptBudget: z.number().int().positive(),
      slotCount: z.number().int().min(1).max(CONGRESS_WAVE_REQUESTS_PER_SECOND),
      slotOffset: z
        .number()
        .int()
        .min(0)
        .max(CONGRESS_WAVE_REQUESTS_PER_SECOND - 1)
    }),
    correlationId: z.string().trim().min(1).max(200),
    scope: z.string().trim().min(1).max(200)
  })
  .strict()

const wavePayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    endCongress: z.number().int().positive(),
    kind: z.literal("entities"),
    startCongress: z.number().int().positive()
  }),
  z.object({
    endCongress: z.number().int().positive(),
    kind: z.literal("history"),
    startCongress: z.number().int().positive()
  }),
  z.object({ currentCongress: z.number().int().positive(), kind: z.literal("recurring") })
])

export const congressWaveChild = task({
  id: "congress-wave-child",
  maxDuration: 21_600,
  queue: congressWaveChildQueue,
  run: async (payload: unknown, { ctx }): Promise<CongressWaveChildResult> => {
    const input = childPayloadSchema.parse(payload)
    return await executeCongressWaveChild(input.scope, input.assignment, input.correlationId, ctx.run.id)
  }
})

/**
 * The only task allowed to issue a multi-scope Congress.gov wave. Its singleton
 * queue makes the in-task 19,500-attempt window authoritative.
 */
export const congressWaveCoordinator = task({
  id: "congress-wave-coordinator",
  maxDuration: 21_600,
  queue: congressWaveCoordinatorQueue,
  run: async (payload: unknown, { ctx }) => {
    const input = wavePayloadSchema.parse(payload)
    const activeWave = await findOtherActiveCongressWave(ctx.run.id)
    if (activeWave !== undefined) {
      return {
        activeWaveRunId: activeWave.id,
        kind: input.kind,
        skipped: "active-wave" as const
      }
    }
    const scopes = congressWavePayloadScopes(input)
    const result = await runCongressWave(scopes, {
      executeChild: createBatchChildExecutor(ctx.run.id),
      waitUntil: async (date) => await wait.until({ date })
    })
    const derivedDispatch =
      input.kind === "recurring" ? await dispatchCongressRecurringDerivedWork(ctx.run.id) : undefined
    return { ...result, derivedDispatch, kind: input.kind }
  }
})

export function congressWavePayloadScopes(payload: unknown): string[] {
  const input = wavePayloadSchema.parse(payload)
  if (input.kind === "recurring") {
    return congressRecurringWaveScopes(input.currentCongress)
  }
  const history = congressHistoryWaveScopes(input.startCongress, input.endCongress)
  return input.kind === "entities" ? history.filter((scope) => scope.startsWith("congress:entities-range:")) : history
}

export function congressRecurringDerivedPayloads(waveRunId: string, includeMaterials: boolean) {
  const rebuildId = `recurring-congress:${waveRunId}`
  return [
    {
      key: "documents",
      payload: {
        correlationId: `${rebuildId}:documents`,
        jurisdictionId: "jurisdiction:us",
        kind: "bill-documents" as const,
        maxContinuations: 100,
        rebuildId,
        shardCount: DOCUMENT_BACKFILL_SHARD_COUNT,
        shardIndex: documentBackfillJurisdictionLane("jurisdiction:us")
      }
    },
    ...(includeMaterials
      ? [
          {
            key: "materials",
            payload: {
              correlationId: `${rebuildId}:materials`,
              kind: "supporting-materials" as const,
              maxContinuations: 100,
              rebuildId,
              shardCount: 1,
              shardIndex: 0
            }
          }
        ]
      : [])
  ]
}

async function dispatchCongressRecurringDerivedWork(waveRunId: string) {
  const activeBackfill = await findActiveLegislationBackfill()
  const items = congressRecurringDerivedPayloads(waveRunId, activeBackfill === undefined)
  const handles = []
  for (const item of items) {
    handles.push(
      await tasks.trigger("backfill-derived-shard-controller", item.payload, {
        idempotencyKey: `${waveRunId}:derived:${item.key}`
      })
    )
  }
  return {
    materialsDeferredByBackfillRunId: activeBackfill?.id,
    runIds: handles.map((handle) => handle.id)
  }
}

async function findActiveLegislationBackfill() {
  const page = await runs.list({
    limit: 100,
    period: "24h",
    status: [...activeCongressWaveStatuses],
    taskIdentifier: "legislation-backfill"
  })
  return page.data[0]
}

async function findOtherActiveCongressWave(currentRunId: string) {
  const page = await runs.list({
    limit: 100,
    period: "24h",
    status: [...activeCongressWaveStatuses],
    taskIdentifier: "congress-wave-coordinator"
  })
  return firstOtherActiveCongressWave(page.data, currentRunId)
}

export function firstOtherActiveCongressWave<T extends Readonly<{ id: string; status: string }>>(
  candidates: readonly T[],
  currentRunId: string
): T | undefined {
  return candidates.find(
    (candidate) =>
      candidate.id !== currentRunId &&
      activeCongressWaveStatuses.includes(candidate.status as (typeof activeCongressWaveStatuses)[number])
  )
}

function createBatchChildExecutor(waveRunId: string) {
  const pending: Array<{
    input: Readonly<{ assignment: CongressRequestBudgetAssignment; scope: string }>
    resolve: (value: CongressWaveChildResult) => void
    reject: (reason?: unknown) => void
  }> = []
  let flush: Promise<void> | undefined
  let generation = 0

  return async (input: Readonly<{ assignment: CongressRequestBudgetAssignment; scope: string }>) =>
    await new Promise<CongressWaveChildResult>((resolve, reject) => {
      pending.push({ input, reject, resolve })
      flush ??= Promise.resolve().then(async () => {
        const batch = pending.splice(0)
        generation += 1
        const batchGeneration = generation
        flush = undefined
        try {
          const result = await congressWaveChild.batchTriggerAndWait(
            batch.map(({ input: child }) => ({
              options: { idempotencyKey: congressWaveChildIdempotencyKey(waveRunId, batchGeneration, child.scope) },
              payload: {
                assignment: child.assignment,
                correlationId: `congress-wave:${waveRunId}:${batchGeneration}:${child.scope}`,
                scope: child.scope
              }
            }))
          )
          assertCongressWaveBatchCardinality(batch.length, result.runs.length)
          for (const [index, run] of result.runs.entries()) {
            const child = batch[index]
            if (child === undefined) {
              continue
            }
            if (!run.ok) {
              child.reject(run.error)
            } else {
              child.resolve(run.output)
            }
          }
        } catch (error) {
          for (const child of batch) {
            child.reject(error)
          }
        }
      })
    })
}

export function congressWaveChildIdempotencyKey(waveRunId: string, generation: number, scope: string): string {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("Congress wave child generation must be a positive integer")
  }
  return `${waveRunId}:${generation}:${scope}`
}

export function assertCongressWaveBatchCardinality(expected: number, actual: number): void {
  if (actual !== expected) {
    throw new Error(`Congress wave batch returned ${actual} child runs for ${expected} submitted children`)
  }
}

async function executeCongressWaveChild(
  scope: string,
  assignment: CongressRequestBudgetAssignment,
  correlationId: string,
  workflowExecutionId: string
): Promise<CongressWaveChildResult> {
  const config = loadConfig()
  const apiKey = config.ingestion.congressApiKey
  if (apiKey === undefined) {
    throw new Error("CONGRESS_API_KEY is required for Congress wave work")
  }
  const budget = new CongressAssignedRequestBudget(assignment)
  const client = new CongressClient({
    apiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: new RetryingHttpClient({
      afterAttemptComplete: async (telemetry) => await budget.observe(telemetry),
      beforeAttempt: async () => await budget.acquire(),
      maxAttempts: config.ingestion.maxAttempts,
      requestTimeoutMs: config.ingestion.requestTimeoutMs
    })
  })
  const entityRange = parseCongressEntityRangeScope(scope)
  // Queue concurrency is 15. Every child gets operation and heartbeat
  // connections so a long transaction cannot starve lease renewal (30 maximum).
  const { database, pool } = createDatabase(congressWaveChildDatabaseConfig(config))
  try {
    const result =
      entityRange === undefined
        ? await executeSynchronization(
            {
              config,
              correlationId,
              database,
              identity: parseSynchronizationIdentity(scope),
              workflowExecutionId
            },
            { congressClient: client }
          )
        : await executeCongressEntityRangeBackfill(
            {
              config,
              correlationId,
              database,
              endCongress: entityRange.endCongress,
              startCongress: entityRange.startCongress,
              workflowExecutionId
            },
            { client }
          )
    if (result.status === "deferred") {
      if (result.retryAt === undefined) {
        throw new Error(`Congress wave child ${scope} deferred without a retry time`)
      }
      return deferredCongressWaveChildResult(scope, budget.attempts, result)
    }
    if (result.status !== "succeeded") {
      requireSuccessfulSynchronizationResult(result)
    }
    return { attempts: budget.attempts, scope, status: "complete" }
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      const retryAt = await ingestionJobHandoffRetryAt(database, error)
      return congressWaveLeaseHandoffResult(scope, budget.attempts, retryAt)
    }
    if (isCongressRequestBudgetExhaustedError(error)) {
      return {
        attempts: budget.attempts,
        ...(error.deferKind === "provider_cooldown" ? { retryAt: error.retryAt } : {}),
        scope,
        status: "incomplete"
      }
    }
    throw error
  } finally {
    await pool.end()
  }
}

export function congressWaveLeaseHandoffResult(
  scope: string,
  attempts: number,
  retryAt: Date
): CongressWaveChildResult {
  return { attempts, retryAt, scope, status: "incomplete" }
}

export function parseCongressEntityRangeScope(
  scope: string
): Readonly<{ endCongress: number; startCongress: number }> | undefined {
  const match = /^congress:entities-range:([1-9]\d*)-([1-9]\d*)$/.exec(scope)
  if (match === null) {
    return undefined
  }
  const startCongress = Number(match[1])
  const endCongress = Number(match[2])
  if (startCongress > endCongress) {
    throw new Error("Congress entity range scope must be ascending")
  }
  return { endCongress, startCongress }
}

export function deferredCongressWaveChildResult(
  scope: string,
  attempts: number,
  result: Readonly<{ deferKind?: string; retryAt?: Date; status: string }>
): CongressWaveChildResult {
  if (result.retryAt === undefined) {
    throw new Error(`Congress wave child ${scope} deferred without a retry time`)
  }
  return {
    attempts,
    ...(result.deferKind === "provider_cooldown" ? { retryAt: result.retryAt } : {}),
    scope,
    status: "incomplete"
  }
}
