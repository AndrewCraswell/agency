import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildMeetingParticipantReadQuery } from "./meeting-participant-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://meeting-participant-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("meeting participant repository", () => {
  it("binds the participant to its visible meeting parent and selects canonical fields only", () => {
    const { sql: generated, params } = buildMeetingParticipantReadQuery(database, {
      meetingId: "event:us:119:hearing:1",
      participantId: "participant:us:119:hearing:1:1"
    }).toSQL()

    expect(params).toEqual(["event:us:119:hearing:1", "participant:us:119:hearing:1:1", false, 1])
    expect(generated).toContain('"event_participants"."event_id" =')
    expect(generated).toContain('"event_participants"."id" =')
    expect(generated).toContain('"legislative_events"."is_deleted" =')
    expect(generated).toContain('inner join "legislation"."legislative_events"')
    expect(generated).toContain('left join "legislation"."people"')
    expect(generated).toContain('left join "legislation"."organizations"')
    expect(generated).not.toContain('"event_participants"."person_id" as')
    expect(generated).not.toContain('"event_participants"."organization_id" as')
  })
})
