import { describe, expect, it } from "vitest"
import { calculateRailBudget, defaultRailBudgetInputs, evaluateDisplayLoad } from "./power-budget.js"

describe("preliminary USB-C 20 V / 3 A rail budget", () => {
  const result = calculateRailBudget()

  it("keeps the provisional source envelope at 60 W", () => {
    expect(result.contractW).toBe(60)
    expect(result.peakDurationMs).toBe(100)
    expect(result.continuous.sourceEnvelopeA).toBeCloseTo(2.4)
    expect(result.peak.sourceEnvelopeA).toBeCloseTo(2.7)
  })

  it("calculates a bounded continuous display allocation", () => {
    expect(result.continuous.buckBoostLossW).toBeCloseTo(7.05, 5)
    expect(result.continuous.pathAndConversionLossW).toBeCloseTo(8.05, 5)
    expect(result.continuous.downstreamRailBudgetW).toBeCloseTo(39.95, 5)
    expect(result.continuous.fixedRailLoadW).toBeCloseTo(6.7889, 4)
    expect(result.continuous.displayAllocationW).toBeCloseTo(33.1611, 4)
    expect(result.continuous.displayAllocationA).toBeCloseTo(6.6322, 4)
  })

  it("calculates a short peak envelope without changing the 3 A contract", () => {
    expect(result.peak.buckBoostLossW).toBeCloseTo(7.95, 5)
    expect(result.peak.pathAndConversionLossW).toBeCloseTo(8.95, 5)
    expect(result.peak.downstreamRailBudgetW).toBeCloseTo(45.05, 5)
    expect(result.peak.fixedRailLoadW).toBeCloseTo(10.2556, 4)
    expect(result.peak.displayAllocationW).toBeCloseTo(34.7944, 4)
    expect(result.peak.displayAllocationA).toBeCloseTo(6.9589, 4)
    expect(result.peak.sourceEnvelopeA).toBeLessThan(defaultRailBudgetInputs.sourceCurrentA)
  })

  it("checks measured panel values against both allocations", () => {
    expect(evaluateDisplayLoad(result, { continuousW: 30, peakW: 32 })).toEqual({
      continuousPass: true,
      peakPass: true
    })
    expect(evaluateDisplayLoad(result, { continuousW: 34, peakW: 35 })).toEqual({
      continuousPass: false,
      peakPass: false
    })
  })

  it("rejects malformed source, efficiency, duration, and load inputs", () => {
    const invalidCases: Array<[string, () => void]> = [
      ["zero source voltage", () => calculateRailBudget({ ...defaultRailBudgetInputs, sourceVoltageV: 0 })],
      [
        "nonfinite source current",
        () => calculateRailBudget({ ...defaultRailBudgetInputs, sourceCurrentA: Number.NaN })
      ],
      ["utilization over one", () => calculateRailBudget({ ...defaultRailBudgetInputs, peakSourceUtilization: 1.01 })],
      ["efficiency over one", () => calculateRailBudget({ ...defaultRailBudgetInputs, buckBoostEfficiency: 1.01 })],
      ["zero peak duration", () => calculateRailBudget({ ...defaultRailBudgetInputs, peakDurationMs: 0 })],
      [
        "missing local loads",
        () => calculateRailBudget({ ...defaultRailBudgetInputs, localLoads: undefined as never })
      ],
      ["path loss over envelope", () => calculateRailBudget({ ...defaultRailBudgetInputs, pdAndEfusePathLossW: 49 })],
      [
        "negative local load",
        () =>
          calculateRailBudget({
            ...defaultRailBudgetInputs,
            localLoads: {
              ...defaultRailBudgetInputs.localLoads,
              v5: { ...defaultRailBudgetInputs.localLoads.v5, audio: { continuousW: -1, peakW: 0 } }
            }
          })
      ]
    ]

    for (const [label, run] of invalidCases) {
      expect(run, label).toThrow(RangeError)
    }
  })

  it("rejects a negative or nonfinite display load", () => {
    expect(() => evaluateDisplayLoad(result, { continuousW: -1, peakW: 0 })).toThrow(
      "display.continuousW must be finite and non-negative"
    )
    expect(() => evaluateDisplayLoad(result, { continuousW: Number.POSITIVE_INFINITY, peakW: 0 })).toThrow(
      "display.continuousW must be finite and non-negative"
    )
  })

  it("fails closed on a forged rail-budget result", () => {
    const forgedResult = {
      ...result,
      continuous: { ...result.continuous, displayAllocationW: Number.NaN }
    }
    expect(() => evaluateDisplayLoad(forgedResult, { continuousW: 1, peakW: 1 })).toThrow(
      "result.continuous.displayAllocationW must be finite and non-negative"
    )
  })
})
