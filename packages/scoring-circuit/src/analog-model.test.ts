import { describe, expect, it } from "vitest"
import {
  adcCodeForResistance,
  adcInputResistanceOhms,
  acquisitionUs,
  analogBudget,
  analogFrontEnd,
  clampLeakageErrorOhms,
  estimateExternalResistance,
  expectedSenseVoltage,
  fieResistanceBoundaries,
  fieTimingBoundariesUs,
  fiveTauAdcSettlingUs,
  fiveTauSourceSettlingUs,
  conservativeBlankingUs,
  fullDiagnosticAcquisitionUs,
  m403ScreenedStaticErrorOhms,
  m403StaticScreenBreakdownOhms,
  m403CouponCaptureDutHalfWidthAllocationOhms,
  m403LowLeakageClampExperimentScreenOhms,
  negativeInjectionScreenMa,
  resistanceErrorForVoltageErrorOhms,
  sourceResistorTemperatureErrorOhms,
  switchChargeErrorOhms
} from "./analog-model.js"

describe("three-weapon analog model", () => {
  it("round-trips every FIE resistance boundary in the ideal resistor-network model", () => {
    for (const resistance of Object.values(fieResistanceBoundaries)) {
      const estimated = estimateExternalResistance(expectedSenseVoltage(resistance))
      expect(Math.abs(estimated - resistance)).toBeLessThan(analogFrontEnd.maximumClassificationErrorOhms)
    }
  })

  it("leaves measurable ADC separation across the foil insulation ambiguity band", () => {
    const alwaysOn = adcCodeForResistance(fieResistanceBoundaries.foilInsulationFaultAlwaysOnOhms)
    const alwaysOff = adcCodeForResistance(fieResistanceBoundaries.foilInsulationFaultAlwaysOffOhms)

    expect(alwaysOff - alwaysOn).toBeGreaterThanOrEqual(25)
  })

  it("represents short and open circuits without overflowing the estimator", () => {
    expect(expectedSenseVoltage(0)).toBe(0)
    expect(estimateExternalResistance(0)).toBe(0)
    expect(expectedSenseVoltage(Number.POSITIVE_INFINITY)).toBe(analogFrontEnd.excitationVoltage)
    expect(estimateExternalResistance(analogFrontEnd.excitationVoltage)).toBe(Number.POSITIVE_INFINITY)
  })

  it("samples fast enough to classify the minimum sabre contact in hardware", () => {
    expect(analogFrontEnd.comparatorTimestampResolutionUs).toBeLessThanOrEqual(
      fieTimingBoundariesUs.sabreMinimumContactUs / 20
    )
    expect(analogFrontEnd.maximumRelevantSabreScanUs).toBeLessThanOrEqual(
      fieTimingBoundariesUs.sabreMinimumContactUs / 10
    )
  })

  it("bounds the M4-03 source, ADC, and switch-transient calculations", () => {
    expect(adcInputResistanceOhms(500)).toBeLessThan(analogBudget.adcSlowChannelMaximumInputResistanceOhms)
    expect(fiveTauSourceSettlingUs(100, 10_000)).toBeCloseTo(4.81, 2)
    expect(fiveTauSourceSettlingUs(500, 10_000)).toBeCloseTo(20.87, 2)
    expect(fiveTauAdcSettlingUs(450)).toBeCloseTo(3.54, 2)
    expect(conservativeBlankingUs(100, 10_000)).toBeCloseTo(7.63, 2)
    expect(acquisitionUs(100, 10_000, 2)).toBeCloseTo(9.98, 2)
    expect(fullDiagnosticAcquisitionUs(500, 10_000)).toBeCloseTo(31.47, 2)
    expect(switchChargeErrorOhms(450, 500)).toBeCloseTo(4.2, 1)
    expect(resistanceErrorForVoltageErrorOhms(450, analogBudget.adcLsbVolts / 2)).toBeCloseTo(0.43, 2)
  })

  it("keeps the M4-03 temperature screen explicitly denied at the 450-ohm boundary", () => {
    expect(analogBudget.adcSingleEndedIntegralLinearityTypicalLsb).toBe(3.1)
    expect(sourceResistorTemperatureErrorOhms(450, -40)).toBeCloseTo(0.29, 2)
    expect(sourceResistorTemperatureErrorOhms(450, 125)).toBeCloseTo(0.44, 2)
    expect(m403ScreenedStaticErrorOhms(450, 125)).toBeCloseTo(7.2, 2)
    expect(m403ScreenedStaticErrorOhms(450, 125)).toBeGreaterThan(analogBudget.fixtureTargetOhms)
  })

  it("identifies the unqualified clamp and ADC terms as the static-screen dominants", () => {
    const screen = m403StaticScreenBreakdownOhms(450, 125)

    expect(screen.clampLeakage).toBeCloseTo(3.15, 2)
    expect(screen.adcIntegralLinearityTypical).toBeCloseTo(2.65, 2)
    expect(screen.clampLeakage).toBeGreaterThan(screen.adcQuantization)
    expect(screen.adcIntegralLinearityTypical).toBeGreaterThan(screen.sourceResistorTemperature)
    expect(screen.clampLeakage).toBe(3.15)
    expect(Object.values(screen).reduce((total, errorOhms) => total + errorOhms, 0)).toBeCloseTo(7.2, 2)
  })

  it("reserves the fixture allocation from the M4-04 coupon-capture half-width", () => {
    expect(m403CouponCaptureDutHalfWidthAllocationOhms()).toBe(4.5)
  })

  it("screens the BAV199 leakage-only experiment below 5 ohms without calling it a release", () => {
    expect(clampLeakageErrorOhms(450, analogBudget.leakageExperimentClampReverseLeakageMaximumNa * 2)).toBeCloseTo(
      0.31,
      2
    )
    expect(m403LowLeakageClampExperimentScreenOhms(450, 125)).toBeCloseTo(4.37, 2)
    expect(m403LowLeakageClampExperimentScreenOhms(450, 125)).toBeLessThanOrEqual(analogBudget.fixtureTargetOhms)
  })

  it("screens negative-path current against the STM32 input boundary", () => {
    expect(negativeInjectionScreenMa(0.5)).toBe(0)
    expect(negativeInjectionScreenMa(-0.5)).toBeCloseTo(0.196, 3)
    expect(negativeInjectionScreenMa(-1)).toBeCloseTo(0.685, 3)
    expect(negativeInjectionScreenMa(-3)).toBeCloseTo(2.642, 3)
    expect(negativeInjectionScreenMa(-7)).toBeCloseTo(6.556, 3)
    expect(negativeInjectionScreenMa(-24)).toBeCloseTo(23.19, 2)
  })
})
