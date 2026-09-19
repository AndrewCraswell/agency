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
  it.each([{ billIds: ["bill:wa:2025-2026:hb:2266"] }, { documentIds: ["document:example"] }])(
    "ranks explicit parents before pagination without a global candidate cap: %j",
    (parents) => {
      const query = buildSemanticPassageSearchQuery(database, {
        ...parents,
        embedding: Array.from({ length: 1536 }, () => 0),
        jurisdictionIds: ["jurisdiction:wa"],
        sessionIds: ["session:wa:2025-2026"],
        limit: 2
      }).toSQL()
      expect(query.sql).toContain('"scoped_passage_embeddings" as')
      expect(query.sql).toContain('"ranked_scoped_passages" as')
      expect(query.sql).not.toContain('"nearest_passage_embeddings"')
      expect(query.sql).toContain(") + 0")
      expect(query.params).toEqual(expect.arrayContaining(["jurisdiction:wa", "session:wa:2025-2026", 3]))
      expect(query.params).not.toContain(20_000)
      const scope = query.sql.slice(0, query.sql.indexOf('"ranked_scoped_passages" as'))
      expect(scope).toContain('"processing_status" =')
      expect(scope).toContain('"model" =')
      expect(scope).toContain('"input_contract" =')
      expect(scope).toContain('"session_id" in')
    }
  )
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

  it("pushes a matching canonical session into the graph instead of requesting 20000 candidates", () => {
    const embedding = Array.from({ length: 1536 }, () => 0)
    const query = buildSemanticPassageSearchQuery(database, {
      embedding,
      jurisdictionIds: ["jurisdiction:nc"],
      limit: 25,
      sessionIds: ["session:nc:2025"]
    }).toSQL()

    expect(query.sql).toContain('"legislation"."document_section_embeddings"."section_id" like')
    expect(query.params).toEqual(expect.arrayContaining(["bill:nc:2025:%", 26, "session:nc:2025"]))
    expect(query.params).not.toContain(20_000)
  })

  it.each(["session:wa:2025_%", "session:ak:34"])(
    "does not push an unsafe or conflicting session prefix: %s",
    (session) => {
      const query = buildSemanticPassageSearchQuery(database, {
        embedding: Array.from({ length: 1536 }, () => 0),
        jurisdictionIds: ["jurisdiction:wa"],
        sessionIds: [session],
        limit: 2
      }).toSQL()
      expect(query.params).toContain(20_000)
      expect(query.params).toContain("bill:wa:%")
    }
  )

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
