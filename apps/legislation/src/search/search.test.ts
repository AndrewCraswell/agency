import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import {
  buildLexicalBillSearchQuery,
  decodeSearchCursor,
  encodeSearchCursor,
  paginateCappedSearchRows,
  paginateSearchDatabaseRows,
  paginateSearchRows,
  reciprocalRankFusion,
  reciprocalRankFusionWithScores
} from "./search.js"

const pool = new pg.Pool({ connectionString: "postgresql://search-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

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

  it("advances a SQL-applied cursor without slicing the database window twice", () => {
    expect(paginateSearchDatabaseRows(["c", "d", "e"], 2, 2)).toEqual({
      items: ["c", "d"],
      nextCursor: encodeSearchCursor(4),
      truncated: true
    })
  })
})

describe("lexical bill candidate query", () => {
  it("covers identifiers, sponsor names, and processed version sections without broadening non-version documents", () => {
    const generated = buildLexicalBillSearchQuery(
      database,
      { query: "appropriations act" },
      "appropriations act",
      25,
      0
    ).toSQL().sql

    expect(generated).toContain('to_tsvector(\'english\', "legislation"."bills"."identifier")')
    expect(generated).toContain('"legislation"."bill_sponsors"."name"')
    expect(generated).toContain('"legislation"."document_sections"."search_vector"')
    expect(generated).toContain('"legislation"."bill_documents"."classification" =')
    expect(generated).toContain('"legislation"."bill_documents"."processing_status" =')
    expect(generated).toContain("left join lateral")
  })

  it("applies inclusive updatedAt timestamp bounds and a date-only exclusive upper bound", () => {
    const generated = buildLexicalBillSearchQuery(
      database,
      {
        query: "appropriations act",
        updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
        updatedToExclusive: new Date("2026-08-25T00:00:00.000Z")
      },
      "appropriations act",
      25,
      0
    ).toSQL().sql

    expect(generated).toContain('"legislation"."bills"."updated_at" >=')
    expect(generated).toContain('"legislation"."bills"."updated_at" <')
  })
})
