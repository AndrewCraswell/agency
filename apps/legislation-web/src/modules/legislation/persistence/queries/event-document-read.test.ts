import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import { buildEventDocumentReadQuery, eventDocumentReadFromPersistence } from "./event-document-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://event-document-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

describe("event document repository", () => {
  it("requires a visible persisted meeting and event-document IDs without selecting unrelated event fields", () => {
    const generated = buildEventDocumentReadQuery(database, {
      eventDocumentId: "event-document:us:119:committee:1:agenda",
      meetingId: "meeting:us:119:committee:1"
    }).toSQL().sql

    expect(generated).toContain('"event_documents"."event_id" =')
    expect(generated).toContain('"event_documents"."id" =')
    expect(generated).toContain('inner join "legislation"."legislative_events"')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
    expect(generated).not.toContain('"event_documents"."content"')
  })

  it("keeps canonical event-document facts and does not manufacture absent links", () => {
    const createdAt = new Date("2026-08-20T15:00:00.000Z")
    expect(
      eventDocumentReadFromPersistence({
        classification: "agenda",
        createdAt,
        eventId: "meeting:us:119:committee:1",
        id: "event-document:us:119:committee:1:agenda",
        sourceUrl: "https://api.congress.gov/v3/committee-meeting/1/agenda.pdf",
        title: "Committee agenda"
      })
    ).toEqual({
      classification: "agenda",
      createdAt,
      documentId: null,
      id: "event-document:us:119:committee:1:agenda",
      materialId: null,
      meetingId: "meeting:us:119:committee:1",
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1/agenda.pdf",
      title: "Committee agenda",
      updatedAt: createdAt
    })
  })
})
