import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { buildSemanticPassageSearchQuery } from "./search"

const pool = new pg.Pool({ connectionString: "postgresql://semantic-passage-query-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("semantic passage query", () => {
  it("bounds the HNSW scan before applying deterministic hydration ordering", () => {
    const embedding = Array.from({ length: 1536 }, () => 0)
    const query = buildSemanticPassageSearchQuery(database, {
      embedding,
      jurisdictionIds: ["jurisdiction:ak"],
      limit: 25
    }).toSQL()
    const nearestEnd = query.sql.indexOf(') select 1 - ("nearest_passage_embeddings"."distance")')
    const nearest = query.sql.slice(0, nearestEnd === -1 ? undefined : nearestEnd)

    expect(nearest).toContain('"nearest_passage_embeddings" as')
    expect(nearest).toContain('"filtered_passage_embeddings" as')
    expect(nearest).toContain('order by "legislation"."document_section_embeddings"."embedding" <=>')
    expect(nearest).not.toContain('order by "legislation"."document_section_embeddings"."embedding" <=> $1::vector,')
    expect(nearest).toContain("limit")
    expect(nearest).toContain('order by "distance" asc, "nearest_passage_embeddings"."section_id" asc')
    expect(query.sql).toContain('order by "distance" asc, "legislation"."document_sections"."id" asc')
    expect(query.sql).toContain('"legislation"."document_section_embeddings"."section_id" like')
    expect(query.params).toEqual(expect.arrayContaining(["bill:ak:%", "jurisdiction:ak", 26]))
    expect(query.params).not.toContain(20_000)
  })

  it("keeps the bounded state graph while retaining a larger window for narrower relational filters", () => {
    const embedding = Array.from({ length: 1536 }, () => 0)
    const query = buildSemanticPassageSearchQuery(database, {
      embedding,
      jurisdictionIds: ["jurisdiction:nc"],
      limit: 25,
      sessionIds: ["session:nc:2025"]
    }).toSQL()

    expect(query.sql).toContain('"legislation"."document_section_embeddings"."section_id" like')
    expect(query.params).toEqual(expect.arrayContaining(["bill:nc:%", 20_000, "session:nc:2025"]))
  })

  it("uses the global candidate window when more than one jurisdiction is requested", () => {
    const embedding = Array.from({ length: 1536 }, () => 0)
    const query = buildSemanticPassageSearchQuery(database, {
      embedding,
      jurisdictionIds: ["jurisdiction:ak", "jurisdiction:nc"],
      limit: 25
    }).toSQL()

    expect(query.sql).not.toContain('"legislation"."document_section_embeddings"."section_id" like')
    expect(query.params).toEqual(expect.arrayContaining([20_000, "jurisdiction:ak", "jurisdiction:nc"]))
  })
})
