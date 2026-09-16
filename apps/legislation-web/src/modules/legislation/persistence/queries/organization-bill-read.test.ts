import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import { buildOrganizationExistenceQuery } from "./organization-bill-read"

const pool = new pg.Pool({ connectionString: "postgresql://organization-bill-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

describe("organization bill repository", () => {
  it("checks the parent independently so an empty page is not mistaken for a missing organization", () => {
    const generated = buildOrganizationExistenceQuery(database, "organization:ak:committee:1").toSQL().sql

    expect(generated).toContain('from "legislation"."organizations"')
    expect(generated).toContain('"organizations"."id" =')
    expect(generated).toContain("limit $")
  })

  it("rejects blank or oversized parent IDs before emitting SQL", () => {
    expect(() => buildOrganizationExistenceQuery(database, " ")).toThrow("organizationId must be between 1 and 256")
    expect(() => buildOrganizationExistenceQuery(database, "a".repeat(257))).toThrow(
      "organizationId must be between 1 and 256"
    )
  })
})
