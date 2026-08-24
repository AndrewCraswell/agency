import { describe, expect, it } from "vitest"
import {
  connectorPlacementContract,
  currentPhysicalBoardModels,
  currentMechanicalEvidence,
  evaluateMechanicalEnvelope,
  harnessServiceContract,
  isolationSlotMechanicalContract,
  mechanicalDatumContract,
  mechanicalReleaseGates,
  provisionalBoardEnvelopes
} from "./mechanical-envelope.js"

describe("three-board provisional mechanical envelope", () => {
  it("keeps all three board outlines provisional and preserves committed thicknesses", () => {
    expect(mechanicalDatumContract.architectureAuthority).toContain(
      "Communications boundary connectivity is integrated"
    )
    expect(mechanicalDatumContract.primaryDatumA).toContain("318 mm by 158 mm")
    expect(mechanicalDatumContract.primaryDatumA).toContain("not a manufacturer support plane")
    expect(provisionalBoardEnvelopes.map((board) => board.board)).toEqual([
      "SCORING_IO_BOARD",
      "APPLICATION_DISPLAY_CARRIER",
      "REPLACEABLE_COMMUNICATIONS_MODULE"
    ])
    expect(provisionalBoardEnvelopes.map((board) => board.finishedThicknessMm)).toEqual([1.6, 1.6, 0.8])
    expect(provisionalBoardEnvelopes.every((board) => board.outlineAuthority === "provisional-planning-only")).toBe(
      true
    )
    expect(provisionalBoardEnvelopes[1].mounting).toContain("VESA 100")
  })

  it("records all three planning models with thickness remaining contract-only", () => {
    expect(currentPhysicalBoardModels.communicationsBoundaryConnectivity).toBe("integrated")
    expect(currentPhysicalBoardModels.physicalAssemblyCount).toBe(3)
    expect(currentPhysicalBoardModels.physicalThreeBoardLayout).toBe("integrated-planning-models")
    expect(currentPhysicalBoardModels.communicationsModule).toMatchObject({
      current: { widthMm: 110, heightMm: 55, layers: 4, finishedThicknessMm: "not-modeled" },
      contract: { widthMm: 110, heightMm: 55, layers: 4, finishedThicknessMm: 0.8 },
      matchesEnvelope: true,
      thicknessModeling: "contract-only-unmodeled"
    })
    expect(currentPhysicalBoardModels.separateMainBoardModels).toMatchObject({
      current: {
        physicalAssemblyCount: 2,
        scoringBoard: { widthMm: 290, heightMm: 70, layers: 6, finishedThicknessMm: "not-modeled" },
        applicationBoard: { widthMm: 290, heightMm: 135, layers: 6, finishedThicknessMm: "not-modeled" }
      },
      contract: {
        physicalAssemblyCount: 2,
        scoringBoard: { widthMm: 290, heightMm: 70, layers: 6, finishedThicknessMm: 1.6 },
        applicationBoard: { widthMm: 290, heightMm: 135, layers: 6, finishedThicknessMm: 1.6 }
      },
      matchesEnvelope: true
    })
  })

  it("assigns every external and panel interface to an edge/service zone", () => {
    const interfaces = connectorPlacementContract.map((placement) => placement.interface).join(" ")
    for (const required of ["USB-C", "RJ45", "U.FL", "HUB75", "body-cord"]) expect(interfaces).toContain(required)
    expect(connectorPlacementContract.find((entry) => entry.interface.includes("body-cord"))?.placement).toContain(
      "panel/chassis supported"
    )
  })

  it("preserves the isolation slot and prohibits mechanical crossings", () => {
    expect(isolationSlotMechanicalContract).toMatchObject({
      clearanceTargetMm: 4,
      copperKeepoutTargetMm: 4,
      creepageTargetMm: 8,
      slotWidthTargetMm: 4
    })
    expect(isolationSlotMechanicalContract.continuity).toContain("continuous")
    expect(isolationSlotMechanicalContract.mountingRule).toContain("No mounting hole")
  })

  it("requires de-energized, strain-relieved, drawing-controlled service", () => {
    expect(harnessServiceContract.internalHotPlug).toBe("prohibited")
    expect(harnessServiceContract.bodyCordAnchorMaximumDistanceFromBoardMm).toBe(25)
    expect(harnessServiceContract.serviceOrder).toContain("verify V20_EFUSE_OUT discharged")
    expect(harnessServiceContract.bendEvidence).toContain("no generic bend radius")
  })

  it("fails closed while drawings and physical evidence are absent", () => {
    expect(evaluateMechanicalEnvelope()).toEqual({
      fabricationApproved: false,
      status: "deny",
      failedGates: Object.keys(currentMechanicalEvidence).filter((key) => key !== "physicalBoardModelsMatchEnvelope")
    })
    expect(mechanicalReleaseGates).toHaveLength(8)
  })

  it("accepts complete evidence for review but never self-authorizes fabrication", () => {
    const complete = Object.fromEntries(Object.keys(currentMechanicalEvidence).map((key) => [key, true]))
    expect(evaluateMechanicalEnvelope(complete)).toEqual({
      fabricationApproved: false,
      status: "pass",
      failedGates: []
    })
  })

  it("cannot pass while any physical PCB model disagrees with the envelope", () => {
    const otherwiseComplete = Object.fromEntries(Object.keys(currentMechanicalEvidence).map((key) => [key, true]))
    const mismatched = { ...otherwiseComplete, physicalBoardModelsMatchEnvelope: false }
    expect(evaluateMechanicalEnvelope(mismatched)).toEqual({
      fabricationApproved: false,
      status: "deny",
      failedGates: ["physicalBoardModelsMatchEnvelope"]
    })
  })

  it("rejects malformed, incomplete, extra, and non-boolean evidence", () => {
    for (const malformed of [null, 3, "ready", [], {}]) {
      expect(() => evaluateMechanicalEnvelope(malformed)).toThrow()
    }
    expect(() => evaluateMechanicalEnvelope({ ...currentMechanicalEvidence, panelMeasured: "yes" })).toThrow(TypeError)
    expect(() => evaluateMechanicalEnvelope({ ...currentMechanicalEvidence, fabricated: true })).toThrow(RangeError)
  })

  it("accepts only plain objects with exact enumerable data properties", () => {
    const accessor = { ...currentMechanicalEvidence }
    Object.defineProperty(accessor, "panelMeasured", {
      enumerable: true,
      get: () => {
        throw new Error("accessor must not execute")
      }
    })
    expect(() => evaluateMechanicalEnvelope(accessor)).toThrow(RangeError)

    const hidden = { ...currentMechanicalEvidence }
    Object.defineProperty(hidden, "panelMeasured", { enumerable: false, value: false })
    expect(() => evaluateMechanicalEnvelope(hidden)).toThrow(RangeError)

    const symbolic = { ...currentMechanicalEvidence }
    Object.defineProperty(symbolic, Symbol("evidence-extension"), { enumerable: true, value: true })
    expect(() => evaluateMechanicalEnvelope(symbolic)).toThrow(RangeError)

    const customPrototype = Object.create({ panelMeasured: false })
    Object.assign(customPrototype, currentMechanicalEvidence)
    expect(() => evaluateMechanicalEnvelope(customPrototype)).toThrow(TypeError)
    expect(() => evaluateMechanicalEnvelope(Object.create(null))).toThrow(TypeError)

    const alias = { ...currentMechanicalEvidence, panel_measured: false }
    Reflect.deleteProperty(alias, "panelMeasured")
    expect(() => evaluateMechanicalEnvelope(alias)).toThrow(RangeError)
  })
})
