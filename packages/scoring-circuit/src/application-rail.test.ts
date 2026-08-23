import { describe, expect, it } from "vitest"
import {
  calculateApplicationRail,
  defaultApplicationRailInputs,
  type ApplicationRailInputs
} from "./application-rail.js"

describe("application V3_3 rail closure screen", () => {
  it("keeps the selected fixed-output buck inside the supervisor release window", () => {
    const result = calculateApplicationRail()

    expect(result.supervisorPinMinimumV).toBeCloseTo(3.25, 3)
    expect(result.releaseMarginV).toBeCloseTo(0.02911, 5)
    expect(result.fallingAssertThresholdWorstV).toBeCloseTo(3.1383, 4)
    expect(result.esp32PinMinimumRegulatedV).toBeCloseTo(3.2, 3)
    expect(result.esp32RegulatedMarginV).toBeCloseTo(0.2, 3)
    expect(result.esp32PinAtLatestSupervisorAssertionV).toBeCloseTo(3.0783, 4)
    expect(result.esp32AssertionMarginV).toBeCloseTo(0.0783, 4)
    expect(result.startupInputMarginV).toBeCloseTo(1.15, 2)
  })

  it("derives a guaranteed CT delay instead of relying on the nominal delay", () => {
    const result = calculateApplicationRail()

    expect(result.ctEffectiveMinimumUf).toBeCloseTo(0.0612, 4)
    expect(result.supervisorDelayGuaranteedMinMs).toBeCloseTo(53.04, 2)
    expect(result.supervisorDelayNominalMs).toBeCloseTo(106.98, 2)
    expect(result.supervisorDelayRequirementMs).toBeCloseTo(14.65, 2)
    expect(result.supervisorDelayMarginMs).toBeCloseTo(38.39, 2)
  })

  it("has current, inductor, and thermal margin at the budget peak", () => {
    const result = calculateApplicationRail()

    expect(result.peakOutputCurrentA).toBeCloseTo(3.2 / 3.27, 5)
    expect(result.peakInputCurrentA).toBeLessThan(0.8)
    expect(result.peakRegulatorCurrentMarginA).toBeGreaterThan(1.3)
    expect(result.inductorPeakCurrentWithMarginA).toBeLessThan(1.7)
    expect(result.peakJunctionC).toBeLessThan(110)
    expect(result.dischargeTo10PercentMs).toBeCloseTo(92.1, 0)
  })

  it("rejects a rail that cannot release above the supervisor threshold", () => {
    const invalid: ApplicationRailInputs = { ...defaultApplicationRailInputs, outputMinV: 3.2 }

    expect(() => calculateApplicationRail(invalid)).toThrow(/SENSE\/VDD pin budget/)
  })

  it("fails closed when either ESP32 pin-level voltage budget is exhausted", () => {
    expect(() => calculateApplicationRail({ ...defaultApplicationRailInputs, esp32TransientAllowanceV: 0.28 })).toThrow(
      /ESP32 pin budget/
    )
    expect(() =>
      calculateApplicationRail({ ...defaultApplicationRailInputs, supervisorToEsp32MismatchMaxV: 0.09 })
    ).toThrow(/latest supervisor assertion/)
  })

  it("rejects an undersized input rail and thermal design", () => {
    expect(() => calculateApplicationRail({ ...defaultApplicationRailInputs, inputMinV: 3.5 })).toThrow(
      /3.6 V startup minimum/
    )
    expect(() => calculateApplicationRail({ ...defaultApplicationRailInputs, regulatorRthetaJaMaxCPerW: 200 })).toThrow(
      /thermal screen/
    )
  })

  it("rejects invalid capacitance and current assumptions", () => {
    expect(() => calculateApplicationRail({ ...defaultApplicationRailInputs, outputCapEffectiveMinUf: 39 })).toThrow(
      /40 uF minimum/
    )
    expect(() => calculateApplicationRail({ ...defaultApplicationRailInputs, regulatorCurrentLimitMinA: 0.9 })).toThrow(
      /current margin/
    )
  })

  it("fails closed when CT tolerance or settling consumes the guaranteed delay", () => {
    expect(() =>
      calculateApplicationRail({ ...defaultApplicationRailInputs, ctBiasAndAgingReserveFraction: 0.9 })
    ).toThrow(/guaranteed supervisor delay/)
    expect(() => calculateApplicationRail({ ...defaultApplicationRailInputs, railSettlingRequirementMs: 60 })).toThrow(
      /guaranteed supervisor delay/
    )
  })
})
