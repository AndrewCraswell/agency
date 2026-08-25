import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildJurisdictionListQuery } from "./jurisdictions-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://jurisdictions-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("jurisdiction collection query", () => {
  it("binds canonical filters, persisted abbreviation columns, and stable name/ID order", () => {
    const generated = buildJurisdictionListQuery(database, {
      classification: ["state", "territory"],
      isActive: true,
      limit: 7,
      q: "ca"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."jurisdictions"')
    expect(generated).toContain('"jurisdictions"."provenance_complete" =')
    expect(generated).toContain('"jurisdictions"."is_active" is not null')
    expect(generated).toContain('"jurisdictions"."source_is_official" is not null')
    expect(generated).toContain('"jurisdictions"."source_provider" is not null')
    expect(generated).toContain('"jurisdictions"."source_retrieved_at" is not null')
    expect(generated).toContain('"jurisdictions"."source_url" is not null')
    expect(generated).toContain('"jurisdictions"."classification" in')
    expect(generated).toContain('"jurisdictions"."is_active" =')
    expect(generated).toContain("ilike")
    expect(generated).toContain('"jurisdictions"."country_code"')
    expect(generated).toContain('"jurisdictions"."subdivision_code"')
    expect(generated).toContain(
      'order by "legislation"."jurisdictions"."name" asc, "legislation"."jurisdictions"."id" asc'
    )
    expect(generated).toContain("limit $")
  })

  it("binds a cursor to every documented filter", () => {
    const cursor = Buffer.from(
      JSON.stringify({
        id: "jurisdiction:ca",
        name: "California",
        scope: { classification: ["state"], isActive: true, q: "ca" },
        version: 1
      }),
      "utf8"
    ).toString("base64url")

    expect(() =>
      buildJurisdictionListQuery(database, {
        classification: ["state"],
        cursor,
        isActive: false,
        q: "ca"
      })
    ).toThrow("Invalid jurisdictions pagination cursor")
  })
})
