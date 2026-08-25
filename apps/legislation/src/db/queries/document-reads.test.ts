import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildBillExistenceQuery,
  buildBillDocumentListQuery,
  buildDocumentDetailQuery,
  buildDocumentSectionDetailQuery,
  buildDocumentSectionListQuery,
  buildSupportingMaterialSectionListQuery,
  documentReadFromPersistence,
  documentSectionReadFromPersistence,
  supportingMaterialSectionReadFromPersistence
} from "./document-reads.js"

const pool = new pg.Pool({ connectionString: "postgresql://document-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

function cursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

describe("bill document reads", () => {
  it("checks a bill parent through its ID only before serving a child collection", () => {
    const generated = buildBillExistenceQuery(database, "bill:us:119:hr:1").toSQL().sql

    expect(generated).toContain('select "id" from "legislation"."bills"')
    expect(generated).toContain('where "legislation"."bills"."id" =')
    expect(generated).toContain("limit")
    expect(generated).not.toContain('"bill_text"')
    expect(generated).not.toContain('"embedding"')
  })

  it("keeps contract filters in the cursor scope and uses a null-safe keyset", () => {
    const generated = buildBillDocumentListQuery(database, {
      billId: "bill:us:119:hr:1",
      classification: "version",
      cursor: cursor({
        documentDate: "2026-01-03",
        id: "document:us:119:hr:1:ih",
        scope: {
          billId: "bill:us:119:hr:1",
          classification: "version",
          processingStatus: "processed",
          versionCode: "ih"
        },
        version: 1,
        versionCode: "ih"
      }),
      limit: 10,
      processingStatus: "processed",
      versionCode: "ih"
    }).toSQL().sql

    expect(generated).toContain('"bill_documents"."bill_id" =')
    expect(generated).toContain('"bill_documents"."classification" =')
    expect(generated).toContain('"bill_documents"."processing_status" =')
    expect(generated).toContain('"bill_documents"."version_code" =')
    expect(generated).toContain('"bill_documents"."document_date" >')
    expect(generated).toContain('"bill_documents"."id" >')
    expect(generated).toContain(
      'order by "legislation"."bill_documents"."document_date" asc, "legislation"."bill_documents"."version_code" asc, "legislation"."bill_documents"."id" asc'
    )
    expect(generated).not.toContain(" offset ")
  })

  it("rejects a cursor whose filters or version are not identical", () => {
    const mismatched = cursor({
      documentDate: null,
      id: "document:us:119:hr:1:ih",
      scope: {
        billId: "bill:us:119:hr:1",
        classification: null,
        processingStatus: null,
        versionCode: null
      },
      version: 1,
      versionCode: null
    })

    expect(() =>
      buildBillDocumentListQuery(database, {
        billId: "bill:us:119:hr:2",
        cursor: mismatched
      })
    ).toThrow("Invalid bill document pagination cursor")
  })

  it("rejects empty contract filter values as invalid requests", () => {
    expect(() =>
      buildBillDocumentListQuery(database, {
        billId: "bill:us:119:hr:1",
        versionCode: " "
      })
    ).toThrow("versionCode must not be empty")
  })

  it("does not publish internal blob paths as a fabricated artifact URL", () => {
    const read = documentReadFromPersistence({
      billId: "bill:us:119:hr:1",
      classification: "version",
      contentHash: "a".repeat(64),
      contentType: "application/pdf",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      documentDate: "2026-01-03",
      id: "document:us:119:hr:1:ih",
      ocrCompletedAt: new Date("2026-01-03T10:00:00.000Z"),
      ocrPageCount: 4,
      ocrProvider: "azure-document-intelligence",
      ocrStatus: "processed",
      processingErrorCategory: null,
      processingStatus: "processed",
      sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1/text/ih",
      title: "Introduced in House",
      updatedAt: new Date("2026-01-03T10:00:00.000Z"),
      versionCode: "ih"
    })

    expect(read).toMatchObject({ byteSize: null, pageCount: 4, storedUrl: null })
  })

  it("fails closed when the persisted OCR status has not been canonicalized", () => {
    let error: unknown
    try {
      documentReadFromPersistence({
        billId: "bill:us:119:hr:1",
        classification: "version",
        contentHash: null,
        contentType: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        documentDate: null,
        id: "document:us:119:hr:1:ih",
        ocrCompletedAt: null,
        ocrPageCount: null,
        ocrProvider: null,
        ocrStatus: null,
        processingErrorCategory: null,
        processingStatus: "pending",
        sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1/text/ih",
        title: "Introduced in House",
        updatedAt: new Date("2026-01-03T10:00:00.000Z"),
        versionCode: null
      })
    } catch (caught) {
      error = caught
    }

    expect(error).toMatchObject({ category: "unprocessable" })
  })

  it("fails closed when a persisted document date is not an ISO date", () => {
    expect(() =>
      documentReadFromPersistence({
        billId: "bill:us:119:hr:1",
        classification: "version",
        contentHash: null,
        contentType: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        documentDate: "January 3, 2026",
        id: "document:us:119:hr:1:ih",
        ocrCompletedAt: null,
        ocrPageCount: null,
        ocrProvider: null,
        ocrStatus: "not-required",
        processingErrorCategory: null,
        processingStatus: "pending",
        sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1/text/ih",
        title: "Introduced in House",
        updatedAt: new Date("2026-01-03T10:00:00.000Z"),
        versionCode: null
      })
    ).toThrow("document documentDate is invalid")
  })

  it("computes section totals in the detail query without selecting extracted text", () => {
    const generated = buildDocumentDetailQuery(database, "document:us:119:hr:1:ih").toSQL().sql

    expect(generated).toContain("left join lateral")
    expect(generated).toContain("count(")
    expect(generated).toContain("sum(length(")
    expect(generated).toContain('"document_sections"."document_id" = "legislation"."bill_documents"."id"')
    expect(generated).not.toContain('"document_sections"."text" as')
  })
})

describe("document section traversal", () => {
  it("binds a singular section to its document parent before joining canonical source facts", () => {
    const generated = buildDocumentSectionDetailQuery(database, {
      documentId: "document:us:119:hr:1:ih",
      sectionId: "section:us:119:hr:1:ih:1"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."document_sections"')
    expect(generated).toContain('inner join "legislation"."bill_documents"')
    expect(generated).toContain('"document_sections"."document_id" =')
    expect(generated).toContain('"document_sections"."id" =')
    expect(generated).toContain("limit")
  })

  it("uses known-document heading and page overlap filters with an ordinal keyset", () => {
    const generated = buildDocumentSectionListQuery(database, {
      cursor: cursor({
        id: "section:us:119:hr:1:ih:3",
        ordinal: 3,
        scope: {
          heading: "Findings",
          pageFrom: 2,
          pageTo: 4,
          parentId: "document:us:119:hr:1:ih"
        },
        version: 1
      }),
      documentId: "document:us:119:hr:1:ih",
      heading: "Findings",
      limit: 20,
      pageFrom: 2,
      pageTo: 4
    }).toSQL().sql

    expect(generated).toContain('"document_sections"."document_id" =')
    expect(generated).toContain('"document_sections"."heading" =')
    expect(generated).toContain('"document_sections"."page_end" >=')
    expect(generated).toContain('"document_sections"."page_start" <=')
    expect(generated).toContain('"document_sections"."ordinal" >')
    expect(generated).toContain('"document_sections"."id" >')
    expect(generated).not.toContain(" offset ")
  })

  it("fails closed for half-persisted page mappings", () => {
    let error: unknown
    try {
      documentSectionReadFromPersistence(
        {
          billId: "bill:us:119:hr:1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1/text/ih",
          updatedAt: new Date("2026-01-03T10:00:00.000Z")
        },
        {
          contentHash: "b".repeat(64),
          documentId: "document:us:119:hr:1:ih",
          heading: null,
          id: "section:us:119:hr:1:ih:1",
          ordinal: 1,
          pageEnd: null,
          pageStart: 1,
          sourceEndOffset: 50,
          sourceStartOffset: 0,
          text: "Section text"
        }
      )
    } catch (caught) {
      error = caught
    }

    expect(error).toMatchObject({ category: "unprocessable" })
  })

  it("fails closed when source offsets run backwards", () => {
    expect(() =>
      documentSectionReadFromPersistence(
        {
          billId: "bill:us:119:hr:1",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1/text/ih",
          updatedAt: new Date("2026-01-03T10:00:00.000Z")
        },
        {
          contentHash: "b".repeat(64),
          documentId: "document:us:119:hr:1:ih",
          heading: null,
          id: "section:us:119:hr:1:ih:1",
          ordinal: 1,
          pageEnd: null,
          pageStart: null,
          sourceEndOffset: 49,
          sourceStartOffset: 50,
          text: "Section text"
        }
      )
    ).toThrow("Document section source offsets are invalid")
  })
})

describe("supporting-material section traversal", () => {
  it("uses exact persisted page overlap filters with the same ordinal keyset", () => {
    const generated = buildSupportingMaterialSectionListQuery(database, {
      cursor: cursor({
        id: "material-section:1:2",
        ordinal: 2,
        scope: { heading: "Agenda", pageFrom: 2, pageTo: 4, parentId: "material:1" },
        version: 1
      }),
      heading: "Agenda",
      materialId: "material:1",
      pageFrom: 2,
      pageTo: 4
    }).toSQL().sql

    expect(generated).toContain('"supporting_material_sections"."material_id" =')
    expect(generated).toContain(
      '"supporting_materials"."id" = "legislation"."supporting_material_sections"."material_id"'
    )
    expect(generated).toContain('"supporting_material_sections"."ordinal" >')
    expect(generated).toContain('"supporting_material_sections"."page_end" >=')
    expect(generated).toContain('"supporting_material_sections"."page_start" <=')
    expect(generated).not.toContain('"supporting_materials"."blob_path"')
    expect(generated).not.toContain('"supporting_materials"."text"')
    expect(generated).not.toContain(" offset ")
  })

  it("uses the matching page boundary for each one-sided overlap filter", () => {
    const fromOnly = buildSupportingMaterialSectionListQuery(database, {
      materialId: "material:1",
      pageFrom: 4
    }).toSQL().sql
    const toOnly = buildSupportingMaterialSectionListQuery(database, {
      materialId: "material:1",
      pageTo: 4
    }).toSQL().sql

    expect(fromOnly).toContain('"supporting_material_sections"."page_end" >=')
    expect(fromOnly).not.toContain('"supporting_material_sections"."page_start" <=')
    expect(toOnly).toContain('"supporting_material_sections"."page_start" <=')
    expect(toOnly).not.toContain('"supporting_material_sections"."page_end" >=')
  })

  it("rejects supporting-material cursors whose filter scope changes", () => {
    const scopedCursor = cursor({
      id: "material-section:1:2",
      ordinal: 2,
      scope: { heading: "Agenda", pageFrom: 2, pageTo: 4, parentId: "material:1" },
      version: 1
    })

    expect(() =>
      buildSupportingMaterialSectionListQuery(database, {
        cursor: scopedCursor,
        heading: "Agenda",
        materialId: "material:1",
        pageFrom: 2,
        pageTo: 5
      })
    ).toThrow("Invalid document section pagination cursor")
  })

  it("fails closed for incomplete persisted supporting-material page mappings", () => {
    expect(() =>
      supportingMaterialSectionReadFromPersistence(
        {
          createdAt: new Date("2026-08-20T15:00:00.000Z"),
          id: "material:1",
          sourceUpdatedAt: null,
          sourceUrl: "https://example.test/material",
          updatedAt: new Date("2026-08-20T15:00:00.000Z")
        },
        {
          contentHash: "a".repeat(64),
          heading: null,
          id: "material-section:1:1",
          ordinal: 1,
          pageEnd: null,
          pageStart: 1,
          text: "Persisted text"
        }
      )
    ).toThrow("supporting material section page mapping is incomplete or invalid")
  })
})
