import { describe, expect, it } from "vitest"
import { normalizeHttpBillSearchPage } from "./canonical-search-output"

const source = {
  isOfficial: true,
  provider: "congress",
  retrievedAt: "2026-09-01T00:00:00Z",
  sourceUpdatedAt: null,
  sourceUrl: "https://congress.gov/bill/1"
}
const page = {
  data: [
    {
      match: {
        explanation: null,
        lexicalScore: 0.8,
        matchedFields: ["title"],
        mode: "lexical",
        rerankScore: null,
        semanticScore: null,
        snippet: "A bill"
      },
      rank: 21,
      record: {
        canonicalUrl: "https://api.example.test/api/bills/bill-1",
        classification: ["bill"],
        id: "bill:us:119:hr:1",
        identifier: "H.R. 1",
        introducedDate: "2026-01-01",
        jurisdictionId: "jurisdiction:us",
        latestActionAt: null,
        sessionId: "119",
        sources: [source],
        status: "introduced",
        subjects: [],
        title: "A bill",
        type: "bill",
        updatedAt: "2026-09-01T00:00:00Z"
      },
      recordId: "bill:us:119:hr:1",
      recordType: "bill",
      score: 0.8,
      sources: [source]
    }
  ],
  links: { next: "/api/search/bills?cursor=next", self: "/api/search/bills" },
  meta: {
    correlationId: "canonical-test",
    isReranked: false,
    limit: 20,
    mode: "lexical",
    models: [],
    nextCursor: "next",
    truncated: true,
    warnings: []
  }
}

describe("canonical search wire output", () => {
  it("preserves the exact HTTP envelope, rank and continuation", () => {
    expect(normalizeHttpBillSearchPage(page)).toEqual(page)
  })
  it("rejects missing provenance instead of filling canonical fields", () => {
    const hit = page.data[0]!
    const { sources: _sources, ...record } = hit.record
    expect(() => normalizeHttpBillSearchPage({ ...page, data: [{ ...hit, record }] })).toThrow()
  })
  it("rejects internal fields and noncanonical page shapes", () => {
    expect(() => normalizeHttpBillSearchPage({ items: [] })).toThrow()
    expect(() => normalizeHttpBillSearchPage({ ...page, data: [{ ...page.data[0], embedding: [0.1] }] })).toThrow()
  })
})
