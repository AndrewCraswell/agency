import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildCalendarListQuery } from "./calendar-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://calendar-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

function cursor(scope: object): string {
  return Buffer.from(
    JSON.stringify({
      id: "calendar:wa:committee-schedule:2026",
      name: "Committee schedule",
      scope,
      version: 1
    })
  ).toString("base64url")
}

describe("calendar read queries", () => {
  it("uses the durable calendar table with parent filters and a name-then-ID keyset", () => {
    const scope = {
      classification: "legislative-schedule",
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      organizationId: "organization:wa:house",
      query: "committee"
    }
    const generated = buildCalendarListQuery(database, {
      classification: "legislative-schedule",
      cursor: cursor(scope),
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      organizationId: "organization:wa:house",
      query: "committee"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."calendars"')
    expect(generated).toContain('"calendars"."organization_id"')
    expect(generated).toContain('"calendars"."name" >')
    expect(generated).toContain('"calendars"."id" >')
    expect(generated).toContain('"calendars"."name" asc')
    expect(generated).toContain('"calendars"."id" asc')
  })

  it("rejects cursors that do not bind the calendar filters", () => {
    expect(() =>
      buildCalendarListQuery(database, {
        cursor: cursor({
          classification: null,
          isActive: null,
          jurisdictionId: "jurisdiction:other",
          organizationId: null,
          query: null
        }),
        jurisdictionId: "jurisdiction:wa"
      })
    ).toThrow("Invalid calendar pagination cursor")
  })
})
