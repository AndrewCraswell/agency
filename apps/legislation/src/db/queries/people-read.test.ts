import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildPeopleListQuery } from "./people-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://people-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

function cursor(scope: object, sort: "name-asc" | "updated-desc" = "name-asc"): string {
  return Buffer.from(
    JSON.stringify(
      sort === "name-asc"
        ? { id: "person:us:example", name: "Alex Example", scope, sort, version: 1 }
        : { id: "person:us:example", scope, sort, updatedAt: "2026-08-20T15:00:00.000Z", version: 1 }
    )
  ).toString("base64url")
}

describe("people collection repository", () => {
  it("selects only public-ready people and applies every stored filter without duplicate organization joins", () => {
    const generated = buildPeopleListQuery(database, {
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      organizationId: "organization:us:house:rules",
      party: "Independent",
      q: "Alex",
      sort: "name-asc"
    }).toSQL().sql

    expect(generated).toContain('"people"."provenance_complete" =')
    expect(generated).toContain('"people"."is_active" is not null')
    expect(generated).toContain('"people"."jurisdiction_id" is not null')
    expect(generated).toContain('exists (select "id" from "legislation"."organization_memberships"')
    expect(generated).toContain('"people"."party" =')
    expect(generated).toContain('"people"."name" ilike')
    expect(generated).toContain('exists (select "person_id" from "legislation"."person_aliases"')
    expect(generated).toContain('"person_aliases"."provenance_complete" =')
    expect(generated).toContain('"person_aliases"."name" ilike')
    expect(generated).not.toContain('"people"."given_name" ilike')
    expect(generated).not.toContain('"people"."family_name" ilike')
    expect(generated).not.toContain(" offset ")
    expect(generated).toContain('order by "legislation"."people"."name" asc, "legislation"."people"."id" asc')
  })

  it("accepts the documented 500-character people query", () => {
    expect(() => buildPeopleListQuery(database, { q: "a".repeat(500) }).toSQL()).not.toThrow()
    expect(() => buildPeopleListQuery(database, { q: "a".repeat(501) }).toSQL()).toThrow(
      "q must be between 1 and 500 characters"
    )
  })

  it("preserves multi-value universal filters and the canonical updated-at interval", () => {
    const generated = buildPeopleListQuery(database, {
      jurisdictionIds: ["jurisdiction:us", "jurisdiction:ca"],
      organizationIds: ["organization:us:house:rules", "organization:us:senate:energy"],
      parties: ["Independent", "Nonpartisan"],
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedToExclusive: new Date("2026-09-01T00:00:00.000Z")
    }).toSQL().sql

    expect(generated).toContain('"people"."jurisdiction_id" in')
    expect(generated).toContain('"organization_memberships"."organization_id" in')
    expect(generated).toContain('"people"."party" in')
    expect(generated).toContain('"people"."updated_at" >=')
    expect(generated).toContain('"people"."updated_at" <')
  })

  it("binds updated-at bounds into the pagination cursor scope", () => {
    const updatedFrom = new Date("2026-08-01T00:00:00.000Z")
    const updatedToExclusive = new Date("2026-09-01T00:00:00.000Z")
    const scope = {
      isActive: null,
      jurisdictionId: null,
      organizationId: null,
      party: null,
      q: null,
      sort: "updated-desc",
      updatedFrom: updatedFrom.toISOString(),
      updatedTo: null,
      updatedToExclusive: updatedToExclusive.toISOString()
    }
    const base = {
      cursor: cursor(scope, "updated-desc"),
      sort: "updated-desc" as const,
      updatedFrom,
      updatedToExclusive
    }

    expect(() => buildPeopleListQuery(database, base)).not.toThrow()
    expect(() =>
      buildPeopleListQuery(database, { ...base, updatedFrom: new Date("2026-08-02T00:00:00.000Z") })
    ).toThrow("Invalid people pagination cursor")
  })

  it("uses an updated-at keyset only when the full sort/filter scope matches", () => {
    const scope = {
      isActive: false,
      jurisdictionId: "jurisdiction:us",
      organizationId: null,
      party: null,
      q: null,
      sort: "updated-desc"
    }
    const generated = buildPeopleListQuery(database, {
      cursor: cursor(scope, "updated-desc"),
      isActive: false,
      jurisdictionId: "jurisdiction:us",
      sort: "updated-desc"
    }).toSQL().sql

    expect(generated).toContain('"people"."updated_at" <')
    expect(generated).toContain('order by "legislation"."people"."updated_at" desc, "legislation"."people"."id" asc')
    expect(() =>
      buildPeopleListQuery(database, {
        cursor: cursor(scope, "updated-desc"),
        isActive: true,
        jurisdictionId: "jurisdiction:us",
        sort: "updated-desc"
      })
    ).toThrow("Invalid people pagination cursor")
  })
})
