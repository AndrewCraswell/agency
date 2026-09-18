import { describe, expect, it } from "vitest"
import { validateVoteDateRange, voteDateRangeSchema } from "./vote-date-range"

describe("vote date range", () => {
  it.each([
    {},
    { from: "2026-05-07", to: "2026-05-07" },
    { from: "2026-05-07T23:59:59.999Z", to: "2026-05-07" },
    { from: "2026-05-07T14:00:00+02:00", to: "2026-05-07T12:00:00Z" },
    { from: "2024-02-29" },
    { to: "2026-05-07" }
  ])("preserves precision through repeated validation: %j", (input) => {
    expect(voteDateRangeSchema.parse(voteDateRangeSchema.parse(input))).toEqual(input)
    expect(() => validateVoteDateRange(input.from, input.to)).not.toThrow()
  })

  it.each([
    { from: "2026-02-29" },
    { from: "2026-05-07T12:00:00" },
    { to: "invalid" },
    { to: "2026-05-07T25:00:00Z" },
    { from: "2026-05-08", to: "2026-05-07" },
    { from: "2026-05-08T00:00:00Z", to: "2026-05-07" },
    { from: "2026-05-07T12:00:00.001Z", to: "2026-05-07T12:00:00Z" }
  ])("rejects invalid or reversed bounds: %j", (input) => {
    expect(voteDateRangeSchema.safeParse(input).success).toBe(false)
    expect(() => validateVoteDateRange(input.from, input.to)).toThrowError(
      expect.objectContaining({ category: "invalid_request" })
    )
  })
})
