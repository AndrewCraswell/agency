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

    expect(nearest).toContain('"semantic_passage_hnsw_settings" as')
    expect(nearest).toContain("set_config('hnsw.ef_search', '1000', true)")
    expect(nearest).toContain("set_config('hnsw.iterative_scan', 'strict_order', true)")
    expect(nearest).toContain('cross join "semantic_passage_hnsw_settings"')
    expect(nearest).toContain('"nearest_passage_embeddings" as')
    expect(nearest).toContain('order by "legislation"."document_section_embeddings"."embedding" <=>')
    expect(nearest).not.toContain('order by "legislation"."document_section_embeddings"."embedding" <=> $1::vector,')
    expect(nearest).toContain("limit")
    expect(query.sql).toContain('order by "distance" asc, "legislation"."document_sections"."id" asc')
    expect(query.params).toEqual(expect.arrayContaining(["jurisdiction:ak", 26]))
  })
})
