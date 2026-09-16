import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { buildPersonAmendmentsListQuery, encodePersonAmendmentsCursor, listPersonAmendments } from "./person-amendments"

const pool = new pg.Pool({ connectionString: "postgresql://person-amendments-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("person amendment queries", () => {
  it("filters the authoritative sponsor relationship and applies submitted-date keyset ordering", () => {
    const generated = buildPersonAmendmentsListQuery(database, {
      from: "2026-01-01",
      limit: 10,
      personId: "person:us:example",
      sessionId: "session:us:119",
      status: "pending",
      to: "2026-12-31"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."amendments"')
    expect(generated).toContain('"amendments"."sponsor_person_id" =')
    expect(generated).toContain('"amendments"."session_id" =')
    expect(generated).toContain('"amendments"."status" =')
    expect(generated).toContain('"amendments"."submitted_date" desc nulls last')
    expect(generated).toContain('"legislation"."amendments"."id" asc')
    expect(generated).not.toContain(" offset ")
  })

  it("binds a cursor to every active filter", () => {
    const cursor = encodePersonAmendmentsCursor({
      id: "amendment:us:119:hr:1:1",
      scope: {
        from: "2026-01-01",
        personId: "person:us:example",
        sessionId: "session:us:119",
        status: "pending",
        to: "2026-12-31"
      },
      submittedDate: "2026-06-01"
    })

    expect(() =>
      buildPersonAmendmentsListQuery(database, {
        cursor,
        from: "2026-01-01",
        limit: 10,
        personId: "person:us:other",
        sessionId: "session:us:119",
        status: "pending",
        to: "2026-12-31"
      }).toSQL()
    ).toThrow("Invalid person amendment pagination cursor")
  })

  it("rejects invalid bounds, limits, and cursors before database access", async () => {
    await expect(
      listPersonAmendments(database, { from: "2026-02-30", personId: "person:us:example" })
    ).rejects.toMatchObject({
      category: "invalid_request"
    })
    await expect(
      listPersonAmendments(database, { from: "2026-03-01", personId: "person:us:example", to: "2026-02-28" })
    ).rejects.toMatchObject({ category: "invalid_request" })
    await expect(listPersonAmendments(database, { limit: 0, personId: "person:us:example" })).rejects.toMatchObject({
      category: "invalid_request"
    })
    await expect(
      listPersonAmendments(database, { cursor: "not-a-cursor", personId: "person:us:example" })
    ).rejects.toMatchObject({ category: "invalid_request" })
  })
})
