import { describe, expect, it } from "vitest"
import { benchPrototypeP0AnalogRailBudget, validateBenchPrototypeP0AnalogRailBudget } from "./p0-analog-rail-budget.js"

describe("P0 phased analog rail budget", () => {
  it("tracks the reduced topology", () => {
    expect(validateBenchPrototypeP0AnalogRailBudget(benchPrototypeP0AnalogRailBudget)).toBe(true)
    expect(benchPrototypeP0AnalogRailBudget.quantities).toMatchObject({
      conductorCount: 7,
      sensedConductorCount: 5,
      adcCount: 1,
      referenceCount: 1,
      bufferCount: 5,
      muxCount: 3,
      phaseRegisterCount: 2
    })
    expect(benchPrototypeP0AnalogRailBudget.quantities.removedComparedWithP0CsA).toEqual({
      adc: 6,
      reference: 6,
      buffer: 2,
      adcReferenceReservoir: 6,
      adcBypassCapacitors: 12
    })
  })

  it("budgets only one energized source/sink phase", () => {
    expect(benchPrototypeP0AnalogRailBudget.arithmetic.assumptions.maximumSimultaneousSourcePaths).toBe(1)
    expect(benchPrototypeP0AnalogRailBudget.arithmetic.continuous.selectedPhaseCurrentA).toBeCloseTo(0.0025987526, 9)
    expect(benchPrototypeP0AnalogRailBudget.arithmetic.continuous.v5AnalogPaperCurrentA).toBeCloseTo(0.0100687526, 9)
    expect(benchPrototypeP0AnalogRailBudget.arithmetic.continuous.app3v3BoundedSubtotalCurrentA).toBeCloseTo(
      0.002539,
      8
    )
  })

  it("keeps physical evidence and fabrication closed", () => {
    expect(benchPrototypeP0AnalogRailBudget.evidence).toMatchObject({ state: "paper-screen", measured: false })
    expect(benchPrototypeP0AnalogRailBudget.authority).toEqual({
      schematicBudgetInput: true,
      completeRailBudgetPassed: false,
      physicalPowerEvidencePassed: false,
      fabricationAuthorized: false
    })
  })

  it("rejects drift", () => {
    const changed = structuredClone(benchPrototypeP0AnalogRailBudget)
    Reflect.set(changed.quantities, "adcCount", 7)
    expect(() => validateBenchPrototypeP0AnalogRailBudget(changed)).toThrow(RangeError)
  })
})
