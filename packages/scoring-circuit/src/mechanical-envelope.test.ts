import { describe, expect, it } from "vitest"
import {
  connectorPlacementContract,
  currentPhysicalPreviewMismatch,
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

  it("records the separate main-board planning models and the unresolved communications model", () => {
    expect(currentPhysicalPreviewMismatch.communicationsBoundaryConnectivity).toBe("integrated")
    expect(currentPhysicalPreviewMismatch.physicalThreeBoardLayout).toBe("partially-integrated")
    expect(currentPhysicalPreviewMismatch.communicationsPreview).toMatchObject({
      current: { widthMm: 100, heightMm: 70, layers: 4, finishedThicknessMm: "not-modeled" },
      planned: { widthMm: 110, heightMm: 55, layers: 4, finishedThicknessMm: 0.8 },
      matchesEnvelope: false
    })
    expect(currentPhysicalPreviewMismatch.separateMainBoardModels).toMatchObject({
      current: {
        physicalAssemblyCount: 2,
        scoringBoard: { widthMm: 290, heightMm: 70, layers: 6, finishedThicknessMm: 1.6 },
        applicationBoard: { widthMm: 290, heightMm: 135, layers: 6, finishedThicknessMm: 1.6 }
      },
      planned: { physicalAssemblyCount: 2, scoringBoardLayers: 6, applicationBoardLayers: 6 },
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
      failedGates: Object.keys(currentMechanicalEvidence)
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
})
