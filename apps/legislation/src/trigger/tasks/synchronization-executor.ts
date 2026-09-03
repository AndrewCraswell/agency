import { logger, tasks } from "@trigger.dev/sdk"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { DERIVED_DOCUMENT_BATCH_SIZE } from "../../ingestion/backfill/derived.js"
import { DOCUMENT_BACKFILL_SHARD_COUNT, documentBackfillJurisdictionLane } from "../../ingestion/documents/jobs.js"
import { executeGovInfoCurrentSynchronization } from "../../ingestion/govinfo/sync.js"
import { JobAlreadyRunningError, type JobResult } from "../../ingestion/job.js"
import { executeSynchronization } from "../../ingestion/synchronization/synchronize.js"
import type { derivedShardBackfillController } from "./backfill-tasks.js"
import type { SynchronizationWorkerDispatchIntent } from "./worker-contract.js"

const federalJurisdictionId = "jurisdiction:us"

export interface RecurringBillDocumentDispatch {
  idempotencyKey: string
  payload: {
    batchSize: number
    correlationId: string
    documentStatus: "pending"
    jurisdictionId: string
    kind: "bill-documents"
    maxContinuations: 1_000
    rebuildId: string
    shardCount: number
    shardIndex: number
  }
  taskIdentifier: "backfill-derived-shard-controller"
}

interface SynchronizationTaskDependencies {
  dispatchRecurringBillDocuments?: (dispatch: RecurringBillDocumentDispatch) => Promise<unknown>
}

export type SynchronizationTaskResult =
  | JobResult
  | Readonly<{
      identity: string
      operation: string
      scopeKey: string
      source: string
      status: "overlap_skipped"
    }>

export async function executeSynchronizationTask(
  intent: SynchronizationWorkerDispatchIntent,
  triggerRunId: string,
  dependencies: SynchronizationTaskDependencies = {}
): Promise<SynchronizationTaskResult> {
  const config = loadConfig()
  const { database, pool } = createDatabase(config.database)
  try {
    const result =
      intent.identity.provider === "govinfo"
        ? await executeGovInfoCurrentSynchronization({
            config,
            congress: intent.identity.scope,
            correlationId: intent.correlationId ?? `trigger:${triggerRunId}`,
            database,
            workflowExecutionId: triggerRunId
          })
        : await executeSynchronization({
            config,
            correlationId: intent.correlationId ?? `trigger:${triggerRunId}`,
            database,
            identity: intent.identity,
            onProgress: (event) => logger.info("Congress.gov synchronization progress", event),
            workflowExecutionId: triggerRunId
          })
    const successful = requireSuccessfulSynchronizationResult(result)
    if (intent.identity.provider === "govinfo" && successful.status === "succeeded") {
      const dispatch = recurringGovInfoBillDocumentDispatch(intent, triggerRunId)
      await (dependencies.dispatchRecurringBillDocuments ?? dispatchRecurringBillDocuments)(dispatch)
    }
    return successful
  } catch (error) {
    if (error instanceof JobAlreadyRunningError) {
      return requireSuccessfulSynchronizationResult({
        identity: intent.identityKey,
        operation: error.operation,
        scopeKey: error.scopeKey,
        source: error.source,
        status: "overlap_skipped" as const
      })
    }
    throw error
  } finally {
    await pool.end()
  }
}

/**
 * Hands a successful recurring GovInfo import to a durable sequence of bounded
 * document batches. The controller retains the exact federal jurisdiction,
 * pending status, and federal shard lane across every continuation, so it can
 * drain newly ingested GovInfo documents without widening into a corpus sweep.
 */
export function recurringGovInfoBillDocumentDispatch(
  intent: SynchronizationWorkerDispatchIntent,
  triggerRunId: string
): RecurringBillDocumentDispatch {
  if (intent.identity.provider !== "govinfo") {
    throw new Error("Recurring GovInfo document processing requires a GovInfo synchronization intent")
  }
  const rebuildId = `recurring-govinfo:${triggerRunId}`
  return {
    idempotencyKey: `recurring-govinfo-documents:${intent.occurrenceKey}`,
    payload: {
      batchSize: DERIVED_DOCUMENT_BATCH_SIZE,
      correlationId: `${intent.correlationId ?? `trigger:${triggerRunId}`}:documents`,
      documentStatus: "pending",
      jurisdictionId: federalJurisdictionId,
      kind: "bill-documents",
      maxContinuations: 1_000,
      rebuildId,
      shardCount: DOCUMENT_BACKFILL_SHARD_COUNT,
      shardIndex: documentBackfillJurisdictionLane(federalJurisdictionId)
    },
    taskIdentifier: "backfill-derived-shard-controller"
  }
}

async function dispatchRecurringBillDocuments(dispatch: RecurringBillDocumentDispatch): Promise<unknown> {
  return await tasks.trigger<typeof derivedShardBackfillController>(dispatch.taskIdentifier, dispatch.payload, {
    idempotencyKey: dispatch.idempotencyKey,
    tags: ["provider:govinfo", "derived:bill-documents", "sync:recurring"]
  })
}

/**
 * Trigger retries only thrown task failures. A completed ingestion run with failed
 * records is therefore a failed worker outcome, not a successful no-op.
 */
export function requireSuccessfulSynchronizationResult(result: SynchronizationTaskResult): SynchronizationTaskResult {
  if (result.status === "succeeded" || result.status === "overlap_skipped") {
    return result
  }
  const detail = result.failures
    .slice(0, 3)
    .map((failure) => failure.message)
    .join("; ")
  throw new Error(
    `Synchronization ${result.source} ${result.operation} completed with status ${result.status}${
      detail === "" ? "" : `: ${detail}`
    }`
  )
}
