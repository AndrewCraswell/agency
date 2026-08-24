import { describe, expect, it } from "vitest"
import { parseCanonicalUtcTimestamp, parseRealUtcDate } from "./bench-prototype-evidence-time.js"

describe("bench-prototype evidence time", () => {
  it("accepts only canonical UTC timestamps and preserves their instant", () => {
    const value = "2026-08-24T08:17:00.000Z"
    expect(parseCanonicalUtcTimestamp(value)?.toISOString()).toBe(value)
  })

  it.each([
    "2026-08-24T08:17:00Z",
    "2026-08-24T08:17:00.000+00:00",
    "2026-08-24T08:17:00.000-07:00",
    "2026-8-24T08:17:00.000Z",
    "2026-02-30T08:17:00.000Z",
    "2026-08-24T24:00:00.000Z",
    "not-a-timestamp",
    null,
    42
  ])("rejects non-canonical or impossible timestamps: %s", (value) => {
    expect(parseCanonicalUtcTimestamp(value)).toBeNull()
  })

  it("accepts a real leap-day date", () => {
    const value = "2024-02-29"
    expect(parseRealUtcDate(value)?.toISOString()).toBe("2024-02-29T00:00:00.000Z")
  })

  it.each(["2023-02-29", "2026-02-30", "2026-2-03", "2026-04-31", "not-a-date", null, 42])(
    "rejects malformed or impossible dates: %s",
    (value) => {
      expect(parseRealUtcDate(value)).toBeNull()
    }
  )
})
