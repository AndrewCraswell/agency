import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildPersonBillActivityListQuery,
  buildPersonExistenceQuery,
  encodePersonBillActivityCursor
} from "./person-bill-activity.js"

const pool = new pg.Pool({ connectionString: "postgresql://person-bill-activity-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("person bill activity queries", () => {
  it("aggregates every stored role before filtering activity membership and uses a latest-observed keyset", () => {
    const cursor = encodePersonBillActivityCursor({
      id: "bill:us:119:house:hr-1",
      latestObservedAt: "2026-08-22T12:00:00.000Z",
      scope: {
        from: "2026-01-01",
        personId: "person:us:example",
        role: "sponsor",
        sessionId: "session:us:119",
        status: "pending",
        to: "2026-12-31"
      }
    })
    const generated = buildPersonBillActivityListQuery(database, {
      cursor,
      from: "2026-01-01",
      limit: 10,
      personId: "person:us:example",
      role: "sponsor",
      sessionId: "session:us:119",
      status: "pending",
      to: "2026-12-31"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."bill_sponsors"')
    expect(generated).toContain('"bill_sponsors"."person_id" =')
    expect(generated).toContain('min("first_observed_at") as "first_observed_at"')
    expect(generated).toContain('max("latest_observed_at") as "latest_observed_at"')
    expect(generated).toContain("case")
    expect(generated).toContain('when "legislation"."bill_sponsors"."classification" = \'subject\' then \'subject\'')
    expect(generated).toContain('= any("roles")')
    expect(generated).toContain('order by "latest_observed_at" desc, "legislation"."bills"."id" asc')
    expect(generated).not.toContain(" offset ")
  })

  it("binds cursors to the complete filter scope and checks the parent independently", () => {
    const cursor = encodePersonBillActivityCursor({
      id: "bill:us:119:house:hr-1",
      latestObservedAt: "2026-08-22T12:00:00.000Z",
      scope: {
        from: null,
        personId: "person:us:example",
        role: null,
        sessionId: null,
        status: null,
        to: null
      }
    })
    expect(() =>
      buildPersonBillActivityListQuery(database, { cursor, limit: 10, personId: "person:us:another" }).toSQL()
    ).toThrow("Invalid person bill activity pagination cursor")
    expect(buildPersonExistenceQuery(database, "person:us:example").toSQL().sql).toContain(
      'from "legislation"."people"'
    )
  })
})
