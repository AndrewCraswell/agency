import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { buildOrganizationMembershipQuery, buildPersonTermQuery } from "./civic-scoped-reads.js"

const pool = new pg.Pool({ connectionString: "postgresql://civic-scoped-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("civic scoped reads", () => {
  it("binds a term to both its opaque ID and its path person", () => {
    const query = buildPersonTermQuery(database, {
      personId: "person:ca:1",
      termId: "term:ca:1"
    }).toSQL().sql

    expect(query).toContain('from "legislation"."legislative_terms"')
    expect(query).toContain('"legislative_terms"."person_id" =')
    expect(query).toContain('"legislative_terms"."id" =')
    expect(query).toContain("limit")
  })

  it("binds a membership to its path organization before joining canonical embedded records", () => {
    const query = buildOrganizationMembershipQuery(database, {
      membershipId: "membership:ca:1",
      organizationId: "organization:ca:assembly"
    }).toSQL().sql

    expect(query).toContain('from "legislation"."organization_memberships"')
    expect(query).toContain('inner join "legislation"."organizations"')
    expect(query).toContain('inner join "legislation"."people"')
    expect(query).toContain('"organization_memberships"."organization_id" =')
    expect(query).toContain('"organization_memberships"."id" =')
    expect(query).toContain("limit")
  })

  it("rejects blank parent and child IDs before generating a query", () => {
    expect(() =>
      buildPersonTermQuery(database, {
        personId: " ",
        termId: "term:ca:1"
      })
    ).toThrow("personId must not be empty")
    expect(() =>
      buildOrganizationMembershipQuery(database, {
        membershipId: "membership:ca:1",
        organizationId: " "
      })
    ).toThrow("organizationId must not be empty")
  })
})
