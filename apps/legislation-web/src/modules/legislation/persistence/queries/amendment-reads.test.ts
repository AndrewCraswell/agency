import * as schema from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import type { AmendmentSummary } from "../../../request-handling/api/canonical-projection.js"
import {
  amendmentContinuationCursor,
  buildDocumentAmendmentListQuery,
  buildStructuredAmendmentListQuery,
  compareAmendmentReadOrder,
  decodeAmendmentContinuationCursor,
  isStructuredAmendmentComplete,
  type AmendmentReadInput
} from "./amendment-reads.js"

const pool = new pg.Pool({ connectionString: "postgresql://amendment-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

function summary(id: string, recordType: "document" | "structured", submittedDate: string | null): AmendmentSummary {
  return {
    billId: "bill:us:119:hr:1",
    canonicalUrl: `https://api.example.test/api/amendments/${encodeURIComponent(id)}`,
    documentId: recordType === "document" ? "document:us:119:hr:1:amdt" : null,
    id,
    identifier: "Amdt. 1",
    jurisdictionId: "jurisdiction:us",
    recordType,
    sources: [
      {
        isOfficial: true,
        provider: "congress",
        retrievedAt: "2026-08-25T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/v3/amendment/119/hamdt/1"
      }
    ],
    status: null,
    submittedDate,
    title: "Amendment title",
    type: "amendment",
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
}

describe("amendment collection queries", () => {
  it("excludes detached structured rows from public collections with an explicit predicate", () => {
    const query = buildStructuredAmendmentListQuery(database, {}, undefined, "submitted-desc", 25).toSQL().sql

    expect(query).toContain('"amendments"."bill_id" is not null')
    expect(query).toContain('order by "legislation"."amendments"."submitted_date" is null asc')
    expect(query).not.toContain(" offset ")
  })

  it("uses a null-safe cross-record keyset for a document cursor", () => {
    const input = {
      billId: "bill:us:119:hr:1",
      cursor: amendmentContinuationCursor(summary("amendment:document:document:1", "document", "2026-02-01"), {
        billId: "bill:us:119:hr:1",
        recordTypes: ["document", "structured"],
        statuses: ["engrossed", "introduced"]
      }),
      recordTypes: ["document", "structured"],
      statuses: ["engrossed", "introduced"]
    } satisfies AmendmentReadInput
    const cursor = decodeAmendmentContinuationCursor(input.cursor, input)

    const structured = buildStructuredAmendmentListQuery(database, input, cursor, "submitted-desc", 25).toSQL().sql
    const document = buildDocumentAmendmentListQuery(database, input, cursor, "submitted-desc", 25).toSQL().sql

    expect(structured).toContain('"amendments"."submitted_date" <')
    expect(structured).toContain('"amendments"."submitted_date" is null')
    expect(document).toContain('"bill_documents"."document_date" <')
    expect(document).toContain('"bill_documents"."document_date" =')
    expect(document).toContain('"bill_documents"."id" >')
  })

  it("orders mixed rows deterministically when submitted dates are nullable", () => {
    const later = summary("amendment:later", "structured", "2026-02-02")
    const structured = summary("amendment:structured", "structured", "2026-02-01")
    const document = summary("amendment:document:document:1", "document", "2026-02-01")
    const nullDate = summary("amendment:null", "structured", null)

    expect(
      [document, nullDate, structured, later].toSorted((left, right) =>
        compareAmendmentReadOrder(left, right, "submitted-desc")
      )
    ).toEqual([later, structured, document, nullDate])
  })

  it("binds every array filter and parent scope to a continuation cursor", () => {
    const input = {
      billId: "bill:us:119:hr:1",
      recordTypes: ["document", "structured"] as const,
      statuses: ["engrossed", "introduced"] as const,
      submittedFrom: "2026-01-01",
      submittedTo: "2026-02-01"
    }
    const cursor = amendmentContinuationCursor(
      summary("amendment:document:document:1", "document", "2026-02-01"),
      input
    )

    expect(
      decodeAmendmentContinuationCursor(cursor, {
        ...input,
        recordTypes: ["structured", "document"],
        statuses: ["introduced", "engrossed"]
      })
    ).toMatchObject({ recordType: "document" })
    expect(() => decodeAmendmentContinuationCursor(cursor, { ...input, billId: "bill:us:119:hr:2" })).toThrowError(
      new LegislationError("invalid_request", "cursor is not valid for these amendment filters")
    )
  })

  it("keeps the direct-read completeness gate distinct from the collection predicate", () => {
    expect(isStructuredAmendmentComplete({ billId: "bill:us:119:hr:1" })).toBe(true)
    expect(isStructuredAmendmentComplete({ billId: null })).toBe(false)
  })
})
