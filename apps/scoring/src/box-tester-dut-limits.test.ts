import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { boxTesterDutLimits, evaluateBoxTesterDutLimits } from "./box-tester-dut-limits.js"

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(`${repositoryRoot}/${path}`))
    .digest("hex")
    .toUpperCase()
}

describe("BT-03 DUT-boundary contract", () => {
  it("binds the normal and guarded source limits without treating them as DUT proof", () => {
    expect(boxTesterDutLimits.dutBoundary.lineState).toMatchObject({
      normalMaximumSourceCurrentMicroamps: 1_100,
      normalMaximumSourceVoltageMillivolts: 2_500,
      normalMinimumSourceResistanceOhms: 2_490,
      result: "unmeasured-no-line-state-credit"
    })
    expect(boxTesterDutLimits.dutBoundary.guardedFaultSurvival).toMatchObject({
      maximumPulseDurationMilliseconds: 100,
      maximumSourceCurrentMicroamps: 433,
      maximumSourceEnergyMicrojoules: 1_040,
      maximumSourceVoltageMillivolts: 24_000,
      result: "unmeasured-no-survival-credit"
    })
  })

  it("retains calibration inputs and isolation screen without inventing physical measurements", () => {
    expect(boxTesterDutLimits.calibrationInputs).toMatchObject({
      capacitance: { maximumExpandedUncertaintyPf: 100, permittedBankPf: [500, 2_000, 5_000, 10_000] },
      resistance: { maximumExpandedUncertaintyOhms: 0.25 },
      timing: { boundaryDisposition: "indeterminate-no-credit", maximumExpandedUncertaintyUs: 1 }
    })
    expect(boxTesterDutLimits.dutBoundary.unpoweredIsolation).toMatchObject({
      minimumIsolationResistanceOhms: 10_000_000,
      result: "unmeasured-no-isolation-credit",
      testVoltageVolts: 5
    })
    for (const source of boxTesterDutLimits.sourceProvenance) {
      expect(sha256(source.sourcePath)).toBe(source.sha256)
    }
  })

  it("keeps topology selection, output sensing, leakage, switching, and all physical authority blocked", () => {
    const result = evaluateBoxTesterDutLimits()
    expect(result).toMatchObject({ physicalRunAuthorized: false, status: "blocked" })
    expect(result.unresolvedGates).toHaveLength(8)
    expect(boxTesterDutLimits.matrixCoverage).toMatchObject({
      conductorCount: 7,
      minimumTopology: "unselected-pending-coverage-proof"
    })
    expect(boxTesterDutLimits.authority).toEqual({
      energizedDutConnectionAuthorized: false,
      faultSurvivalClaim: false,
      physicalRunAuthorized: false,
      scoringAuthority: false,
      testerHardwareApproved: false
    })
  })

  it("rejects changed source bounds, fabricated acceptance, and topology drift", () => {
    const changedSource = structuredClone(boxTesterDutLimits)
    Object.defineProperty(changedSource.dutBoundary.lineState, "normalMaximumSourceCurrentMicroamps", {
      configurable: true,
      enumerable: true,
      value: 1_101,
      writable: true
    })
    expect(() => evaluateBoxTesterDutLimits(changedSource)).toThrow(RangeError)

    const fabricatedMeasurement = structuredClone(boxTesterDutLimits)
    Object.defineProperty(fabricatedMeasurement.dutBoundary.leakage, "allocation", {
      configurable: true,
      enumerable: true,
      value: "accepted",
      writable: true
    })
    expect(() => evaluateBoxTesterDutLimits(fabricatedMeasurement)).toThrow(RangeError)

    const selectedTopology = structuredClone(boxTesterDutLimits)
    Object.defineProperty(selectedTopology.matrixCoverage, "minimumTopology", {
      configurable: true,
      enumerable: true,
      value: "fifteen-switch-matrix",
      writable: true
    })
    expect(() => evaluateBoxTesterDutLimits(selectedTopology)).toThrow(RangeError)
  })
})
