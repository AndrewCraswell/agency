import { describe, expect, it } from "vitest"
import { projectAmendmentSearchHit } from "./canonical-amendment-search.js"
import { CanonicalProjectionError } from "./canonical-projection.js"

const structured = {
  amendment: {
    amendmentNumber: "1",
    amendmentType: "floor",
    billId: "bill:1",
    chamber: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    description: null,
    id: "amendment:1",
    jurisdictionId: "jurisdiction:1",
    printedIdentifier: "A. 1",
    purpose: "Housing",
    sessionId: null,
    sourceId: "source:1",
    sourceUpdatedAt: null,
    sourceUrl: "https://example.test/amendment",
    sponsorName: null,
    sponsorPersonId: null,
    sponsorSourceId: null,
    status: "introduced",
    submittedDate: "2026-01-01",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    upstreamIds: {}
  },
  lexicalScore: 0.8,
  matchedFields: ["metadata"] as const,
  recordType: "structured" as const,
  rerankScore: null,
  score: 0.8,
  semanticScore: null,
  snippet: null
}

describe("canonical amendment search projection", () => {
  it("projects persisted structured facts without inventing reranking", () => {
    const hit = projectAmendmentSearchHit(structured, "lexical", 1, "https://api.example.test")
    expect(hit).toMatchObject({
      match: { lexicalScore: 0.8, mode: "lexical", rerankScore: null },
      rank: 1,
      recordId: "amendment:1",
      recordType: "amendment"
    })
  })

  it("rejects semantic metadata on a lexical response", () => {
    expect(() =>
      projectAmendmentSearchHit({ ...structured, semanticScore: 0.4 }, "lexical", 1, "https://api.example.test")
    ).toThrow(CanonicalProjectionError)
  })
})
