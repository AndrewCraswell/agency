import { createDatabase } from "@repo/legislation-core/database/database"
import { logger, tasks } from "@trigger.dev/sdk"
import { loadConfig } from "../../config/config.js"
import { executeGovInfoCurrentSynchronization } from "../../ingestion/govinfo/sync.js"
import { JobAlreadyRunningError } from "../../ingestion/job.js"
import { createGovInfoProviderRequestAdmission } from "../../ingestion/provider-request-admission.js"
import { executeSynchronization } from "../../ingestion/synchronization/synchronize.js"
import type { derivedShardBackfillController } from "./backfill-tasks.js"
import {
  recurringGovInfoBillDocumentDispatch,
  recurringOpenStatesBillDocumentDispatch,
  requireSuccessfulSynchronizationResult,
  type RecurringBillDocumentDispatch,
  type SynchronizationTaskResult
} from "./synchronization-policy.js"
import type { SynchronizationWorkerDispatchIntent } from "./worker-contract.js"

interface SynchronizationTaskDependencies {
  dispatchRecurringBillDocuments?: (dispatch: RecurringBillDocumentDispatch) => Promise<unknown>
}

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
        ? await executeGovInfoCurrentSynchronization(
            {
              config,
              congress: intent.identity.scope,
              correlationId: intent.correlationId ?? `trigger:${triggerRunId}`,
              database,
              workflowExecutionId: triggerRunId
            },
            { providerAdmission: createGovInfoProviderRequestAdmission(pool) }
          )
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
    if (
      intent.identity.provider === "openstates" &&
      intent.identity.domain === "bills" &&
      successful.status === "succeeded"
    ) {
      const dispatch = recurringOpenStatesBillDocumentDispatch(intent, triggerRunId)
      await (dependencies.dispatchRecurringBillDocuments ?? dispatchRecurringOpenStatesBillDocuments)(dispatch)
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

async function dispatchRecurringBillDocuments(dispatch: RecurringBillDocumentDispatch): Promise<unknown> {
  return await tasks.trigger<typeof derivedShardBackfillController>(dispatch.taskIdentifier, dispatch.payload, {
    idempotencyKey: dispatch.idempotencyKey,
    tags: ["provider:govinfo", "derived:bill-documents", "sync:recurring"]
  })
}

async function dispatchRecurringOpenStatesBillDocuments(dispatch: RecurringBillDocumentDispatch): Promise<unknown> {
  return await tasks.trigger<typeof derivedShardBackfillController>(dispatch.taskIdentifier, dispatch.payload, {
    idempotencyKey: dispatch.idempotencyKey,
    tags: ["provider:openstates", dispatch.payload.jurisdictionId, "derived:bill-documents", "sync:recurring"]
  })
}
