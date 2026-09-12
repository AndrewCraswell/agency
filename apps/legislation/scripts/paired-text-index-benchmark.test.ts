import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { benchmarkMedian, nativeBenchmarkQuery } from "./paired-text-index-benchmark.js"

const dialect = new PgDialect()

describe("paired native benchmark query", () => {
  it("uses stored vectors and bound search input over the same processed sample", () => {
    const query = dialect.sqlToQuery(nativeBenchmarkQuery({ name: "phrase", query: '"health insurance"' }, false, 21))
    expect(query.sql).toContain("benchmark_body_vector @@ websearch_to_tsquery")
    expect(query.sql).toContain('search_metadata @> \'{"processingStatus":"processed"}\'::jsonb')
    expect(query.sql).not.toContain("health insurance")
    expect(query.params).toContain('"health insurance"')
    expect(query.sql).toContain('order by score desc,id collate "C" limit')
  })

  it("deduplicates all matching amendment sections before its final limit", () => {
    const query = dialect.sqlToQuery(nativeBenchmarkQuery({ name: "broad", query: "health" }, true, 21))
    expect(query.sql).toContain('distinct on (document_id collate "C")')
    expect(query.sql).toContain("benchmark_title_vector @@")
    expect(query.sql).toContain('search_metadata @> \'{"documentClassifications":["amendment"]}\'::jsonb')
    expect(query.sql.match(/\blimit\b/gu)).toHaveLength(1)
    expect(query.sql.indexOf("from best")).toBeLessThan(query.sql.indexOf("limit"))
  })

  it("binds scoped filters and refuses silently unsupported filters", () => {
    const value = "x'); delete from legislation.bills; --"
    const query = dialect.sqlToQuery(
      nativeBenchmarkQuery(
        { name: "scope", query: "health", filters: { any: { jurisdictionIds: [value] } } },
        false,
        21
      )
    )
    expect(query.params).toContain(JSON.stringify({ jurisdictionIds: [value] }))
    expect(query.sql).not.toContain(value)
    expect(() =>
      nativeBenchmarkQuery({ name: "scope", query: "health", filters: { headings: ["heading"] } }, false, 21)
    ).toThrow(Error)
  })

  it.each([0, -1, 1001, 1.5, Number.NaN])("rejects invalid limit %s", (limit) => {
    expect(() => nativeBenchmarkQuery({ name: "broad", query: "health" }, false, limit)).toThrow(
      "Invalid benchmark limit"
    )
  })
})

describe("benchmark observation summaries", () => {
  it("calculates odd and even medians without mutating observations", () => {
    const values = [9, 2, 4, 1, 3]
    expect(benchmarkMedian(values)).toBe(3)
    expect(benchmarkMedian([8, 2])).toBe(5)
    expect(values).toEqual([9, 2, 4, 1, 3])
  })
  it.each([{ values: [] }, { values: [Number.NaN] }, { values: [Number.POSITIVE_INFINITY] }])(
    "rejects missing or invalid observations %#",
    ({ values }) => {
      expect(() => benchmarkMedian(values)).toThrow("Finite timing observations required")
    }
  )
})
