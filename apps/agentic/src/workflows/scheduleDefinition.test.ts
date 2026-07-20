import { describe, expect, it } from "vitest"
import { nextScheduleRunAt, scheduleDefinitionFromConfig } from "./scheduleDefinition"

describe("workflow schedule definitions", () => {
  it("calculates interval and timezone-aware CRON occurrences", () => {
    const after = new Date("2026-07-17T13:00:01.000Z")

    expect(
      nextScheduleRunAt({ intervalSeconds: 300, scheduleExpression: null, timezone: "UTC" }, after).toISOString()
    ).toBe("2026-07-17T13:05:01.000Z")
    expect(
      nextScheduleRunAt(
        { intervalSeconds: null, scheduleExpression: "0 9 * * 1-5", timezone: "America/New_York" },
        after
      ).toISOString()
    ).toBe("2026-07-20T13:00:00.000Z")
  })

  it("rejects ambiguous, missing, and invalid schedule expressions", () => {
    expect(() => scheduleDefinitionFromConfig({ intervalSeconds: 300, cron: "0 9 * * *", timezone: "UTC" })).toThrow(
      "Choose either an interval or a CRON expression"
    )
    expect(() => scheduleDefinitionFromConfig({ timezone: "UTC" })).toThrow(
      "Choose either an interval or a CRON expression"
    )
    expect(() =>
      nextScheduleRunAt({ intervalSeconds: null, scheduleExpression: "not a schedule", timezone: "UTC" }, new Date(0))
    ).toThrow()
  })
})
