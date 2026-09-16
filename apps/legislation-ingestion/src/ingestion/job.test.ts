import { describe, expect, it } from "vitest"
import { ingestionFailureSummary, ingestionLeaseHandoffAt } from "./job.js"

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
})

describe("ingestion lease handoff", () => {
  it("uses PostgreSQL string timestamps instead of falling back to a short retry", () => {
    expect(ingestionLeaseHandoffAt("2026-08-20T12:46:30.119Z", new Date("2026-08-20T12:18:30.000Z"))).toEqual(
      new Date("2026-08-20T12:46:40.119Z")
    )
  })

  it("adds the handoff margin to Date values and invalid-value fallbacks", () => {
    const now = new Date("2026-08-20T12:18:30.000Z")

    expect(ingestionLeaseHandoffAt(new Date("2026-08-20T12:46:30.119Z"), now)).toEqual(
      new Date("2026-08-20T12:46:40.119Z")
    )
    expect(ingestionLeaseHandoffAt(undefined, now)).toEqual(new Date("2026-08-20T12:18:40.000Z"))
  })
})
