import { logger } from "@trigger.dev/sdk"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { executeGovInfoCurrentSynchronization } from "../../ingestion/govinfo/sync.js"
import { JobAlreadyRunningError, type JobResult } from "../../ingestion/job.js"
import { executeSynchronization } from "../../ingestion/synchronization/synchronize.js"
import type { SynchronizationWorkerDispatchIntent } from "./worker-contract.js"

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
  triggerRunId: string
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
    return requireSuccessfulSynchronizationResult(result)
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
