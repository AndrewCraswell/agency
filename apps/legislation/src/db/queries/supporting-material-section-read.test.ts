import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildSupportingMaterialSectionReadQuery,
  supportingMaterialSectionReadFromPersistence
} from "./supporting-material-section-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://supporting-material-section-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

describe("supporting material section repository", () => {
  it("requires both persisted parent and section IDs without selecting internal material content", () => {
    const generated = buildSupportingMaterialSectionReadQuery(database, {
      materialId: "material:us:119:report:1",
      sectionId: "material-section:us:119:report:1:2"
    }).toSQL().sql

    expect(generated).toContain('"supporting_material_sections"."material_id" =')
    expect(generated).toContain('"supporting_material_sections"."id" =')
    expect(generated).toContain('inner join "legislation"."supporting_materials"')
    expect(generated).not.toContain('"supporting_materials"."text"')
    expect(generated).not.toContain('"supporting_materials"."blob_path"')
  })

  it("keeps canonical section facts and source provenance while withholding storage-only fields", () => {
    const read = supportingMaterialSectionReadFromPersistence(
      {
        createdAt: new Date("2026-08-20T15:00:00.000Z"),
        id: "material:us:119:report:1",
        sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
        sourceUrl: "https://api.congress.gov/v3/committee-report/1",
        updatedAt: new Date("2026-08-22T15:00:00.000Z")
      },
      {
        contentHash: "a".repeat(64),
        heading: "Findings",
        id: "material-section:us:119:report:1:2",
        ordinal: 2,
        text: "The persisted public section text."
      }
    )

    expect(read).toEqual({
      material: {
        createdAt: new Date("2026-08-20T15:00:00.000Z"),
        id: "material:us:119:report:1",
        sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
        sourceUrl: "https://api.congress.gov/v3/committee-report/1",
        updatedAt: new Date("2026-08-22T15:00:00.000Z")
      },
      section: {
        contentHash: "a".repeat(64),
        heading: "Findings",
        id: "material-section:us:119:report:1:2",
        ordinal: 2,
        text: "The persisted public section text."
      }
    })
  })
})
