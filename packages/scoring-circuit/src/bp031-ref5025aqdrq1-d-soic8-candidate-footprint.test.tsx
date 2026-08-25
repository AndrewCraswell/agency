import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import {
  bp031Ref5025Aqdrq1DSoic8CandidateFootprint,
  Bp031Ref5025Aqdrq1DSoic8CandidateFootprint,
  validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint
} from "./bp031-ref5025aqdrq1-d-soic8-candidate-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type CandidateComponent = () => ReactElement
type RectSmtPad = Extract<CircuitElement, { readonly type: "pcb_smtpad" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly soldermask_margin: number
  readonly port_hints: readonly string[]
}
type RectSolderPaste = Extract<CircuitElement, { readonly type: "pcb_solder_paste" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function isRectSmtPad(element: CircuitElement): element is RectSmtPad {
  return (
    element.type === "pcb_smtpad" &&
    element.shape === "rect" &&
    "x" in element &&
    "y" in element &&
    "width" in element &&
    "height" in element &&
    "soldermask_margin" in element &&
    "port_hints" in element
  )
}

function isRectSolderPaste(element: CircuitElement): element is RectSolderPaste {
  return (
    element.type === "pcb_solder_paste" &&
    element.shape === "rect" &&
    "x" in element &&
    "y" in element &&
    "width" in element &&
    "height" in element
  )
}

function renderedFootprint(Component: CandidateComponent) {
  return renderTestCircuit(<Component />)
}

function evidenceHash(artifactPath: string) {
  const relativeEvidencePath = artifactPath.replace("packages/scoring-circuit/", "../")
  return createHash("sha256")
    .update(readFileSync(new URL(relativeEvidencePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-031 TI REF5025AQDRQ1 D SOIC-8 candidate footprint", () => {
  it("binds the exact orderable, package, retained TI sources, and denied CAD disposition", () => {
    expect(validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint()).toEqual([])
    expect(bp031Ref5025Aqdrq1DSoic8CandidateFootprint).toMatchObject({
      artifactKind: "bp031-ref5025aqdrq1-d-soic8-candidate-footprint",
      workUnit: "BP-031",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "REF5025AQDRQ1",
      package: {
        family: "SOIC",
        option: "D",
        pinCount: 8,
        drawingIdentifier: "D0008A",
        drawingDocumentRevision: "MSOI002K",
        embeddedDrawingRevision: "4214825/C 02/2019"
      },
      manufacturerCad: {
        state: "not-acquired",
        authority: "deny",
        availability: "listed-by-ti-not-retrieved",
        retainedArtifactPath: null,
        sha256: null,
        disposition: "not-acquired-no-substitute"
      },
      projectFootprint: {
        state: "review-only",
        orientationStatus: "pending-independent-review",
        fabricationAuthority: "deny",
        accepted: false
      }
    })
    expect(bp031Ref5025Aqdrq1DSoic8CandidateFootprint.sources).toEqual([
      expect.objectContaining({
        id: "ti-ref50xxa-q1-datasheet-rev-h",
        revision: "H",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-ref50xxa-q1-ref5025aqdrq1-datasheet-rev-h.pdf",
        sha256: "908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B"
      }),
      expect.objectContaining({
        id: "ti-d0008a-soic8-package-outline-rev-k",
        documentNumber: "MSOI002K",
        drawingIdentifier: "D0008A",
        sha256: "E064777954A2161CFB76C801A7F699EEC23A9FB4434ACF27A9DC37E57FF39655"
      })
    ])
    for (const source of bp031Ref5025Aqdrq1DSoic8CandidateFootprint.sources) {
      expect(evidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("retains TI's exact copper, NSMD mask, equal-size paste, and pin-one orientation", () => {
    const { landPattern, pinOneOrientation, projectFootprint } = bp031Ref5025Aqdrq1DSoic8CandidateFootprint
    expect(landPattern).toMatchObject({
      copper: {
        padLengthMm: 1.55,
        padWidthMm: 0.6,
        rowCenterSpanMm: 5.4,
        padPitchMm: 1.27,
        roundedCornerRadiusMm: 0.05,
        status: "manufacturer-drawing-example"
      },
      solderMask: {
        selectedDefinition: "non-solder-mask-defined",
        marginMm: 0.07,
        openingLengthMm: 1.69,
        openingWidthMm: 0.74
      },
      paste: {
        stencilThicknessMm: 0.125,
        openingLengthMm: 1.55,
        openingWidthMm: 0.6,
        reductionPerEdgeMm: 0
      }
    })
    expect(pinOneOrientation).toMatchObject({
      sourceTopViewPinOneDatum: "pin 1 identifier at upper-left in TI top view",
      projectBoardRotationDegrees: 0,
      projectPinOnePad: { pin: 1, xMm: -2.7, yMm: 1.905 },
      independentOrientationReview: "pending"
    })
    expect(projectFootprint.pads).toEqual([
      { pin: 1, xMm: -2.7, yMm: 1.905, function: "DNC" },
      { pin: 2, xMm: -2.7, yMm: 0.635, function: "VIN" },
      { pin: 3, xMm: -2.7, yMm: -0.635, function: "TEMP" },
      { pin: 4, xMm: -2.7, yMm: -1.905, function: "GND" },
      { pin: 5, xMm: 2.7, yMm: -1.905, function: "TRIM/NR" },
      { pin: 6, xMm: 2.7, yMm: -0.635, function: "VOUT" },
      { pin: 7, xMm: 2.7, yMm: 0.635, function: "NC" },
      { pin: 8, xMm: 2.7, yMm: 1.905, function: "DNC" }
    ])
    expect(projectFootprint.courtyard).toMatchObject({
      centerMm: { x: 0, y: 0 },
      minimumXMm: -3.725,
      maximumXMm: 3.725,
      minimumYMm: -2.75,
      maximumYMm: 2.75,
      widthMm: 7.45,
      heightMm: 5.5,
      minimumClearanceMm: 0.25,
      sourceStatus: "not-published",
      status: "project-review-input"
    })
  })

  it("renders eight TI-aligned pads, solder mask, paste, and the derived review courtyard", () => {
    const elements = renderedFootprint(Bp031Ref5025Aqdrq1DSoic8CandidateFootprint)
    const pads = elements.filter(isRectSmtPad)
    const paste = elements.filter(isRectSolderPaste)
    const courtyard = elements.find((element) => element.type === "pcb_courtyard_rect")

    expect(pads).toHaveLength(8)
    expect(paste).toHaveLength(8)
    expect(courtyard).toBeDefined()
    expect(
      pads.map(({ x, y, width, height, soldermask_margin }) => ({ x, y, width, height, soldermask_margin }))
    ).toEqual([
      { x: -2.7, y: 1.905, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: -2.7, y: 0.635, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: -2.7, y: -0.635, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: -2.7, y: -1.905, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: 2.7, y: -1.905, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: 2.7, y: -0.635, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: 2.7, y: 0.635, width: 1.55, height: 0.6, soldermask_margin: 0.07 },
      { x: 2.7, y: 1.905, width: 1.55, height: 0.6, soldermask_margin: 0.07 }
    ])
    expect(pads[0]?.port_hints).toEqual(expect.arrayContaining(["1", "DNC", "pin1-upper-left"]))
    expect(paste.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual(
      pads.map(({ x, y }) => ({ x, y, width: 1.55, height: 0.6 }))
    )
    expect(courtyard).toMatchObject({ center: { x: 0, y: 0 }, width: 7.45, height: 5.5 })
    expect(elements.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("fails closed if exact identity or fabrication denial drifts", () => {
    const identityDrift = structuredClone(bp031Ref5025Aqdrq1DSoic8CandidateFootprint)
    Reflect.set(identityDrift, "manufacturerPartNumber", "REF5025AQDRQ1.A")
    expect(validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint(identityDrift)).toContain(
      "exact BP-031 TI REF5025AQDRQ1 identity drifted"
    )

    const acceptedDrift = structuredClone(bp031Ref5025Aqdrq1DSoic8CandidateFootprint)
    Reflect.set(acceptedDrift.projectFootprint, "accepted", true)
    expect(validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint(acceptedDrift)).toContain(
      "CAD uncertainty and fabrication denial must remain fail-closed"
    )

    const cadDrift = structuredClone(bp031Ref5025Aqdrq1DSoic8CandidateFootprint)
    Reflect.set(cadDrift.manufacturerCad, "state", "acquired")
    expect(validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint(cadDrift)).toContain(
      "CAD uncertainty and fabrication denial must remain fail-closed"
    )

    const courtyardDrift = structuredClone(bp031Ref5025Aqdrq1DSoic8CandidateFootprint)
    Reflect.set(courtyardDrift.projectFootprint.courtyard, "widthMm", 7.44)
    expect(validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint(courtyardDrift)).toContain(
      "project courtyard must enclose TI package/pads and retain not-published status"
    )
  })
})
