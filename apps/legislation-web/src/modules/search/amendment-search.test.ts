import { describe, expect, it } from "vitest"
import {
  decodeAmendmentSearchCursor,
  encodeAmendmentSearchCursor,
  fuseAmendmentSearchCandidates,
  type AmendmentSearchCandidate,
  type AmendmentSearchInput
} from "./amendment-search.js"

const input: AmendmentSearchInput = {
  billIds: ["bill:2", "bill:1"],
  limit: 20,
  mode: "hybrid",
  query: "housing",
  recordTypes: ["document", "structured"],
  statuses: ["introduced"]
}

describe("amendment search cursors", () => {
  it("binds cursors to canonicalized complete filter scope", () => {
    const cursor = encodeAmendmentSearchCursor(20, input)
    expect(decodeAmendmentSearchCursor(cursor, { ...input, billIds: ["bill:1", "bill:2"] })).toBe(20)
    expect(() => decodeAmendmentSearchCursor(cursor, { ...input, statuses: ["adopted"] })).toThrow(
      "invalid amendment search cursor"
    )
  })

  it("keeps structured and document identities separate during reciprocal-rank fusion", () => {
    const structured = candidate("structured", "amendment:1")
    const document = candidate("document", "document:1")
    const results = fuseAmendmentSearchCandidates([[structured], [document]], 25)
    expect(results).toHaveLength(2)
    expect(results.map((item) => item.recordType).toSorted()).toEqual(["document", "structured"])
  })
})

function candidate(recordType: "document" | "structured", id: string): AmendmentSearchCandidate {
  if (recordType === "structured") {
    return {
      amendment: {
        amendmentNumber: "1",
        amendmentType: "floor",
        billId: "bill:1",
        chamber: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        description: null,
        id,
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
      matchedFields: ["metadata"],
      recordType,
      rerankScore: null,
      score: 0.8,
      semanticScore: null,
      snippet: null
    }
  }
  return {
    document: {
      billId: "bill:1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      documentDate: "2026-01-01",
      id,
      sourceUrl: "https://example.test/document",
      title: "Housing amendment",
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    jurisdictionId: "jurisdiction:1",
    lexicalScore: 0.8,
    matchedFields: ["text"],
    recordType,
    rerankScore: null,
    score: 0.8,
    semanticScore: null,
    snippet: "housing"
  }
}
