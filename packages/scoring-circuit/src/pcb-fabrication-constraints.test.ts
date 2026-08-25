import { describe, expect, it } from "vitest"
import {
  currentPcbModelInput,
  evaluatePcbFabricationConstraints,
  pcbFabricationContract,
  type PcbFabricationInput
} from "./pcb-fabrication-constraints.js"
import { sixLayerBoardReleaseRequirements } from "./pcb-stackup-release.js"

describe("PCB fabrication constraints", () => {
  it("defines a six-layer mixed-signal stack with split domain references", () => {
    expect(pcbFabricationContract.topology.requiredPhysicalAssemblyCount).toBe(3)
    expect(pcbFabricationContract.topology.assemblies.map((assembly) => assembly.layerCount)).toEqual([6, 6, 4])
    expect(pcbFabricationContract.stackups.scoringIoBoard).toHaveLength(6)
    expect(pcbFabricationContract.stackups.applicationDisplayCarrier).toHaveLength(6)
    expect(pcbFabricationContract.stackups.communicationsModule).toHaveLength(4)
    expect(pcbFabricationContract.stackups.applicationDisplayCarrier.map((layer) => layer.copperOz)).toEqual([
      2, 1, 1, 1, 1, 2
    ])
    expect(pcbFabricationContract.designRules).toMatchObject({
      minimumTrackWidthMm: 0.25,
      minimumClearanceMm: 0.25,
      minimumViaDrillMm: 0.3,
      minimumFinishedAnnularRingMm: 0.3,
      minimumComponentAnnularRingMm: 0.35,
      minimumPlatedSlotWidthMm: 0.75,
      minimumNonPlatedSlotWidthMm: 1.5,
      minimumCopperToRoutedEdgeMm: 0.3,
      minimumSoldermaskBridgeMm: 0.25,
      maximumBoardOutlineToleranceMm: 0.2
    })
    expect(pcbFabricationContract.stackups.scoringIoBoard[1].role).toContain("APP_GND")
    expect(pcbFabricationContract.stackups.scoringIoBoard[1].role).toContain("SCORING_SGND")
    expect(pcbFabricationContract.designRules.projectIsolationCreepageTargetMm).toBeGreaterThan(
      pcbFabricationContract.designRules.projectIsolationClearanceTargetMm
    )
  })

  it("projects shared release floors while retaining fabrication-local fields", () => {
    const sharedCopperWeights = sixLayerBoardReleaseRequirements.layerOrder.map((layer) => layer.copperOz)

    expect(pcbFabricationContract.board).toMatchObject({
      outerCopperOz: sixLayerBoardReleaseRequirements.outerCopperOz,
      innerCopperOz: sixLayerBoardReleaseRequirements.innerCopperOz
    })
    expect(pcbFabricationContract.stackups.scoringIoBoard.map((layer) => layer.copperOz)).toEqual(sharedCopperWeights)
    expect(pcbFabricationContract.stackups.applicationDisplayCarrier.map((layer) => layer.copperOz)).toEqual(
      sharedCopperWeights
    )
    expect(pcbFabricationContract.designRules).toMatchObject({
      minimumTrackWidthMm: sixLayerBoardReleaseRequirements.minimumTraceWidthMm,
      minimumClearanceMm: sixLayerBoardReleaseRequirements.minimumClearanceMm,
      minimumViaDrillMm: sixLayerBoardReleaseRequirements.minimumViaDrillMm,
      minimumFinishedHoleMm: sixLayerBoardReleaseRequirements.minimumFinishedHoleMm,
      minimumFinishedAnnularRingMm: sixLayerBoardReleaseRequirements.minimumFinishedAnnularRingMm,
      minimumComponentAnnularRingMm: sixLayerBoardReleaseRequirements.minimumComponentAnnularRingMm,
      minimumPlatedSlotWidthMm: sixLayerBoardReleaseRequirements.minimumPlatedSlotWidthMm,
      minimumNonPlatedSlotWidthMm: sixLayerBoardReleaseRequirements.minimumNonPlatedSlotWidthMm,
      minimumCopperToRoutedEdgeMm: sixLayerBoardReleaseRequirements.minimumCopperToRoutedEdgeMm,
      minimumSoldermaskBridgeMm: sixLayerBoardReleaseRequirements.minimumSoldermaskBridgeMm,
      maximumTraceWidthTolerancePercent: sixLayerBoardReleaseRequirements.maximumTraceWidthTolerancePercent,
      maximumFinishedPthHoleTolerancePositiveMm:
        sixLayerBoardReleaseRequirements.maximumFinishedPthHoleTolerancePositiveMm,
      maximumFinishedPthHoleToleranceNegativeMm:
        sixLayerBoardReleaseRequirements.maximumFinishedPthHoleToleranceNegativeMm,
      maximumHolePositionToleranceMm: sixLayerBoardReleaseRequirements.maximumHolePositionToleranceMm,
      maximumBoardOutlineToleranceMm: sixLayerBoardReleaseRequirements.maximumBoardOutlineToleranceMm,
      projectIsolationSlotWidthTargetMm: sixLayerBoardReleaseRequirements.isolation.slotWidthTargetMm,
      projectIsolationSlotWidthToleranceMm: sixLayerBoardReleaseRequirements.isolation.slotWidthToleranceMm,
      projectIsolationCreepageTargetMm: sixLayerBoardReleaseRequirements.isolation.creepageTargetMm,
      projectIsolationClearanceTargetMm: sixLayerBoardReleaseRequirements.isolation.clearanceTargetMm,
      projectIsolationCopperKeepoutTargetMm: sixLayerBoardReleaseRequirements.isolation.copperKeepoutTargetMm,
      powerEntryClearanceMm: 0.3,
      switchNodeToQuietCopperKeepoutMm: 2
    })
    expect(
      pcbFabricationContract.impedanceTargets.map(({ netClass, targetOhms, tolerancePercent }) => ({
        netClass,
        targetOhms,
        tolerancePercent
      }))
    ).toEqual(sixLayerBoardReleaseRequirements.controlledImpedance)
    expect(pcbFabricationContract.impedanceTargets.every((target) => target.routing.length > 0)).toBe(true)
  })

  it("keeps the current architectural model denied without overstating fabrication readiness", () => {
    const result = evaluatePcbFabricationConstraints()

    expect(result.constraintStatus).toBe("deny")
    expect(result.fabricationApproved).toBe(false)
    expect(result.checks.find((check) => check.id === "physical-topology")?.status).toBe("pass")
    expect(result.checks.find((check) => check.id === "scoring-board-stackup")?.status).toBe("pass")
    expect(result.checks.find((check) => check.id === "application-board-stackup")?.status).toBe("pass")
    expect(result.checks.find((check) => check.id === "scoring-board-thickness")?.status).toBe("open")
    expect(result.checks.find((check) => check.id === "application-board-thickness")?.status).toBe("open")
    expect(result.checks.find((check) => check.id === "usb-c-carrier-thickness")?.status).toBe("open")
    expect(result.checks.find((check) => check.id === "assembly-boundary")?.status).toBe("deny")
    expect(result.checks.find((check) => check.id === "high-speed-interconnect")?.status).toBe("open")
    expect(result.checks.find((check) => check.id === "exact-footprints")?.status).toBe("deny")
    expect(result.checks.find((check) => check.id === "routing")?.status).toBe("open")
    expect(result.checks.find((check) => check.id === "drc")?.status).toBe("open")
  })

  it("accepts the contract only when the physical evidence inputs are complete", () => {
    const completeInput: PcbFabricationInput = {
      physicalAssemblyCount: 3,
      scoringBoardLayerCount: 6,
      scoringBoardThicknessMm: 1.6,
      scoringBoardThicknessModeled: true,
      applicationBoardLayerCount: 6,
      applicationBoardThicknessMm: 1.6,
      applicationBoardThicknessModeled: true,
      communicationsModuleLayerCount: 4,
      usbCModuleThicknessMm: 0.8,
      communicationsModuleThicknessModeled: true,
      assemblyBoundaryReviewed: true,
      highSpeedInterconnectQualified: true,
      exactFootprintsImported: true,
      isolationSlotPresent: true,
      externalAntennaPathQualified: true,
      manufacturerStackupApproved: true,
      routed: true,
      drcClean: true,
      thermalValidationComplete: true,
      chassisBondReviewed: true
    }

    const result = evaluatePcbFabricationConstraints(completeInput)

    expect(result.constraintStatus).toBe("pass")
    expect(result.fabricationApproved).toBe(false)
    expect(result.checks.every((check) => check.status === "pass")).toBe(true)
  })

  it("fails closed for malformed physical inputs", () => {
    expect(() => evaluatePcbFabricationConstraints(null as never)).toThrow(TypeError)
    expect(() =>
      evaluatePcbFabricationConstraints({ ...currentPcbModelInput, scoringBoardThicknessMm: Number.NaN })
    ).toThrow(RangeError)
    expect(() => evaluatePcbFabricationConstraints({ ...currentPcbModelInput, physicalAssemblyCount: 0 })).toThrow(
      RangeError
    )
    expect(() => evaluatePcbFabricationConstraints({ ...currentPcbModelInput, routed: "yes" as never })).toThrow(
      TypeError
    )
  })

  it("requires the high-current branch, ESD return, and impedance contracts", () => {
    expect(pcbFabricationContract.highCurrentInterface.selectedV5ContinuousAmps).toBe(5.39)
    expect(pcbFabricationContract.highCurrentInterface.selectedV5ShortScreenAmps).toBe(6.09)
    expect(pcbFabricationContract.highCurrentInterface.hardEfuseBoundAmps).toBe(8.12)
    expect(pcbFabricationContract.highCurrentInterface.connectorCurrentRatingAmps).toBeGreaterThanOrEqual(
      pcbFabricationContract.highCurrentInterface.hardEfuseBoundAmps
    )
    expect(pcbFabricationContract.impedanceTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ netClass: "USB2_HIGH_SPEED", targetOhms: 90, tolerancePercent: 10 }),
        expect.objectContaining({ netClass: "ETHERNET_PHY", targetOhms: 100, tolerancePercent: 10 })
      ])
    )
    expect(pcbFabricationContract.forbiddenCrossings.some((rule) => rule.includes("CHASSIS_OR_ESD_RETURN"))).toBe(true)
    expect(pcbFabricationContract.testPointContract.requiredNets).toContain("SCORING_SGND")
    const chassisZone = pcbFabricationContract.zones.find((zone) => zone.id === "EXTERNAL_IO_CHASSIS")
    const rfZone = pcbFabricationContract.zones.find((zone) => zone.id === "APP_COMPUTE_RF")
    expect(chassisZone?.boundary).toContain("Shielded USB-C, RJ45, and field interfaces")
    expect(chassisZone?.requirements).toContain("body-cord line protection")
    expect(rfZone?.requirements).toContain("external antenna")
  })
})
