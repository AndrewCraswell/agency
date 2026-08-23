import { describe, expect, it } from "vitest"
import {
  assessDeferred12vIsolation,
  deferred12vAcquisitionScreen,
  deferred12vBoostBounds,
  deferred12vFaultScreen,
  deferred12vIsolation,
  deferred12vIsolationErrorScreen,
  deferred12vSupervisorWindowBounds
} from "./analog-12v-isolation.js"

describe("deferred 12 V analog isolation screen", () => {
  it("keeps the proposed boost output inside the ADG5412F 12 V operating range before unbounded regulation terms", () => {
    const bounds = deferred12vBoostBounds()

    expect(bounds.minimumV).toBeCloseTo(11.974, 3)
    expect(bounds.maximumV).toBeCloseTo(12.514, 3)
    expect(bounds.minimumV).toBeGreaterThanOrEqual(10.8)
    expect(bounds.maximumV).toBeLessThanOrEqual(13.2)
    expect(bounds.includesOnlyReferenceDividerAndTolerance).toBe(true)
    expect(deferred12vIsolation.boost.enablePulldownOhms).toBe(100_000)
    expect(deferred12vIsolation.boost.outputCapacitorRatedV).toBe(50)
    expect(deferred12vIsolation.boost.adgDecouplingPerPackageNf).toBe(100)
  })

  it("holds the permit low below a supervisor window that protects the ADG5412F minimum rail", () => {
    const window = deferred12vSupervisorWindowBounds()

    expect(window.risingUndervoltage.minimumV).toBeCloseTo(11.336, 3)
    expect(window.fallingUndervoltageMinimumV).toBeCloseTo(10.993, 3)
    expect(window.risingOvervoltage.maximumV).toBeCloseTo(13.123, 3)
    expect(window.fallingUndervoltageMinimumV).toBeGreaterThan(10.8)
  })

  it("keeps either polarity of a 24 V source fault within the protected-source and source-to-supply limits", () => {
    const negative = deferred12vFaultScreen(-24)
    const positive = deferred12vFaultScreen(24)

    expect(negative.sourceToVssStressV).toBe(24)
    expect(negative.sourceToVddStressV).toBeCloseTo(36.514, 3)
    expect(negative.sourceToSupplyStressV).toBeCloseTo(36.514, 3)
    expect(positive.sourceToVssStressV).toBe(24)
    expect(positive.sourceToVddStressV).toBeCloseTo(12.026, 3)
    expect(positive.sourceToSupplyStressV).toBe(24)

    for (const screen of [negative, positive]) {
      expect(screen.withinProtectedSourceMagnitude).toBe(true)
      expect(screen.withinSourceToSupplyStress).toBe(true)
      expect(screen.sourceFaultLeakageTypicalUa).toBe(78)
      expect(screen.outputIsolatorTarget).toBe("unavailable")
    }
    expect(deferred12vIsolation.sourceEsd.leakageMaximumNa).toBe(10)
    expect(deferred12vIsolation.sourceEsd.surgeClampAt3AV).toBe(37)
    expect(deferred12vIsolation.sourceEsd.surgeClampHasMaximumGuarantee).toBe(false)
  })

  it("screens 12 V typical and conservative cross-condition charge against output-only capacitance", () => {
    const fiveTau = deferred12vIsolationErrorScreen(5)
    const tenTau = deferred12vIsolationErrorScreen(10)

    expect(fiveTau.adgChargeAfterBlankingTypical12vOutputOnlyOhms).toBeCloseTo(6.43, 2)
    expect(fiveTau.adgChargeAfterBlankingConservativeCombinedCapacitanceOhms).toBeCloseTo(6.08, 2)
    expect(fiveTau.adgChargeAfterBlankingConservativeOutputOnlyOhms).toBeCloseTo(12.11, 2)
    expect(fiveTau.totalOhms).toBeGreaterThan(16)
    expect(fiveTau.withinCouponCaptureTarget).toBe(false)
    expect(tenTau.totalOhms).toBeCloseTo(4.486, 3)
    expect(tenTau.withinCouponCaptureTarget).toBe(true)
    expect(tenTau.fullAdcPathUs).toBeGreaterThan(10)
  })

  it("separates the 450 ohm foil screen from the 100 ohm sabre timing screen", () => {
    const foil = deferred12vAcquisitionScreen(450, 10)
    const sabre = deferred12vAcquisitionScreen(100, 10)

    expect(foil.fullAdcPathUs).toBeCloseTo(11.347, 3)
    expect(sabre.fullAdcPathUs).toBeCloseTo(8.469, 3)
    expect(sabre.fullAdcPathUs).toBeLessThan(10)
    expect(sabre.excludesUnboundedAndImplementationDelays).toBe(true)
  })

  it("fails closed despite acceptable normal range and nominal fault-voltage limits", () => {
    const assessment = assessDeferred12vIsolation()

    expect(assessment.normalRangeCovered).toBe(true)
    expect(assessment.zeroOhmNormalSignalCovered).toBe(true)
    expect(assessment.status).toBe("deny")
    expect(assessment.boost.includesOnlyReferenceDividerAndTolerance).toBe(true)
    expect(assessment.unresolvedGates).toHaveLength(6)
    expect(assessment.screens.tenTau.usesTypicalOnlyChargeInjection).toBe(true)
    expect(assessment.screens.sabre100OhmTenTau.fullAdcPathUs).toBeLessThan(10)
  })
})
