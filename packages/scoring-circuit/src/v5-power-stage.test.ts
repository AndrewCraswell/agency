import { describe, expect, it } from "vitest"
import { assessV5PowerStage, v5PowerStage } from "./v5-power-stage.js"

describe("20 V USB-PD to V5 power stage", () => {
  const assessment = assessV5PowerStage()

  it("binds the exact minimal support network and omits unused power-good parts", () => {
    expect(v5PowerStage.supportParts).toHaveLength(12)
    expect(v5PowerStage.supportParts.map((part) => part.reference)).toEqual(
      expect.arrayContaining([
        "L_V5_BUCK",
        "C_V5_BUCK_IN_A",
        "C_V5_BUCK_BOOT",
        "R_V5_BUCK_MODE",
        "R_V5_BUCK_FB_TOP",
        "C_V5_BUCK_FF"
      ])
    )
    expect(v5PowerStage.intentionallyUnpopulated).toEqual([
      "R_V5_BUCK_EN_UP",
      "R_V5_BUCK_EN_DOWN",
      "C_V5_BUCK_SS",
      "R_V5_BUCK_PG_PULLUP",
      "TP_V5_BUCK_PG"
    ])
  })

  it("rejects the TPS55288 because its 6.35 A programmable limit cannot carry the V5 envelope", () => {
    expect(v5PowerStage.controller.mpn).toBe("TPS56A37RPAR")
    expect(assessment.continuous.outputCurrentA).toBeCloseTo(7.99, 2)
    expect(assessment.peak.outputCurrentA).toBeCloseTo(9.01, 2)
    expect(assessment.limits.outputCurrentPass).toBe(true)
    expect(assessment.peak.outputHeadroomA).toBeCloseTo(0.99, 2)
  })

  it("checks the selected input, on-time, inductor, and input-capacitor limits", () => {
    expect(assessment.limits.inputWithinRecommendedMaximum).toBe(true)
    expect(assessment.limits.inputWithinAbsoluteMaximum).toBe(true)
    expect(assessment.limits.absoluteInputHeadroomV).toBe(10)
    expect(assessment.limits.minimumOnTimeHeadroomAtRecommendedMaximumNs).toBeGreaterThan(300)
    expect(v5PowerStage.inductor.inductanceScreenAt12AH).toBe(2.4e-6)
    expect(assessment.inductor.peakToPeakRippleA).toBeCloseTo(3.42, 2)
    expect(assessment.inductor.peakCurrentA).toBeCloseTo(10.72, 2)
    expect(assessment.inductor.peakRmsCurrentA).toBeLessThan(v5PowerStage.inductor.heatingCurrentA)
    expect(assessment.inductor.continuousRmsCurrentA).toBeLessThan(v5PowerStage.inductor.heatingCurrentA)
    expect(assessment.limits.currentLimitPeakHeadroomA).toBeGreaterThan(2)
    expect(assessment.inputMlcc.peakBankRmsCurrentA).toBeCloseTo(4.06, 2)
    expect(assessment.inputMlcc.requiredPerCapRmsCurrentA).toBeCloseTo(2.03, 2)
    expect(assessment.inputMlcc.rippleQualificationPass).toBe(false)
  })

  it("keeps the peak envelope denied because the eFuse minimum current limit is below its input demand", () => {
    expect(assessment.continuous.eFuseHeadroomA).toBeGreaterThan(0)
    expect(assessment.peak.eFuseHeadroomA).toBeLessThan(0)
    expect(assessment.eFuseBound.minimumCurrentLimitA).toBeCloseTo(2.4, 2)
    expect(assessment.continuous.outputLoadW).toBeCloseTo(39.95, 2)
    expect(assessment.peak.outputLoadW).toBeCloseTo(45.05, 2)
    expect(assessment.eFuseBound.maximumOutputLoadW).toBeCloseTo(40.73, 2)
    expect(assessment.eFuseBound.maximumOutputCurrentA).toBeCloseTo(8.15, 2)
    expect(assessment.eFuseBound.maximumPeakDisplayAllocationW).toBeCloseTo(30.47, 2)
    expect(assessment.releaseState).toBe("deny")
  })

  it("fails closed on malformed rail-budget and efficiency inputs", () => {
    expect(() => assessV5PowerStage(null as never)).toThrow("railBudget must be an object")
    expect(() => assessV5PowerStage(undefined, 0)).toThrow("buckEfficiency must be finite and in the range (0, 1]")
    expect(() => assessV5PowerStage(undefined, Number.NaN)).toThrow(
      "buckEfficiency must be finite and in the range (0, 1]"
    )
  })
})
