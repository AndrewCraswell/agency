import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp033Tpd4s201RgrProjectFootprint,
  bp033Tpd4s201RgrProjectFootprintGeometry,
  validateBp033Tpd4s201RgrProjectFootprintGeometry
} from "./bp033-tpd4s201-rgr-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type RectSmtPad = Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }>
type RectSolderPaste = Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }>
type CourtyardRect = Extract<CircuitElement, { readonly type: "pcb_courtyard_rect" }>

function isRectSmtPad(element: CircuitElement): element is RectSmtPad {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectSolderPaste(element: CircuitElement): element is RectSolderPaste {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function isCourtyardRect(element: CircuitElement): element is CourtyardRect {
  return element.type === "pcb_courtyard_rect"
}

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033Tpd4s201RgrProjectFootprint />)
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderProjectFootprint()) {
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
    if (isCourtyardRect(element)) {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

function area(element: { readonly height: number; readonly width: number }) {
  return element.width * element.height
}

describe("BP-033 TPD4S201TRGRRQ1 RGR project footprint", () => {
  it("binds the exact canonical reference, orderable, RGR package, source bytes, and denied authority", () => {
    expect(validateBp033Tpd4s201RgrProjectFootprintGeometry()).toEqual([])
    expect(bp033Tpd4s201RgrProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-033",
      reference: "U_USB_PORT_PROTECT",
      referenceAliases: {
        canonical: "U_USB_PORT_PROTECT",
        ledgerAlias: "U_USB_CC_SBU_PROTECT",
        disposition: "ledger-alias-only"
      },
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPD4S201TRGRRQ1",
      orderablePartNumber: "TPD4S201TRGRRQ1",
      devicePartNumber: "TPD4S201-Q1",
      package: {
        designation: "VQFN (RGR), 20-pin",
        legacyApplicationLabel: "VQFN-20 (RGR), 3.5mm x 3.5mm nominal body",
        sourceDesignation: "RGR (VQFN, 20)",
        packageDrawing: "RGR0020C",
        bodySizeMm: { minimum: 3.35, nominal: 3.5, maximum: 3.65 },
        landPatternSpanMm: 3.3,
        heightMaximumMm: 1,
        pitchMm: 0.5,
        perimeterPinCount: 20,
        exposedPad: { id: "21", net: "GND", widthMm: 2.05, heightMm: 2.05 }
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, sha256: null, authority: "deny" },
      acceptance: {
        packageIdentityReviewed: true,
        packageDrawingReviewed: true,
        pinFunctionsReviewed: true,
        manufacturerLandPatternCaptured: true,
        projectGeometryAccepted: false,
        pinOneOrientationAccepted: false,
        cadImportAccepted: false,
        boardImportAccepted: false,
        boardFitAccepted: false,
        drcAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    const source = bp033Tpd4s201RgrProjectFootprintGeometry.sources[0]
    if (source === undefined) throw new Error("retained TI source is missing")
    expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    expect(source).toMatchObject({
      document: "TPD4S201-Q1 USB Type-C 20V SPR Port Protector datasheet, SLVSI17, June 2025",
      url: "https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf",
      reviewedPages: "1, 3-4, 21, 26-28",
      pagePurposes: {
        exactOrderableAndPackage: "1, 21",
        pinMapAndFunctions: "3-4",
        rgrPackageOutline: "26",
        rgrBoardLayout: "27",
        rgrStencil: "28"
      }
    })
  })

  it("binds TI pins to the canonical circuit ports, including FLT_N and suffixed GND/NC ports", () => {
    expect(bp033Tpd4s201RgrProjectFootprintGeometry.circuitPortAliases).toEqual([
      { tiPin: 1, tiName: "C_SBU1", circuitPort: "C_SBU1" },
      { tiPin: 2, tiName: "C_SBU2", circuitPort: "C_SBU2" },
      { tiPin: 3, tiName: "VBIAS", circuitPort: "VBIAS" },
      { tiPin: 4, tiName: "C_CC1", circuitPort: "C_CC1" },
      { tiPin: 5, tiName: "C_CC2", circuitPort: "C_CC2" },
      { tiPin: 6, tiName: "RPD_G2", circuitPort: "RPD_G2" },
      { tiPin: 7, tiName: "RPD_G1", circuitPort: "RPD_G1" },
      { tiPin: 8, tiName: "GND", circuitPort: "GND_8" },
      { tiPin: 9, tiName: "FLT", circuitPort: "FLT_N" },
      { tiPin: 10, tiName: "VPWR", circuitPort: "VPWR" },
      { tiPin: 11, tiName: "CC2", circuitPort: "CC2" },
      { tiPin: 12, tiName: "CC1", circuitPort: "CC1" },
      { tiPin: 13, tiName: "GND", circuitPort: "GND_13" },
      { tiPin: 14, tiName: "SBU2", circuitPort: "SBU2" },
      { tiPin: 15, tiName: "SBU1", circuitPort: "SBU1" },
      { tiPin: 16, tiName: "NC", circuitPort: "NC_16" },
      { tiPin: 17, tiName: "NC", circuitPort: "NC_17" },
      { tiPin: 18, tiName: "GND", circuitPort: "GND_18" },
      { tiPin: 19, tiName: "NC", circuitPort: "NC_19" },
      { tiPin: 20, tiName: "NC", circuitPort: "NC_20" },
      { tiPin: 21, tiName: "GND", circuitPort: "THERMAL_GND" }
    ])
  })

  it("preserves the TI top-view counter-clockwise pin map and RGR copper land geometry", () => {
    const evidence = bp033Tpd4s201RgrProjectFootprintGeometry
    expect(evidence.terminals).toEqual([
      { pin: 1, name: "C_SBU1", side: "left", xMm: -1.35, yMm: 1, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 2, name: "C_SBU2", side: "left", xMm: -1.35, yMm: 0.5, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 3, name: "VBIAS", side: "left", xMm: -1.35, yMm: 0, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 4, name: "C_CC1", side: "left", xMm: -1.35, yMm: -0.5, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 5, name: "C_CC2", side: "left", xMm: -1.35, yMm: -1, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 6, name: "RPD_G2", side: "bottom", xMm: -1, yMm: -1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 7, name: "RPD_G1", side: "bottom", xMm: -0.5, yMm: -1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 8, name: "GND", side: "bottom", xMm: 0, yMm: -1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 9, name: "FLT", side: "bottom", xMm: 0.5, yMm: -1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 10, name: "VPWR", side: "bottom", xMm: 1, yMm: -1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 11, name: "CC2", side: "right", xMm: 1.35, yMm: -1, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 12, name: "CC1", side: "right", xMm: 1.35, yMm: -0.5, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 13, name: "GND", side: "right", xMm: 1.35, yMm: 0, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 14, name: "SBU2", side: "right", xMm: 1.35, yMm: 0.5, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 15, name: "SBU1", side: "right", xMm: 1.35, yMm: 1, copperWidthMm: 0.6, copperHeightMm: 0.24 },
      { pin: 16, name: "NC", side: "top", xMm: 1, yMm: 1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 17, name: "NC", side: "top", xMm: 0.5, yMm: 1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 18, name: "GND", side: "top", xMm: 0, yMm: 1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 19, name: "NC", side: "top", xMm: -0.5, yMm: 1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 },
      { pin: 20, name: "NC", side: "top", xMm: -1, yMm: 1.35, copperWidthMm: 0.24, copperHeightMm: 0.6 }
    ])
    expect(evidence.exposedPad).toMatchObject({
      id: "21",
      name: "GND",
      xMm: 0,
      yMm: 0,
      copperWidthMm: 2.05,
      copperHeightMm: 2.05
    })
    expect(evidence.orientation).toMatchObject({
      boardRotationDegrees: 0,
      pinOne: { id: "1", xMm: -1.35, yMm: 1 },
      numbering: "counter-clockwise in TI top view",
      independentlyReviewed: false,
      accepted: false
    })
    expect(evidence.projectSelection).toMatchObject({
      solderMask: { marginMm: 0.07, accepted: false },
      solderPaste: {
        stencilThicknessMm: 0.125,
        perimeterAperture: { widthMm: 0.56, heightMm: 0.24, count: 20 },
        thermalApertures: { count: 4, widthMm: 0.92, heightMm: 0.92, printedAreaPercent: 81 },
        accepted: false
      },
      courtyard: { widthMm: 4.15, heightMm: 4.15, minimumClearanceMm: 0.25, accepted: false }
    })
  })

  it("renders 20 perimeter pads, exposed pad, review courtyard, and the area-only thermal paste approximation", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(21)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -1.35, y: 1, width: 0.6, height: 0.24, soldermask_margin: 0.07 }),
        expect.objectContaining({ x: -1.35, y: -1, width: 0.6, height: 0.24, soldermask_margin: 0.07 }),
        expect.objectContaining({ x: 1.35, y: 1, width: 0.6, height: 0.24, soldermask_margin: 0.07 }),
        expect.objectContaining({ x: 0, y: 0, width: 2.05, height: 2.05, soldermask_margin: 0.07 })
      ])
    )
    const paste = json.filter(isRectSolderPaste)
    expect(paste).toHaveLength(21)
    const perimeterPaste = paste.filter((aperture) => aperture.x !== 0 || aperture.y !== 0)
    expect(perimeterPaste).toHaveLength(20)
    for (const terminal of bp033Tpd4s201RgrProjectFootprintGeometry.terminals) {
      const aperture = perimeterPaste.find(({ x, y }) => x === terminal.xMm && y === terminal.yMm)
      if (aperture === undefined) throw new Error(`RGR perimeter paste is missing at pin ${terminal.pin}`)
      const longAxis = terminal.copperWidthMm > terminal.copperHeightMm ? "width" : "height"
      const shortAxis = longAxis === "width" ? "height" : "width"
      expect(aperture).toMatchObject({
        x: terminal.xMm,
        y: terminal.yMm,
        [longAxis]: 0.56,
        [shortAxis]: 0.24
      })
    }
    const thermalPad = pads.find((pad) => pad.x === 0 && pad.y === 0)
    const thermalPaste = paste.find((aperture) => aperture.x === 0 && aperture.y === 0)
    if (thermalPad === undefined || thermalPaste === undefined) throw new Error("RGR thermal render is incomplete")
    expect(area(thermalPaste) / area(thermalPad)).toBeCloseTo(0.81, 6)
    expect(json).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pcb_courtyard_rect", center: { x: 0, y: 0 }, width: 4.15, height: 4.15 })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("hashes the rendered review geometry and fails closed when identity or CAD authority is tampered", () => {
    expect(renderedGeometryHash()).toBe("6fa9a9c5018a1e1d9498032c2691e7aff50c0e0c9b2daa3acd4982cb21db4ac7")
    const tampered = structuredClone(
      bp033Tpd4s201RgrProjectFootprintGeometry
    ) as unknown as typeof bp033Tpd4s201RgrProjectFootprintGeometry
    Reflect.set(tampered.terminals[0], "xMm", 0)
    Reflect.set(tampered.referenceAliases, "ledgerAlias", "U_USB_PORT_PROTECT")
    Reflect.set(tampered.circuitPortAliases[8], "circuitPort", "FLT")
    Reflect.set(tampered.manufacturerCad, "authority", "allow")
    expect(validateBp033Tpd4s201RgrProjectFootprintGeometry(tampered)).toEqual(
      expect.arrayContaining([
        "exact BP-033 TPD4S201TRGRRQ1 identity drifted",
        "RGR terminal 1 identity or geometry drifted",
        "TI-to-circuit port alias map drifted",
        "RGR manufacturer CAD must remain explicitly unacquired and denied"
      ])
    )

    const forgedSource = structuredClone(
      bp033Tpd4s201RgrProjectFootprintGeometry
    ) as unknown as typeof bp033Tpd4s201RgrProjectFootprintGeometry
    Reflect.set(forgedSource.sources[0], "document", "forged source")
    Reflect.set(forgedSource.sources[0], "url", "https://example.invalid/forged.pdf")
    expect(validateBp033Tpd4s201RgrProjectFootprintGeometry(forgedSource)).toEqual(
      expect.arrayContaining(["retained TI primary source binding is incomplete"])
    )

    const acceptedReviewInput = structuredClone(
      bp033Tpd4s201RgrProjectFootprintGeometry
    ) as unknown as typeof bp033Tpd4s201RgrProjectFootprintGeometry
    Reflect.set(acceptedReviewInput.projectSelection.solderMask, "accepted", true)
    Reflect.set(acceptedReviewInput.projectSelection.solderPaste, "accepted", true)
    Reflect.set(acceptedReviewInput.projectSelection.courtyard, "accepted", true)
    expect(validateBp033Tpd4s201RgrProjectFootprintGeometry(acceptedReviewInput)).toEqual(
      expect.arrayContaining(["RGR mask, paste, or courtyard review inputs drifted"])
    )

    const denyStateMutations = [
      {
        name: "artifactKind",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate, "artifactKind", "forged-artifact"),
        error: "RGR artifact kind drifted"
      },
      {
        name: "package.bodySizeSource",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.package, "bodySizeSource", "forged source"),
        error: "RGR package body source note drifted"
      },
      {
        name: "package.canonicalLabelDiscrepancy",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.package, "canonicalLabelDiscrepancy", "forged discrepancy"),
        error: "RGR canonical package-label discrepancy note drifted"
      },
      {
        name: "manufacturerCad.reason",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.manufacturerCad, "reason", "forged CAD reason"),
        error: "RGR manufacturer CAD reason drifted"
      },
      {
        name: "projectSelection.authority",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.projectSelection, "authority", "forged authority"),
        error: "RGR project-selection authority note drifted"
      },
      {
        name: "projectSelection.solderMask.perimeterOpeningNote",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.projectSelection.solderMask, "perimeterOpeningNote", "forged mask note"),
        error: "RGR solder-mask source note drifted"
      },
      {
        name: "projectSelection.solderPaste.renderedApproximation.disposition",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(
            candidate.projectSelection.solderPaste.renderedApproximation,
            "disposition",
            "forged paste disposition"
          ),
        error: "RGR rendered thermal-paste disposition drifted"
      },
      {
        name: "projectSelection.courtyard.disposition",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.projectSelection.courtyard, "disposition", "forged courtyard disposition"),
        error: "RGR courtyard disposition drifted"
      },
      {
        name: "exposedPad.thermalViaPolicy",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.exposedPad, "thermalViaPolicy", "uncontrolled"),
        error: "RGR exposed pad identity, geometry, or thermal via policy drifted"
      },
      {
        name: "copper.exposedPads",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.copper, "exposedPads", []),
        error: "RGR copper state or exposed-pad array drifted"
      },
      {
        name: "copper.state",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.copper, "state", "project-review-input"),
        error: "RGR copper state or exposed-pad array drifted"
      },
      {
        name: "orientation.pinOne.sourceDatum",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.orientation.pinOne, "sourceDatum", "forged datum"),
        error: "RGR pin-one datum or orientation review state drifted"
      },
      {
        name: "solderPaste.renderedApproximation.thermalPadSymmetricMarginMm",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.projectSelection.solderPaste.renderedApproximation, "thermalPadSymmetricMarginMm", 0),
        error: "RGR rendered thermal-paste approximation drifted"
      },
      {
        name: "orientation.accepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.orientation, "accepted", true),
        error: "RGR pin-one datum or orientation review state drifted"
      },
      {
        name: "acceptance.projectGeometryAccepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "projectGeometryAccepted", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.pinOneOrientationAccepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "pinOneOrientationAccepted", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.cadImportAccepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "cadImportAccepted", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.boardImportAccepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "boardImportAccepted", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.boardFitAccepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "boardFitAccepted", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.drcAccepted",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "drcAccepted", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.fabricationAuthorized",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "fabricationAuthorized", true),
        error: "RGR candidate must remain review-only and fabrication-denied"
      },
      {
        name: "acceptance.releaseState",
        mutate: (candidate: typeof bp033Tpd4s201RgrProjectFootprintGeometry) =>
          Reflect.set(candidate.acceptance, "releaseState", "allow"),
        error: "RGR candidate must remain review-only and fabrication-denied"
      }
    ] as const
    for (const mutation of denyStateMutations) {
      const tamperedDenyState = structuredClone(
        bp033Tpd4s201RgrProjectFootprintGeometry
      ) as unknown as typeof bp033Tpd4s201RgrProjectFootprintGeometry
      mutation.mutate(tamperedDenyState)
      expect(validateBp033Tpd4s201RgrProjectFootprintGeometry(tamperedDenyState), mutation.name).toContain(
        mutation.error
      )
    }
  })
})
