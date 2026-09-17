import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it, vi } from "vitest"
import * as schema from "../database/schema/schema"
import { readRecordCollection } from "./record-collections"
import { recordResolutionSchema } from "./record-contracts"
import { normalizedRecordIdentifier, resolveRecord } from "./record-resolution"

const pool = new pg.Pool({ connectionString: "postgresql://resolver-test.invalid/legislation" })
const database = drizzle(pool, { schema })
afterAll(async () => {
  await pool.end()
})

describe("record identity resolution", () => {
  it("rejects collection cursors with a different selection before accessing the database", async () => {
    await expect(
      readRecordCollection(database, {
        collection: "bill-actions",
        recordId: "bill:us:116:hr:1",
        cursor: Buffer.from(JSON.stringify({ offset: 1, binding: "different-selection" })).toString("base64url")
      })
    ).rejects.toThrow("Invalid collection cursor")
  })
  it("reads bounded section windows without fetching the complete source text", async () => {
    const query = vi
      .spyOn(pool, "query")
      .mockImplementation(async () => ({ rows: [], fields: [], command: "SELECT", rowCount: 0, oid: 0 }))
    try {
      await readRecordCollection(database, {
        collection: "document-sections",
        recordId: "document:one",
        sectionId: "section:one",
        textOffset: 10000,
        limit: 1
      })
      expect(JSON.stringify(query.mock.calls)).toContain("substring")
      expect(query.mock.calls[0]?.[1]).toContain(10001)
      expect(query.mock.calls[0]?.[1]).toContain("section:one")
    } finally {
      query.mockRestore()
    }
  })
  it.each([
    ["H.R. 1", "HR1"],
    ["H.J.Res. 2", "HJRES2"],
    [" AB 2652 ", "AB2652"]
  ])("normalizes %s", (input, expected) => {
    expect(normalizedRecordIdentifier(input)).toBe(expected)
  })
  it("rejects unsupported filters and missing identities", () => {
    expect(
      recordResolutionSchema.safeParse({ kind: "person", name: "Smith", sessionId: "session:us:116" }).success
    ).toBe(false)
    expect(recordResolutionSchema.safeParse({ kind: "bill" }).success).toBe(false)
  })
  it("binds normalized name tokens and checks only provenance-backed aliases", async () => {
    const query = vi
      .spyOn(pool, "query")
      .mockImplementation(async () => ({ rows: [], fields: [], command: "SELECT", rowCount: 0, oid: 0 }))
    try {
      await resolveRecord(database, {
        kind: "person",
        name: "Alexandria Ocasio-Cortez",
        jurisdictionId: "jurisdiction:us"
      })
      expect(JSON.stringify(query.mock.calls)).toContain("provenance_complete")
      expect(query.mock.calls[0]?.[1]).toContainEqual(["alexandria", "cortez", "ocasio"])
    } finally {
      query.mockRestore()
    }
  })
  it("uses the primary key for scoped bill numbers without searching document text", async () => {
    const query = vi
      .spyOn(pool, "query")
      .mockImplementation(async () => ({ rows: [], fields: [], command: "SELECT", rowCount: 0, oid: 0 }))
    try {
      const result = await resolveRecord(database, {
        kind: "bill",
        identifier: "H.R. 1",
        jurisdictionId: "jurisdiction:us",
        sessionId: "session:us:116"
      })
      expect(result.status).toBe("not-found")
      expect(JSON.stringify(query.mock.calls)).toContain("bill:us:116:hr:1")
      expect(JSON.stringify(query.mock.calls)).not.toContain("document_sections")
    } finally {
      query.mockRestore()
    }
  })
})
