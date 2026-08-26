import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildChangeFeedQuery, encodeChangeFeedCursor, listChangeFeed } from "./change-feed-reads.js"

const pool = new pg.Pool({ connectionString: "postgresql://change-feed-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("change feed queries", () => {
  it("uses observed-time descending keyset ordering and all supported filters", () => {
    const generated = buildChangeFeedQuery(database, {
      classification: "update",
      jurisdictionId: "jurisdiction:us",
      limit: 10,
      organizationId: "organization:us:house",
      personId: "person:us:example",
      recordId: "bill:us:119:house:hr-1",
      recordType: "bill",
      observedFrom: new Date("2026-01-01T00:00:00.000Z"),
      observedTo: new Date("2026-12-31T23:59:59.000Z")
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."change_events"')
    expect(generated).toContain('"change_events"."change_type" =')
    expect(generated).toContain('"change_events"."jurisdiction_id" =')
    expect(generated).toContain('"change_events"."organization_id" =')
    expect(generated).toContain('"change_events"."person_id" =')
    expect(generated).toContain('"change_events"."record_id" =')
    expect(generated).toContain('"change_events"."record_type" =')
    expect(generated).toContain('"change_events"."observed_at" desc')
    expect(generated).toContain('"change_events"."id" desc')
    expect(generated).not.toContain(" offset ")
  })

  it("binds cursors to the complete scope and rejects malformed cursor timestamps", () => {
    const scope = {
      billId: null,
      classification: null,
      jurisdictionId: null,
      organizationId: null,
      personId: null,
      recordId: null,
      recordType: null,
      observedFrom: null,
      observedTo: null
    } as const
    const cursor = encodeChangeFeedCursor({
      id: "change:1",
      observedAt: "2026-08-01T12:00:00.000Z",
      scope
    })

    expect(() =>
      buildChangeFeedQuery(database, {
        cursor,
        limit: 10,
        recordType: "bill"
      }).toSQL()
    ).toThrow("Invalid change pagination cursor")

    expect(() =>
      buildChangeFeedQuery(database, {
        cursor: Buffer.from(
          JSON.stringify({ id: "change:1", observedAt: "2026-08-01", scope, version: 1 }),
          "utf8"
        ).toString("base64url"),
        limit: 10
      }).toSQL()
    ).toThrow("Invalid change pagination cursor")
  })

  it("rejects invalid limits before querying", async () => {
    await expect(listChangeFeed(database, { limit: 0 })).rejects.toMatchObject({ category: "invalid_request" })
    await expect(listChangeFeed(database, { limit: 101 })).rejects.toMatchObject({ category: "invalid_request" })
  })
})
