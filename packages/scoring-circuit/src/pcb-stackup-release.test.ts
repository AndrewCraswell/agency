import { describe, expect, it } from "vitest"
import {
  comparePcbVendorCapabilities,
  currentStackupReleaseInput,
  evaluateStackupRelease,
  fabricationVendors,
  sixLayerBoardReleaseRequirements,
  type StackupReleaseInput
} from "./pcb-stackup-release.js"

describe("six-layer PCB stackup release decision", () => {
  it("records the exact six-layer production targets", () => {
    expect(sixLayerBoardReleaseRequirements.boardIds).toEqual(["SCORING_IO_BOARD", "APPLICATION_DISPLAY_CARRIER"])
    expect(sixLayerBoardReleaseRequirements.layerCount).toBe(6)
    expect(sixLayerBoardReleaseRequirements.finishedThicknessMm).toBe(1.6)
    expect(sixLayerBoardReleaseRequirements.finishedThicknessToleranceMm).toBe(0.1)
    expect(sixLayerBoardReleaseRequirements.minimumTraceWidthMm).toBe(0.25)
    expect(sixLayerBoardReleaseRequirements.minimumClearanceMm).toBe(0.25)
    expect(sixLayerBoardReleaseRequirements.minimumFinishedHoleMm).toBe(0.3)
    expect(sixLayerBoardReleaseRequirements.minimumFinishedAnnularRingMm).toBe(0.3)
    expect(sixLayerBoardReleaseRequirements.minimumComponentAnnularRingMm).toBe(0.35)
    expect(sixLayerBoardReleaseRequirements.minimumCopperToRoutedEdgeMm).toBe(0.3)
    expect(sixLayerBoardReleaseRequirements.minimumSoldermaskBridgeMm).toBe(0.25)
    expect(sixLayerBoardReleaseRequirements.minimumNonPlatedSlotWidthMm).toBe(1.5)
    expect(sixLayerBoardReleaseRequirements.maximumBoardOutlineToleranceMm).toBe(0.2)
    expect(sixLayerBoardReleaseRequirements.layerOrder.map((layer) => layer.copperOz)).toEqual([2, 1, 1, 1, 1, 2])
    expect(sixLayerBoardReleaseRequirements.minimumTgC).toBe(155)
    expect(sixLayerBoardReleaseRequirements.controlledImpedance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ netClass: "USB2_HIGH_SPEED", targetOhms: 90 }),
        expect.objectContaining({ netClass: "ETHERNET_PHY", targetOhms: 100 })
      ])
    )
    expect(sixLayerBoardReleaseRequirements.isolation).toMatchObject({
      slotWidthTargetMm: 4,
      creepageTargetMm: 8,
      clearanceTargetMm: 4,
      copperKeepoutTargetMm: 4
    })
    expect(sixLayerBoardReleaseRequirements.current).toMatchObject({
      v5ContinuousAmps: 5.39,
      v5ShortScreenAmps: 6.09,
      hardEfuseBoundAmps: 8.12,
      blockedVentAmbientC: 50
    })
  })

  it("compares two current primary-source vendor candidates without selecting either", () => {
    expect(fabricationVendors.JLCPCB.sourceUrls.every((url) => url.includes("jlcpcb.com"))).toBe(true)
    expect(fabricationVendors.PCBWAY.sourceUrls).toEqual(
      expect.arrayContaining([
        "https://www.pcbway.com/capabilities.html",
        "https://www.pcbway.com/advanced-pcb-capabilities.html"
      ])
    )
    const comparison = comparePcbVendorCapabilities()
    expect(comparison.map((candidate) => candidate.vendor)).toEqual(["JLCPCB", "PCBWAY"])
    expect(comparison.every((candidate) => candidate.layerCountFit && candidate.thicknessNominalFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.geometryFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.traceSpaceFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.finishedHoleFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.annularRingFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.copperToEdgeFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.soldermaskFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.slotWidthFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.dimensionalToleranceFit)).toBe(true)
    expect(comparison.every((candidate) => candidate.gaps.length > 0)).toBe(true)
    expect(comparison.find((candidate) => candidate.vendor === "JLCPCB")?.gaps).toEqual(
      expect.arrayContaining(["supplier-confirmed isolation-slot position tolerance"])
    )
    expect(comparison.find((candidate) => candidate.vendor === "PCBWAY")?.gaps).toEqual(
      expect.arrayContaining([
        "supplier acceptance of the +/-0.10 mm finished-thickness target",
        "supplier-confirmed isolation-slot position tolerance"
      ])
    )
    expect(fabricationVendors.JLCPCB.twoOzOuterGeometry.releaseBaseline).toMatchObject({
      minTraceWidthMm: 0.16,
      minTraceSpaceMm: 0.16,
      minViaAnnularRingMm: 0.254
    })
    expect(fabricationVendors.JLCPCB.twoOzOuterGeometry.alternatePublishedClass).toMatchObject({
      minTraceWidthMm: 0.15,
      minTraceSpaceMm: 0.15,
      minViaAnnularRingMm: 0.254
    })
    expect(fabricationVendors.PCBWAY.twoOzOuterGeometry.releaseBaseline).toMatchObject({
      minTraceWidthMm: 0.1778,
      minTraceSpaceMm: 0.2032,
      minViaAnnularRingMm: 0.1778
    })
    expect(fabricationVendors.PCBWAY.twoOzOuterGeometry.alternatePublishedClass).toMatchObject({
      minTraceWidthMm: 0.1524,
      minTraceSpaceMm: 0.1778,
      minViaAnnularRingMm: 0.1524
    })
    expect(fabricationVendors.JLCPCB.minCopperToRoutedEdgeMm).toBe(0.2)
    expect(fabricationVendors.PCBWAY.minCopperToRoutedEdgeMm).toBe(0.25)
    expect(fabricationVendors.JLCPCB.minSoldermaskBridgeMm).toBe(0.2)
    expect(fabricationVendors.PCBWAY.minSoldermaskBridgeMm).toBe(0.0762)
    expect(fabricationVendors.JLCPCB.minPlatedSlotWidthMm).toBe(0.35)
    expect(fabricationVendors.PCBWAY.minPlatedSlotWidthMm).toBe(0.5)
    expect(fabricationVendors.JLCPCB.finishedPthHoleTolerancePositiveMm).toBe(0.13)
    expect(fabricationVendors.PCBWAY.finishedPthHoleTolerancePositiveMm).toBe(0.08)
    expect(fabricationVendors.JLCPCB.slotPositionToleranceMm).toBeNull()
    expect(fabricationVendors.PCBWAY.slotPositionToleranceMm).toBeNull()
  })

  it("does not call unsupported cross-vendor geometry a fit", () => {
    const tooTight = {
      ...sixLayerBoardReleaseRequirements,
      minimumCopperToRoutedEdgeMm: 0.15
    }
    const comparison = comparePcbVendorCapabilities(tooTight as typeof sixLayerBoardReleaseRequirements)
    expect(comparison.every((candidate) => candidate.geometryFit === false)).toBe(true)
    expect(comparison.every((candidate) => candidate.copperToEdgeFit === false)).toBe(true)
  })

  it("keeps drill-tool capability separate from finished-hole capability", () => {
    const tooTight = {
      ...sixLayerBoardReleaseRequirements,
      minimumViaDrillMm: 0.1
    }
    const comparison = comparePcbVendorCapabilities(tooTight as typeof sixLayerBoardReleaseRequirements)
    expect(comparison.every((candidate) => candidate.finishedHoleFit === false)).toBe(true)
    expect(comparison.every((candidate) => candidate.geometryFit === false)).toBe(true)
  })

  it("fails closed before vendor, stackup, outline, and supplier review are explicit", () => {
    const result = evaluateStackupRelease()
    expect(result).toMatchObject({ status: "deny", fabricationApproved: false })
    expect(result.checks.filter((check) => check.status === "deny").map((check) => check.id)).toEqual(
      expect.arrayContaining([
        "vendor-selection",
        "supplier-review",
        "solved-stackup",
        "isolation-tolerance",
        "scoring_io_board-outline-datum",
        "application_display_carrier-outline-datum"
      ])
    )
  })

  it("does not pass with a selected vendor until all release evidence is accepted", () => {
    const partial: StackupReleaseInput = {
      ...currentStackupReleaseInput,
      vendor: "PCBWAY",
      vendorSelectionRecorded: true,
      supplierReviewAccepted: true,
      solvedStackupProvided: true,
      layerOrderMatches: true,
      dielectricMaterialAndTgRecorded: true,
      finishedThicknessAndToleranceAccepted: true,
      copperWeightsAccepted: true,
      soldermaskAndFinishAccepted: true,
      outlineEvidence: [
        {
          board: "SCORING_IO_BOARD",
          revision: "REL-001",
          outlineReleased: true,
          datumReleased: true,
          toleranceReleased: true,
          mountingHoleTableReleased: true,
          connectorCoordinateTableReleased: true
        },
        {
          board: "APPLICATION_DISPLAY_CARRIER",
          revision: "REL-001",
          outlineReleased: true,
          datumReleased: true,
          toleranceReleased: true,
          mountingHoleTableReleased: true,
          connectorCoordinateTableReleased: true
        }
      ]
    }
    const result = evaluateStackupRelease(partial)
    expect(result.status).toBe("deny")
    expect(result.fabricationApproved).toBe(false)
    expect(result.checks.find((check) => check.id === "impedance-and-coupons")?.status).toBe("open")
    expect(result.checks.find((check) => check.id === "isolation-tolerance")?.status).toBe("deny")
  })

  it("can evaluate complete evidence while keeping fabrication authorization separate", () => {
    const complete: StackupReleaseInput = {
      ...currentStackupReleaseInput,
      vendor: "PCBWAY",
      vendorSelectionRecorded: true,
      supplierReviewAccepted: true,
      solvedStackupProvided: true,
      layerOrderMatches: true,
      dielectricMaterialAndTgRecorded: true,
      finishedThicknessAndToleranceAccepted: true,
      copperWeightsAccepted: true,
      impedanceFieldSolverAndCouponsAccepted: true,
      soldermaskAndFinishAccepted: true,
      isolationSlotAndCreepageToleranceAccepted: true,
      currentAndThermalEvidenceAccepted: true,
      dfmAndPanelizationAccepted: true,
      acceptanceCriteriaRecorded: true,
      outlineEvidence: [
        {
          board: "SCORING_IO_BOARD",
          revision: "REL-001",
          outlineReleased: true,
          datumReleased: true,
          toleranceReleased: true,
          mountingHoleTableReleased: true,
          connectorCoordinateTableReleased: true
        },
        {
          board: "APPLICATION_DISPLAY_CARRIER",
          revision: "REL-001",
          outlineReleased: true,
          datumReleased: true,
          toleranceReleased: true,
          mountingHoleTableReleased: true,
          connectorCoordinateTableReleased: true
        }
      ]
    }
    const result = evaluateStackupRelease(complete)
    expect(result.status).toBe("pass")
    expect(result.fabricationApproved).toBe(false)
    expect(result.checks.every((check) => check.status === "pass")).toBe(true)
  })

  it("rejects malformed decisions and malformed outline evidence", () => {
    expect(() => evaluateStackupRelease(null as never)).toThrow(TypeError)
    expect(() => evaluateStackupRelease({ ...currentStackupReleaseInput, vendor: "UNKNOWN" } as never)).toThrow(
      TypeError
    )
    expect(() =>
      evaluateStackupRelease({ ...currentStackupReleaseInput, vendorSelectionRecorded: "yes" } as never)
    ).toThrow(TypeError)
    expect(() =>
      evaluateStackupRelease({
        ...currentStackupReleaseInput,
        outlineEvidence: [{ board: "SCORING_IO_BOARD" }]
      } as never)
    ).toThrow(TypeError)
    expect(() =>
      evaluateStackupRelease({ ...currentStackupReleaseInput, outlineEvidence: [{ board: "UNKNOWN" }] } as never)
    ).toThrow(TypeError)
    expect(() =>
      evaluateStackupRelease({
        ...currentStackupReleaseInput,
        outlineEvidence: [
          {
            board: "SCORING_IO_BOARD",
            revision: "A",
            outlineReleased: true,
            datumReleased: true,
            toleranceReleased: true,
            mountingHoleTableReleased: true,
            connectorCoordinateTableReleased: true
          },
          {
            board: "SCORING_IO_BOARD",
            revision: "B",
            outlineReleased: true,
            datumReleased: true,
            toleranceReleased: true,
            mountingHoleTableReleased: true,
            connectorCoordinateTableReleased: true
          }
        ]
      } as never)
    ).toThrow(RangeError)
  })
})
