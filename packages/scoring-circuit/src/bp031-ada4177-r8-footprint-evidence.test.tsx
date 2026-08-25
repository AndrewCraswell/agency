import { describe, expect, it } from "vitest"
import {
  Bp031Ada4177R8ProjectFootprint,
  bp031Ada4177R8FootprintEvidence,
  validateBp031Ada4177R8FootprintEvidence
} from "./bp031-ada4177-r8-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isSmtPad(element: CircuitElement): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isCourtyardRect(element: CircuitElement): element is Extract<CircuitElement, { type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

describe("BP-031 ADA4177-1ARZ R-8 footprint evidence", () => {
  it("retains exact primary sources and a deny-by-default CAD disposition", () => {
    expect(validateBp031Ada4177R8FootprintEvidence()).toEqual([])
    expect(bp031Ada4177R8FootprintEvidence).toMatchObject({
      artifactKind: "bp031-ada4177-1arz-r8-footprint-evidence",
      workUnit: "BP-031",
      manufacturerPartNumber: "ADA4177-1ARZ",
      package: {
        option: "R-8",
        designation: "8-Lead Standard Small Outline Package [SOIC_N] Narrow Body",
        boardPlaneBodyLengthMm: { minimum: 4.8, maximum: 5.0 },
        bodyWidthMm: { minimum: 3.8, maximum: 4.0 },
        overallLeadSpanMm: { minimum: 5.8, maximum: 6.2 },
        packageHeightMm: { minimum: 1.35, maximum: 1.75 },
        leadPitchMm: 1.27,
        leadLengthMm: { minimum: 0.4, maximum: 1.27 },
        leadWidthMm: { minimum: 0.31, maximum: 0.51 },
        packageStandard: "JEDEC MS-012-AA",
        drawingIdentifier: "012407-A"
      },
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      partnerCad: {
        providersListedByAdi: ["Ultra Librarian", "SamacSys"],
        availability: "listed-by-adi-not-retrieved",
        retainedArtifactPath: null,
        sha256: null,
        authority: "deny"
      },
      projectFootprint: {
        state: "review-only",
        orientationStatus: "pending-independent-review",
        fabricationAuthority: "deny",
        accepted: false
      }
    })
    expect(bp031Ada4177R8FootprintEvidence.package).not.toHaveProperty("bodyLengthMm")
    expect(bp031Ada4177R8FootprintEvidence.package).not.toHaveProperty("overallHeightMm")
    expect(bp031Ada4177R8FootprintEvidence.sources).toEqual([
      expect.objectContaining({
        id: "adi-ada4177-datasheet-rev-e",
        revision: "E",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-ada4177-datasheet-rev-e.pdf",
        sha256: "363C6BB4B4DB88F197F4FB3A0D286CD041FB492B9BFD1900382078B1489078CC"
      }),
      expect.objectContaining({
        id: "adi-r-8-package-outline",
        drawingIdentifier: "012407-A",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-r-8-package-outline.pdf",
        sha256: "83932339A984A08A714727BA5F7F836B6451B9194C3C8DAD160FF4408F28FCAF"
      }),
      expect.objectContaining({
        id: "adi-90-0096-s8-land-pattern-rev-m",
        revision: "M",
        artifactPath:
          "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-90-0096-soicn-land-pattern-rev-m.pdf",
        sha256: "17E97CC5CD3B6348EB44142CDE0F65AC53414F2B963AE6ECC77E9C31D7880729"
      })
    ])
  })

  it("reconciles S8 to R-8 without treating the family recommendation as exact approval", () => {
    expect(bp031Ada4177R8FootprintEvidence.landPatternReconciliation).toMatchObject({
      legacyDesignation: "S8",
      r8Designation: "R-8",
      applicability: "family-reference-only",
      exactAda4177Approval: false,
      padLengthMm: { nominal: 1.98, tolerance: 0.02 },
      padWidthMm: { nominal: 0.53, tolerance: 0.02 },
      rowCenterSpanMm: { nominal: 4.93, tolerance: 0.02 },
      padPitchMm: 1.27
    })
    expect(bp031Ada4177R8FootprintEvidence.landPatternReconciliation.reconciliation).toContain(
      "not an exact ADA4177-specific approval"
    )
  })

  it("maps the source pin-one datum to exact review pads and checks the project courtyard", () => {
    const { pinOneOrientation, projectFootprint } = bp031Ada4177R8FootprintEvidence
    expect(pinOneOrientation).toMatchObject({
      topViewPinOneDatum: "lower-left pin-one identifier",
      topViewNumbering:
        "pins 1 through 4 run left-to-right on the lower edge; pins 5 through 8 return right-to-left on the upper edge",
      projectBoardRotationDegrees: 0,
      projectPinOnePad: { pin: 1, xMm: -1.905, yMm: -2.465 },
      independentOrientationReview: "pending"
    })
    expect(projectFootprint.pads).toEqual([
      { pin: 1, xMm: -1.905, yMm: -2.465 },
      { pin: 2, xMm: -0.635, yMm: -2.465 },
      { pin: 3, xMm: 0.635, yMm: -2.465 },
      { pin: 4, xMm: 1.905, yMm: -2.465 },
      { pin: 5, xMm: 1.905, yMm: 2.465 },
      { pin: 6, xMm: 0.635, yMm: 2.465 },
      { pin: 7, xMm: -0.635, yMm: 2.465 },
      { pin: 8, xMm: -1.905, yMm: 2.465 }
    ])
    expect(projectFootprint.courtyard).toEqual({
      centerMm: { x: 0, y: 0 },
      minimumXMm: -2.75,
      maximumXMm: 2.75,
      minimumYMm: -3.705,
      maximumYMm: 3.705,
      widthMm: 5.5,
      heightMm: 7.41,
      minimumClearanceMm: 0.25,
      sourceStatus: "not-published",
      status: "project-review-input"
    })
  })

  it("renders eight exact project pads and the review-only courtyard", () => {
    const json = renderTestCircuit(<Bp031Ada4177R8ProjectFootprint />)
    const pads = json.filter(isSmtPad)
    expect(pads).toHaveLength(8)
    expect(pads.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
      { x: -1.905, y: -2.465, width: 0.53, height: 1.98 },
      { x: -0.635, y: -2.465, width: 0.53, height: 1.98 },
      { x: 0.635, y: -2.465, width: 0.53, height: 1.98 },
      { x: 1.905, y: -2.465, width: 0.53, height: 1.98 },
      { x: 1.905, y: 2.465, width: 0.53, height: 1.98 },
      { x: 0.635, y: 2.465, width: 0.53, height: 1.98 },
      { x: -0.635, y: 2.465, width: 0.53, height: 1.98 },
      { x: -1.905, y: 2.465, width: 0.53, height: 1.98 }
    ])
    expect(pads[0].port_hints).toEqual(expect.arrayContaining(["1", "pin1", "lower-left"]))
    const renderedPadEnvelope = {
      minimumXMm: Math.min(...pads.map(({ x, width }) => x - width / 2)),
      maximumXMm: Math.max(...pads.map(({ x, width }) => x + width / 2)),
      minimumYMm: Math.min(...pads.map(({ y, height }) => y - height / 2)),
      maximumYMm: Math.max(...pads.map(({ y, height }) => y + height / 2))
    }
    const packageEnvelope = bp031Ada4177R8FootprintEvidence.maximumPackageEnvelope
    const clearanceMm = bp031Ada4177R8FootprintEvidence.projectFootprint.courtyard.minimumClearanceMm
    const expectedCourtyard = {
      minimumXMm: Math.min(renderedPadEnvelope.minimumXMm, packageEnvelope.minimumXMm) - clearanceMm,
      maximumXMm: Math.max(renderedPadEnvelope.maximumXMm, packageEnvelope.maximumXMm) + clearanceMm,
      minimumYMm: Math.min(renderedPadEnvelope.minimumYMm, packageEnvelope.minimumYMm) - clearanceMm,
      maximumYMm: Math.max(renderedPadEnvelope.maximumYMm, packageEnvelope.maximumYMm) + clearanceMm
    }
    const courtyard = bp031Ada4177R8FootprintEvidence.projectFootprint.courtyard
    expect(courtyard).toMatchObject({
      ...expectedCourtyard,
      widthMm: expectedCourtyard.maximumXMm - expectedCourtyard.minimumXMm,
      heightMm: expectedCourtyard.maximumYMm - expectedCourtyard.minimumYMm
    })
    expect(json.filter(isCourtyardRect)).toEqual([
      expect.objectContaining({ center: { x: 0, y: 0 }, width: courtyard.widthMm, height: courtyard.heightMm })
    ])
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })
})
