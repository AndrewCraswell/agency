import { describe, expect, it } from "vitest"
import {
  adcCodeForResistance,
  analogFrontEnd,
  estimateExternalResistance,
  expectedSenseVoltage,
  fieResistanceBoundaries,
  fieTimingBoundariesUs
} from "./analog-model.js"

describe("three-weapon analog model", () => {
  it("round-trips every FIE resistance boundary within the design error budget", () => {
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
})
