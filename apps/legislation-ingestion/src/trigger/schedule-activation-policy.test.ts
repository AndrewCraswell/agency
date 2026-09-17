import { describe, expect, it } from "vitest"
import {
  parseOpenStatesScheduleGate,
  parseOpenStatesScheduleJurisdictions,
  resolveOpenStatesScheduleActivation
} from "./schedule-activation-policy.js"

describe("OpenStates schedule activation policy", () => {
  it("fails closed unless both operator opt-ins are present", () => {
    expect(
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: false,
        enabledJurisdictions: ["ak", "nc"],
        openStatesSchedulesEnabled: true
      })
    ).toEqual([])
    expect(
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: true,
        enabledJurisdictions: ["ak", "nc"],
        openStatesSchedulesEnabled: true
      })
    ).toEqual(["ak", "nc"])
  })

  it("rejects activation without the standard activation request or provider quota gate", () => {
    expect(() =>
      resolveOpenStatesScheduleActivation({
        activate: false,
        activateOpenStates: true,
        enabledJurisdictions: ["ak"],
        openStatesSchedulesEnabled: true
      })
    ).toThrow("--activate-openstates requires --activate")
    expect(() =>
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: true,
        enabledJurisdictions: ["ak"],
        openStatesSchedulesEnabled: false
      })
    ).toThrow("OPENSTATES_SCHEDULES_ENABLED=true")
    expect(() =>
      resolveOpenStatesScheduleActivation({
        activate: true,
        activateOpenStates: true,
        enabledJurisdictions: [],
        openStatesSchedulesEnabled: true
      })
    ).toThrow("OPENSTATES_SCHEDULES_ENABLED_STATES")
  })

  it("parses the quota gate strictly and defaults it off", () => {
    expect(parseOpenStatesScheduleGate(undefined)).toBe(false)
    expect(parseOpenStatesScheduleGate(" ")).toBe(false)
    expect(parseOpenStatesScheduleGate("FALSE")).toBe(false)
    expect(parseOpenStatesScheduleGate("true")).toBe(true)
    expect(() => parseOpenStatesScheduleGate("enabled")).toThrow("must be true or false")
  })

  it("parses a strict, unique jurisdiction allowlist", () => {
    expect(parseOpenStatesScheduleJurisdictions(undefined)).toEqual([])
    expect(parseOpenStatesScheduleJurisdictions("ak,nc")).toEqual(["ak", "nc"])
    expect(parseOpenStatesScheduleJurisdictions(" ak, nc ")).toEqual(["ak", "nc"])
    expect(() => parseOpenStatesScheduleJurisdictions("ak,ca,ak")).toThrow("duplicate")
    expect(() => parseOpenStatesScheduleJurisdictions("ak,zz")).toThrow(/Invalid option/)
  })
})
