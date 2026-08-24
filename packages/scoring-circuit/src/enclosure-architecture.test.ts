import { describe, expect, it } from "vitest"
import {
  currentEnclosureArchitectureEvidence,
  enclosureArchitectureContract,
  evaluateEnclosureArchitecture
} from "./enclosure-architecture.js"

describe("M4-12 enclosure architecture contract", () => {
  it("maps every backlog acceptance area without inventing physical geometry", () => {
    expect(enclosureArchitectureContract).toMatchObject({
      boardAssembly: {
        boardEnvelopeCount: 3,
        panelEnvelope: {
          authority: "published panel envelope; not a selected enclosure or support datum",
          depthMm: 15,
          heightMm: 158,
          widthMm: 318
        }
      },
      releaseState: "deny",
      workUnit: "M4-12"
    })
    expect(enclosureArchitectureContract.constraints.vesaMounting).toMatchObject({
      loadPath: expect.stringContaining("no VESA load may reach a PCB"),
      patternMm: 100,
      state: "unverified"
    })
    expect(enclosureArchitectureContract.constraints.boardOutlinesAndKeepouts.requirement).toContain(
      "Dimensioned board outlines"
    )
    expect(enclosureArchitectureContract.constraints.antennaClearance.minimumClearanceMm).toBeNull()
    expect(enclosureArchitectureContract.constraints.irOpticalWindow.fieldOfViewDeg).toBeNull()
    expect(enclosureArchitectureContract.constraints.airflowAndThermal.maximumAmbientC).toBeNull()
    expect(enclosureArchitectureContract.constraints.harnessBendRadii.requirement).toContain("no generic bend radius")
  })

  it("fails closed for the current planning-only state", () => {
    const evaluation = evaluateEnclosureArchitecture()
    expect(evaluation.fabricationApproved).toBe(false)
    expect(evaluation.status).toBe("deny")
    expect(evaluation.failedGates).toEqual(
      Object.keys(currentEnclosureArchitectureEvidence).filter((key) => key !== "planningModelsRecorded")
    )
  })

  it("accepts a complete evidence record only as a non-fabrication review result", () => {
    const complete = Object.fromEntries(Object.keys(currentEnclosureArchitectureEvidence).map((key) => [key, true]))
    expect(evaluateEnclosureArchitecture(complete)).toEqual({
      fabricationApproved: false,
      status: "evidence-complete",
      failedGates: []
    })
  })

  it("rejects malformed, incomplete, extra, and non-boolean evidence", () => {
    for (const malformed of [null, 3, "ready", [], {}]) {
      expect(() => evaluateEnclosureArchitecture(malformed)).toThrow()
    }
    expect(() => evaluateEnclosureArchitecture({ ...currentEnclosureArchitectureEvidence, future: true })).toThrow(
      RangeError
    )
    expect(() =>
      evaluateEnclosureArchitecture({ ...currentEnclosureArchitectureEvidence, vesaLoadBypass: "yes" })
    ).toThrow(TypeError)
  })

  it("freezes contract, evidence, and evaluator results recursively", () => {
    expect(Object.isFrozen(enclosureArchitectureContract)).toBe(true)
    expect(Object.isFrozen(enclosureArchitectureContract.boardAssembly)).toBe(true)
    expect(Object.isFrozen(enclosureArchitectureContract.constraints)).toBe(true)
    expect(Object.isFrozen(enclosureArchitectureContract.releaseGates)).toBe(true)
    expect(Object.isFrozen(currentEnclosureArchitectureEvidence)).toBe(true)

    const evaluation = evaluateEnclosureArchitecture()
    expect(Object.isFrozen(evaluation)).toBe(true)
    expect(Object.isFrozen(evaluation.failedGates)).toBe(true)
  })

  it("rejects symbols, accessors, non-enumerable keys, aliases, and cycles before reads", () => {
    const symbolKey = { ...currentEnclosureArchitectureEvidence, [Symbol("forged")]: true }
    expect(() => evaluateEnclosureArchitecture(symbolKey)).toThrow(RangeError)

    let getterRead = false
    const accessor = { ...currentEnclosureArchitectureEvidence }
    Object.defineProperty(accessor, "vesaLoadBypass", {
      enumerable: true,
      get: () => {
        getterRead = true
        return false
      }
    })
    expect(() => evaluateEnclosureArchitecture(accessor)).toThrow(RangeError)
    expect(getterRead).toBe(false)

    const nonEnumerable = { ...currentEnclosureArchitectureEvidence }
    Object.defineProperty(nonEnumerable, "vesaLoadBypass", { enumerable: false })
    expect(() => evaluateEnclosureArchitecture(nonEnumerable)).toThrow(RangeError)

    const alias = {}
    const aliased = { ...currentEnclosureArchitectureEvidence, vesaLoadBypass: alias, antennaClearance: alias }
    expect(() => evaluateEnclosureArchitecture(aliased)).toThrow(RangeError)

    const cyclic = { ...currentEnclosureArchitectureEvidence, vesaLoadBypass: {} as Record<string, unknown> }
    cyclic.vesaLoadBypass.self = cyclic
    expect(() => evaluateEnclosureArchitecture(cyclic)).toThrow(RangeError)
  })
})
