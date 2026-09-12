import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it, vi } from "vitest"
import * as schema from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"
import { createRankedPassageSearch, rankedFilters } from "./ranked-passage-search.js"
import {
  assertRankedPassageHydrationFreshness,
  buildRankedPassageHydrationQuery,
  decodePassageSearchCursor,
  encodePassageSearchCursor,
  hydrateRankedPassageSearch,
  RankedPassageHydrationError
} from "./search.js"

const pool = new pg.Pool({ connectionString: "postgresql://ranked-passage-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("ranked passage API integration", () => {
  it("maps every public passage filter to the ranked search-copy fields", () => {
    const input = {
      billIds: ["bill"],
      classifications: ["bill"],
      documentClassifications: ["official"],
      documentIds: ["document"],
      headings: ["Eligibility"],
      introducedFrom: "2026-01-01",
      introducedTo: "2026-02-01",
      jurisdictionIds: ["us"],
      pageFrom: 2,
      pageTo: 4,
      query: "health care",
      sessionIds: ["119"],
      sponsorIds: ["person"],
      statuses: ["introduced"],
      subjects: ["health"],
      updatedFrom: new Date("2026-03-01T00:00:00Z"),
      updatedToExclusive: new Date("2026-04-01T00:00:00Z"),
      versionCodes: ["ih"]
    }

    expect(rankedFilters(input)).toEqual({
      any: {
        billIds: ["bill"],
        classifications: ["bill"],
        jurisdictionIds: ["us"],
        sessionIds: ["119"],
        sponsorIds: ["person"],
        statuses: ["introduced"],
        subjects: ["health"]
      },
      documentClassifications: ["official"],
      documentIds: ["document"],
      headings: ["Eligibility"],
      pageFrom: 2,
      pageTo: 4,
      range: {
        introducedAt: { gte: "2026-01-01", lte: "2026-02-01" },
        updatedAt: { gte: "2026-03-01T00:00:00.000Z", lt: "2026-04-01T00:00:00.000Z", lte: undefined }
      },
      versionCodes: ["ih"]
    })
  })

  it("binds cursors to the ranked generation and every canonical bill filter", () => {
    const input = {
      classifications: ["bill"],
      introducedFrom: "2026-01-01",
      query: "health care",
      rankingGeneration: "generation-a",
      sponsorIds: ["person-a"],
      statuses: ["introduced"],
      subjects: ["health"]
    }
    const cursor = encodePassageSearchCursor(20, input)

    expect(decodePassageSearchCursor(cursor, input)).toBe(20)
    expect(() => decodePassageSearchCursor(cursor, { ...input, rankingGeneration: "generation-b" })).toThrow(
      "Invalid passage search cursor"
    )
    expect(() => decodePassageSearchCursor(cursor, { ...input, sponsorIds: ["person-b"] })).toThrow(
      "Invalid passage search cursor"
    )
    expect(() => decodePassageSearchCursor(cursor, { ...input, subjects: ["budget"] })).toThrow(
      "Invalid passage search cursor"
    )
  })

  it("hydrates only requested identifiers while reapplying canonical filters", () => {
    const generated = buildRankedPassageHydrationQuery(
      database,
      {
        billIds: ["bill"],
        documentIds: ["document"],
        jurisdictionIds: ["us"],
        query: "health care",
        statuses: ["introduced"]
      },
      ["section-b", "section-a"]
    ).toSQL()

    expect(generated.params).toContain("health care")
    expect(generated.params).toContain("section-a")
    expect(generated.params).toContain("section-b")
    expect(generated.params).toContain("document")
    expect(generated.params).toContain("bill")
    expect(generated.params).toContain("us")
    expect(generated.params).toContain("introduced")
    expect(generated.sql).toContain('"bill_documents"."processing_status" = $')
    expect(generated.sql).not.toContain("order by")
    expect(generated.sql).not.toMatch(/\boffset\s+\$/u)
  })

  it("preserves ranked order and passes only private index facts to canonical hydration", async () => {
    const hydrate = vi.fn<typeof hydrateRankedPassageSearch>(async () => ({ items: [], truncated: false }))
    const search = createRankedPassageSearch({
      canonicalDatabase: database,
      executeRankedQuery: async () => [
        {
          content_hash: "hash-b",
          document_id: "document-b",
          heading: "B",
          id: "section-b",
          page_end: 2,
          page_start: 1,
          score: "4.5",
          search_document_title: "Document B"
        },
        {
          content_hash: "hash-a",
          document_id: "document-a",
          heading: null,
          id: "section-a",
          page_end: null,
          page_start: null,
          score: 3,
          search_document_title: "Document A"
        }
      ],
      generation: "generation-a",
      hydrate,
      searchDatabase: database
    })

    await search.search({ limit: 1, query: "health" })

    expect(hydrate).toHaveBeenCalledWith(
      database,
      expect.objectContaining({ limit: 1, query: "health", rankingGeneration: "generation-a" }),
      [
        {
          contentHash: "hash-b",
          documentId: "document-b",
          documentTitle: "Document B",
          heading: "B",
          pageEnd: 2,
          pageStart: 1,
          score: 4.5,
          sectionId: "section-b"
        },
        {
          contentHash: "hash-a",
          documentId: "document-a",
          documentTitle: "Document A",
          heading: null,
          pageEnd: null,
          pageStart: null,
          score: 3,
          sectionId: "section-a"
        }
      ]
    )
  })

  it("returns retryable unavailability with an actionable stale-copy reason", async () => {
    const search = createRankedPassageSearch({
      canonicalDatabase: database,
      executeRankedQuery: async () => [
        {
          content_hash: "old-hash",
          document_id: "document",
          heading: "Old heading",
          id: "section",
          page_end: 1,
          page_start: 1,
          score: 1,
          search_document_title: "Old title"
        }
      ],
      generation: "generation-a",
      hydrate: async () => {
        throw new RankedPassageHydrationError("content_mismatch")
      },
      searchDatabase: database
    })

    let caught: unknown
    try {
      await search.search({ query: "health" })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(LegislationError)
    if (!(caught instanceof LegislationError)) {
      throw new Error("Expected ranked hydration failure to be a LegislationError")
    }
    expect(caught.category).toBe("dependency_unavailable")
    expect(caught.details).toEqual({
      dependency: "passage_search_database",
      reason: "content_mismatch",
      retryAfterSynchronization: true
    })
  })

  it("rejects stale indexed heading and document-title projections even when body content is unchanged", () => {
    const hit = {
      contentHash: "same-body-hash",
      documentId: "document",
      documentTitle: "Old title",
      heading: "Old heading",
      pageEnd: 2,
      pageStart: 1,
      score: 1,
      sectionId: "section"
    }
    expect(() =>
      assertRankedPassageHydrationFreshness(
        {
          document: { title: "Current title" },
          section: { contentHash: "same-body-hash", heading: "Old heading", pageEnd: 2, pageStart: 1 }
        },
        hit
      )
    ).toThrow("indexed_projection_mismatch")
    expect(() =>
      assertRankedPassageHydrationFreshness(
        {
          document: { title: "Old title" },
          section: { contentHash: "same-body-hash", heading: "Current heading", pageEnd: 2, pageStart: 1 }
        },
        hit
      )
    ).toThrow("indexed_projection_mismatch")
  })
})
