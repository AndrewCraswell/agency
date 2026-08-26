import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildMeetingExistenceQuery, buildMeetingParticipantListQuery } from "./meeting-participant-reads.js"

const pool = new pg.Pool({ connectionString: "postgresql://meeting-participant-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

function cursor(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

describe("meeting participant reads", () => {
  it("checks the parent by ID and excludes soft-deleted meetings", () => {
    const query = buildMeetingExistenceQuery(database, "meeting:us:1").toSQL().sql

    expect(query).toContain('from "legislation"."legislative_events"')
    expect(query).toContain('"legislative_events"."id" =')
    expect(query).toContain('"legislative_events"."is_deleted" =')
    expect(query).toContain("limit")
  })

  it("binds every filter into the cursor scope and pages by participant name then ID", () => {
    const query = buildMeetingParticipantListQuery(database, {
      cursor: cursor({
        id: "participant:us:2",
        name: "Baker",
        scope: {
          meetingId: "meeting:us:1",
          organizationId: "organization:us:house",
          personId: "person:us:1",
          role: "witness"
        },
        version: 1
      }),
      meetingId: "meeting:us:1",
      organizationId: "organization:us:house",
      personId: "person:us:1",
      role: "witness"
    }).toSQL().sql

    expect(query).toContain('from "legislation"."event_participants"')
    expect(query).toContain('inner join "legislation"."legislative_events"')
    expect(query).toContain('"event_participants"."event_id" =')
    expect(query).toContain('"event_participants"."role" =')
    expect(query).toContain('"event_participants"."person_id" =')
    expect(query).toContain('"event_participants"."organization_id" =')
    expect(query).toContain('"legislative_events"."is_deleted" =')
    expect(query).toContain('"event_participants"."name" >')
    expect(query).toContain('"event_participants"."id" >')
    expect(query).toContain(
      'order by "legislation"."event_participants"."name" asc, "legislation"."event_participants"."id" asc'
    )
    expect(query).not.toContain(" offset ")
  })

  it("rejects a cursor reused under different filters", () => {
    const mismatched = cursor({
      id: "participant:us:2",
      name: "Baker",
      scope: { meetingId: "meeting:us:1", organizationId: null, personId: null, role: null },
      version: 1
    })

    expect(() =>
      buildMeetingParticipantListQuery(database, {
        cursor: mismatched,
        meetingId: "meeting:us:2"
      })
    ).toThrow("Invalid meeting participant pagination cursor")
  })
})
