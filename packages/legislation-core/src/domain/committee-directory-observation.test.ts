import { describe, expect, it } from "vitest"
import { readDirectoryObservation } from "./committee-directory-observation.js"

const previous = {
  packageId: "CDIR-2026-02-20",
  issuedAt: "2026-02-20T00:00:00.000Z",
  detectedAt: "2026-02-20T00:00:00.000Z",
  lastModified: "2026-07-14T00:00:00.000Z",
  fingerprint: "a".repeat(64)
}

describe("committee directory coverage evidence", () => {
  it("never treats missing coverage evidence as a complete roster", () => {
    expect(readDirectoryObservation(undefined)).toBeUndefined()
    expect(readDirectoryObservation(previous)?.coverage).toBeUndefined()
  })

  it("retains incomplete coverage evidence across checkpoint serialization", () => {
    const coverage = {
      status: "incomplete",
      quarantined: [
        {
          chamber: "upper",
          name: "Tom Udall",
          organization: "Appropriations",
          reason: "source_term_contradiction",
          personId: "person:congress:u000039"
        }
      ]
    }
    const serialized = JSON.stringify({ ...previous, coverage })
    expect(readDirectoryObservation(JSON.parse(serialized))?.coverage).toEqual(coverage)
    expect(() => readDirectoryObservation({ ...previous, coverage: { ...coverage, status: "complete" } })).toThrow(
      "Incomplete committee coverage"
    )
    expect(() => readDirectoryObservation({ ...previous, coverage: { ...coverage, quarantined: [] } })).toThrow(
      "Incomplete committee coverage"
    )
  })
})
