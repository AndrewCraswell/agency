import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { buildBillTextSectionListQuery, normalizeBillTextSectionListInput } from "./bill-text-read"

const pool = new pg.Pool({ connectionString: "postgresql://bill-text-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

function cursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

describe("bill text section traversal", () => {
  it("traverses only processed version sections with exact repeated filters and a filter-bound keyset", () => {
    const generated = buildBillTextSectionListQuery(database, {
      billId: "bill:us:119:hr:1",
      cursor: cursor({
        documentDate: "2026-01-03",
        documentId: "document:us:119:hr:1:ih",
        ordinal: 3,
        scope: {
          billId: "bill:us:119:hr:1",
          documentIds: ["document:us:119:hr:1:eh", "document:us:119:hr:1:ih"],
          heading: "Findings",
          pageFrom: 2,
          pageTo: 4,
          versionCodes: ["eh", "ih"]
        },
        sectionId: "section:us:119:hr:1:ih:3",
        version: 1,
        versionCode: "ih"
      }),
      documentIds: ["document:us:119:hr:1:ih", "document:us:119:hr:1:eh"],
      heading: "Findings",
      limit: 20,
      pageFrom: 2,
      pageTo: 4,
      versionCodes: ["ih", "eh"]
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."document_sections"')
    expect(generated).toContain('inner join "legislation"."bill_documents"')
    expect(generated).toContain('"bill_documents"."bill_id" =')
    expect(generated).toContain('"bill_documents"."classification" =')
    expect(generated).toContain('"bill_documents"."processing_status" =')
    expect(generated).toContain('"bill_documents"."id" in')
    expect(generated).toContain('"bill_documents"."version_code" in')
    expect(generated).toContain('"document_sections"."heading" =')
    expect(generated).toContain('"document_sections"."page_end" >=')
    expect(generated).toContain('"document_sections"."page_start" <=')
    expect(generated).toContain('"bill_documents"."document_date" >')
    expect(generated).toContain('"document_sections"."ordinal" >')
    expect(generated).toContain('"document_sections"."id" >')
    expect(generated).toContain(
      'order by "legislation"."bill_documents"."document_date" asc, "legislation"."bill_documents"."version_code" asc, "legislation"."bill_documents"."id" asc, "legislation"."document_sections"."ordinal" asc, "legislation"."document_sections"."id" asc'
    )
    expect(generated).not.toContain(" offset ")
    expect(generated).not.toContain('"bill_documents"."text"')
    expect(generated).not.toContain('"bill_documents"."blob_path"')
  })

  it("rejects a cursor with a changed repeated filter scope", () => {
    const scopedCursor = cursor({
      documentDate: "2026-01-03",
      documentId: "document:us:119:hr:1:ih",
      ordinal: 3,
      scope: {
        billId: "bill:us:119:hr:1",
        documentIds: ["document:us:119:hr:1:ih"],
        heading: null,
        pageFrom: null,
        pageTo: null,
        versionCodes: ["ih"]
      },
      sectionId: "section:us:119:hr:1:ih:3",
      version: 1,
      versionCode: "ih"
    })

    expect(() =>
      buildBillTextSectionListQuery(database, {
        billId: "bill:us:119:hr:1",
        cursor: scopedCursor,
        documentIds: ["document:us:119:hr:1:ih"],
        versionCodes: ["eh"]
      })
    ).toThrow("Invalid bill text pagination cursor")
  })

  it("rejects malformed repeated filters and page ranges before a query can be built", () => {
    expect(() =>
      normalizeBillTextSectionListInput({ billId: "bill:us:119:hr:1", documentIds: ["document:1", "document:1"] })
    ).toThrow("documentId values must be unique")
    expect(() => normalizeBillTextSectionListInput({ billId: "bill:us:119:hr:1", pageFrom: 3, pageTo: 2 })).toThrow(
      "pageFrom must not be greater than pageTo"
    )
  })
})
