import { getTableColumns } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import * as schema from "../database/schema/schema"
import { readRecordCollection } from "./record-collections"
import { recordCollectionSchema } from "./record-contracts"

const pool = new pg.Pool({ connectionString: "postgresql://record-collections-test.invalid/legislation" })
const database = drizzle(pool, { schema })
const materialId = "material:us:report"
const sourceUrl = "https://www.govinfo.gov/content/pkg/report/pdf/report.pdf"
const createdAt = "2026-09-01T00:00:00.000Z"

afterAll(async () => {
  await pool.end()
})

describe("document collection parent bill identity", () => {
  const bill = {
    id: "bill:us:119:s:2937",
    identifier: "S. 2937",
    title: "A bill to establish requirements for automated decision systems.",
    sessionId: "session:us:119"
  }
  const document = {
    id: "document:us:119:s:2937:is",
    billId: bill.id,
    title: "Introduced in Senate",
    classification: "version",
    versionCode: "is",
    documentDate: "2025-10-01",
    sourceUrl: "https://www.congress.gov/bill/119th-congress/senate-bill/2937/text"
  }
  const section = {
    id: "section:2937:1",
    documentId: document.id,
    ordinal: 0,
    heading: "Requirements"
  }
  const billRow = Object.values(bill)

  it("joins each bill document to its exact persisted parent without replacing the published title", async () => {
    const documentValues: Record<string, unknown> = document
    const documentRow = Object.keys(getTableColumns(schema.billDocuments))
      .filter((key) => key !== "text")
      .map((key) => documentValues[key] ?? null)
    const query = vi.spyOn(pool, "query").mockImplementationOnce(async () => ({
      rows: [[...documentRow, ...billRow]],
      fields: [],
      command: "SELECT",
      rowCount: 1,
      oid: 0
    }))
    try {
      const result = await readRecordCollection(database, {
        collection: "bill-documents",
        recordId: bill.id,
        limit: 2
      })
      expect(result.items).toEqual([expect.objectContaining({ ...document, bill })])
      expect(result.items[0]).not.toHaveProperty("text")
      expect(result.truncated).toBe(false)
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('inner join "legislation"."bills"')
      expect(statement).toContain('"legislation"."bills"."id" = "legislation"."bill_documents"."bill_id"')
      expect(query.mock.calls[0]?.[1]).toEqual([bill.id, 3])
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })

  it("returns the parent on section continuation while binding the exact document, section and text offset", async () => {
    const sectionValues: Record<string, unknown> = section
    const sectionRow = Object.keys(getTableColumns(schema.documentSections))
      .filter((key) => key !== "text" && key !== "searchVector")
      .map((key) => sectionValues[key] ?? null)
    const row = [
      ...sectionRow,
      document.id,
      section.id,
      document.title,
      document.sourceUrl,
      document.documentDate,
      document.billId,
      document.versionCode,
      "Exact published text",
      10000,
      10020,
      null,
      document.classification,
      ...billRow
    ]
    const query = vi.spyOn(pool, "query").mockImplementationOnce(async () => ({
      rows: [row, row],
      fields: [],
      command: "SELECT",
      rowCount: 2,
      oid: 0
    }))
    try {
      const result = await readRecordCollection(database, {
        collection: "document-sections",
        recordId: document.id,
        sectionId: section.id,
        textOffset: 10000,
        limit: 1
      })
      expect(result.items).toEqual([
        expect.objectContaining({
          ...section,
          recordId: document.id,
          sectionId: section.id,
          title: document.title,
          classification: document.classification,
          versionCode: document.versionCode,
          documentDate: document.documentDate,
          sourceUrl: document.sourceUrl,
          billId: bill.id,
          bill,
          text: "Exact published text",
          textOffset: 10000,
          totalCharacters: 10020,
          nextTextOffset: null
        })
      ])
      expect(result.truncated).toBe(true)
      expect(result.nextCursor).toEqual(expect.any(String))
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('inner join "legislation"."bill_documents"')
      expect(statement).toContain('inner join "legislation"."bills"')
      expect(statement).toContain('"legislation"."bills"."id" = "legislation"."bill_documents"."bill_id"')
      expect(statement).toContain('"bill_documents"."classification"')
      expect(query.mock.calls[0]?.[1]).toEqual([10001, 10000, 20000, 20000, document.id, section.id, 2])
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })

  it("does not join or attach a bill identity to supporting material sections", async () => {
    const materialSection = { id: "section:report:1", materialId, ordinal: 0, heading: "Report findings" }
    const sectionValues: Record<string, unknown> = materialSection
    const sectionRow = Object.keys(getTableColumns(schema.supportingMaterialSections))
      .filter((key) => key !== "text" && key !== "searchVector")
      .map((key) => sectionValues[key] ?? null)
    const query = vi.spyOn(pool, "query").mockImplementationOnce(async () => ({
      rows: [
        [
          ...sectionRow,
          materialId,
          materialSection.id,
          "Committee report",
          sourceUrl,
          "2026-09-01",
          null,
          null,
          "Report text",
          0,
          11,
          null
        ]
      ],
      fields: [],
      command: "SELECT",
      rowCount: 1,
      oid: 0
    }))
    try {
      const result = await readRecordCollection(database, { collection: "material-sections", recordId: materialId })
      expect(result.items).toEqual([
        expect.objectContaining({
          ...materialSection,
          title: "Committee report",
          billId: null,
          versionCode: null,
          text: "Report text"
        })
      ])
      expect(result.items[0]).not.toHaveProperty("bill")
      expect(result.items[0]).not.toHaveProperty("classification")
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).not.toContain('"legislation"."bills"')
      expect(statement).not.toContain('"legislation"."bill_documents"')
      expect(query.mock.calls[0]?.[1]).toEqual([1, 0, 10000, 10000, materialId, 2])
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })
})

describe("supporting material link collections", () => {
  it("returns every joined link across count-plus-one pages with provenance and deterministic ordering", async () => {
    const rows = Array.from({ length: 7 }, (_, index) => [
      materialId,
      "bill:us:119:hr:1",
      "amendment:us:119:hamdt:1",
      "event:us:hearing",
      "organization:us:committee",
      `relationship-${index}`,
      createdAt,
      "H.R. 1",
      "H.Amdt. 1",
      "Committee hearing",
      "Committee",
      sourceUrl
    ])
    const query = vi.spyOn(pool, "query").mockImplementation(async (...args) => {
      const parameters = z.array(z.unknown()).parse(args[1])
      const count = z.number().parse(parameters[1])
      const offset = z.number().parse(parameters[2] ?? 0)
      expect(parameters[0]).toBe(materialId)
      expect(count).toBe(4)
      const page = rows.slice(offset, offset + count)
      return { rows: page, fields: [], command: "SELECT", rowCount: page.length, oid: 0 }
    })
    try {
      const input = { collection: "material-links", recordId: materialId, limit: 3 } as const
      const first = await readRecordCollection(database, input)
      const second = await readRecordCollection(database, { ...input, cursor: first.nextCursor })
      const third = await readRecordCollection(database, { ...input, cursor: second.nextCursor })
      expect([first.items.length, second.items.length, third.items.length]).toEqual([3, 3, 1])
      expect([first.truncated, second.truncated, third.truncated]).toEqual([true, true, false])
      expect(first.nextCursor).toEqual(expect.any(String))
      expect(second.nextCursor).not.toBe(first.nextCursor)
      expect(third.nextCursor).toBeUndefined()
      expect([...first.items, ...second.items, ...third.items]).toEqual(
        rows.map((_, index) => ({
          materialId,
          billId: "bill:us:119:hr:1",
          amendmentId: "amendment:us:119:hamdt:1",
          eventId: "event:us:hearing",
          organizationId: "organization:us:committee",
          classification: `relationship-${index}`,
          createdAt: new Date(createdAt),
          billIdentifier: "H.R. 1",
          amendmentIdentifier: "H.Amdt. 1",
          meetingName: "Committee hearing",
          organizationName: "Committee",
          sourceUrl
        }))
      )
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('inner join "legislation"."supporting_materials"')
      for (const table of ["bills", "amendments", "legislative_events", "organizations"]) {
        expect(statement).toContain(`left join "legislation"."${table}"`)
      }
      const order = statement.split(" order by ")[1]?.split(" limit ")[0]
      expect(order?.match(/"(bill_id|amendment_id|event_id|organization_id|classification|created_at)" asc/g)).toEqual(
        ["bill_id", "amendment_id", "event_id", "organization_id", "classification", "created_at"].map(
          (column) => `"${column}" asc`
        )
      )
      expect(query).toHaveBeenCalledTimes(3)
    } finally {
      query.mockRestore()
    }
  })

  it("binds continuation to the material, collection and page size, not the section offset cursor", async () => {
    const query = vi.spyOn(pool, "query").mockImplementation(async () => ({
      rows: [
        [materialId, null, null, null, "organization:us:one", "related", createdAt, null, null, null, "One", sourceUrl],
        [materialId, null, null, null, "organization:us:two", "related", createdAt, null, null, null, "Two", sourceUrl]
      ],
      fields: [],
      command: "SELECT",
      rowCount: 2,
      oid: 0
    }))
    try {
      const input = { collection: "material-links", recordId: materialId, limit: 1 } as const
      const first = await readRecordCollection(database, input)
      expect(first.nextCursor).toEqual(expect.any(String))
      for (const changed of [
        { ...input, recordId: "material:us:other", cursor: first.nextCursor },
        { ...input, collection: "material-sections" as const, cursor: first.nextCursor },
        { ...input, limit: 2, cursor: first.nextCursor },
        { ...input, cursor: Buffer.from(JSON.stringify({ offset: 1 })).toString("base64url") },
        { ...input, cursor: "invalid-cursor" }
      ]) {
        await expect(readRecordCollection(database, changed)).rejects.toThrow("Invalid collection cursor")
      }
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })

  it("publishes the collection in the shared schema and rejects non-material IDs and text selectors", async () => {
    const jsonSchema = z.toJSONSchema(recordCollectionSchema)
    expect(jsonSchema.properties?.collection).toMatchObject({ enum: expect.arrayContaining(["material-links"]) })
    const query = vi.spyOn(pool, "query")
    try {
      for (const recordId of ["bill:us:119:hr:1", "document:one", "event:us:one", "material:", "material"]) {
        await expect(readRecordCollection(database, { collection: "material-links", recordId })).rejects.toThrow(
          "Material links require a canonical material ID"
        )
      }
      for (const selector of [{ sectionId: "section:one" }, { textOffset: 0 }]) {
        expect(
          recordCollectionSchema.safeParse({ collection: "material-links", recordId: materialId, ...selector }).success
        ).toBe(false)
      }
      expect(query).not.toHaveBeenCalled()
    } finally {
      query.mockRestore()
    }
  })
})
