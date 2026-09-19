import { describe, expect, it } from "vitest"
import { createJobCounts } from "../../ingestion/job-result.js"
import type { JobResult } from "../../ingestion/job.js"
import {
  recurringGovInfoBillDocumentDispatch,
  recurringOpenStatesBillDocumentDispatch,
  requireSuccessfulSynchronizationResult
} from "./synchronization-policy.js"
import { createSynchronizationWorkerDispatchIntent } from "./worker-contract.js"

function jobResult(status: JobResult["status"]): JobResult {
  return {
    correlationId: "trigger:test",
    counts: createJobCounts({ failed: status === "partial" ? 1 : 0 }),
    failures: status === "partial" ? [{ identifier: "HB 1", message: "provider record failed", retryable: false }] : [],
    operation: "incremental-sync",
    runId: "run-test",
    source: "openstates",
    status
  }
}

describe("synchronization task result postcondition", () => {
  it("returns a complete ingestion result", () => {
    expect(requireSuccessfulSynchronizationResult(jobResult("succeeded"))).toMatchObject({ status: "succeeded" })
  })

  it("treats an overlap skip as a successful terminal worker outcome", () => {
    expect(
      requireSuccessfulSynchronizationResult({
        identity: "openstates:bills:ca",
        operation: "incremental-sync",
        scopeKey: "bills:ca",
        source: "openstates",
        status: "overlap_skipped"
      })
    ).toMatchObject({ status: "overlap_skipped" })
  })

  it.each(["partial", "failed"] as const)("fails the Trigger task for a %s ingestion result", (status) => {
    expect(() => requireSuccessfulSynchronizationResult(jobResult(status))).toThrow(
      `Synchronization openstates incremental-sync completed with status ${status}`
    )
  })
})

describe("recurring GovInfo document processing", () => {
  it("creates a durable pending-only federal document drain keyed to the schedule occurrence", () => {
    const intent = createSynchronizationWorkerDispatchIntent("govinfo-bill-status-sync", {
      correlationId: "govinfo:119:scheduled",
      identity: "govinfo:bill-status:119",
      occurrenceKey: "schedule-1:2026-09-03T12:00:00.000Z"
    })

    expect(recurringGovInfoBillDocumentDispatch(intent, "run-1")).toEqual({
      idempotencyKey: "recurring-govinfo-documents:schedule-1:2026-09-03T12:00:00.000Z",
      payload: {
        batchSize: 100,
        correlationId: "govinfo:119:scheduled:documents",
        documentStatus: "pending",
        jurisdictionId: "jurisdiction:us",
        kind: "bill-documents",
        maxContinuations: 1_000,
        rebuildId: "recurring-govinfo:run-1",
        shardCount: 64,
        shardIndex: 52
      },
      taskIdentifier: "backfill-derived-shard-controller"
    })
  })

  it("rejects a non-GovInfo intent", () => {
    const intent = createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
      identity: "openstates:bills:ca",
      occurrenceKey: "schedule-1:2026-09-03T12:00:00.000Z"
    })
    expect(() => recurringGovInfoBillDocumentDispatch(intent, "run-1")).toThrow(
      "requires a GovInfo synchronization intent"
    )
  })
})

describe("recurring OpenStates bill document processing", () => {
  it("creates a durable pending-only document drain scoped to the synchronized jurisdiction", () => {
    const intent = createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
      correlationId: "openstates:ca:scheduled",
      identity: "openstates:bills:ca",
      occurrenceKey: "schedule-ca:2026-09-03T12:00:00.000Z"
    })

    expect(recurringOpenStatesBillDocumentDispatch(intent, "run-ca-1")).toEqual({
      idempotencyKey: "recurring-openstates-documents:schedule-ca:2026-09-03T12:00:00.000Z",
      payload: {
        batchSize: 100,
        correlationId: "openstates:ca:scheduled:documents",
        documentStatus: "pending",
        jurisdictionId: "jurisdiction:ca",
        kind: "bill-documents",
        maxContinuations: 1_000,
        rebuildId: "recurring-openstates:ca:run-ca-1",
        shardCount: 64,
        shardIndex: 4
      },
      taskIdentifier: "backfill-derived-shard-controller"
    })
  })

  it.each([
    ["dc", "jurisdiction:dc", 50],
    ["pr", "jurisdiction:pr", 51]
  ] as const)("uses the canonical jurisdiction and reserved lane for %s", (scope, jurisdictionId, shardIndex) => {
    const intent = createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
      identity: `openstates:bills:${scope}`,
      occurrenceKey: `schedule-${scope}:2026-09-03T12:00:00.000Z`
    })

    expect(recurringOpenStatesBillDocumentDispatch(intent, `run-${scope}-1`).payload).toMatchObject({
      jurisdictionId,
      shardIndex
    })
  })

  it.each(["entities", "events"] as const)("rejects an OpenStates %s synchronization intent", (domain) => {
    const intent = createSynchronizationWorkerDispatchIntent(`openstates-${domain}-sync`, {
      identity: `openstates:${domain}:ca`,
      occurrenceKey: "schedule-ca:2026-09-03T12:00:00.000Z"
    })

    expect(() => recurringOpenStatesBillDocumentDispatch(intent, "run-ca-1")).toThrow(
      "requires an OpenStates bills synchronization intent"
    )
  })

  it("rejects a GovInfo synchronization intent", () => {
    const intent = createSynchronizationWorkerDispatchIntent("govinfo-bill-status-sync", {
      identity: "govinfo:bill-status:119",
      occurrenceKey: "schedule-us:2026-09-03T12:00:00.000Z"
    })

    expect(() => recurringOpenStatesBillDocumentDispatch(intent, "run-us-1")).toThrow(
      "requires an OpenStates bills synchronization intent"
    )
  })
})
