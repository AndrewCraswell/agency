import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import {
  billSearchExecution,
  buildBillBrowseQuery,
  documentBackedAmendmentId,
  projectDocumentBackedAmendment
} from "./query-service.js"

const pool = new pg.Pool({ connectionString: "postgresql://query-service-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("bill browse query", () => {
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
      documentId,
      id: `amendment:document:${documentId}`,
      jurisdictionId: "jurisdiction:wa",
      printedIdentifier: "Floor amendment 001",
      recordType: "document",
      sourceUrl: "https://leg.wa.gov/amendments/sb6027.pdf",
      submittedDate: "2026-02-01",
      title: "Floor amendment 001"
    })
  })
})
