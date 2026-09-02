import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { billActionTimestamp } from "./bill-action-timestamp.js"

describe("bill action timestamp", () => {
  it("normalizes date-only actions to a timezone-aware UTC timestamp", () => {
    const rendered = new PgDialect().sqlToQuery(billActionTimestamp())

    expect(rendered.sql).toBe(
      `coalesce("legislation"."bill_actions"."action_at", "legislation"."bill_actions"."action_date"::timestamp at time zone 'UTC')`
    )
  })
})
