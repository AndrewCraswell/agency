import { sql } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import {
  buildLexicalBillSearchQuery,
  decodeSearchCursor,
  embeddingLiteral,
  encodeSearchCursor,
  hasCappedLexicalBillVersionCoverage,
  isBillIdentifierQuery,
  paginateCappedSearchRows,
  paginateSearchDatabaseRows,
  paginateSearchRows,
  reciprocalRankFusion,
  reciprocalRankFusionWithScores,
  semanticSimilarityScore
} from "./search"

const dialect = new PgDialect()

describe("hybrid search ranking", () => {
  it("combines lexical and semantic ranks with deterministic tie-breaking", () => {
    const a = { id: "a" }
    const b = { id: "b" }
    const c = { id: "c" }
    expect(reciprocalRankFusion([a, b], [b, c], 3)).toEqual([b, a, c])
    expect(reciprocalRankFusion([b, a], [a, b], 2)).toEqual([a, b])
  })

  it("returns normalized reciprocal-rank scores", () => {
    const items = reciprocalRankFusionWithScores([{ id: "a" }, { id: "b" }], [{ id: "b" }], 2)

    expect(items[0]?.id).toBe("b")
    expect(items[0]?.score).toBeGreaterThan(items[1]?.score ?? 0)
  })

  it("uses bounded opaque pagination cursors", () => {
    const cursor = encodeSearchCursor(2)

    expect(decodeSearchCursor(cursor)).toBe(2)
    expect(paginateSearchRows(["a", "b", "c", "d"], 2, 1)).toEqual({
      items: ["b", "c"],
      nextCursor: encodeSearchCursor(3),
      truncated: true
    })
    expect(() => decodeSearchCursor(Buffer.from('{"offset":-1}').toString("base64url"))).toThrow(
      "Invalid search cursor"
    )
  })

  it("binds lexical cursors to the normalized query and filters", () => {
    const input = {
      classifications: ["bill", "resolution"],
      cursor: undefined,
      jurisdictionIds: ["jurisdiction:b", "jurisdiction:a"],
      query: "  housing  ",
      statuses: ["introduced"]
    }
    const cursor = encodeSearchCursor(300, input)

    expect(decodeSearchCursor(cursor, { ...input, query: "housing" })).toBe(300)
    expect(() => decodeSearchCursor(cursor)).toThrow("Invalid search cursor")
    expect(() => decodeSearchCursor(cursor, { ...input, query: "transport" })).toThrow("Invalid search cursor")
    expect(() => decodeSearchCursor(cursor, { ...input, statuses: ["enacted"] })).toThrow("Invalid search cursor")
    expect(decodeSearchCursor(encodeSearchCursor(1, { ...input, statuses: ["introduced", "introduced"] }), input)).toBe(
      1
    )
    expect(() => decodeSearchCursor(encodeSearchCursor(1_000, input), input)).toThrow("Invalid search cursor")
    const semanticCursor = encodeSearchCursor(1, { ...input, mode: "semantic" })
    expect(decodeSearchCursor(semanticCursor, { ...input, mode: "semantic" })).toBe(1)
    expect(() => decodeSearchCursor(semanticCursor, { ...input, mode: "hybrid" })).toThrow("Invalid search cursor")
    const boundPayload: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof boundPayload !== "object" ||
      boundPayload === null ||
      !("binding" in boundPayload) ||
      typeof boundPayload.binding !== "string"
    ) {
      throw new Error("Expected a bound cursor payload")
    }
    expect(() =>
      decodeSearchCursor(
        Buffer.from(JSON.stringify({ binding: boundPayload.binding, offset: 1 })).toString("base64url"),
        input
      )
    ).toThrow("Invalid search cursor")
    const page = paginateSearchDatabaseRows(["a", "b"], 1, 300, input)
    expect(page.nextCursor).toBeDefined()
    expect(decodeSearchCursor(page.nextCursor, input)).toBe(301)
    expect(paginateSearchDatabaseRows(["a", "b"], 1, 900, input, true, 1_000)).toEqual({
      items: ["a"],
      nextCursor: encodeSearchCursor(901, input),
      truncated: true
    })
    const boundaryRows = Array.from({ length: 101 }, (_, index) => index)
    expect(paginateSearchDatabaseRows(boundaryRows, 100, 900, input, true, 1_000)).toEqual({
      items: boundaryRows.slice(0, 100),
      nextCursor: undefined,
      truncated: true
    })
  })

  it("does not mint an endless cursor after exhausting a capped candidate window", () => {
    const rows = Array.from({ length: 25 }, (_, index) => index)
    expect(paginateCappedSearchRows(rows, 20, 0, true)).toMatchObject({
      items: rows.slice(0, 20),
      nextCursor: expect.any(String),
      truncated: true
    })
    expect(paginateCappedSearchRows(rows, 20, 20, true)).toEqual({
      items: rows.slice(20),
      nextCursor: undefined,
      truncated: true
    })
    expect(paginateCappedSearchRows(rows, 20, 40, true)).toEqual({ items: [], nextCursor: undefined, truncated: true })
  })

  it("conservatively reports a capped lexical bill version candidate window", () => {
    expect(hasCappedLexicalBillVersionCoverage([{ versionCoverageCapped: false }])).toBe(false)
    const capped = hasCappedLexicalBillVersionCoverage([
      { versionCoverageCapped: false },
      { versionCoverageCapped: true }
    ])

    expect(capped).toBe(true)
    expect(paginateSearchDatabaseRows(["bill"], 20, 0, undefined, capped)).toEqual({
      items: ["bill"],
      nextCursor: undefined,
      truncated: true
    })
    expect(paginateSearchDatabaseRows(["bill-a", "bill-b"], 1, 0, undefined, capped)).toEqual({
      items: ["bill-a"],
      nextCursor: encodeSearchCursor(1),
      truncated: true
    })
  })

  it("retains capped version coverage from a sentinel-only empty page", () => {
    expect(hasCappedLexicalBillVersionCoverage([{ versionCoverageCapped: true }])).toBe(true)
  })

  it("advances a SQL-applied cursor without slicing the database window twice", () => {
    expect(paginateSearchDatabaseRows(["c", "d", "e"], 2, 2)).toEqual({
      items: ["c", "d"],
      nextCursor: encodeSearchCursor(4),
      truncated: true
    })
  })

  it("parenthesizes vector distance before subtracting it from the semantic score", () => {
    const distance = sql<number>`"section_embedding" <=> ${"[0,1]"}::vector`
    const rendered = dialect.sqlToQuery(semanticSimilarityScore(distance))

    expect(rendered.sql).toBe('1 - ("section_embedding" <=> $1::vector)')
    expect(rendered.params).toEqual(["[0,1]"])
  })

  it("binds finite embeddings as pgvector literals instead of PostgreSQL records", () => {
    const rendered = dialect.sqlToQuery(embeddingLiteral([0, 1], 2))

    expect(rendered.sql).toBe("$1::vector")
    expect(rendered.params).toEqual(["[0,1]"])
    expect(() => embeddingLiteral([0], 2)).toThrow("Embedding must contain 2 finite numbers")
    expect(() => embeddingLiteral([0, Number.NaN], 2)).toThrow("Embedding must contain 2 finite numbers")
  })

  it("renders a semantic pgvector expression as one typed parameter with a grouped distance", () => {
    const distance = sql<number>`"section_embedding" <=> ${embeddingLiteral([0.125, -2, 3.5], 3)}`
    const rendered = dialect.sqlToQuery(semanticSimilarityScore(distance))

    expect(rendered.sql).toBe('1 - ("section_embedding" <=> $1::vector)')
    expect(rendered.params).toEqual(["[0.125,-2,3.5]"])
    expect(rendered.params).toHaveLength(1)
  })
})

