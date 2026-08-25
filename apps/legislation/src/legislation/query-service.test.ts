import { drizzle } from "drizzle-orm/node-postgres"
import { PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import { LegislationError } from "./errors.js"
import {
  billSearchExecution,
  amendmentSearchPageState,
  buildStructuredAmendmentLexicalQuery,
  buildLexicalSupportingMaterialCandidateQuery,
  buildBillBrowseQuery,
  decodeBillBrowseCursor,
  decodeSupportingMaterialCollectionCursor,
  decodeSupportingMaterialSearchCursor,
  documentBackedAmendmentId,
  encodeBillBrowseCursor,
  encodeSupportingMaterialCollectionCursor,
  encodeSupportingMaterialSearchCursor,
  lexicalSupportingMaterialCandidateLimit,
  lexicalSupportingMaterialCandidateWindowCapped,
  lexicalSupportingMaterialPageState,
  projectDocumentBackedAmendment
} from "./query-service.js"

const pool = new pg.Pool({ connectionString: "postgresql://query-service-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("bill browse query", () => {
  it("binds bill browse cursors to the complete filter and sort scope", () => {
    const input = {
      classification: ["resolution", "bill"],
      identifier: "HR",
      introducedFrom: "2026-01-01",
      introducedTo: "2026-01-31",
      jurisdictionId: "jurisdiction:us",
      limit: 25,
      organizationId: "organization:us:house:rules",
      sessionId: "session:us:119",
      sort: "updated-desc" as const,
      sponsorPersonId: "person:us:1",
      status: ["referred", "introduced"],
      subject: ["taxes", "budget"],
      updatedFrom: new Date("2026-08-20T12:00:00.000Z")
    }
    const cursor = encodeBillBrowseCursor(25, input)

    expect(decodeBillBrowseCursor(cursor, { ...input, classification: ["bill", "resolution"] })).toBe(25)
    expect(() => decodeBillBrowseCursor(cursor, { ...input, sort: "identifier-asc" })).toThrow(LegislationError)
    expect(() => decodeBillBrowseCursor(cursor, { ...input, status: ["introduced"] })).toThrow(LegislationError)
    expect(() => decodeBillBrowseCursor(cursor, { ...input, jurisdictionId: "jurisdiction:ak" })).toThrow(
      LegislationError
    )
    expect(() => decodeBillBrowseCursor(Buffer.from('{"offset":25}').toString("base64url"), input)).toThrow(
      LegislationError
    )
  })

  it("computes latest action once and reuses it for latest-action-desc ordering", () => {
    const query = buildBillBrowseQuery(
      database,
      { jurisdictionId: "jurisdiction:ak", sort: "latest-action-desc" },
      100,
      0
    )
    const generated = query.toSQL().sql

    expect(generated.match(/max\(coalesce/g)).toHaveLength(1)
    expect(generated).toContain("left join lateral")
    expect(generated).toContain('"latest_action_at"')
    expect(generated).toContain('"legislation"."bill_actions"."bill_id" = "browse_bill"."id"')
    expect(generated).toMatch(
      /order by coalesce\("latest_action_at", "browse_bill"\."source_updated_at", "browse_bill"\."updated_at"\) desc, "browse_bill"\."id" asc/
    )
  })

  it("applies the global collection's sponsor, organization, and update filters without changing its stable sort", () => {
    const updatedFrom = new Date("2026-08-20T12:00:00.000Z")
    const query = buildBillBrowseQuery(
      database,
      {
        classification: ["bill", "resolution"],
        identifier: "HR",
        introducedFrom: "2026-01-01",
        introducedTo: "2026-01-31",
        organizationId: "organization:us:house:rules",
        sponsorPersonId: "person:us:1",
        status: ["introduced", "referred"],
        subject: ["budget", "taxes"],
        updatedFrom
      },
      25,
      0
    )
    const generated = query.toSQL()

    expect(generated.sql).toContain('"browse_bill"."identifier" ilike')
    expect(generated.sql).toContain('"browse_bill"."classification" &&')
    expect(generated.sql).toContain('"browse_bill"."subjects" @>')
    expect(generated.sql).toContain('exists (select 1 from "legislation"."bill_sponsors"')
    expect(generated.sql).toContain('exists (select 1 from "legislation"."bill_organizations"')
    expect(generated.sql).toContain('"browse_bill"."updated_at" >=')
    expect(generated.params).toContain(updatedFrom.toISOString())
    expect(generated.sql).toMatch(
      /order by coalesce\("latest_action_at", "browse_bill"\."source_updated_at", "browse_bill"\."updated_at"\) desc, "browse_bill"\."id" asc/
    )
  })
})

describe("amendment lexical search query", () => {
  it("uses full-text ranking and preserves every multi-value filter as bound parameters", () => {
    const query = buildStructuredAmendmentLexicalQuery(
      database,
      {
        billIds: ["bill:first", "bill:second"],
        jurisdictionIds: ["jurisdiction:first", "jurisdiction:second"],
        limit: 20,
        mode: "lexical",
        query: "housing & appropriations",
        sessionIds: ["session:first", "session:second"],
        sponsorPersonIds: ["person:first", "person:second"],
        statuses: ["introduced", "adopted"],
        submittedFrom: "2026-01-01",
        submittedTo: "2026-01-31"
      },
      21
    ).toSQL()

    expect(query.sql).toContain("websearch_to_tsquery('english', $1)")
    expect(query.sql).toContain("ts_rank_cd")
    expect(query.sql).toContain("ts_headline")
    expect(query.sql).not.toContain(" ilike ")
    expect(query.params).toEqual(
      expect.arrayContaining([
        "housing & appropriations",
        "bill:first",
        "bill:second",
        "jurisdiction:first",
        "jurisdiction:second",
        "session:first",
        "session:second",
        "person:first",
        "person:second",
        "introduced",
        "adopted"
      ])
    )
  })
})

describe("amendment capped page state", () => {
  it("drains known candidates in a capped semantic window before retaining the cap signal", () => {
    expect(amendmentSearchPageState(25, 0, 20, true)).toEqual({ nextOffset: 20, truncated: true })
    expect(amendmentSearchPageState(25, 20, 20, true)).toEqual({ truncated: true })
  })
})

describe("bill search execution metadata", () => {
  it("does not claim a reranker when semantic search has no candidates", () => {
    expect(billSearchExecution("voyageai/voyage-4", "cohere/rerank-v3.5", 0)).toEqual({
      isReranked: false,
      models: [{ model: "voyageai/voyage-4", purpose: "embedding" }]
    })
  })

  it("does not claim a reranker when hybrid search has no fused candidates", () => {
    expect(billSearchExecution("voyageai/voyage-4", "cohere/rerank-v3.5", 0).models).toHaveLength(1)
  })

  it("reports only the embedding and reranker that were used", () => {
    expect(billSearchExecution("voyageai/voyage-4", "cohere/rerank-v3.5", 1)).toEqual({
      isReranked: true,
      models: [
        { model: "voyageai/voyage-4", purpose: "embedding" },
        { model: "cohere/rerank-v3.5", purpose: "reranking" }
      ]
    })
  })
})

describe("lexical supporting material candidate search", () => {
  const dialect = new PgDialect()

  function renderCandidateSearch(input: Parameters<typeof buildLexicalSupportingMaterialCandidateQuery>[0]) {
    return dialect.sqlToQuery(buildLexicalSupportingMaterialCandidateQuery(input, "Build the Wall", 20, 0))
  }

  it("bounds title and indexed section retrieval before material-level ranking", () => {
    const rendered = renderCandidateSearch({ query: "Build the Wall" })

    expect(rendered.sql).toContain("with title_candidate_probe as")
    expect(rendered.sql).toContain("title_candidates as")
    expect(rendered.sql).toContain("section_candidate_probe as")
    expect(rendered.sql).toContain("section_ranked_candidates as")
    expect(rendered.sql).toContain("section_candidates as")
    expect(rendered.sql.match(/limit \$\d+/g)).toHaveLength(4)
    expect(rendered.sql).toContain("from candidate_scores")
    expect(rendered.sql).toContain("group by material_id")
    expect(rendered.sql).toContain("as matched_section_id")
    expect(rendered.sql).toContain("as section_snippet")
    expect(rendered.sql).toContain("row_number() over")
    expect(rendered.sql).toContain('to_tsvector(\'english\', "legislation"."supporting_materials"."title")')
    expect(rendered.sql.indexOf("section_candidates as")).toBeLessThan(rendered.sql.indexOf("ts_headline("))
    expect(rendered.sql).not.toContain('inner join "legislation"."supporting_materials" on')
    expect(rendered.sql).not.toContain('left join "legislation"."supporting_material_links"')
  })

  it("keeps link, session, date, update, status, and classification filters in both candidate sources", () => {
    const rendered = renderCandidateSearch({
      amendmentIds: ["amendment:fixture"],
      billIds: ["bill:fixture"],
      classifications: ["committee-report"],
      documentFrom: "2026-01-01",
      documentTo: "2026-12-31",
      eventIds: ["event:fixture"],
      jurisdictionIds: ["jurisdiction:fixture"],
      organizationIds: ["organization:fixture"],
      processingStatus: "processed",
      sessionIds: ["session:fixture"],
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedToExclusive: new Date("2026-09-01T00:00:00.000Z")
    })

    expect(rendered.sql.match(/exists \(/g)).toHaveLength(4)
    expect(rendered.sql.match(/"bill_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"amendment_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"event_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"organization_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"session_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"processing_status" =/g)).toHaveLength(2)
    expect(rendered.sql.match(/"updated_at" >=/g)).toHaveLength(2)
    expect(rendered.sql.match(/"updated_at" </g)).toHaveLength(2)
    expect(rendered.sql).toContain('inner join "legislation"."supporting_materials" on')
  })

  it("uses a stable bounded window for deep cursors", () => {
    expect(lexicalSupportingMaterialCandidateLimit(1, 0)).toBe(25)
    expect(lexicalSupportingMaterialCandidateLimit(100, 0)).toBe(101)
    expect(lexicalSupportingMaterialCandidateLimit(100, 200)).toBe(250)
  })

  it("does not mark an exactly full candidate window as capped", () => {
    expect(lexicalSupportingMaterialCandidateWindowCapped(25, 25, 25)).toBe(false)
  })

  it("marks a candidate window capped only when a source returns one more row", () => {
    expect(lexicalSupportingMaterialCandidateWindowCapped(25, 26, 25)).toBe(true)
    expect(lexicalSupportingMaterialCandidateWindowCapped(25, 25, 26)).toBe(true)
  })

  it("does not create a cursor for an exactly full uncapped candidate page", () => {
    expect(lexicalSupportingMaterialPageState(0, 25, 25, false)).toEqual({
      nextCursor: undefined,
      truncated: false
    })
  })

  it("keeps a cursor when a cap or an extra row proves another page may exist", () => {
    expect(lexicalSupportingMaterialPageState(0, 25, 25, true)).toEqual({
      nextCursor: "eyJvZmZzZXQiOjI1fQ",
      truncated: true
    })
    expect(lexicalSupportingMaterialPageState(0, 25, 26, false)).toEqual({
      nextCursor: "eyJvZmZzZXQiOjI1fQ",
      truncated: true
    })
  })

  it("binds cursors to the material filter scope and stops at the candidate cap", () => {
    const input = {
      billIds: ["bill:fixture"],
      classifications: ["committee-report", "testimony"],
      documentFrom: "2026-01-01",
      documentTo: "2026-01-31",
      jurisdictionIds: ["jurisdiction:fixture"],
      mode: "lexical" as const,
      query: "public data",
      sessionIds: ["session:fixture"]
    }
    const cursor = encodeSupportingMaterialSearchCursor(25, input)

    expect(
      decodeSupportingMaterialSearchCursor(cursor, { ...input, classifications: ["testimony", "committee-report"] })
    ).toBe(25)
    expect(() => decodeSupportingMaterialSearchCursor(cursor, { ...input, query: "private data" })).toThrow(
      LegislationError
    )
    expect(() =>
      decodeSupportingMaterialSearchCursor(Buffer.from('{"offset":25}').toString("base64url"), input)
    ).toThrow(LegislationError)
    expect(lexicalSupportingMaterialPageState(200, 50, 50, true)).toEqual({
      nextCursor: undefined,
      truncated: true
    })
  })
})

describe("supporting material collection cursors", () => {
  it("binds ordered traversal to filters and sort", () => {
    const input = {
      billId: "bill:fixture",
      documentFrom: "2026-01-01",
      mode: "lexical" as const,
      processingStatus: "processed" as const,
      sort: "document-desc" as const
    }
    const cursor = encodeSupportingMaterialCollectionCursor(20, input)

    expect(decodeSupportingMaterialCollectionCursor(cursor, input)).toBe(20)
    expect(() => decodeSupportingMaterialCollectionCursor(cursor, { ...input, sort: "title-asc" })).toThrow(
      LegislationError
    )
    expect(() => decodeSupportingMaterialCollectionCursor(cursor, { ...input, billId: "bill:other" })).toThrow(
      LegislationError
    )
    expect(() =>
      decodeSupportingMaterialCollectionCursor(Buffer.from('{"offset":20}').toString("base64url"), input)
    ).toThrow(LegislationError)
  })
})

describe("document-backed amendments", () => {
  it("uses a stable amendment ID and preserves published metadata", () => {
    const documentId = "bill:wa:2025-2026:sb:6027:document:floor-amendment"
    expect(documentBackedAmendmentId(documentId)).toBe(`amendment:document:${documentId}`)
    expect(
      projectDocumentBackedAmendment(
        {
          billId: "bill:wa:2025-2026:sb:6027",
          blobPath: null,
          classification: "amendment",
          contentHash: null,
          contentType: null,
          createdAt: new Date("2026-08-19T00:00:00.000Z"),
          documentDate: "2026-02-01",
          id: documentId,
          lastAttemptAt: null,
          nextAttemptAt: null,
          ocrCompletedAt: null,
          ocrPageCount: null,
          ocrProvider: null,
          ocrStatus: null,
          processingAttempts: 0,
          processingError: null,
          processingErrorCategory: null,
          processingStatus: "pending",
          sourceUrl: "https://leg.wa.gov/amendments/sb6027.pdf",
          text: null,
          title: "Floor amendment 001",
          updatedAt: new Date("2026-08-19T00:00:00.000Z"),
          versionCode: null
        },
        "jurisdiction:wa"
      )
    ).toEqual({
      billId: "bill:wa:2025-2026:sb:6027",
      createdAt: new Date("2026-08-19T00:00:00.000Z"),
      documentId,
      id: `amendment:document:${documentId}`,
      jurisdictionId: "jurisdiction:wa",
      printedIdentifier: "Floor amendment 001",
      recordType: "document",
      sourceUpdatedAt: null,
      sourceUrl: "https://leg.wa.gov/amendments/sb6027.pdf",
      submittedDate: "2026-02-01",
      title: "Floor amendment 001",
      updatedAt: new Date("2026-08-19T00:00:00.000Z")
    })
  })
})
