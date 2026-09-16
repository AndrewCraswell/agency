import { describe, expect, it } from "vitest"
import {
  committeeIdentityReviews,
  historicalAssignmentReviews,
  loadCommitteeReviewData
} from "./committee-review-data.js"

function dataset() {
  return {
    editions: [
      { packageId: "CDIR-1999-06-15", congress: 106, fingerprint: "a".repeat(64), organizations: 1, entries: 1 }
    ],
    identities: [
      {
        printedName: "Printed Name",
        state: "NY",
        chamber: "lower",
        personId: "person:congress:example",
        canonicalName: "Canonical Name",
        givenName: "Canonical",
        familyName: "Name",
        district: "1",
        contexts: [{ name: "Committee" }]
      }
    ]
  }
}

describe("committee review data loader", () => {
  it("expands shared mappings across explicit editions", () => {
    const input = dataset()
    input.editions.push({ ...input.editions[0]!, packageId: "CDIR-2000-02-01" })
    const result = loadCommitteeReviewData([input])
    expect(result.identities).toHaveLength(2)
    expect(result.identities[0]?.identities).toEqual(input.identities)
    expect(result.identities[1]?.identities).toEqual(input.identities)
    expect(result.historicalAssignments).toEqual([])
  })

  it("keeps historical observations separate from ordinary identities", () => {
    const result = loadCommitteeReviewData([dataset(), { ...dataset(), historicalAtFirstObservation: true }])
    expect(result.identities).toHaveLength(1)
    expect(result.identities[0]?.historicalAtFirstObservation).toBeUndefined()
    expect(result.historicalAssignments[0]?.historicalAtFirstObservation).toBe(true)
  })

  it("rejects malformed data and unknown fields", () => {
    expect(() => loadCommitteeReviewData([{ ...dataset(), nicknameFallback: true }])).toThrow(/nicknameFallback/)
    expect(() => loadCommitteeReviewData([{ ...dataset(), historicalAtFirstObservation: false }])).toThrow(
      /historicalAtFirstObservation/
    )
    const input = dataset()
    input.editions[0]!.fingerprint = "invalid"
    expect(() => loadCommitteeReviewData([input])).toThrow(/fingerprint/)
  })

  it("rejects duplicate editions instead of choosing a mapping by order", () => {
    expect(() => loadCommitteeReviewData([dataset(), dataset()])).toThrow("Duplicate committee review edition")
  })

  it("rejects duplicate source contexts, including competing targets", () => {
    const input = dataset()
    input.identities.push({ ...input.identities[0]!, personId: "person:congress:other" })
    expect(() => loadCommitteeReviewData([input])).toThrow("Duplicate committee review context")
  })

  it("loads the bundled identity and historical review datasets", () => {
    expect(committeeIdentityReviews).toHaveLength(13)
    expect(historicalAssignmentReviews).toHaveLength(5)
  })
})
