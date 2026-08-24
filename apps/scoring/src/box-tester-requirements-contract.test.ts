import { describe, expect, it } from "vitest"
import {
  boxTesterRequirementsContract,
  evaluateBoxTesterRun,
  validateBoxTesterRequirementsContract
} from "./box-tester-requirements-contract.js"

const physicalPass = {
  virtual: "notRun",
  dutSelfReport: "pass",
  physicalObserver: "pass",
  infrastructure: "pass"
} as const

const virtualPass = {
  virtual: "pass",
  dutSelfReport: "notRun",
  physicalObserver: "notRun",
  infrastructure: "pass"
} as const

describe("BT-01 tester requirements contract", () => {
  it("maps every frozen requirement family once with independent evidence fields", () => {
    expect(validateBoxTesterRequirementsContract(boxTesterRequirementsContract)).toBe(true)
    expect(boxTesterRequirementsContract.releaseState).toBe("deny")
    expect(boxTesterRequirementsContract.rows).toHaveLength(19)
    for (const row of boxTesterRequirementsContract.rows) {
      expect(row.state).toBe("planned")
      expect(row.stimulus).not.toHaveLength(0)
      expect(row.independentObservation).not.toHaveLength(0)
      expect(row.uncertainty).not.toHaveLength(0)
      expect(row.evidence).not.toHaveLength(0)
    }
  })

  it("fails closed for duplicate or unmapped family rows", () => {
    const duplicate = structuredClone(boxTesterRequirementsContract)
    Object.defineProperty(duplicate.rows[1], "requirementFamily", {
      configurable: true,
      enumerable: true,
      value: duplicate.rows[0].requirementFamily,
      writable: true
    })
    expect(() => validateBoxTesterRequirementsContract(duplicate)).toThrow(RangeError)

    const unmapped = structuredClone(boxTesterRequirementsContract)
    Object.defineProperty(unmapped.rows[0], "requirementFamily", {
      configurable: true,
      enumerable: true,
      value: "REQ-UNKNOWN",
      writable: true
    })
    expect(() => validateBoxTesterRequirementsContract(unmapped)).toThrow(RangeError)
  })

  it("keeps virtual, DUT self-report, physical observer, and infrastructure outcomes separate", () => {
    const row = boxTesterRequirementsContract.rows[1]
    expect(evaluateBoxTesterRun(row, "virtual", virtualPass)).toMatchObject({
      evaluation: "pass",
      physicalClaim: false
    })
    expect(evaluateBoxTesterRun(row, "dut", { ...physicalPass, physicalObserver: "unavailable" })).toMatchObject({
      evaluation: "indeterminate",
      physicalClaim: false
    })
    expect(evaluateBoxTesterRun(row, "dut", { ...physicalPass, infrastructure: "fail" })).toMatchObject({
      evaluation: "infrastructureError",
      physicalClaim: false
    })
    expect(evaluateBoxTesterRun(row, "dut", physicalPass)).toMatchObject({ evaluation: "pass", physicalClaim: false })
  })

  it("fails closed for altered or unmapped caller-created rows", () => {
    const altered = { ...boxTesterRequirementsContract.rows[0], stimulus: "unreviewed substitute" }
    expect(evaluateBoxTesterRun(altered, "dut", physicalPass)).toMatchObject({
      evaluation: "skipped",
      physicalClaim: false
    })
    const unmapped = { ...boxTesterRequirementsContract.rows[0], requirementFamily: "REQ-UNKNOWN" }
    expect(evaluateBoxTesterRun(unmapped, "dut", physicalPass)).toMatchObject({
      evaluation: "skipped",
      physicalClaim: false
    })
  })

  it("rejects prototype, accessor, and extra-key observations", () => {
    const row = boxTesterRequirementsContract.rows[0]
    const inherited = Object.create(physicalPass)
    expect(() => evaluateBoxTesterRun(row, "dut", inherited)).toThrow(RangeError)

    const accessor = { ...physicalPass }
    Object.defineProperty(accessor, "virtual", { enumerable: true, get: () => "notRun" })
    expect(() => evaluateBoxTesterRun(row, "dut", accessor)).toThrow(RangeError)

    expect(() => evaluateBoxTesterRun(row, "dut", { ...physicalPass, unreviewed: "pass" })).toThrow(RangeError)
    expect(() => evaluateBoxTesterRun(row, "dut", { ...physicalPass, virtual: "unknown" })).toThrow(RangeError)
  })

  it("returns indeterminate for unavailable or not-run participating outcomes", () => {
    const row = boxTesterRequirementsContract.rows[0]
    expect(evaluateBoxTesterRun(row, "virtual", { ...virtualPass, virtual: "unavailable" })).toMatchObject({
      evaluation: "indeterminate"
    })
    expect(evaluateBoxTesterRun(row, "virtual", { ...virtualPass, virtual: "notRun" })).toMatchObject({
      evaluation: "indeterminate"
    })
    expect(evaluateBoxTesterRun(row, "dut", { ...physicalPass, dutSelfReport: "notRun" })).toMatchObject({
      evaluation: "indeterminate"
    })
    expect(evaluateBoxTesterRun(row, "dut", { ...physicalPass, physicalObserver: "unavailable" })).toMatchObject({
      evaluation: "indeterminate"
    })
  })

  it("does not pass physical correlation disagreement", () => {
    const row = boxTesterRequirementsContract.rows[0]
    expect(evaluateBoxTesterRun(row, "dut", { ...physicalPass, dutSelfReport: "fail" })).toMatchObject({
      evaluation: "fail",
      physicalClaim: false
    })
    expect(evaluateBoxTesterRun(row, "dut", { ...physicalPass, physicalObserver: "fail" })).toMatchObject({
      evaluation: "fail",
      physicalClaim: false
    })
  })
})
