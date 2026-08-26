import { describe, expect, it } from "vitest"
import { displayPanelReadiness } from "./display-panel-readiness.js"
import { calculateSelectedPanelPowerBudget } from "./selected-panel-power-budget.js"

describe("selected Adafruit 2277 panel power closure", () => {
  const budget = calculateSelectedPanelPowerBudget()
  const missingManufacturer = Object.fromEntries(
    Object.entries(displayPanelReadiness).filter(([field]) => field !== "manufacturer")
  )

  it("keeps the USB-PD contract and 100 ms screen explicit", () => {
    expect(budget.contractVoltageV).toBe(20)
    expect(budget.contractCurrentA).toBe(3)
    expect(budget.contractW).toBe(60)
    expect(budget.peakDurationMs).toBe(100)
    expect(budget.continuous.panel).toMatchObject({ continuousW: 20, peakW: 20, currentA: 4 })
    expect(budget.peak.panel).toMatchObject({ continuousW: 20, peakW: 20, currentA: 4 })
  })

  it("includes the selected panel, application rail, V5 direct loads, shunt, and buck", () => {
    expect(budget.continuous.applicationRail).toMatchObject({
      inputEquivalentW: expect.closeTo(3.0588, 3),
      localLoadW: 2.6,
      outputCurrentA: expect.closeTo(2.6 / 3.27, 5)
    })
    expect(budget.continuous.directV5FixedLoadW).toBeCloseTo(3.9, 5)
    expect(budget.continuous.postShuntLoadW).toBeCloseTo(26.9588, 3)
    expect(budget.continuous.shuntPowerW).toBeCloseTo(0.05814, 5)
    expect(budget.continuous.v5PreShuntLoadW).toBeCloseTo(27.017, 3)
    expect(budget.continuous.buckConversionLossW).toBeCloseTo(4.7677, 3)
    expect(budget.continuous.totalLossW).toBeCloseTo(5.8258, 3)
  })

  it("fits the guaranteed 40.60 W post-shunt ceiling in both envelopes", () => {
    expect(budget.continuous.postShuntCeilingW).toBeCloseTo(40.6, 2)
    expect(budget.peak.postShuntCeilingW).toBeCloseTo(40.6, 2)
    expect(budget.continuous.postShuntLoadW).toBeCloseTo(26.9588, 3)
    expect(budget.peak.postShuntLoadW).toBeCloseTo(30.4647, 3)
    expect(budget.continuous.postShuntCeilingHeadroomW).toBeCloseTo(13.6393, 3)
    expect(budget.peak.postShuntCeilingHeadroomW).toBeCloseTo(10.1334, 3)
    expect(budget.continuous.postShuntLoadPass).toBe(true)
    expect(budget.peak.postShuntLoadPass).toBe(true)
    expect(budget.powerFitPass).toBe(true)
  })

  it("keeps source and worst-low eFuse current inside the selected envelope", () => {
    expect(budget.continuous.sourceDemandW).toBeCloseTo(32.7847, 3)
    expect(budget.peak.sourceDemandW).toBeCloseTo(36.9282, 3)
    expect(budget.continuous.sourceDemandA).toBeCloseTo(1.6392, 3)
    expect(budget.peak.sourceDemandA).toBeCloseTo(1.8464, 3)
    expect(budget.continuous.sourceEnvelopePass).toBe(true)
    expect(budget.peak.sourceEnvelopePass).toBe(true)
    expect(budget.continuous.eFuseCurrentLimitA).toBeCloseTo(2.3959, 3)
    expect(budget.peak.eFuseCurrentLimitA).toBeCloseTo(2.3959, 3)
    expect(budget.continuous.eFuseCurrentPass).toBe(true)
    expect(budget.peak.eFuseCurrentPass).toBe(true)
  })

  it("does not turn the generic maximum-allocation peak into a pass", () => {
    expect(budget.genericMaximumAllocation.peakDisplayAllocationW).toBeCloseTo(34.7944, 3)
    expect(budget.genericMaximumAllocation.peakDisplayEFuseAllocationW).toBeCloseTo(30.34, 2)
    expect(budget.genericMaximumAllocation.peakDisplayEFusePass).toBe(false)
  })

  it("keeps startup and inrush as an explicit unmeasured release gate", () => {
    expect(budget.startupInrush).toEqual({ measured: false, releasePass: false, status: "unmeasured-gate" })
    expect(budget.releaseState).toBe("deny")
    expect(displayPanelReadiness.productionApproved).toBe(false)
  })

  it("fails closed when the selected panel record is unsafe", () => {
    expect(() =>
      calculateSelectedPanelPowerBudget({
        ...displayPanelReadiness,
        declaredLoad: { continuousW: 21, peakW: 21 }
      })
    ).toThrow("display panel continuous load exceeds its published voltage/current envelope")
  })

  it.each([
    [null, "display panel must be an object"],
    ["not a panel", "display panel must be an object"],
    [missingManufacturer, "display panel manufacturer must be a string"],
    [{ ...displayPanelReadiness, declaredLoad: undefined }, "display panel declaredLoad must be an object"],
    [
      { ...displayPanelReadiness, declaredLoad: { peakW: 20 } },
      "display panel declaredLoad.continuousW must be a finite number"
    ],
    [
      { ...displayPanelReadiness, declaredLoad: { continuousW: 20 } },
      "display panel declaredLoad.peakW must be a finite number"
    ],
    [
      { ...displayPanelReadiness, declaredLoad: { continuousW: Number.NaN, peakW: 20 } },
      "display panel declaredLoad.continuousW must be a finite number"
    ],
    [
      { ...displayPanelReadiness, declaredLoad: { continuousW: 20, peakW: Number.POSITIVE_INFINITY } },
      "display panel declaredLoad.peakW must be a finite number"
    ]
  ])("rejects malformed runtime input before budget evaluation", (panel, expectedError) => {
    expect(() => calculateSelectedPanelPowerBudget(panel)).toThrow(new RangeError(expectedError))
  })
})
