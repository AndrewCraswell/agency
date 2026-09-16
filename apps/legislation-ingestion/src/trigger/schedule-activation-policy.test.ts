import { describe, expect, it } from "vitest"
import { parseOpenStatesScheduleGate, resolveOpenStatesScheduleActivation } from "./schedule-activation-policy.js"

describe("OpenStates schedule activation policy", () => {
  it("fails closed unless both operator opt-ins are present", () => {
    expect(
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: false,
        openStatesSchedulesEnabled: true
      })
    ).toBe(false)
    expect(
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: true,
        openStatesSchedulesEnabled: true
      })
    ).toBe(true)
  })

  it("rejects activation without the standard activation request or provider quota gate", () => {
    expect(() =>
      resolveOpenStatesScheduleActivation({
        activate: false,
        activateOpenStates: true,
        openStatesSchedulesEnabled: true
      })
    ).toThrow("--activate-openstates requires --activate")
    expect(() =>
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: true,
        openStatesSchedulesEnabled: false
      })
    ).toThrow("OPENSTATES_SCHEDULES_ENABLED=true")
  })

  it("parses the quota gate strictly and defaults it off", () => {
    expect(parseOpenStatesScheduleGate(undefined)).toBe(false)
    expect(parseOpenStatesScheduleGate(" ")).toBe(false)
    expect(parseOpenStatesScheduleGate("FALSE")).toBe(false)
    expect(parseOpenStatesScheduleGate("true")).toBe(true)
    expect(() => parseOpenStatesScheduleGate("enabled")).toThrow("must be true or false")
  })
})
