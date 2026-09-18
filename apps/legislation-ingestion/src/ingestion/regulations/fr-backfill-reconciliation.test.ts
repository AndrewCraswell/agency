import { describe, expect, it, vi } from "vitest"
import {
  runFrReconciliationBatch,
  summarizeFrReconciliationBatch,
  type FrReconciliationSuccess,
  type FrReconciliationUnit
} from "./fr-backfill-reconciliation.js"

const units: FrReconciliationUnit[] = [
  { key: "a", nativeId: "FR-2024-01-02", issueDate: "2024-01-02" },
  { key: "b", nativeId: "FR-2024-01-03", issueDate: "2024-01-03" },
  { key: "c", nativeId: "FR-2024-02-01", issueDate: "2024-02-01" }
]

function success(unit: FrReconciliationUnit): FrReconciliationSuccess {
  return {
    unitKey: unit.key,
    issueDate: unit.issueDate,
    status: "reconciled",
    matchedPublications: 2,
    metadataPublications: 3,
    outsideScope: 1,
    listedPdfsNotAcquired: 2,
    reportId: unit.key.repeat(64),
    reportPath: `${unit.issueDate}.json`
  }
}

describe("Federal Register backfill reconciliation orchestration", () => {
  it("replays each monthly manifest once and retains input ordering under bounded concurrency", async () => {
    const loadMetadata = vi.fn(async (month: string) => month)
    const result = await runFrReconciliationBatch({
      units,
      concurrency: 2,
      loadMetadata,
      reconcile: async (unit, month) => {
        expect(unit.issueDate.startsWith(month)).toBe(true)
        return success(unit)
      }
    })
    expect(loadMetadata.mock.calls).toEqual([["2024-01"], ["2024-02"]])
    expect(result.outcomes.map((outcome) => outcome.unitKey)).toEqual(["a", "b", "c"])
    expect(summarizeFrReconciliationBatch(result.outcomes)).toMatchObject({
      expectedIssues: 3,
      reconciledIssues: 3,
      failedIssues: 0,
      matchedPublications: 6,
      metadataPublications: 9,
      outsideScope: 3
    })
  })

  it("accounts for a failed month and an independent issue failure without stopping peers", async () => {
    const result = await runFrReconciliationBatch({
      units,
      concurrency: 3,
      loadMetadata: async (month) => {
        if (month === "2024-02") throw new Error("corrupt retained month")
        return month
      },
      reconcile: async (unit) => {
        if (unit.key === "b") throw new Error("damaged normalized shard")
        return success(unit)
      }
    })
    expect(result.outcomes).toEqual([
      success(units[0]!),
      expect.objectContaining({ unitKey: "b", status: "failed", stage: "issue" }),
      expect.objectContaining({ unitKey: "c", status: "failed", stage: "metadata" })
    ])
    expect(summarizeFrReconciliationBatch(result.outcomes)).toMatchObject({
      expectedIssues: 3,
      reconciledIssues: 1,
      failedIssues: 2,
      matchedPublications: 2
    })
  })
})
