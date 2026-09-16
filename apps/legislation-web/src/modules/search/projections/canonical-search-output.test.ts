import { normalizeHttpBillSearchPage } from "@repo/legislation-core/research/canonical-search-output"
import { describe, expect, it } from "vitest"
import { normalizeDirectBillSearchPage, type DirectBillSearchPage } from "./canonical-search-output"

function directPage(): DirectBillSearchPage {
  return {
    items: [
      {
        classification: ["bill"],
        createdAt: new Date("2026-08-24T00:00:00.000Z"),
        id: "bill:us:119:hr:1",
        identifier: "H.R. 1",
        introducedAt: "2026-01-01",
        jurisdictionId: "us",
        latestActionAt: null,
        lexicalScore: 0.8,
        matchedFields: ["identifier", "title"],
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
    ],
    nextCursor: "next cursor",
    search: { isReranked: false, models: [] },
    truncated: false,
    warnings: ["coverage"]
  }
}

function normalizedDirectPage() {
  return normalizeDirectBillSearchPage(directPage(), {
    apiBaseUrl: "https://api.example.test",
    correlationId: "parity-correlation",
    limit: 20,
    mode: "lexical",
    rankOffset: 0
  })
}

describe("canonical bill-search shared output", () => {
  it("makes direct and canonical HTTP pages exactly comparable", () => {
    const direct = normalizedDirectPage()

    expect(normalizeHttpBillSearchPage(direct)).toEqual(direct)
    expect(direct).toEqual({
      data: [expect.objectContaining({ rank: 1, recordId: "bill:us:119:hr:1", recordType: "bill" })],
      links: { next: "/api/search/bills?cursor=next%20cursor", self: "/api/search/bills" },
      meta: expect.objectContaining({ correlationId: "parity-correlation", mode: "lexical", warnings: ["coverage"] })
    })
  })

  it("fails closed instead of reverse-mapping an incomplete HTTP hit", () => {
    const incomplete = normalizedDirectPage()
    const [first] = incomplete.data
    if (first === undefined) {
      throw new Error("Expected a bill search hit")
    }
    const { sources: _sources, ...recordWithoutProvenance } = first.record

    expect(() =>
      normalizeHttpBillSearchPage({ ...incomplete, data: [{ ...first, record: recordWithoutProvenance }] })
    ).toThrow("Invalid input")
  })

  it("preserves absolute ranks and the POST pagination links on page two", () => {
    const page = directPage()
    const nextCursor = "eyJvZmZzZXQiOjQwfQ"
    const normalized = normalizeDirectBillSearchPage(
      { ...page, nextCursor },
      {
        apiBaseUrl: "https://api.example.test",
        correlationId: "parity-correlation",
        limit: 20,
        mode: "lexical",
        rankOffset: 20
      }
    )

    expect(normalized.data[0]?.rank).toBe(21)
    expect(normalized.links).toEqual({
      next: "/api/search/bills?cursor=eyJvZmZzZXQiOjQwfQ",
      self: "/api/search/bills"
    })
  })
})
