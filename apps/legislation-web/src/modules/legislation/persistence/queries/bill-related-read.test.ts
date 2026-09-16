import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import type { BillRelatedHitRead, BillRelationRead } from "./bill-related-read"
import {
  buildBillRelatedExplicitQuery,
  buildBillRelatedExplicitIdQueries,
  excludeExplicitRelatedBills,
  projectBillRelatedRead,
  type BillRelationCursor
} from "./bill-related-read"

const pool = new pg.Pool({ connectionString: "postgresql://bill-related-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

function bill(id = "bill:us:119:hr:1") {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id,
    identifier: "H.R. 1",
    introducedAt: new Date("2026-01-03T00:00:00.000Z"),
    jurisdictionId: "jurisdiction:us",
    latestActionAt: null,
    sessionId: "session:us:119",
    sourceUrl: `https://api.example.test/bills/${encodeURIComponent(id)}`,
    status: "pending",
    subjects: ["Budget"],
    title: "Budget Act",
    updatedAt: new Date("2026-08-22T15:00:00.000Z"),
    upstreamIds: { congress: "119/hr/1" }
  }
}

function relation(overrides: Partial<BillRelationRead> = {}): BillRelationRead {
  return {
    canonicalFactsComplete: true,
    classification: "companion",
    direction: "outgoing",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-22T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1/related",
    ...overrides
  }
}

describe("bill related read projection", () => {
  it("uses relation provenance for explicit hits", () => {
    const projected = projectBillRelatedRead(
      { bill: bill("bill:us:119:s:2"), relationship: relation(), similarityScore: null },
      "https://api.example.test"
    )

    expect(projected).toMatchObject({
      relationship: {
        classification: "companion",
        relatedBill: { id: "bill:us:119:s:2" },
        sources: [{ provider: "congress", isOfficial: true }]
      },
      sources: [{ provider: "congress", isOfficial: true }]
    })
  })

  it("clamps a finite semantic score without adding a relationship", () => {
    const hit: BillRelatedHitRead = { bill: bill("bill:us:119:s:2"), relationship: null, similarityScore: 1.4 }
    expect(projectBillRelatedRead(hit, "https://api.example.test")).toMatchObject({
      relationship: null,
      similarityScore: 1,
      sources: [{ provider: "congress" }]
    })
  })

  it("rejects incomplete persisted relation provenance", () => {
    expect(() =>
      projectBillRelatedRead(
        {
          bill: bill("bill:us:119:s:2"),
          relationship: relation({ canonicalFactsComplete: false, sourceUrl: null }),
          similarityScore: null
        },
        "https://api.example.test"
      )
    ).toThrow("Related bill relationship provenance is incomplete")
  })
})

describe("bill related explicit query paging", () => {
  const scope = { billId: "bill:us:119:hr:1", classifications: [], mode: "all" as const }

  it("pushes the explicit keyset cursor into both directional branches", () => {
    const cursor: BillRelationCursor = {
      billId: "bill:us:119:hr:10",
      classification: "related",
      direction: "incoming",
      kind: "explicit",
      scope,
      similarityScore: null,
      version: 1
    }
    const query = buildBillRelatedExplicitQuery(database, {
      billId: scope.billId,
      classifications: [],
      cursor,
      limit: 4
    })

    const incoming = query.incoming.toSQL().sql
    const outgoing = query.outgoing.toSQL().sql
    expect(incoming).toContain('"bill_relations"."classification" >')
    expect(outgoing).toContain('"bill_relations"."classification" >')
    expect(incoming).toContain("limit")
    expect(outgoing).toContain("limit")
  })

  it("uses the outgoing tie-breaker after an incoming row with the same bill and classification", () => {
    const cursor: BillRelationCursor = {
      billId: "bill:us:119:hr:10",
      classification: "related",
      direction: "incoming",
      kind: "explicit",
      scope,
      similarityScore: null,
      version: 1
    }
    const generated = buildBillRelatedExplicitQuery(database, {
      billId: scope.billId,
      classifications: [],
      cursor,
      limit: 4
    }).outgoing.toSQL().sql

    expect(generated).toContain('"bill_relations"."bill_id" =')
    expect(generated).toContain('"bill_relations"."classification" =')
  })

  it("deduplicates semantic candidates against explicit relations beyond the first page", () => {
    const sourceBillId = "bill:us:119:hr:1"
    const explicitRelationBillIds = new Set(Array.from({ length: 130 }, (_, index) => `bill:us:119:s:${index + 1}`))
    const candidates = [{ id: sourceBillId }, { id: "bill:us:119:s:130" }, { id: "bill:us:119:s:999" }]

    expect(excludeExplicitRelatedBills(candidates, sourceBillId, explicitRelationBillIds)).toEqual([
      { id: "bill:us:119:s:999" }
    ])
  })

  it("builds unpaged incoming and outgoing relation-id scans for semantic de-duplication", () => {
    const queries = buildBillRelatedExplicitIdQueries(database, scope.billId)
    expect(queries.incoming.toSQL().sql).toContain('"bill_relations"."related_bill_id" =')
    expect(queries.outgoing.toSQL().sql).toContain('"bill_relations"."bill_id" =')
    expect(queries.incoming.toSQL().sql).not.toContain(" limit ")
    expect(queries.outgoing.toSQL().sql).not.toContain(" limit ")
  })
})
