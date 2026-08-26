import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { buildJurisdictionSessionListQuery, buildSessionLookupQuery } from "./session-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://session-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

const jurisdictionId = "jurisdiction:wa"

function cursor(
  scope: Readonly<{ from: string | null; isActive: boolean | null; jurisdictionId: string; to: string | null }>
): string {
  return Buffer.from(
    JSON.stringify({
      id: "session:wa:2025",
      name: "Regular Session",
      scope,
      startDate: "2025-01-01",
      version: 1
    })
  ).toString("base64url")
}

describe("session read queries", () => {
  it("binds jurisdiction, interval, activity, and keyset order", () => {
    const generated = buildJurisdictionSessionListQuery(database, {
      cursor: cursor({ from: "2025-01-01", isActive: true, jurisdictionId, to: "2025-12-31" }),
      from: "2025-01-01",
      isActive: true,
      jurisdictionId,
      limit: 25,
      to: "2025-12-31"
    }).toSQL().sql

    expect(generated).toContain('from "legislation"."legislative_sessions"')
    expect(generated).toContain('"legislative_sessions"."jurisdiction_id" =')
    expect(generated).toContain('"legislative_sessions"."is_active" =')
    expect(generated).toContain("coalesce")
    expect(generated).toContain('"legislative_sessions"."name" asc')
    expect(generated).toContain('"legislative_sessions"."id" asc')
    expect(generated).toContain('"legislative_sessions"."name" >')
  })

  it("treats null session bounds as open-ended interval endpoints", () => {
    const generated = buildJurisdictionSessionListQuery(database, {
      from: "2025-01-01",
      jurisdictionId,
      to: "2025-12-31"
    }).toSQL().sql

    expect(generated).toContain('coalesce("legislation"."legislative_sessions"."end_date", \'9999-12-31\'::date) >= ')
    expect(generated).toContain('coalesce("legislation"."legislative_sessions"."start_date", \'0001-01-01\'::date) <= ')
  })

  it("builds an exact canonical session lookup", () => {
    const generated = buildSessionLookupQuery(database, "session:wa:2025").toSQL().sql

    expect(generated).toContain('from "legislation"."legislative_sessions"')
    expect(generated).toContain('"legislative_sessions"."id" =')
    expect(generated).toContain("limit")
  })

  it("rejects reversed date intervals and cursor scope mismatches", () => {
    expect(() =>
      buildJurisdictionSessionListQuery(database, { from: "2026-01-01", jurisdictionId, to: "2025-01-01" })
    ).toThrow("from must not be after to")
    expect(() =>
      buildJurisdictionSessionListQuery(database, {
        cursor: cursor({ from: null, isActive: null, jurisdictionId: "jurisdiction:other", to: null }),
        jurisdictionId
      })
    ).toThrow("Invalid session pagination cursor")
  })
})
