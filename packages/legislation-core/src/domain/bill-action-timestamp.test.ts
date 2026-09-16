import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { billActions } from "../database/schema/schema"
import { billActionTimestamp } from "./bill-action-timestamp"

describe("bill action timestamp", () => {
  it("decodes computed PostgreSQL timestamps before timeline ordering", () => {
    const timestamp = "2026-05-19 00:00:00+00"
    expect(Reflect.get(billActionTimestamp(), "decoder")).toBe(billActions.actionAt)
    expect(billActions.actionAt.mapFromDriverValue(timestamp)).toEqual(new Date("2026-05-19T00:00:00Z"))
  })
  it("normalizes date-only actions to a timezone-aware UTC timestamp", () => {
    const rendered = new PgDialect().sqlToQuery(billActionTimestamp())

    expect(rendered.sql).toBe(
      `coalesce("legislation"."bill_actions"."action_at", "legislation"."bill_actions"."action_date"::timestamp at time zone 'UTC')`
    )
  })
})
