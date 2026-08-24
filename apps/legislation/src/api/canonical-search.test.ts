import { describe, expect, it } from "vitest"
import { CanonicalProjectionError } from "./canonical-projection.js"
import { projectBillSearchHit } from "./canonical-search.js"

const candidate = {
  classification: ["bill"],
  createdAt: new Date("2026-08-24T00:00:00.000Z"),
  id: "bill:us:119:hr:1",
  identifier: "H.R. 1",
  introducedAt: "2026-01-01",
  jurisdictionId: "us",
  latestActionAt: null,
  lexicalScore: 0.8,
  matchedFields: ["identifier", "title"] as const,
  rerankScore: null,
  score: 0.8,
  semanticScore: null,
  sessionId: "119",
  snippet: "<b>H.R. 1</b> establishes a program",
  sourceUpdatedAt: null,
  sourceUrl: "https://example.test/bills/hr-1",
  status: "introduced",
  subjects: ["government"],
  title: "A test bill",
  updatedAt: new Date("2026-08-24T01:00:00.000Z"),
  upstreamIds: { source: "hr1" }
}

describe("canonical bill search projection", () => {
  it("preserves canonical summary provenance and actual lexical metadata", () => {
    expect(projectBillSearchHit(candidate, "lexical", 1, "https://api.example.test")).toMatchObject({
      match: {
        lexicalScore: 0.8,
        matchedFields: ["identifier", "title"],
        mode: "lexical",
        rerankScore: null,
        semanticScore: null,
        snippet: "<b>H.R. 1</b> establishes a program"
      },
      rank: 1,
      recordId: "bill:us:119:hr:1",
      recordType: "bill",
      score: 0.8,
      sources: [
        expect.objectContaining({
          provider: "example.test",
          sourceUrl: "https://example.test/bills/hr-1"
        })
      ]
    })
  })

  it("rejects invented ranking metadata", () => {
    expect(() =>
      projectBillSearchHit({ ...candidate, semanticScore: 0.7 }, "lexical", 1, "https://api.example.test")
    ).toThrow(CanonicalProjectionError)
    expect(() =>
      projectBillSearchHit({ ...candidate, matchedFields: [] }, "lexical", 1, "https://api.example.test")
    ).toThrow(CanonicalProjectionError)
  })

  it("requires the reranker score for semantic and hybrid results", () => {
    const semantic = {
      ...candidate,
      lexicalScore: null,
      matchedFields: ["semantic"] as const,
      rerankScore: 0.91,
      score: 0.91,
      semanticScore: 0.78
    }
    expect(projectBillSearchHit(semantic, "semantic", 1, "https://api.example.test").match.semanticScore).toBe(0.78)
    expect(() => projectBillSearchHit({ ...semantic, score: 0.78 }, "semantic", 1, "https://api.example.test")).toThrow(
      CanonicalProjectionError
    )
  })
})
