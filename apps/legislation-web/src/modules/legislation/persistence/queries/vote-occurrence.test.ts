import { PgDialect } from "drizzle-orm/pg-core"
import { expect, it } from "vitest"
import { voteDateBound, voteOccurrence, voteSortInstant, voteSortTimestamp } from "./vote-occurrence"

it("projects only source precision, keeping the internal sort anchor separate", () => {
  const vote = { heldDate: "2026-05-07", heldAt: null }
  expect(voteOccurrence(vote)).toEqual({ date: "2026-05-07", heldAt: null })
  expect(voteSortInstant(vote)).toEqual(new Date("2026-05-07T00:00:00Z"))
  expect(vote.heldAt).toBeNull()
})

it("keeps exact timestamps and existing UTC reporting dates", () => {
  const heldAt = new Date("2026-05-07T23:30:00-08:00")
  expect(voteOccurrence({ heldAt })).toEqual({ date: "2026-05-08", heldAt })
  expect(voteSortInstant({ heldAt })).toBe(heldAt)
})

it("rejects missing or invalid date evidence", () => {
  expect(() => voteOccurrence({ heldAt: null })).toThrow("Vote date is incomplete")
  expect(() => voteOccurrence({ heldAt: null, heldDate: "2026-02-30" })).toThrow("Vote date is incomplete")
  expect(() => voteOccurrence({ heldAt: new Date("invalid") })).toThrow("Vote heldAt is invalid")
})

it("uses an explicit timezone for internal ordering, independent of the database session", () => {
  const query = new PgDialect().sqlToQuery(voteSortTimestamp())
  expect(query.sql).toContain("\"held_date\"::timestamp at time zone 'UTC'")
})

it("includes date-only boundary days without weakening exact timestamp comparisons", () => {
  const query = new PgDialect().sqlToQuery(voteDateBound("2026-05-07T12:00:00Z", "from"))
  expect(query.sql).toContain('"held_at" >=')
  expect(query.sql).toContain('"held_at" is null')
  expect(query.sql).toContain('"held_date" >=')
  expect(query.params).toEqual(["2026-05-07T12:00:00Z", "2026-05-07"])
})