describe("lexical bill candidate query", () => {
  function renderBillSearch(input: Parameters<typeof buildLexicalBillSearchQuery>[0]) {
    return dialect.sqlToQuery(buildLexicalBillSearchQuery(input, input.query, 25, 0))
  }

  it("uses bounded bill text first and bounds sponsor and processed-version fallbacks on primary underfill", () => {
    const generated = renderBillSearch({ query: "appropriations act" }).sql

    expect(generated).not.toContain('to_tsvector(\'english\', "legislation"."bills"."identifier")')
    expect(generated).toContain('"legislation"."bill_sponsors"."name"')
    expect(generated).toContain('"legislation"."document_sections"."search_vector"')
    expect(generated).toContain('"legislation"."bill_documents"."classification" =')
    expect(generated).toContain('"legislation"."bill_documents"."processing_status" =')
    expect(generated).toContain("with bill_text_matches as")
    expect(generated).toContain("identifier_matches as")
    expect(generated).toContain("primary_sources as")
    expect(generated).toContain("primary_matches as")
    expect(generated).toContain("primary_count as")
    expect(generated).toContain("candidate_sources as")
    expect(generated).toContain("candidate_ids as")
    expect(generated).toContain("sponsor_matches as")
    expect(generated).toContain("version_matches as")
    expect(generated).toContain("version_section_lookahead as")
    expect(generated).toContain("version_section_candidates as")
    expect(generated).toContain("version_section_matches as")
    expect(generated).toContain("version_section_coverage as")
    expect(generated).toContain("from version_section_lookahead")
    expect(generated).toContain("count(*) >")
    expect(generated).toContain("primary_count.count <")
    expect(generated).toContain("limit case when primary_count.count <")
    expect(generated).toContain("else 0 end")
    expect(generated).toContain('"legislation"."document_sections"."id" as section_id')
    expect(generated).not.toContain('order by "legislation"."document_sections"."id" asc')
    expect(generated).toContain('order by ts_rank_cd("legislation"."document_sections"."search_vector"')
    expect(generated).toContain("version_section_matches.search_vector")
    expect(generated).toContain('version_section_coverage.capped as "versionCoverageCapped"')
    expect(generated).toContain("cross join version_section_coverage")
    expect(generated).toContain("bounded_candidates as materialized")
    expect(generated).toContain("from bounded_candidates")
    expect(generated).toContain("page_candidates as materialized")
    expect(generated).toContain('true as "coverageOnly"')
    expect(generated).toContain("select * from page_candidates")
    expect(generated).toContain("union all")
    expect(generated.match(/cross join lateral/g)).toHaveLength(3)
    expect(generated.match(/limit greatest/g)).toHaveLength(2)
    expect(generated).toContain("primary_count.count")
    expect(generated).toContain("as sponsor_rank")
    expect(generated).toContain("as version_rank")
    expect(generated.match(/as materialized/g)).toHaveLength(10)
    expect(generated).not.toContain("sponsor_snippet")
    expect(generated).not.toContain("version_snippet")
    expect(renderBillSearch({ query: "appropriations act" }).params).toContain(1_000)
  })

  it("applies bill filters before bounding indexed version-text sections", () => {
    const generated = renderBillSearch({ jurisdictionIds: ["jurisdiction:us"], query: "premium protection" }).sql
    const candidateStart = generated.indexOf("version_section_lookahead as")
    const coverageStart = generated.indexOf("version_section_coverage as")
    const candidateSql = generated.slice(candidateStart, coverageStart)

    expect(candidateSql).toContain('"legislation"."bills"."jurisdiction_id" in')
    expect(candidateSql).not.toContain('order by "legislation"."document_sections"."id" asc')
    expect(candidateSql).not.toContain("group by")
  })

  it("uses a case-insensitive indexed equality candidate for identifier-shaped input", () => {
    const identifier = renderBillSearch({ query: "H.R. 1" }).sql
    const prose = renderBillSearch({ query: "appropriations act" }).sql

    expect(isBillIdentifierQuery("H.R. 1")).toBe(true)
    expect(isBillIdentifierQuery("HB 12A")).toBe(true)
    expect(isBillIdentifierQuery("appropriations act")).toBe(false)
    expect(identifier).toContain('lower("legislation"."bills"."identifier") = lower(')
    expect(prose).toContain("where false")
  })

  it("deduplicates all match sources before applying a stable rank and SQL cursor", () => {
    const rendered = dialect.sqlToQuery(buildLexicalBillSearchQuery({ query: "HB 1" }, "HB 1", 2, 2))

    expect(rendered.sql).toContain("union all")
    expect(rendered.sql).toContain("from primary_sources")
    expect(rendered.sql).toContain("from primary_matches")
    expect(rendered.sql).toContain("from candidate_sources")
    expect(rendered.sql).toContain("group by id")
    expect(rendered.sql).toContain('order by "rank" desc, "id" asc')
    expect(rendered.sql).toContain("limit $")
    expect(rendered.sql).toContain("offset $")
    expect(rendered.params).toContain(3)
    expect(rendered.params).toContain(2)
  })

  it("retrieves the complete candidate prefix needed for offsets beyond the normal candidate window", () => {
    const rendered = dialect.sqlToQuery(buildLexicalBillSearchQuery({ query: "HB 1" }, "HB 1", 20, 300))

    expect(rendered.params).toContain(321)
    expect(rendered.params).toContain(300)
    expect(rendered.params).toContain(21)
  })

  it("caps hostile lexical cursor candidate amplification and reports incomplete coverage without a continuation", () => {
    const rendered = dialect.sqlToQuery(buildLexicalBillSearchQuery({ query: "HB 1" }, "HB 1", 100, 950))

    expect(rendered.params).toContain(1000)
    expect(rendered.params).toContain(950)
    expect(rendered.params).toContain(101)
  })

  it("limits the globally ranked prefix before applying a non-divisor boundary offset", () => {
    const rendered = dialect.sqlToQuery(buildLexicalBillSearchQuery({ query: "HB 1" }, "HB 1", 30, 990))
    const boundedStart = rendered.sql.indexOf("bounded_candidates as materialized")
    const pageStart = rendered.sql.indexOf("page_candidates as materialized")
    const boundedSql = rendered.sql.slice(boundedStart, pageStart)
    const pageSql = rendered.sql.slice(pageStart)

    expect(boundedStart).toBeGreaterThan(-1)
    expect(pageStart).toBeGreaterThan(boundedStart)
    expect(boundedSql).toContain("from ranked_candidates")
    expect(boundedSql).toContain("limit $")
    expect(pageSql).toContain("from bounded_candidates")
    expect(rendered.params).toContain(1_000)
    expect(rendered.params).toContain(31)
    expect(rendered.params).toContain(990)

    const boundaryRows = Array.from({ length: 10 }, (_, index) => index)
    expect(paginateSearchDatabaseRows(boundaryRows, 30, 990, { query: "HB 1" }, true, 1_000)).toEqual({
      items: boundaryRows,
      nextCursor: undefined,
      truncated: true
    })
  })

  it("preserves the established lexical score inputs after ranking candidates", () => {
    const generated = renderBillSearch({ query: "H.R. 1" }).sql

    expect(generated).toContain('ts_rank_cd("legislation"."bills"."search_vector"')
    expect(generated).toContain('case when lower("legislation"."bills"."identifier") = lower(')
    expect(generated).toContain("coalesce(sponsor_matches.sponsor_rank, 0)")
    expect(generated).toContain("coalesce(version_matches.version_rank, 0)")
  })

  it("applies inclusive updatedAt timestamp bounds and a date-only exclusive upper bound", () => {
    const generated = renderBillSearch({
      query: "appropriations act",
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedToExclusive: new Date("2026-08-25T00:00:00.000Z")
    }).sql

    expect(generated).toContain('"legislation"."bills"."updated_at" >=')
    expect(generated).toContain('"legislation"."bills"."updated_at" <')
  })
})
