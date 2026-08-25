import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildMeetingOutcomeExistenceQuery,
  buildMeetingOutcomeListQuery,
  buildMeetingOutcomeReadQuery,
  meetingOutcomeReadFromPersistence
} from "./meeting-outcome-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://meeting-outcome-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })
const meetingId = "meeting:us:119:hearing:1"
const outcomeId = "outcome:us:119:hearing:1:2"

function cursor(scope: Readonly<{ billId: string | null; classification: string | null; meetingId: string }>): string {
  return Buffer.from(JSON.stringify({ id: outcomeId, scope, sourceSequence: 2, version: 1 })).toString("base64url")
}

function persistence(): Parameters<typeof meetingOutcomeReadFromPersistence>[0] {
  return {
    actionId: "action:us:119:hr:1:2",
    agendaAssociation: "explicit",
    agendaItemId: "agenda:us:119:hearing:1:2",
    classification: "action",
    description: "Committee recommendation adopted",
    eventId: meetingId,
    id: outcomeId,
    linkMethod: "explicit",
    sourceIsOfficial: true,
    sourceProvider: "Congress.gov",
    sourceRetrievedAt: new Date("2026-08-21T15:00:00.000Z"),
    sourceSequence: 2,
    sourceUpdatedAt: new Date("2026-08-20T16:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
    updatedAt: new Date("2026-08-22T15:00:00.000Z"),
    voteId: null
  }
}

describe("meeting outcome repository", () => {
  it("checks the visible parent before an empty collection is accepted", () => {
    const generated = buildMeetingOutcomeExistenceQuery(database, meetingId).toSQL().sql

    expect(generated).toContain('from "legislation"."legislative_events"')
    expect(generated).toContain('"legislative_events"."id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
  })

  it("binds outcomes to the visible meeting, filters through explicit targets, and source-orders the keyset", () => {
    const generated = buildMeetingOutcomeListQuery(database, {
      billId: "bill:us:119:hr:1",
      classification: "action",
      cursor: cursor({ billId: "bill:us:119:hr:1", classification: "action", meetingId }),
      limit: 25,
      meetingId
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."event_outcomes"')
    expect(generated).toContain('inner join "legislation"."legislative_events"')
    expect(generated).toContain('left join "legislation"."bill_actions"')
    expect(generated).toContain('left join "legislation"."votes"')
    expect(generated).toContain('"event_outcomes"."event_id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
    expect(generated).toContain('"event_outcomes"."classification" =')
    expect(generated).toContain('"bill_actions"."bill_id" =')
    expect(generated).toContain('"votes"."bill_id" =')
    expect(generated).toContain(
      'order by "legislation"."event_outcomes"."source_sequence" asc, "legislation"."event_outcomes"."id" asc'
    )
    expect(generated).toContain('"event_outcomes"."source_sequence" >')
    expect(generated).not.toContain('"event_agenda_item_bills"')
    expect(generated).not.toContain('"event_bills"')
    expect(generated).not.toContain('"event_outcome_links"')
  })

  it("binds a singular outcome to both parent and child while hiding deleted parents", () => {
    const generated = buildMeetingOutcomeReadQuery(database, { meetingId, outcomeId }).toSQL().sql

    expect(generated).toContain('"event_outcomes"."event_id" =')
    expect(generated).toContain('"event_outcomes"."id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
  })

  it("rejects cursor scopes from another meeting or filter", () => {
    expect(() =>
      buildMeetingOutcomeListQuery(database, {
        cursor: cursor({ billId: null, classification: "action", meetingId: "meeting:other" }),
        meetingId
      })
    ).toThrow("Invalid meeting outcome pagination cursor")
    expect(() =>
      buildMeetingOutcomeListQuery(database, {
        classification: "vote",
        cursor: cursor({ billId: null, classification: "action", meetingId }),
        meetingId
      })
    ).toThrow("Invalid meeting outcome pagination cursor")
  })

  it("projects only complete canonical outcome and provenance facts", () => {
    expect(meetingOutcomeReadFromPersistence(persistence())).toMatchObject({
      agendaItemId: "agenda:us:119:hearing:1:2",
      billActionId: "action:us:119:hr:1:2",
      classification: "action",
      description: "Committee recommendation adopted",
      voteId: null
    })

    const incomplete = persistence()
    incomplete.sourceProvider = ""
    expect(() => meetingOutcomeReadFromPersistence(incomplete)).toThrow("outcome sourceProvider must be non-empty")

    const incompatible = persistence()
    incompatible.voteId = "vote:us:119:1"
    expect(() => meetingOutcomeReadFromPersistence(incompatible)).toThrow(
      "outcome target does not match classification"
    )
  })
})
