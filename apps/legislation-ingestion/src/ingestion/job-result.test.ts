import { describe, expect, it } from "vitest"
import { createJobCounts, ingestionFailureSummary } from "./job-result.js"

describe("ingestion failure summaries", () => {
  it("prefixes failure messages with their identifiers", () => {
    expect(
      ingestionFailureSummary([
        { identifier: "119/hr/1234", message: "Congress.gov bundle was invalid" },
        { identifier: "119/s/567", message: "Congress.gov request failed" }
      ])
    ).toBe("119/hr/1234: Congress.gov bundle was invalid; 119/s/567: Congress.gov request failed")
  })

  it("keeps identifier-free failure messages unchanged", () => {
    expect(ingestionFailureSummary([{ message: "Source discovery failed" }])).toBe("Source discovery failed")
  })

  it("returns no summary for an empty failure list", () => {
    expect(ingestionFailureSummary([])).toBeNull()
  })
})

describe("ingestion job counts", () => {
  it("creates independent zero counts with explicit overrides", () => {
    const counts = createJobCounts({ discovered: 3, read: 2 })
    expect(counts).toEqual({ discovered: 3, failed: 0, inserted: 0, read: 2, skipped: 0, unchanged: 0, updated: 0 })

    counts.failed = 1
    expect(createJobCounts().failed).toBe(0)
  })
})
