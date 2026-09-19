import { jurisdictionId as canonicalJurisdictionId } from "@repo/legislation-core/domain/identifiers"
import { DERIVED_DOCUMENT_BATCH_SIZE } from "../../ingestion/backfill/derived-policy.js"
import {
  DOCUMENT_BACKFILL_SHARD_COUNT,
  documentBackfillJurisdictionLane
} from "../../ingestion/documents/shard-policy.js"
import { ingestionFailureSummary } from "../../ingestion/job-result.js"
import type { JobResult } from "../../ingestion/job.js"
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

export type SynchronizationTaskResult =
  | JobResult
  | Readonly<{
      identity: string
      operation: string
      scopeKey: string
      source: string
      status: "overlap_skipped"
    }>

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

/**
 * Hands a successful recurring OpenStates bills import to a durable sequence
 * of bounded document batches. The controller retains the synchronization's
 * exact state jurisdiction and pending status across every continuation.
 */
export function recurringOpenStatesBillDocumentDispatch(
  intent: SynchronizationWorkerDispatchIntent,
  triggerRunId: string
): RecurringBillDocumentDispatch {
  if (intent.identity.provider !== "openstates" || intent.identity.domain !== "bills") {
    throw new Error("Recurring OpenStates bill document processing requires an OpenStates bills synchronization intent")
  }
  const jurisdictionId = canonicalJurisdictionId(intent.identity.scope)
  const rebuildId = `recurring-openstates:${intent.identity.scope}:${triggerRunId}`
  return {
    idempotencyKey: `recurring-openstates-documents:${intent.occurrenceKey}`,
    payload: {
      batchSize: DERIVED_DOCUMENT_BATCH_SIZE,
      correlationId: `${intent.correlationId ?? `trigger:${triggerRunId}`}:documents`,
      documentStatus: "pending",
      jurisdictionId,
      kind: "bill-documents",
      maxContinuations: 1_000,
      rebuildId,
      shardCount: DOCUMENT_BACKFILL_SHARD_COUNT,
      shardIndex: documentBackfillJurisdictionLane(jurisdictionId)
    },
    taskIdentifier: "backfill-derived-shard-controller"
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
  const detail = ingestionFailureSummary(result.failures.slice(0, 3)) ?? ""
  throw new Error(
    `Synchronization ${result.source} ${result.operation} completed with status ${result.status} (ingestion ${result.runId}, workflow ${result.workflowExecutionId ?? "unknown"})${
      detail === "" ? "" : `: ${detail}`
    }`
  )
}
