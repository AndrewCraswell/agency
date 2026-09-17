import { expect, it } from "vitest"
import { parseVoteDate } from "./vote-date.js"

it("retains a date-only vote without inventing an instant", () => {
  expect(parseVoteDate("2026-05-07")).toEqual({ heldDate: "2026-05-07" })
  expect(parseVoteDate("2024-02-29")).toEqual({ heldDate: "2024-02-29" })
})

it("preserves timezone-qualified timestamps across a UTC day boundary", () => {
  expect(parseVoteDate("2026-05-07T23:30:00-08:00")).toEqual({ heldAt: new Date("2026-05-08T07:30:00Z") })
  expect(parseVoteDate("2026-05-07T12:00:00Z")).toEqual({ heldAt: new Date("2026-05-07T12:00:00Z") })
})

it.each([undefined, "", "2026", "2026-05", "2026-02-29", "2026-04-31", "2026-05-07T12:00:00", "2026-02-30T12:00:00Z"])(
  "withholds invalid, partial or timezone-ambiguous source values: %s",
  (value) => expect(parseVoteDate(value)).toEqual({})
)
