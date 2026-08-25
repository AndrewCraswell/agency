import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildMeetingDocumentListQuery, buildMeetingExistenceQuery } from "./meeting-document-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://meeting-document-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

const meetingId = "event:us:119:hearing:1"

function cursor(scope: Readonly<{ classification: string | null; meetingId: string }>): string {
  return Buffer.from(
    JSON.stringify({
      classification: "agenda",
      id: "event-document:1",
      scope,
      title: "Budget hearing packet",
      version: 1
    })
  ).toString("base64url")
}

describe("meeting document repository", () => {
  it("checks that the parent is visible before an empty child collection is accepted", () => {
    const generated = buildMeetingExistenceQuery(database, meetingId).toSQL().sql

    expect(generated).toContain('from "legislation"."legislative_events"')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
  })

  it("binds documents to the visible meeting, filters classification, and uses a stable keyset order", () => {
    const generated = buildMeetingDocumentListQuery(database, {
      classification: "agenda",
      cursor: cursor({ classification: "agenda", meetingId }),
      limit: 25,
      meetingId
    }).toSQL().sql

    expect(generated).toContain('inner join "legislation"."legislative_events"')
    expect(generated).toContain('"event_documents"."event_id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
    expect(generated).toContain('"event_documents"."classification" =')
    expect(generated).toContain(
      'order by "legislation"."event_documents"."classification" asc, "legislation"."event_documents"."title" asc, "legislation"."event_documents"."id" asc'
    )
    expect(generated).toContain('"event_documents"."title" >')
    expect(generated).not.toContain('"event_documents"."content_type"')
    expect(generated).not.toContain('"event_documents"."document_date"')
  })

  it("rejects cursors bound to another meeting or classification", () => {
    expect(() =>
      buildMeetingDocumentListQuery(database, {
        cursor: cursor({ classification: null, meetingId: "event:other" }),
        meetingId
      })
    ).toThrow("Invalid meeting document pagination cursor")
    expect(() =>
      buildMeetingDocumentListQuery(database, {
        classification: "minutes",
        cursor: cursor({ classification: "agenda", meetingId }),
        meetingId
      })
    ).toThrow("Invalid meeting document pagination cursor")
  })
})
