import { describe, expect, it } from "vitest"
import { createJobCounts, type JobResult } from "../../ingestion/job.js"
import { requireSuccessfulSynchronizationResult } from "./synchronization-executor.js"

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
