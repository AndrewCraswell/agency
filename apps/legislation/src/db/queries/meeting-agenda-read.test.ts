import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildMeetingAgendaItemReadQuery,
  buildMeetingAgendaListQuery,
  buildMeetingAgendaExistenceQuery,
  meetingAgendaReadFromPersistence
} from "./meeting-agenda-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://meeting-agenda-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })
const meetingId = "event:us:119:hearing:1"
const agendaItemId = "agenda:us:119:hearing:1:0"

function persistence(): Parameters<typeof meetingAgendaReadFromPersistence>[0] {
  return {
    agendaItem: {
      amendmentRelationsComplete: true,
      billRelationsComplete: true,
      canonicalFactsComplete: true,
      description: "Consider the budget proposal",
      eventId: meetingId,
      id: agendaItemId,
      materialRelationsComplete: true,
      ordinal: 0,
      status: "scheduled",
      title: "Budget proposal"
    },
    source: {
      createdAt: new Date("2026-08-20T15:00:00.000Z"),
      id: meetingId,
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
      updatedAt: new Date("2026-08-21T15:00:00.000Z"),
      upstreamIds: { congress: "committee-meeting/1" }
    }
  }
}

describe("meeting agenda repository", () => {
  it("checks the public parent before an empty agenda page is accepted", () => {
    const generated = buildMeetingAgendaExistenceQuery(database, meetingId).toSQL().sql

    expect(generated).toContain('from "legislation"."legislative_events"')
    expect(generated).toContain('"legislative_events"."id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
  })

  it("binds agenda rows to a visible meeting and only selects complete canonical facts", () => {
    const cursor = Buffer.from(
      JSON.stringify({ id: agendaItemId, ordinal: 0, scope: { meetingId }, version: 1 })
    ).toString("base64url")
    const generated = buildMeetingAgendaListQuery(database, { cursor, limit: 25, meetingId }).toSQL().sql

    expect(generated).toContain('from "legislation"."event_agenda_items"')
    expect(generated).toContain('inner join "legislation"."legislative_events"')
    expect(generated).toContain('"event_agenda_items"."event_id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
    expect(generated).toContain('"event_agenda_items"."canonical_facts_complete" =')
    expect(generated).toContain('"event_agenda_items"."bill_relations_complete" =')
    expect(generated).toContain('"event_agenda_items"."amendment_relations_complete" =')
    expect(generated).toContain('"event_agenda_items"."material_relations_complete" =')
    expect(generated).toContain(
      'order by "legislation"."event_agenda_items"."ordinal" asc, "legislation"."event_agenda_items"."id" asc'
    )
    expect(generated).not.toContain("coalesce")
  })

  it("binds a singular agenda item to both its meeting parent and item ID", () => {
    const generated = buildMeetingAgendaItemReadQuery(database, { agendaItemId, meetingId }).toSQL().sql

    expect(generated).toContain('"event_agenda_items"."event_id" =')
    expect(generated).toContain('"event_agenda_items"."id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
  })

  it("projects explicit relation arrays only from complete canonical rows", () => {
    expect(
      meetingAgendaReadFromPersistence(persistence(), {
        amendmentIds: ["amendment:us:119:1"],
        billIds: ["bill:us:119:hr:1"],
        materialIds: ["material:us:119:agenda"]
      })
    ).toMatchObject({
      amendmentIds: ["amendment:us:119:1"],
      billIds: ["bill:us:119:hr:1"],
      description: "Consider the budget proposal",
      materialIds: ["material:us:119:agenda"],
      title: "Budget proposal"
    })

    const incomplete = persistence()
    incomplete.agendaItem.materialRelationsComplete = false
    expect(() =>
      meetingAgendaReadFromPersistence(incomplete, {
        amendmentIds: [],
        billIds: [],
        materialIds: []
      })
    ).toThrow("was not found")
  })

  it("never substitutes a description for a missing canonical title", () => {
    const incomplete = persistence()
    incomplete.agendaItem.title = null
    expect(() =>
      meetingAgendaReadFromPersistence(incomplete, { amendmentIds: [], billIds: [], materialIds: [] })
    ).toThrow("agenda item title must not be empty")
  })
})
