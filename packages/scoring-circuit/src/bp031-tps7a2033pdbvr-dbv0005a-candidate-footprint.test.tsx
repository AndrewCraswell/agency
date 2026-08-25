import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import {
  bp031Tps7a2033PdbvrDbv0005aCandidateFootprint,
  Bp031Tps7a2033PdbvrDbv0005aCandidateFootprint,
  validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint
} from "./bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
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

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderedFootprint(Bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
    if (isRectSolderPaste(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-031 TI TPS7A2033PDBVR DBV0005A SOT-23-5 candidate footprint", () => {
  it("binds the exact orderable, package, retained TI source, and denied CAD disposition", () => {
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint()).toEqual([])
    expect(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint).toMatchObject({
      artifactKind: "bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint",
      workUnit: "BP-031",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPS7A2033PDBVR",
      sourceContract: "BP-100",
      affectedReferences: ["U_3V3"],
      sourceBinding: {
        canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        canonicalSourceReference: "U_3V3",
        manufacturer: "Texas Instruments",
        manufacturerPartNumber: "TPS7A2033PDBVR",
        package: "DBV SOT-23-5",
        sourceContract: "BP-100"
      },
      sourceControl: {
        basisCommit: "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c",
        upstreamSources: [
          {
            path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
            sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
          },
          {
            path: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
            sha256: "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
          },
          {
            path: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
            sha256: "1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d"
          }
        ]
      },
      package: {
        family: "SOT-23",
        option: "DBV",
        pinCount: 5,
        drawingIdentifier: "DBV0005A",
        drawingDocument: "SBVS338H",
        drawingRevision: "K",
        embeddedDrawingRevision: "4214839/K 08/2024"
      },
      manufacturerCad: {
        state: "not-acquired",
        authority: "deny",
        availability: "not-established-from-retained-m4-04-evidence",
        retainedArtifactPath: null,
        sha256: null,
        disposition: "not-acquired-no-substitute"
      },
      projectFootprint: {
        state: "review-only",
        orientationStatus: "pending-independent-review",
        fabricationAuthority: "deny",
        accepted: false
      },
      artwork: {
        state: "generated-project-review-only",
        representation: "canonical-rendered-footprint-soup-geometry",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: expect.any(String),
        authority: "deny"
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint.sourceBinding).toEqual({
      canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
      canonicalSourceReference: "U_3V3",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPS7A2033PDBVR",
      package: "DBV SOT-23-5",
      sourceContract: "BP-100"
    })
    expect(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint.sourceControl).toEqual({
      basisCommit: "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
        },
        {
          path: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
          sha256: "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
        },
        {
          path: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
          sha256: "1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d"
        }
      ]
    })
    expect(oneChannelAnalogExperimentBom.find((part) => String(part.reference) === "U_3V3")).toBeUndefined()
    expect(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint.sources[0]).toMatchObject({
      reviewedPages: "4, 45, 60-62",
      orderableStatus: "Active",
      addendum: {
        title: "PACKAGE OPTION ADDENDUM",
        page: 45,
        orderable: "TPS7A2033PDBVR",
        package: "SOT-23 (DBV) | 5",
        status: "Active"
      }
    })
    expect(renderedGeometryHash()).toBe(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint.artwork.sha256)
  })
  it("retains the exact TI source bytes and hash", () => {
    expect(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint.sources).toEqual([
      expect.objectContaining({
        id: "ti-tps7a20-dbvr-datasheet-rev-h",
        revision: "H",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf",
        sha256: "6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1"
      })
    ])
    for (const source of bp031Tps7a2033PdbvrDbv0005aCandidateFootprint.sources) {
      expect(evidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("retains the exact DBV0005A copper, NSMD mask, equal-size paste, and pin-one orientation", () => {
    const {
      landPattern,
      package: packageMetadata,
      pinOneOrientation,
      projectFootprint
    } = bp031Tps7a2033PdbvrDbv0005aCandidateFootprint
    expect(packageMetadata).toMatchObject({
      bodyWidthMm: { minimum: 1.45, maximum: 1.75 },
      bodyLengthMm: { minimum: 2.75, maximum: 3.05 },
      overallLeadSpanMm: { minimum: 2.6, maximum: 3.0 },
      packageHeightMm: { maximum: 1.45 },
      leadPitchMm: 0.95,
      leadWidthMm: { minimum: 0.3, maximum: 0.5 },
      leadLengthMm: { minimum: 0.3, maximum: 0.6 },
      standard: "JEDEC MO-178",
      supportPinMayDiffer: true
    })
    expect(landPattern).toMatchObject({
      copper: {
        padLengthMm: 1.1,
        padWidthMm: 0.6,
        rowCenterSpanMm: 2.6,
        padPitchMm: 0.95,
        roundedCornerRadiusMm: 0.05,
        status: "manufacturer-drawing-example"
      },
      solderMask: {
        selectedDefinition: "non-solder-mask-defined",
        marginMm: 0.07,
        openingLengthMm: 1.24,
        openingWidthMm: 0.74
      },
      paste: {
        stencilThicknessMm: 0.125,
        openingLengthMm: 1.1,
        openingWidthMm: 0.6,
        reductionPerEdgeMm: 0
      }
    })
    expect(pinOneOrientation).toMatchObject({
      sourceTopViewPinOneDatum: "pin 1 identifier at upper-left in TI DBV top view",
      projectBoardRotationDegrees: 0,
      projectPinOnePad: { pin: 1, xMm: -1.3, yMm: 0.95 },
      independentOrientationReview: "pending"
    })
    expect(projectFootprint.pads).toEqual([
      { pin: 1, xMm: -1.3, yMm: 0.95, function: "IN" },
      { pin: 2, xMm: -1.3, yMm: 0, function: "GND" },
      { pin: 3, xMm: -1.3, yMm: -0.95, function: "EN" },
      { pin: 4, xMm: 1.3, yMm: -0.95, function: "N/C" },
      { pin: 5, xMm: 1.3, yMm: 0.95, function: "OUT" }
    ])
    expect(projectFootprint.courtyard).toMatchObject({
      centerMm: { x: 0, y: 0 },
      minimumXMm: -2.1,
      maximumXMm: 2.1,
      minimumYMm: -1.775,
      maximumYMm: 1.775,
      widthMm: 4.2,
      heightMm: 3.55,
      minimumClearanceMm: 0.25,
      sourceStatus: "not-published",
      status: "project-review-input"
    })
  })

  it("renders five TI-aligned pads, solder mask, paste, and the derived review courtyard", () => {
    const elements = renderedFootprint(Bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    const pads = elements.filter(isRectSmtPad)
    const paste = elements.filter(isRectSolderPaste)
    const courtyard = elements.find((element) => element.type === "pcb_courtyard_rect")

    expect(pads).toHaveLength(5)
    expect(paste).toHaveLength(5)
    expect(courtyard).toBeDefined()
    expect(
      pads.map(({ x, y, width, height, soldermask_margin }) => ({ x, y, width, height, soldermask_margin }))
    ).toEqual([
      { x: -1.3, y: 0.95, width: 1.1, height: 0.6, soldermask_margin: 0.07 },
      { x: -1.3, y: 0, width: 1.1, height: 0.6, soldermask_margin: 0.07 },
      { x: -1.3, y: -0.95, width: 1.1, height: 0.6, soldermask_margin: 0.07 },
      { x: 1.3, y: -0.95, width: 1.1, height: 0.6, soldermask_margin: 0.07 },
      { x: 1.3, y: 0.95, width: 1.1, height: 0.6, soldermask_margin: 0.07 }
    ])
    expect(pads[0]?.port_hints).toEqual(expect.arrayContaining(["1", "IN", "pin1-upper-left"]))
    expect(paste.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual(
      pads.map(({ x, y }) => ({ x, y, width: 1.1, height: 0.6 }))
    )
    expect(courtyard).toMatchObject({ center: { x: 0, y: 0 }, width: 4.2, height: 3.55 })
    expect(elements.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("fails closed if exact identity, CAD uncertainty, courtyard, or fabrication denial drifts", () => {
    const identityDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(identityDrift, "manufacturerPartNumber", "TPS7A2033PDBVR.A")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(identityDrift)).toContain(
      "exact BP-031 TI TPS7A2033PDBVR identity drifted"
    )

    const acceptedDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(acceptedDrift.projectFootprint, "accepted", true)
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(acceptedDrift)).toContain(
      "CAD uncertainty and fabrication denial must remain fail-closed"
    )

    const cadDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(cadDrift.manufacturerCad, "state", "acquired")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(cadDrift)).toContain(
      "CAD uncertainty and fabrication denial must remain fail-closed"
    )

    const courtyardDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(courtyardDrift.projectFootprint.courtyard, "widthMm", 4.19)
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(courtyardDrift)).toContain(
      "project courtyard must enclose TI package/pads and retain not-published status"
    )

    const upstreamDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(upstreamDrift.sourceBinding, "canonicalSourceReference", "U_NEGATIVE_RAIL")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(upstreamDrift)).toContain(
      "BP-100 U_3V3 exact-reference source binding drifted"
    )

    const sourcePageDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(sourcePageDrift.sources[0], "reviewedPages", "4, 60-62")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(sourcePageDrift)).toContain(
      "exact retained TI TPS7A20 source is required"
    )

    const addendumDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(addendumDrift.sources[0].addendum, "status", "Obsolete")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(addendumDrift)).toContain(
      "exact retained TI TPS7A20 source is required"
    )

    const pinMapDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(pinMapDrift.datasheetPinMap[0], "function", "OUT")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(pinMapDrift)).toContain(
      "datasheet pin map does not preserve TI DBV top-view pin mapping"
    )

    const landPatternDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(landPatternDrift.landPattern.copper, "padLengthMm", 1.09)
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(landPatternDrift)).toContain(
      "TI DBV0005A copper, mask, or paste dimensions drifted"
    )

    const orientationDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(orientationDrift.pinOneOrientation, "sourceTopViewPinOneDatum", "lower-right")
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(orientationDrift)).toContain(
      "TI pin-one orientation or project rotation drifted"
    )

    const artworkDrift = structuredClone(bp031Tps7a2033PdbvrDbv0005aCandidateFootprint)
    Reflect.set(artworkDrift.artwork, "sha256", "0".repeat(64))
    expect(validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(artworkDrift)).toContain(
      "CAD uncertainty and fabrication denial must remain fail-closed"
    )
  })
})
