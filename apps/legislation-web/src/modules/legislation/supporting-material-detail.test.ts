import * as schema from "@repo/legislation-core/database/schema/schema"
import { getTableColumns } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { LegislationQueryService } from "./query-service"

const pool = new pg.Pool({ connectionString: "postgresql://material-detail-test.invalid/legislation" })
const database = drizzle(pool, { schema })
const materialId = "material:us:report"
const sourceUrl = "https://www.govinfo.gov/content/pkg/report/pdf/report.pdf"

vi.mock("./analytics-telemetry", () => ({
  createAnalyticsTelemetry: () => ({
    observe: async (_name: string, _metadata: unknown, operation: () => Promise<unknown>) => operation(),
    shutdown: async () => undefined
  })
}))

afterAll(async () => {
  await pool.end()
})

describe("supporting material detail link preview", () => {
  it.each([
    { linkCount: 0, sectionCount: 0, cursor: undefined, sectionOffset: 0 },
    { linkCount: 25, sectionCount: 1, cursor: undefined, sectionOffset: 0 },
    { linkCount: 26, sectionCount: 0, cursor: undefined, sectionOffset: 0 },
    {
      linkCount: 26,
      sectionCount: 3,
      cursor: Buffer.from(JSON.stringify({ offset: 1 })).toString("base64url"),
      sectionOffset: 1
    }
  ])("caps $linkCount links independently of the section cursor", async (fixture) => {
    const linkRows = Array.from({ length: fixture.linkCount }, (_, index) => [
      materialId,
      `bill:us:119:hr:${index + 1}`,
      null,
      null,
      null,
      "related",
      "2026-09-01T00:00:00.000Z",
      `H.R. ${index + 1}`,
      null,
      null,
      null,
      sourceUrl
    ])
    const material: Record<string, unknown> = {
      id: materialId,
      title: "Report",
      sourceUrl,
      jurisdictionId: "jurisdiction:us",
      sourceId: "report",
      classification: "report",
      processingStatus: "processed",
      processingAttempts: 0
    }
    const sections = Array.from({ length: fixture.sectionCount }, (_, ordinal) => {
      const section: Record<string, unknown> = {
        id: `section:${ordinal}`,
        materialId,
        ordinal,
        text: "Text",
        sourceStartOffset: ordinal * 4,
        sourceEndOffset: (ordinal + 1) * 4
      }
      return Object.keys(getTableColumns(schema.supportingMaterialSections)).map((key) => section[key] ?? null)
    })
    const query = vi.spyOn(pool, "query").mockImplementation(async (...args) => {
      const statement = z.object({ text: z.string() }).parse(args[0]).text
      let rows: unknown[][]
      if (statement.includes('from "legislation"."supporting_material_links"')) {
        rows = linkRows
      } else if (statement.includes("count(*)")) {
        rows = [[fixture.sectionCount, fixture.sectionCount * 4]]
      } else if (statement.includes('from "legislation"."supporting_material_sections"')) {
        rows = sections.slice(fixture.sectionOffset, fixture.sectionOffset + 2)
      } else if (statement.includes('from "legislation"."supporting_materials"')) {
        rows = [
          Object.keys(getTableColumns(schema.supportingMaterials))
            .filter((key) => key !== "text")
            .map((key) => material[key] ?? null)
        ]
      } else {
        throw new Error(`Unexpected SQL query: ${statement}`)
      }
      return { rows, fields: [], command: "SELECT", rowCount: rows.length, oid: 0 }
    })
    try {
      const result = await new LegislationQueryService(database).getSupportingMaterial({
        id: materialId,
        limit: 1,
        cursor: fixture.cursor
      })
      const sectionsTruncated = fixture.sectionCount > fixture.sectionOffset + 1
      expect(result.links).toHaveLength(Math.min(fixture.linkCount, 25))
      expect(result.linksTruncated).toBe(fixture.linkCount > 25)
      expect(result.truncated).toBe(sectionsTruncated || fixture.linkCount > 25)
      expect(result.nextCursor).toBe(
        sectionsTruncated
          ? Buffer.from(JSON.stringify({ offset: fixture.sectionOffset + 1 })).toString("base64url")
          : undefined
      )
      expect(result.sections.map((section) => section.id)).toEqual(
        fixture.sectionCount ? [`section:${fixture.sectionOffset}`] : []
      )
      expect(result.material.billIds).toEqual(
        Array.from({ length: Math.min(fixture.linkCount, 25) }, (_, index) => `bill:us:119:hr:${index + 1}`).sort()
      )
      expect(result.material.linksTruncated).toBe(result.linksTruncated)
      for (const link of result.links) {
        expect(link).toMatchObject({ materialId, sourceUrl, billIdentifier: expect.any(String) })
      }
      expect(query).toHaveBeenCalledTimes(4)
      const calls = query.mock.calls.map(([statement, parameters]) => ({
        statement: z.object({ text: z.string() }).parse(statement).text,
        parameters
      }))
      expect(
        calls.find((call) => call.statement.includes('from "legislation"."supporting_material_links"'))?.parameters
      ).toEqual([materialId, 26])
      expect(
        calls.find(
          (call) =>
            call.statement.includes('from "legislation"."supporting_material_sections"') &&
            !call.statement.includes("count(*)")
        )?.parameters
      ).toEqual(fixture.sectionOffset ? [materialId, 2, fixture.sectionOffset] : [materialId, 2])
    } finally {
      query.mockRestore()
    }
  })
})
