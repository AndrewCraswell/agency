import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildMeetingListQuery } from "./meeting-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://meeting-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

function cursor(scope: object): string {
  return Buffer.from(
    JSON.stringify({
      id: "event:openstates:rules-1",
      scope,
      sortValue: "2026-08-17T17:00:00.000Z",
      sourceSequence: 3,
      version: 1
    })
  ).toString("base64url")
}

describe("meeting read queries", () => {
  it("binds scoped filters and keysets by start time, source sequence, then ID", () => {
    const scope = {
      billId: null,
      calendarId: null,
      classification: "meeting",
      dateTimezone: null,
      from: "2026-08-01",
      jurisdictionId: "jurisdiction:wa",
      isRemote: true,
      meetingId: null,
      organizationId: "organization:openstates:rules",
      query: "budget",
      sessionId: "session:wa:2026",
      sort: "starts-asc",
      status: "scheduled",
      to: "2026-08-31"
    }
    const generated = buildMeetingListQuery(database, {
      classification: "meeting",
      cursor: cursor(scope),
      from: "2026-08-01",
      jurisdictionId: "jurisdiction:wa",
      isRemote: true,
      organizationId: "organization:openstates:rules",
      query: "budget",
      sessionId: "session:wa:2026",
      status: "scheduled",
      to: "2026-08-31"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."legislative_events"')
    expect(generated).toContain('"legislative_events"."start_at" asc')
    expect(generated).toContain('coalesce("legislation"."legislative_events"."source_sequence", 2147483647) asc')
    expect(generated).toContain('"legislative_events"."id" asc')
    expect(generated).toContain('"legislative_events"."source_sequence"')
    expect(generated).toContain('exists (select 1 from "legislation"."event_organizations"')
    expect(generated).toContain('exists (select 1 from "legislation"."event_sessions"')
    expect(generated).toContain('"legislative_events"."is_remote"')
    expect(generated).toContain('"legislative_events"."name" ilike')
  })

  it("supports explicit timestamp intervals plus persisted bill and calendar relationships", () => {
    const generated = buildMeetingListQuery(database, {
      billId: "bill:wa:1",
      from: "2026-08-17T00:00:00Z",
      to: "2026-08-17T23:59:59Z"
    }).toSQL().sql

    expect(generated).toContain('exists (select 1 from "legislation"."event_bills"')
    expect(generated).toContain('"legislative_events"."start_at" >=')
    expect(generated).toContain('"legislative_events"."start_at" <=')
    expect(buildMeetingListQuery(database, { calendarId: "calendar:wa:committee-schedule" }).toSQL().sql).toContain(
      'exists (select 1 from "legislation"."calendar_events"'
    )
  })

  it("uses the selected calendar timezone for date-only bounds across DST transitions", () => {
    const spring = buildMeetingListQuery(database, {
      calendarId: "calendar:wa:committee-schedule",
      dateTimezone: "America/Los_Angeles",
      from: "2026-03-08",
      to: "2026-03-08"
    }).toSQL()
    const fall = buildMeetingListQuery(database, {
      calendarId: "calendar:wa:committee-schedule",
      dateTimezone: "America/Los_Angeles",
      from: "2026-11-01",
      to: "2026-11-01"
    }).toSQL()

    expect(spring.sql).toContain('"legislative_events"."start_at" >= $7::date at time zone $8')
    expect(spring.sql).toContain('"legislative_events"."start_at" < $9::date at time zone $10')
    expect(spring.params).toEqual([
      false,
      true,
      true,
      true,
      true,
      "calendar:wa:committee-schedule",
      "2026-03-08",
      "America/Los_Angeles",
      "2026-03-09",
      "America/Los_Angeles",
      26
    ])
    expect(fall.params).toEqual([
      false,
      true,
      true,
      true,
      true,
      "calendar:wa:committee-schedule",
      "2026-11-01",
      "America/Los_Angeles",
      "2026-11-02",
      "America/Los_Angeles",
      26
    ])
  })

  it("preserves multi-value universal filters, including shared session IDs", () => {
    const generated = buildMeetingListQuery(database, {
      classifications: ["meeting", "hearing"],
      jurisdictionIds: ["jurisdiction:wa", "jurisdiction:or"],
      organizationIds: ["organization:openstates:rules", "organization:openstates:energy"],
      sessionIds: ["session:wa:2026", "session:or:2026"],
      statuses: ["scheduled", "completed"]
    }).toSQL().sql

    expect(generated).toContain('"legislative_events"."jurisdiction_id" in')
    expect(generated).toContain('"legislative_events"."classification" in')
    expect(generated).toContain('"legislative_events"."status" in')
    expect(generated).toContain('"event_organizations"."organization_id" in')
    expect(generated).toContain('"event_sessions"."session_id" in')
  })

  it("rejects impossible dates and cursor scopes that no longer describe the collection", () => {
    expect(() => buildMeetingListQuery(database, { from: "2026-02-31", jurisdictionId: "jurisdiction:wa" })).toThrow(
      "from must be an ISO date or RFC 3339 timestamp"
    )
    expect(() =>
      buildMeetingListQuery(database, {
        cursor: cursor({
          billId: null,
          calendarId: null,
          classification: null,
          dateTimezone: null,
          from: null,
          jurisdictionId: "jurisdiction:other",
          isRemote: null,
          meetingId: null,
          organizationId: null,
          query: null,
          sessionId: null,
          sort: "starts-asc",
          status: null,
          to: null
        }),
        jurisdictionId: "jurisdiction:wa"
      })
    ).toThrow("Invalid meeting pagination cursor")
  })
})
