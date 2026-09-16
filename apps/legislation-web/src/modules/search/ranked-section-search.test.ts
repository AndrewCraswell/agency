import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it, vi } from "vitest"
import { collectRankedAmendments, rankedSectionPageQuery, type RankedSectionHit } from "./ranked-section-search"

const dialect = new PgDialect()
type FetchPage = (offset: number, limit: number) => Promise<readonly RankedSectionHit[]>

describe("ranked section query", () => {
  it("compiles plain multiword input as conjunction before deterministic pagination", () => {
    const query = dialect.sqlToQuery(rankedSectionPageQuery({ query: "health care", limit: 21, offset: 40 }))
    expect(query.params).toEqual([
      '(body:"health" AND body:"care")',
      'search_metadata.processingStatus:"processed"',
      21,
      40
    ])
    expect(query.sql).toContain("pdb.parse($1, lenient => false, conjunction_mode => true)")
    expect(query.sql).toContain("pdb.parse($2, lenient => false, conjunction_mode => true)::pdb.const(0)")
    expect(query.sql).toContain('order by pdb.score(id) desc,  id collate "C" asc')
    expect(query.sql).toContain("limit $3 offset $4")
    expect(query.sql).not.toContain("content_hash")
  })

  it("selects private freshness fields only for canonical passage hydration", () => {
    const query = dialect.sqlToQuery(
      rankedSectionPageQuery({ includeHydrationFields: true, limit: 2, query: "health" })
    )

    expect(query.sql).toContain(
      "document_id, content_hash, heading, page_start, page_end, search_document_title, pdb.score(id)"
    )
  })

  it("matches complete expressions within either amendment body or title", () => {
    const query = dialect.sqlToQuery(
      rankedSectionPageQuery({ query: '"tax credit" -health OR education', amendmentsOnly: true, limit: 10 })
    )
    expect(query.params[0]).toBe(
      '((body:"tax credit" AND -body:"health") OR (body:"education") OR (title:"tax credit" AND -title:"health") OR (title:"education"))'
    )
    expect(query.params).toContain('search_metadata.documentClassifications:"amendment"')
    expect(query.sql.match(/::pdb\.const\(0\)/gu)).toHaveLength(2)
    expect(query.sql).toContain('order by pdb.score(id) desc, document_id collate "C" asc, id collate "C" asc')
  })

  it("parameterizes every caller filter and query instead of interpolating them", () => {
    const attack = "x'); drop table legislation.bills; --"
    const query = dialect.sqlToQuery(
      rankedSectionPageQuery({
        query: "title:health",
        limit: 5,
        filters: {
          any: {
            billIds: [attack],
            jurisdictionIds: ["us", "ca"],
            sessionIds: ["119"],
            classifications: ["bill"],
            statuses: ["passed"],
            subjects: ["health"],
            sponsorIds: ["person"]
          },
          documentIds: [attack],
          documentClassifications: ["amendment"],
          versionCodes: ["ih"],
          headings: [attack],
          pageFrom: 2,
          pageTo: 10,
          range: {
            introducedAt: { gte: "2026-01-01T01:00:00+01:00" },
            updatedAt: { lte: "2026-02-01T00:00:00Z" },
            submittedAt: { lt: "2026-03-01T00:00:00Z" },
            documentUpdatedAt: { gte: "2026-04-01T00:00:00Z" }
          }
        }
      })
    )
    expect(query.sql).not.toContain(attack)
    expect(query.sql).not.toContain("title:health")
    expect(query.params).toContain('(body:"title:health")')
    expect(query.params).toContain(`search_metadata.billIds:${JSON.stringify(attack)}`)
    expect(query.params).toContain(`document_id:${JSON.stringify(attack)}`)
    expect(query.params).toContain(`heading:${JSON.stringify(attack)}`)
    expect(query.params).toContain(`search_metadata.introducedAt:>=${Date.parse("2026-01-01T00:00:00Z")}`)
    expect(query.params).toContain(`search_metadata.updatedAt:<=${Date.parse("2026-02-01T00:00:00Z")}`)
    expect(query.params).toContain(`search_metadata.submittedAt:<${Date.parse("2026-03-01T00:00:00Z")}`)
    expect(query.params).toContain(`search_metadata.documentUpdatedAt:>=${Date.parse("2026-04-01T00:00:00Z")}`)
    expect(query.params).toContain("page_end:>=2")
    expect(query.params).toContain("page_start:<=10")
    expect(query.sql).not.toContain('"document_id" in (')
    expect(query.sql).not.toContain('"heading" in (')
    expect(query.sql).not.toContain("::bigint")
    expect(query.sql).not.toContain("@>")
    // Every filter, including headings and page bounds, has zero relevance weight.
    expect(query.sql.match(/pdb\.parse\(/gu)).toHaveLength(20)
    expect(query.sql.match(/::pdb\.const\(0\)/gu)).toHaveLength(19)
    expect(query.sql.indexOf("where")).toBeLessThan(query.sql.indexOf("limit"))
  })

  it("treats explicitly empty filters as no eligible rows", () => {
    const query = dialect.sqlToQuery(
      rankedSectionPageQuery({
        query: "health",
        limit: 5,
        filters: { any: { billIds: [] }, documentIds: [], headings: [], documentClassifications: [], versionCodes: [] }
      })
    )
    expect(query.sql.match(/\bfalse\b/gu)).toHaveLength(7)
    expect(query.sql).not.toContain("in ()")
  })

  it.each([0, -1, 1.5, 1001, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid limit %s", (limit) => {
    expect(() => rankedSectionPageQuery({ query: "health", limit })).toThrow("Invalid ranked section page")
  })
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid offset %s",
    (offset) => {
      expect(() => rankedSectionPageQuery({ query: "health", limit: 1, offset })).toThrow("Invalid ranked section page")
    }
  )
  it("rejects invalid dates and invalid search grammar", () => {
    expect(() =>
      rankedSectionPageQuery({ query: "health", limit: 1, filters: { range: { introducedAt: { gte: "not a date" } } } })
    ).toThrow("Invalid ranked search date")
    expect(() => rankedSectionPageQuery({ query: "health OR", limit: 1 })).toThrow("OR requires")
  })

  it("quotes metadata, document and heading literals without accepting field or boolean syntax", () => {
    const literal = 'a" OR search_metadata.processingStatus:"failed" \\b'
    const query = dialect.sqlToQuery(
      rankedSectionPageQuery({
        query: "health",
        limit: 1,
        filters: { any: { subjects: [literal] }, documentIds: [literal], headings: [literal] }
      })
    )
    expect(query.params[2]).toBe(
      'search_metadata.subjects:"a\\" OR search_metadata.processingStatus:\\"failed\\" \\\\b"'
    )
    expect(query.sql).not.toContain(literal)
    expect(query.params).toContain(`document_id:${JSON.stringify(literal)}`)
    expect(query.params).toContain(`heading:${JSON.stringify(literal)}`)
    expect(query.sql.match(/::pdb\.const\(0\)/gu)).toHaveLength(4)
    expect(query.sql).toContain("pdb.parse($3, lenient => false, conjunction_mode => true)::pdb.const(0)")
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid page boundary %s",
    (page) => {
      expect(() => rankedSectionPageQuery({ query: "health", limit: 1, filters: { pageFrom: page } })).toThrow(
        "Invalid ranked search page bound"
      )
      expect(() => rankedSectionPageQuery({ query: "health", limit: 1, filters: { pageTo: page } })).toThrow(
        "Invalid ranked search page bound"
      )
    }
  )

  it("rejects reversed page bounds but accepts a single-page intersection", () => {
    expect(() => rankedSectionPageQuery({ query: "health", limit: 1, filters: { pageFrom: 4, pageTo: 3 } })).toThrow(
      "Ranked search page bounds are reversed"
    )
    const query = dialect.sqlToQuery(
      rankedSectionPageQuery({ query: "health", limit: 1, filters: { pageFrom: 4, pageTo: 4 } })
    )
    expect(query.params).toEqual([
      '(body:"health")',
      'search_metadata.processingStatus:"processed"',
      "page_end:>=4",
      "page_start:<=4",
      1,
      0
    ])
  })
})

describe("exact ranked amendment collection", () => {
  it("continues through more than ten thousand duplicate document hits without a candidate cap", async () => {
    const repeated: RankedSectionHit[] = Array.from({ length: 10_001 }, (_, index) => ({
      id: `section-${String(index).padStart(5, "0")}`,
      document_id: "a",
      score: 2
    }))
    const next = { id: "next", document_id: "b", score: 1 }
    const rows = [...repeated, next]
    const fetch = vi.fn<FetchPage>(async (offset, limit) => rows.slice(offset, offset + limit))
    expect(await collectRankedAmendments(fetch, 2, 100)).toEqual([repeated[0], next])
    expect(fetch).toHaveBeenCalledTimes(101)
    expect(fetch).toHaveBeenLastCalledWith(10_000, 100)
  })

  it("preserves best-section identity and bytewise document/section ties across batches", async () => {
    const rows: RankedSectionHit[] = [
      { id: "A", document_id: "Z", score: 3 },
      { id: "a", document_id: "Z", score: 3 },
      { id: "s", document_id: "a", score: 3 },
      { id: "t", document_id: "a", score: 2 },
      { id: "u", document_id: "b", score: 1 }
    ]
    const fetch = vi.fn<FetchPage>(async (offset, limit) => rows.slice(offset, offset + limit))
    expect(await collectRankedAmendments(fetch, 3, 2)).toEqual([rows[0], rows[2], rows[4]])
    expect(fetch.mock.calls).toEqual([
      [0, 2],
      [2, 2],
      [4, 2]
    ])
  })

  it("stops at exhaustion even when fewer unique documents exist than requested", async () => {
    const row = { id: "s", document_id: "d", score: 1 }
    const fetch = vi.fn<FetchPage>(async (offset) => (offset === 0 ? [row] : []))
    expect(await collectRankedAmendments(fetch, 5, 1)).toEqual([row])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("returns an empty result from an empty source", async () => {
    expect(await collectRankedAmendments(async () => [], 1)).toEqual([])
  })

  it("propagates deadline errors without returning a partial prefix", async () => {
    const deadline = new Error("statement timeout")
    const fetch = vi.fn<FetchPage>(async (offset) => {
      if (offset > 0) {
        throw deadline
      }
      return [{ id: "s", document_id: "d", score: 1 }]
    })
    await expect(collectRankedAmendments(fetch, 2, 1)).rejects.toBe(deadline)
  })

  it.each([
    [
      { id: "s", document_id: "a", score: 1 },
      { id: "t", document_id: "b", score: 2 }
    ],
    [
      { id: "s", document_id: "b", score: 1 },
      { id: "t", document_id: "a", score: 1 }
    ],
    [
      { id: "b", document_id: "a", score: 1 },
      { id: "a", document_id: "a", score: 1 }
    ],
    [
      { id: "s", document_id: "a", score: 1 },
      { id: "s", document_id: "a", score: 1 }
    ]
  ])("rejects an incorrectly ordered stream across a batch boundary %#", async (first, second) => {
    const rows = [first, second]
    await expect(
      collectRankedAmendments(async (offset, limit) => rows.slice(offset, offset + limit), 3, 1)
    ).rejects.toThrow("not strictly ordered")
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])("rejects invalid score %s", async (score) => {
    await expect(collectRankedAmendments(async () => [{ id: "s", document_id: "d", score }], 1)).rejects.toThrow(
      "Invalid ranked search score"
    )
  })

  it("rejects a source returning more than the requested batch", async () => {
    await expect(
      collectRankedAmendments(
        async () => [
          { id: "a", document_id: "a", score: 2 },
          { id: "b", document_id: "b", score: 1 }
        ],
        2,
        1
      )
    ).rejects.toThrow("exceeded its requested batch")
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid target count %s", async (count) => {
    await expect(collectRankedAmendments(async () => [], count)).rejects.toThrow("Invalid amendment collection size")
  })
  it.each([0, -1, 1.5, 1001, Number.NaN])("rejects invalid batch size %s", async (batch) => {
    await expect(collectRankedAmendments(async () => [], 1, batch)).rejects.toThrow("Invalid amendment collection size")
  })
})
