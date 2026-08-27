import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildPersonMembershipListQuery,
  encodePersonMembershipCursor,
  listPersonMemberships
} from "./person-membership-reads.js"

const pool = new pg.Pool({ connectionString: "postgresql://person-memberships-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("person membership queries", () => {
  it("binds the person parent, applies every filter, and orders by start date keyset", () => {
    const generated = buildPersonMembershipListQuery(database, {
      from: "2024-01-01",
      isCurrent: true,
      limit: 20,
      organizationId: "organization:us:house",
      personId: "person:us:example",
      to: "2026-01-01"
    }).toSQL().sql

    expect(generated).toContain('"organization_memberships"."person_id" =')
    expect(generated).toContain('"organization_memberships"."organization_id" =')
    expect(generated).toContain('"organization_memberships"."provenance_complete" =')
    expect(generated).toContain('"organizations"."provenance_complete" =')
    expect(generated).toContain('"people"."provenance_complete" =')
    expect(generated).toContain('"organization_memberships"."is_active" =')
    expect(generated).toContain('coalesce("legislation"."organization_memberships"."effective_end_date"')
    expect(generated).toContain('"legislation"."organization_memberships"."detected_end_date"')
    expect(generated).toContain('coalesce("legislation"."organization_memberships"."effective_start_date"')
    expect(generated).toContain('"legislation"."organization_memberships"."detected_start_date"')
    expect(generated).toContain("order by coalesce")
    expect(generated).toContain('"legislation"."organization_memberships"."id" asc')
    expect(generated).not.toContain(" offset ")
    expect(generated).toContain("limit $")
  })

  it("rejects cursors reused across a different parent or filter scope", async () => {
    const cursor = encodePersonMembershipCursor({
      id: "membership:us:house:1",
      scope: {
        from: null,
        isCurrent: true,
        organizationId: "organization:us:house",
        personId: "person:us:example",
        to: null
      },
      sortDate: "2025-01-03"
    })

    await expect(
      listPersonMemberships(database, {
        cursor,
        isCurrent: false,
        organizationId: "organization:us:house",
        personId: "person:us:example"
      })
    ).rejects.toMatchObject({ category: "invalid_request" })

    await expect(
      listPersonMemberships(database, {
        cursor,
        isCurrent: true,
        organizationId: "organization:us:house",
        personId: "person:us:other"
      })
    ).rejects.toMatchObject({ category: "invalid_request" })
  })

  it("rejects invalid limits, date bounds, and cursor payloads before database access", async () => {
    await expect(listPersonMemberships(database, { limit: 0, personId: "person:us:example" })).rejects.toMatchObject({
      category: "invalid_request"
    })
    await expect(
      listPersonMemberships(database, { from: "2026-02-30", personId: "person:us:example" })
    ).rejects.toMatchObject({ category: "invalid_request" })
    await expect(
      listPersonMemberships(database, {
        from: "2026-03-01",
        personId: "person:us:example",
        to: "2026-02-28T23:59:59Z"
      })
    ).rejects.toMatchObject({ category: "invalid_request" })
    expect(() =>
      buildPersonMembershipListQuery(database, {
        from: "2026-01-01",
        personId: "person:us:example",
        to: "2026-01-01"
      }).toSQL()
    ).not.toThrow()
    expect(() =>
      buildPersonMembershipListQuery(database, {
        from: "2026-01-01T12:00:00Z",
        personId: "person:us:example",
        to: "2026-01-01T12:00:00Z"
      }).toSQL()
    ).not.toThrow()
    await expect(
      listPersonMemberships(database, { cursor: "not-a-cursor", personId: "person:us:example" })
    ).rejects.toMatchObject({ category: "invalid_request" })
  })
})
