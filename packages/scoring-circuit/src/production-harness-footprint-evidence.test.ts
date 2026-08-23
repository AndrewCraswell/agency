import { describe, expect, it } from "vitest"
import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import {
  canReleaseProductionHarnessFootprint,
  productionHarnessFootprintEvidence,
  validateProductionHarnessFootprintEvidence
} from "./production-harness-footprint-evidence.js"
import { productionHarnessSelection } from "./production-harness-selection.js"

describe("production harness footprint evidence", () => {
  it("covers the four selected scoring-board headers exactly once and remains a DNP review model", () => {
    expect(validateProductionHarnessFootprintEvidence()).toEqual([])
    expect(productionHarnessFootprintEvidence.map((record) => record.mpn)).toEqual([
      "43650-0200",
      "43650-0300",
      "43650-0400",
      "39-29-1067"
    ])

    for (const record of productionHarnessFootprintEvidence) {
      const selection = productionHarnessSelection.find((candidate) => candidate.connector.headerMpn === record.mpn)
      const gate = fabricationFootprintGates.find((candidate) => candidate.mpn === record.mpn)
      expect(record.releaseState).toBe("deny")
      expect(canReleaseProductionHarnessFootprint(record)).toBe(false)
      expect(selection?.boardReference).toBe(record.boardReference)
      expect(gate?.references).toEqual([record.boardReference])
      expect(record.independentVerification).toEqual({
        assemblyProcessQualified: false,
        cadOverlayComplete: false,
        enclosureKeepoutVerified: false,
        fabricationPreviewChecked: false,
        physicalMateTested: false
      })
    }
  })

  it("transcribes only the source-backed grid, holes, orientation, board thickness, and Micro-Fit edge limit", () => {
    const [piste, leftWeapon, rightWeapon, primaryOutputs] = productionHarnessFootprintEvidence
    expect(piste).toMatchObject({
      boardThickness: { recommendationMm: 1.57 },
      copper: { contactCount: 2, contactGridPitchMm: 3, exactLandGeometry: "not-published" },
      keepout: { boardEdgeMaximumMm: 10.16 },
      holes: [
        { layoutHoleDiameterMm: 1.02, layoutHoleToleranceMm: 0.05, xMm: 0, yMm: 0 },
        { layoutHoleDiameterMm: 1.02, layoutHoleToleranceMm: 0.05, xMm: 3, yMm: 0 }
      ]
    })
    expect(leftWeapon.body.drawingDimensionsMm).toEqual({ A: 12.65, B: 6, C: undefined })
    expect(rightWeapon.body.drawingDimensionsMm).toEqual({ A: 15.65, B: 9, C: 4.7 })
    expect(primaryOutputs).toMatchObject({
      assemblyProcess: { manufacturerCapability: "not-published", selectedProcess: "not-qualified" },
      boardThickness: { recommendationMm: 1.78 },
      body: { drawingDimensionsMm: { A: 23.8, B: 8.4, C: 13.8 } },
      copper: { contactCount: 6, contactGridPitchMm: 4.2, exactLandGeometry: "not-published" },
      paste: { sourceStatus: "not-published" }
    })
    expect(primaryOutputs.holes.filter((hole) => hole.role === "contact")).toHaveLength(6)
    expect(primaryOutputs.holes.filter((hole) => hole.role === "retention-or-mounting")).toHaveLength(2)
    expect(primaryOutputs.holes.map((hole) => hole.layoutHoleDiameterMm)).toEqual([
      1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 3.2, 3.2
    ])
    expect(primaryOutputs.orientation.circuitOne).toContain("SD-5569-002")
  })

  it("rejects mismatched references, an inferred release, incomplete source records, or nonphysical holes", () => {
    const mismatchedReference = productionHarnessFootprintEvidence.map((record, index) =>
      index === 0 ? { ...record, boardReference: "J_WEAPON_HARNESS_L" as const } : record
    )
    expect(validateProductionHarnessFootprintEvidence(mismatchedReference)).toEqual(
      expect.arrayContaining(["43650-0200: record must match the selected board reference"])
    )

    const inferredRelease = productionHarnessFootprintEvidence.map((record, index) =>
      index === 0
        ? { ...record, independentVerification: { ...record.independentVerification, cadOverlayComplete: true } }
        : record
    )
    expect(validateProductionHarnessFootprintEvidence(inferredRelease)).toEqual(
      expect.arrayContaining(["43650-0200: CAD overlay must not be claimed complete"])
    )

    const missingDrawing = productionHarnessFootprintEvidence.map((record, index) =>
      index === 3
        ? { ...record, primarySources: record.primarySources.filter((source) => source.kind !== "product-drawing") }
        : record
    )
    expect(validateProductionHarnessFootprintEvidence(missingDrawing)).toEqual(
      expect.arrayContaining(["39-29-1067: manufacturer drawing is required"])
    )

    const invalidHole = productionHarnessFootprintEvidence.map((record, index) =>
      index === 1
        ? { ...record, holes: [{ ...record.holes[0], layoutHoleDiameterMm: Number.NaN }, ...record.holes.slice(1)] }
        : record
    )
    expect(validateProductionHarnessFootprintEvidence(invalidHole)).toEqual(
      expect.arrayContaining(["43650-0300: hole diameter must be positive"])
    )
  })

  it("rejects drift in every exact per-MPN geometry, mate, process, source, and verification contract", () => {
    const canonicalError = "39-29-1067: evidence must exactly match the reviewed per-MPN canonical record"
    const cases = [
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, copper: { ...record.copper, contactCount: 8 } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, copper: { ...record.copper, contactGridPitchMm: 4 } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, boardThickness: { ...record.boardThickness, recommendationMm: 1.6 } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? { ...record, body: { ...record.body, drawingDimensionsMm: { A: 23.8, B: 17.4, C: 13.8 } } }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, body: { ...record.body, drawingDimensionsMm: { A: 24, B: 8.4, C: 13.8 } } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, body: { ...record.body, drawingDimensionsMm: { A: 23.8, B: 8.4, C: 14 } } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, keepout: { ...record.keepout, boardEdgeMaximumMm: 10.16 } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? {
              ...record,
              holes: record.holes.map((hole, holeIndex) => (holeIndex === 0 ? { ...hole, xMm: 0.1 } : hole))
            }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? {
              ...record,
              holes: record.holes.map((hole, holeIndex) =>
                holeIndex === 0 ? { ...hole, layoutHoleToleranceMm: 0.1 } : hole
              )
            }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, holes: record.holes.slice(0, 7) } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? {
              ...record,
              holes: record.holes.map((hole, holeIndex) =>
                holeIndex === 6 ? { ...hole, layoutHoleDiameterMm: 3.3 } : hole
              )
            }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? {
              ...record,
              holes: record.holes.map((hole, holeIndex) =>
                holeIndex === 6 ? { ...hole, layoutHoleToleranceMm: 0.2 } : hole
              )
            }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, mates: ["39-01-2060", "substituted-terminal"] } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? { ...record, orientation: { ...record.orientation, circuitOne: "uncontrolled orientation" } }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3 ? { ...record, paste: { ...record.paste, statement: "unsupported pin-in-paste process" } } : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? {
              ...record,
              primarySources: record.primarySources.map((source, sourceIndex) =>
                sourceIndex === 0 ? { ...source, url: "https://example.invalid/substitution.pdf" } : source
              )
            }
          : record
      ),
      productionHarnessFootprintEvidence.map((record, index) =>
        index === 3
          ? {
              ...record,
              primarySources: record.primarySources.map((source, sourceIndex) =>
                sourceIndex === 0 ? { ...source, revision: "uncontrolled revision" } : source
              )
            }
          : record
      )
    ]

    for (const records of cases) {
      expect(validateProductionHarnessFootprintEvidence(records)).toContain(canonicalError)
    }
  })

  it.each(productionHarnessFootprintEvidence)("applies the exact canonical comparison to $mpn", (canonical) => {
    const records = productionHarnessFootprintEvidence.map((record) =>
      record.mpn === canonical.mpn ? { ...record, mates: [...record.mates, "unreviewed-mate"] } : record
    )
    expect(validateProductionHarnessFootprintEvidence(records)).toContain(
      `${canonical.mpn}: evidence must exactly match the reviewed per-MPN canonical record`
    )
  })

  it.each([
    "assemblyProcessQualified",
    "cadOverlayComplete",
    "enclosureKeepoutVerified",
    "fabricationPreviewChecked",
    "physicalMateTested"
  ] as const)("rejects a true %s verification flag", (flag) => {
    const records = productionHarnessFootprintEvidence.map((record, index) =>
      index === 3
        ? {
            ...record,
            independentVerification: { ...record.independentVerification, [flag]: true }
          }
        : record
    )
    expect(validateProductionHarnessFootprintEvidence(records)).toContain(
      "39-29-1067: evidence must exactly match the reviewed per-MPN canonical record"
    )
  })
})
