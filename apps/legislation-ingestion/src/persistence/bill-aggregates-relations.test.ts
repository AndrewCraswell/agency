import { describe, expect, it } from "vitest"
import { prepareBillRelationInsert } from "./bill-aggregates.js"

const completeFacts = {
  direction: "outgoing" as const,
  sourceIsOfficial: true,
  sourceProvider: "congress",
  sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
  sourceUpdatedAt: new Date("2026-08-23T12:00:00.000Z"),
  sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/related"
}

describe("bill relation persistence preparation", () => {
  it("marks only fully supplied source facts complete", () => {
    expect(
      prepareBillRelationInsert({
        billId: "bill:us:119:hr:1",
        classification: "related",
        relatedBillId: "bill:us:119:s:2",
        ...completeFacts
      })
    ).toMatchObject({ canonicalFactsComplete: true, provenanceComplete: true })

    expect(
      prepareBillRelationInsert({
        billId: "bill:us:119:hr:1",
        classification: "related",
        relatedBillId: "bill:us:119:s:2"
      })
    ).toMatchObject({ canonicalFactsComplete: false, provenanceComplete: false })
  })

  it("does not infer a missing direction or source facts for legacy rows", () => {
    const prepared = prepareBillRelationInsert({
      billId: "bill:us:119:hr:1",
      classification: "related",
      relatedBillId: "bill:us:119:s:2",
      sourceUrl: completeFacts.sourceUrl,
      sourceProvider: completeFacts.sourceProvider,
      sourceRetrievedAt: completeFacts.sourceRetrievedAt,
      sourceUpdatedAt: completeFacts.sourceUpdatedAt,
      sourceIsOfficial: completeFacts.sourceIsOfficial
    })
    expect(prepared.direction).toBeUndefined()
    expect(prepared.canonicalFactsComplete).toBe(false)
    expect(prepared.provenanceComplete).toBe(false)
  })
})
