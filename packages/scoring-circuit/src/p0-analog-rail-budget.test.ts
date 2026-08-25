import { describe, expect, it } from "vitest"
import { benchPrototypeP0AnalogRailBudget, validateBenchPrototypeP0AnalogRailBudget } from "./p0-analog-rail-budget.js"

describe("BP-050 analog and reference rail budget", () => {
  it("binds the selected one-channel topology to seven explicit cells", () => {
    expect(validateBenchPrototypeP0AnalogRailBudget(benchPrototypeP0AnalogRailBudget)).toBe(true)
    expect(benchPrototypeP0AnalogRailBudget.quantities).toMatchObject({
      channelCount: 7,
      perCellPartCount: 17,
      perCellElectricalPartQuantity: 119,
      sharedRailPartCount: 10,
      sharedRailElectricalPartQuantity: 13,
      totalElectricalTopologyQuantity: 132
    })
    expect(benchPrototypeP0AnalogRailBudget.quantities.perCellParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "U_REF", mpn: "REF5025AQDRQ1", quantity: 7 }),
        expect.objectContaining({ reference: "U_SAR", mpn: "ADS8881IDGS", quantity: 7 }),
        expect.objectContaining({ reference: "U_OVP_BUFFER", mpn: "ADA4177-1ARZ", quantity: 7 }),
        expect.objectContaining({ reference: "C_REF", mpn: "GRM21BR71A106KE51L", quantity: 7 })
      ])
    )
    expect(benchPrototypeP0AnalogRailBudget.quantities.sharedRailParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "U_NEGATIVE_RAIL", mpn: "TPS60400DBVR", quantity: 1 }),
        expect.objectContaining({ reference: "C_NEG_FLY", quantity: 1 }),
        expect.objectContaining({ reference: "C_NEG_IN", quantity: 1 }),
        expect.objectContaining({ reference: "C_NEG_OUT", quantity: 1 })
      ])
    )
  })

  it("keeps the graph common-ground and excludes processor and isolation loads", () => {
    expect(benchPrototypeP0AnalogRailBudget.railGraph.edges).toEqual(
      expect.arrayContaining([
        expect.stringContaining("V5_ANALOG -> U_NEGATIVE_RAIL.VIN"),
        expect.stringContaining("APP_3V3 -> U_SOURCE_SWITCH_1..2"),
        expect.stringContaining("SCORING_3V3, STM32 supply, and any isolation-domain rail are not vertices")
      ])
    )
    expect(benchPrototypeP0AnalogRailBudget.scope.excluded).toEqual(
      expect.arrayContaining([
        expect.stringContaining("STM32G474RET3TR"),
        expect.stringContaining("NXE1S0505MC"),
        expect.stringContaining("DNP")
      ])
    )
    expect(benchPrototypeP0AnalogRailBudget.authority).toMatchObject({
      feedsBp050: true,
      completeRailBudgetPassed: false,
      physicalPowerEvidencePassed: false,
      releaseState: "deny"
    })
  })

  it("separates continuous, 100 ms peak, startup, and transient arithmetic", () => {
    const { arithmetic } = benchPrototypeP0AnalogRailBudget
    expect(arithmetic.continuous.v5AnalogCurrentA).toBeCloseTo(0.02409811245, 10)
    expect(arithmetic.continuous.v5NegativeOutputCurrentA).toBeCloseTo(0.0042, 10)
    expect(arithmetic.continuous.app3v3BoundedSubtotalCurrentA).toBeCloseTo(0.017068, 10)
    expect(arithmetic.continuous.referenceOutputCurrentA).toBeCloseTo(0.00702811245, 10)
    expect(arithmetic.peak.durationMs).toBe(100)
    expect(arithmetic.peak.completeRailTotal).toBe(false)
    expect(arithmetic.startup.declaredRampTimeMs).toBe(1)
    expect(arithmetic.startup.capacitanceUf).toEqual({
      v5Analog: 8.7,
      v5Negative: 1.7,
      app3v3: 14.3,
      reference: 140.7
    })
    expect(arithmetic.transient.referencePulse).toMatchObject({
      perCellCurrentA: 0.1,
      aggregateCurrentA: 0.7,
      localUnregulatedStepMv: 22.5,
      credit: "none"
    })
    expect(arithmetic.startup.credit).toBe("none")
    expect(arithmetic.transient.credit).toBe("none")
  })

  it("does not turn paper arithmetic into physical evidence", () => {
    expect(benchPrototypeP0AnalogRailBudget.evidence).toMatchObject({
      continuous: { state: "paper-screen", measured: false },
      peak: { state: "paper-screen", measured: false },
      startup: { state: "unmeasured-gate", measured: false },
      transient: { state: "unmeasured-gate", measured: false },
      decision: expect.stringContaining("not physical power proof")
    })
    expect(benchPrototypeP0AnalogRailBudget.evidence.openPhysicalEvidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining("REF5025 dynamic-load"),
        expect.stringContaining("TPS60400 negative-rail"),
        expect.stringContaining("effective capacitor")
      ])
    )
  })

  it("rejects a forged budget", () => {
    const forged = structuredClone(benchPrototypeP0AnalogRailBudget)
    Reflect.set(forged.quantities, "channelCount", 8)
    expect(() => validateBenchPrototypeP0AnalogRailBudget(forged)).toThrow(RangeError)
  })
})
