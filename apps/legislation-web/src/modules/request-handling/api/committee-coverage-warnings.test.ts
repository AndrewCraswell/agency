import { describe, expect, it } from "vitest"
import { committeeCoverageWarnings, personCommitteeCoverageWarnings } from "./committee-coverage-warnings.js"

const organization = { chamber: "upper", name: "Appropriations" }
const checkpoint = {
  stream: "govinfo:committee-directory:117",
  cursor: {
    observation: {
      packageId: "CDIR-2022-10-26",
      issuedAt: "2022-10-26T00:00:00.000Z",
      detectedAt: "2022-10-26T00:00:00.000Z",
      lastModified: "2022-10-26T00:00:00.000Z",
      fingerprint: "a".repeat(64),
      coverage: {
        status: "incomplete",
        quarantined: [
          {
            chamber: "upper",
            organization: "Appropriations",
            name: "Tom Udall",
            reason: "source_term_contradiction",
            personId: "person:congress:u000039"
          }
        ]
      }
    }
  }
}

describe("Congress-scoped committee coverage warnings", () => {
  it("targets the reviewed person ID, never a namesake or inferred replacement", () => {
    expect(personCommitteeCoverageWarnings([checkpoint], "person:congress:u000039")).toEqual([
      "GovInfo membership history for this person in session:us:117 is incomplete: 1 source assignment(s) quarantined in CDIR-2022-10-26."
    ])
    expect(personCommitteeCoverageWarnings([checkpoint], "person:congress:u000038")).toEqual([])
    expect(
      personCommitteeCoverageWarnings([{ stream: checkpoint.stream, cursor: {} }], "person:congress:u000039")
    ).toEqual([])
  })
  it("names the historical Congress and source edition without claiming today's roster is incomplete", () => {
    expect(committeeCoverageWarnings([checkpoint], organization)).toEqual([
      "GovInfo committee roster for session:us:117 is incomplete: 1 source assignment(s) quarantined in CDIR-2022-10-26."
    ])
  })
  it("does not label other committees or chambers incomplete", () => {
    expect(committeeCoverageWarnings([checkpoint], { ...organization, chamber: "lower" })).toEqual([])
    expect(committeeCoverageWarnings([checkpoint], { ...organization, name: "Finance" })).toEqual([])
  })
  it("does not synthesize coverage from absent evidence or another checkpoint stream", () => {
    expect(committeeCoverageWarnings([{ stream: checkpoint.stream, cursor: {} }], organization)).toEqual([])
    expect(committeeCoverageWarnings([{ ...checkpoint, stream: "govinfo:bills" }], organization)).toEqual([])
  })
  it("fails closed on contradictory saved coverage", () => {
    const invalid = structuredClone(checkpoint)
    invalid.cursor.observation.coverage.status = "complete"
    expect(() => committeeCoverageWarnings([invalid], organization)).toThrow("Incomplete committee coverage")
  })
})
