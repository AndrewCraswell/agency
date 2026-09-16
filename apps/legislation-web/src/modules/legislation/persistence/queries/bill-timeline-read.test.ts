import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { buildBillTimelineOutcomeQuery } from "./bill-timeline-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://bill-timeline-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("bill timeline outcome query", () => {
  it("rejects a timestamp at an ISO-date exclusive end bound", () => {
    expect(() =>
      buildBillTimelineOutcomeQuery(database, {
        billId: "bill:us:119:hr:1",
        from: "2026-01-02T00:00:00Z",
        to: "2026-01-01"
      })
    ).toThrow(/from must be less than or equal to to/)
  })

  it("includes agenda-linked outcomes exactly once with their canonical timeline order", () => {
    const generated = buildBillTimelineOutcomeQuery(database, {
      billId: "bill:us:119:hr:1",
      from: "2026-02-01T00:00:00.000Z",
      limit: 25,
      to: "2026-02-02T00:00:00.000Z"
    }).toSQL().sql

    expect(generated).toContain("select distinct")
    expect(generated).toContain('left join "legislation"."event_agenda_item_bills"')
    expect(generated).toContain('"event_agenda_item_bills"."agenda_item_id"')
    expect(generated).toContain('"event_agenda_item_bills"."bill_id" =')
    expect(generated).toContain(
      'order by "legislation"."event_outcomes"."occurred_at" asc, "legislation"."event_outcomes"."source_sequence" asc, "legislation"."event_outcomes"."id" asc'
    )
    expect(generated).not.toContain(" offset ")
  })
})
