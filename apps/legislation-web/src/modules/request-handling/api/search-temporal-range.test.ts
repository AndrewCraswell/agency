import { describe, expect, it } from "vitest"
import { normalizeSearchTemporalRange, validateSearchTemporalRange } from "./search-temporal-range"

describe("search temporal ranges", () => {
  it.each([
    ["2024-02-28", "2024-02-29"],
    ["2024-02-29", "2024-03-01"],
    ["2025-02-28", "2025-03-01"],
    ["2026-04-30", "2026-05-01"],
    ["2026-12-31", "2027-01-01"],
    ["2026-03-08", "2026-03-09"]
  ])("includes the full UTC day %s up to, but not including, %s", (to, nextDay) => {
    expect(normalizeSearchTemporalRange(to, to, ["from", "to"])).toEqual({
      updatedFrom: new Date(`${to}T00:00:00.000Z`),
      updatedTo: undefined,
      updatedToExclusive: new Date(`${nextDay}T00:00:00.000Z`)
    })
  })

  it("preserves timestamp precision and compares instants rather than offset spellings", () => {
    expect(
      normalizeSearchTemporalRange("2026-08-24T01:30:00.123+02:00", "2026-08-23T23:30:00.456Z", ["from", "to"])
    ).toEqual({
      updatedFrom: new Date("2026-08-23T23:30:00.123Z"),
      updatedTo: new Date("2026-08-23T23:30:00.456Z"),
      updatedToExclusive: undefined
    })
    expect(() =>
      validateSearchTemporalRange("2026-08-24T01:30:00+02:00", "2026-08-23T23:30:00Z", ["from", "to"])
    ).not.toThrow()
  })

  it.each([null, undefined])("leaves %s bounds absent and supports each one-sided range", (absent) => {
    expect(normalizeSearchTemporalRange(absent, absent, ["from", "to"])).toEqual({
      updatedFrom: undefined,
      updatedTo: undefined,
      updatedToExclusive: undefined
    })
    expect(normalizeSearchTemporalRange("2026-08-24", absent, ["from", "to"])).toEqual({
      updatedFrom: new Date("2026-08-24T00:00:00.000Z"),
      updatedTo: undefined,
      updatedToExclusive: undefined
    })
    expect(normalizeSearchTemporalRange(absent, "2026-08-24", ["from", "to"])).toEqual({
      updatedFrom: undefined,
      updatedTo: undefined,
      updatedToExclusive: new Date("2026-08-25T00:00:00.000Z")
    })
    expect(normalizeSearchTemporalRange(absent, "2026-08-24T00:00:00.123-07:00", ["from", "to"])).toEqual({
      updatedFrom: undefined,
      updatedTo: new Date("2026-08-24T07:00:00.123Z"),
      updatedToExclusive: undefined
    })
    expect(normalizeSearchTemporalRange("2026-08-24T00:00:00.123-07:00", absent, ["from", "to"])).toEqual({
      updatedFrom: new Date("2026-08-24T07:00:00.123Z"),
      updatedTo: undefined,
      updatedToExclusive: undefined
    })
  })

  it.each([
    ["2026-08-25", "2026-08-24", "start must not be after end"],
    ["2026-08-24T00:00:00-07:00", "2026-08-24T00:00:00Z", "start must not be after end"],
    ["2026-08-24", "2026-08-25T00:00:00Z", "start and end must use the same temporal format"],
    ["2026-08-24T00:00:00Z", "2026-08-25", "start and end must use the same temporal format"]
  ])("rejects the invalid range %s to %s with explicit field attribution", (from, to, message) => {
    expect(() => normalizeSearchTemporalRange(from, to, ["start", "end"])).toThrow(
      expect.objectContaining({ category: "invalid_request", message })
    )
  })
})
