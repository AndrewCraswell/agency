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
      from: "2026-08-01",
      jurisdictionId: "jurisdiction:wa",
      isRemote: true,
      meetingId: null,
      organizationId: "organization:openstates:rules",
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
  })

  it("supports explicit timestamp intervals and persisted bill relationships without guessing calendar links", () => {
    const generated = buildMeetingListQuery(database, {
      billId: "bill:wa:1",
      from: "2026-08-17T00:00:00Z",
      to: "2026-08-17T23:59:59Z"
    }).toSQL().sql

    expect(generated).toContain('exists (select 1 from "legislation"."event_bills"')
    expect(generated).toContain('"legislative_events"."start_at" >=')
    expect(generated).toContain('"legislative_events"."start_at" <=')
    expect(buildMeetingListQuery(database, { calendarId: "calendar:unmapped" }).toSQL().sql).toContain("false")
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
          from: null,
          jurisdictionId: "jurisdiction:other",
          isRemote: null,
          meetingId: null,
          organizationId: null,
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
