import { Fragment, type ReactElement } from "react"

/**
 * Isolated BP-033 review evidence for the exact D_VBUS_TVS orderable.
 *
 * The retained TI datasheet publishes the DRV0006A land pattern, mask options,
 * optional thermal vias, and a segmented stencil example. This module keeps
 * those facts separate from project review geometry. It is intentionally not
 * imported by a board circuit and cannot grant fabrication authority.
 */

type TvsPad = {
  readonly heightMm: number
  readonly id: string
  readonly role: "GND" | "IN"
  readonly widthMm: number
  readonly xMm: number
  readonly yMm: number
}

type TvsPin = TvsPad & { readonly number: number }

const sourceArtifactPath = "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf"
const sourceSha256 = "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801"

/** TI's page-19 board-layout top view: pin 1 is upper-left. */
export const bp033Tvs2200Pins: readonly TvsPin[] = [
  { heightMm: 0.3, id: "1", number: 1, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: 0.65 },
  { heightMm: 0.3, id: "2", number: 2, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: 0 },
  { heightMm: 0.3, id: "3", number: 3, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: -0.65 },
  { heightMm: 0.3, id: "4", number: 4, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: -0.65 },
  { heightMm: 0.3, id: "5", number: 5, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: 0 },
  { heightMm: 0.3, id: "6", number: 6, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: 0.65 }
] as const

const exposedPad = {
  heightMm: 1.6,
  id: "7",
  role: "GND thermal pad",
  widthMm: 1,
  xMm: 0,
  yMm: 0
} as const

const thermalVias = [
  { drillDiameterMm: 0.2, xMm: 0, yMm: -0.55 },
  { drillDiameterMm: 0.2, xMm: 0, yMm: 0.55 }
] as const

const pasteMarginForCoverage = (widthMm: number, heightMm: number, coveragePercent: number): number => {
  const targetArea = widthMm * heightMm * (coveragePercent / 100)
  const perimeter = widthMm + heightMm
  return (perimeter - Math.sqrt(perimeter ** 2 - 4 * (widthMm * heightMm - targetArea))) / 4
}

const exposedPadPasteMarginMm = pasteMarginForCoverage(exposedPad.widthMm, exposedPad.heightMm, 88)
const renderedPasteAperture = {
  coveragePercent: 88,
  heightMm: exposedPad.heightMm - 2 * exposedPadPasteMarginMm,
  marginPerEdgeMm: exposedPadPasteMarginMm,
  widthMm: exposedPad.widthMm - 2 * exposedPadPasteMarginMm,
  xMm: 0,
  yMm: 0
} as const
const pinLabels = Object.fromEntries(
  [...bp033Tvs2200Pins, { ...exposedPad, number: 7 }].map((pad) => [`pin${pad.number}`, pad.id])
)

export const bp033Tvs2200ProjectFootprintGeometry = {
  acceptance: {
    boardFitAccepted: false,
    cadImportAccepted: false,
    electricalPlacementAccepted: false,
    fabricationAuthorized: false,
    independentOrientationAccepted: false,
    projectArtworkRendered: true,
    projectGeometryAccepted: false,
    releaseState: "deny",
    solderMaskAccepted: false,
    solderPasteAccepted: false,
    thermalLayoutAccepted: false
  },
  artifactKind: "bp033-tvs2200-project-footprint",
  boardReferenceAlias: "D_USB_PD_VBUS_TVS",
  copper: {
    cornerRadiusTypMm: 0.05,
    renderDisposition:
      "TI R0.05 TYP is retained as source guidance; the review renderer uses rectangular pads as an explicit bounded approximation.",
    state: "manufacturer-datasheet-land-pattern",
    pads: bp033Tvs2200Pins,
    source: "TI TVS2200 datasheet page 19, DRV0006A example board layout"
  },
  courtyard: {
    clearanceFromNominalBodyMm: 0.3,
    heightMm: 2.6,
    state: "project-review-input-not-manufacturer-data",
    widthMm: 2.6,
    disposition: "TI does not publish a courtyard; this envelope is DRC review input only."
  },
  manufacturerCad: {
    authority: "deny",
    disposition: "datasheet-only-candidate-no-fabrication-release",
    officialCadArtifact: null,
    state: "not-acquired",
    note: "No official TI ECAD or 3D CAD archive is retained by this slice; the PDF is not a CAD import."
  },
  manufacturerLandPattern: {
    copper: {
      cornerRadiusTypMm: 0.05,
      padHeightMm: 0.3,
      padWidthMm: 0.45,
      rowCenterXAbsoluteMm: 0.975,
      rowPitchMm: 0.65,
      rowSpanMm: 1.3,
      exposedPadMm: { heightMm: 1.6, widthMm: 1 }
    },
    sourcePage: 19,
    solderMask: {
      alternativeSmd: {
        definition: "SMD",
        minimumOpeningOverlapPerEdgeMm: 0.07
      },
      preferredNsmd: {
        definition: "NSMD",
        maximumOpeningExpansionPerEdgeMm: 0.07
      },
      sourceStatement:
        "TI shows non-solder-mask-defined metal as preferred with 0.07 mm maximum all around and solder-mask-defined metal as an alternative with 0.07 mm minimum all around."
    },
    thermalVias: {
      drillDiameterMm: 0.2,
      locations: thermalVias,
      policy: "optional-depending-on-application",
      sourceStatement: "TI page 19 notes that vias are optional depending on application and shows these locations."
    }
  },
  manufacturerPartNumber: "TVS2200DRVR",
  package: {
    bodyNominalMm: { heightMaxMm: 0.8, lengthMm: 2, widthMm: 2 },
    designation: "DRV WSON-6 2x2 mm",
    exposedThermalPad: { net: "GND", ...exposedPad },
    packageDrawing: "DRV0006A",
    pinCount: 6,
    family: "WSON-6"
  },
  paste: {
    accepted: false,
    manufacturerExample: {
      apertureCount: 2,
      apertures: [
        { heightMm: 0.7, id: "7A", widthMm: 1, xMm: 0, yMm: 0.45 },
        { heightMm: 0.7, id: "7B", widthMm: 1, xMm: 0, yMm: -0.45 }
      ],
      exposedPadId: "7",
      printedCoveragePercent: 88,
      geometricalCoveragePercent: 87.5,
      sourcePage: 20,
      stencilThicknessMm: 0.125
    },
    renderDisposition:
      "The isolated tscircuit artwork uses one symmetric aperture with the published 88% area; TI's two-aperture segmentation remains source guidance, not a released stencil.",
    renderedAreaEquivalentAperture: renderedPasteAperture,
    state: "manufacturer-example-review-only"
  },
  pinMap: [
    { function: "ground", name: "GND", number: 1 },
    { function: "ground", name: "GND", number: 2 },
    { function: "ground", name: "GND", number: 3 },
    { function: "ESD and surge protected channel", name: "IN", number: 4 },
    { function: "ESD and surge protected channel", name: "IN", number: 5 },
    { function: "ESD and surge protected channel", name: "IN", number: 6 },
    { function: "ground", name: "GND", number: 7 }
  ],
  reference: "D_VBUS_TVS",
  sources: [
    {
      artifactPath: sourceArtifactPath,
      authority: "manufacturer-primary",
      document: "TVS2200 22-V Flat-Clamp Surge Protection Device datasheet",
      drawingApplicability:
        "Exact TVS2200DRVR active orderable, DRV WSON-6 package, pin map, DRV0006A outline, board land pattern, mask options, optional vias, and stencil example.",
      pageCount: 21,
      reviewedPages: "1, 3, 14-20",
      sha256: sourceSha256,
      url: "https://www.ti.com/lit/ds/symlink/tvs2200.pdf"
    }
  ],
  solderMask: {
    accepted: false,
    definition: "NSMD preferred",
    marginPerEdgeMm: 0.07,
    sourcePage: 19,
    state: "manufacturer-guidance-review-only",
    note: "The 0.07 mm value is TI's example limit, not a selected fabricator rule."
  },
  thermal: {
    exposedPadId: "7",
    layoutState: "denied",
    viaLocations: thermalVias,
    viaPolicy: "optional-depending-on-application",
    renderDisposition:
      "The review renderer intentionally emits no drilled or plated-hole objects; the two source-coordinate optional vias remain metadata only until an annular-ring and fabricator rule are selected."
  },
  workUnit: "BP-033",
  orientation: {
    boardRotationDegrees: 0,
    boardView: "top-land-pattern",
    independentlyReviewed: false,
    numbering:
      "counter-clockwise in the TI top-land-pattern view: pins 1-3 left top-to-bottom and pins 4-6 right bottom-to-top.",
    packagePinConfiguration: {
      note: "TI page 3 Figure 6-1 is a bottom view; it is mirrored relative to the page-19 board top-land-pattern view.",
      pinOneLocation: "bottom-left in the datasheet bottom-view figure",
      view: "bottom"
    },
    pinOne: {
      id: "1",
      marker: "TI DRV0006A pin-1 index area",
      sourceDatum: "page-19 board land-pattern upper-left pin",
      xMm: -0.975,
      yMm: 0.65
    }
  }
} as const

function sameLiteral(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true
  if (typeof actual !== "object" || actual === null || typeof expected !== "object" || expected === null) return false
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((entry, index) => sameLiteral(entry, expected[index]))
    )
  }
  const actualRecord = actual as Record<string, unknown>
  const expectedRecord = expected as Record<string, unknown>
  const actualKeys = Object.keys(actualRecord)
  const expectedKeys = Object.keys(expectedRecord)
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(actualRecord, key) && sameLiteral(actualRecord[key], expectedRecord[key]))
  )
}

function requireLiteral(condition: boolean, message: string): void {
  if (!condition) throw new RangeError(`BP-033 TVS2200 literal drift: ${message}`)
}

/** Ensures the evidence object remains the exact, bounded, fail-closed slice. */
export function validateBp033Tvs2200ProjectFootprint(value: unknown = bp033Tvs2200ProjectFootprintGeometry): true {
  if (value === null || typeof value !== "object") throw new RangeError("BP-033 TVS2200 candidate must be an object")
  const candidate = value as typeof bp033Tvs2200ProjectFootprintGeometry
  requireLiteral(candidate.workUnit === "BP-033", "work unit")
  requireLiteral(candidate.reference === "D_VBUS_TVS", "canonical reference")
  requireLiteral(candidate.boardReferenceAlias === "D_USB_PD_VBUS_TVS", "board reference alias")
  requireLiteral(candidate.manufacturerPartNumber === "TVS2200DRVR", "orderable")
  requireLiteral(
    sameLiteral(candidate.sources, [
      {
        artifactPath: "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf",
        authority: "manufacturer-primary",
        document: "TVS2200 22-V Flat-Clamp Surge Protection Device datasheet",
        drawingApplicability:
          "Exact TVS2200DRVR active orderable, DRV WSON-6 package, pin map, DRV0006A outline, board land pattern, mask options, optional vias, and stencil example.",
        pageCount: 21,
        reviewedPages: "1, 3, 14-20",
        sha256: "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801",
        url: "https://www.ti.com/lit/ds/symlink/tvs2200.pdf"
      }
    ]),
    "retained source path, SHA-256, pages, and URL"
  )
  requireLiteral(
    sameLiteral(candidate.copper.pads, [
      { heightMm: 0.3, id: "1", number: 1, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: 0.65 },
      { heightMm: 0.3, id: "2", number: 2, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: 0 },
      { heightMm: 0.3, id: "3", number: 3, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: -0.65 },
      { heightMm: 0.3, id: "4", number: 4, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: -0.65 },
      { heightMm: 0.3, id: "5", number: 5, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: 0 },
      { heightMm: 0.3, id: "6", number: 6, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: 0.65 }
    ]),
    "perimeter terminal roles, coordinates, and dimensions"
  )
  requireLiteral(
    sameLiteral(candidate.package, {
      bodyNominalMm: { heightMaxMm: 0.8, lengthMm: 2, widthMm: 2 },
      designation: "DRV WSON-6 2x2 mm",
      exposedThermalPad: { heightMm: 1.6, id: "7", role: "GND thermal pad", widthMm: 1, xMm: 0, yMm: 0, net: "GND" },
      family: "WSON-6",
      packageDrawing: "DRV0006A",
      pinCount: 6
    }),
    "package body, designation, drawing, pin count, and exposed pad"
  )
  requireLiteral(
    sameLiteral(candidate.pinMap, [
      { function: "ground", name: "GND", number: 1 },
      { function: "ground", name: "GND", number: 2 },
      { function: "ground", name: "GND", number: 3 },
      { function: "ESD and surge protected channel", name: "IN", number: 4 },
      { function: "ESD and surge protected channel", name: "IN", number: 5 },
      { function: "ESD and surge protected channel", name: "IN", number: 6 },
      { function: "ground", name: "GND", number: 7 }
    ]),
    "pin map"
  )
  requireLiteral(
    sameLiteral(candidate.manufacturerLandPattern.thermalVias, {
      drillDiameterMm: 0.2,
      locations: [
        { drillDiameterMm: 0.2, xMm: 0, yMm: -0.55 },
        { drillDiameterMm: 0.2, xMm: 0, yMm: 0.55 }
      ],
      policy: "optional-depending-on-application",
      sourceStatement: "TI page 19 notes that vias are optional depending on application and shows these locations."
    }),
    "thermal-via drill, locations, and policy"
  )
  requireLiteral(
    sameLiteral(candidate.paste.manufacturerExample, {
      apertureCount: 2,
      apertures: [
        { heightMm: 0.7, id: "7A", widthMm: 1, xMm: 0, yMm: 0.45 },
        { heightMm: 0.7, id: "7B", widthMm: 1, xMm: 0, yMm: -0.45 }
      ],
      exposedPadId: "7",
      geometricalCoveragePercent: 87.5,
      printedCoveragePercent: 88,
      sourcePage: 20,
      stencilThicknessMm: 0.125
    }),
    "manufacturer stencil geometry, coverage, and thickness"
  )
  requireLiteral(
    sameLiteral(candidate.paste.renderedAreaEquivalentAperture, {
      coveragePercent: 88,
      heightMm: Number("1.5239281024635393"),
      marginPerEdgeMm: Number("0.038035948768230354"),
      widthMm: 0.9239281024635393,
      xMm: 0,
      yMm: 0
    }),
    "area-equivalent solder-paste margin"
  )
  requireLiteral(
    sameLiteral(candidate.manufacturerLandPattern.solderMask, {
      alternativeSmd: { definition: "SMD", minimumOpeningOverlapPerEdgeMm: 0.07 },
      preferredNsmd: { definition: "NSMD", maximumOpeningExpansionPerEdgeMm: 0.07 },
      sourceStatement:
        "TI shows non-solder-mask-defined metal as preferred with 0.07 mm maximum all around and solder-mask-defined metal as an alternative with 0.07 mm minimum all around."
    }),
    "solder-mask guidance"
  )
  requireLiteral(candidate.manufacturerLandPattern.sourcePage === 19, "manufacturer land-pattern source page")
  requireLiteral(
    sameLiteral(candidate.manufacturerLandPattern.copper, {
      cornerRadiusTypMm: 0.05,
      exposedPadMm: { heightMm: 1.6, widthMm: 1 },
      padHeightMm: 0.3,
      padWidthMm: 0.45,
      rowCenterXAbsoluteMm: 0.975,
      rowPitchMm: 0.65,
      rowSpanMm: 1.3
    }),
    "manufacturer copper dimensions"
  )
  requireLiteral(
    sameLiteral(candidate.solderMask, {
      accepted: false,
      definition: "NSMD preferred",
      marginPerEdgeMm: 0.07,
      note: "The 0.07 mm value is TI's example limit, not a selected fabricator rule.",
      sourcePage: 19,
      state: "manufacturer-guidance-review-only"
    }),
    "solder-mask review disposition"
  )
  requireLiteral(
    sameLiteral(candidate.orientation, {
      boardRotationDegrees: 0,
      boardView: "top-land-pattern",
      independentlyReviewed: false,
      numbering:
        "counter-clockwise in the TI top-land-pattern view: pins 1-3 left top-to-bottom and pins 4-6 right bottom-to-top.",
      packagePinConfiguration: {
        note: "TI page 3 Figure 6-1 is a bottom view; it is mirrored relative to the page-19 board top-land-pattern view.",
        pinOneLocation: "bottom-left in the datasheet bottom-view figure",
        view: "bottom"
      },
      pinOne: {
        id: "1",
        marker: "TI DRV0006A pin-1 index area",
        sourceDatum: "page-19 board land-pattern upper-left pin",
        xMm: -0.975,
        yMm: 0.65
      }
    }),
    "top-land/bottom-view orientation and independent-review gate"
  )
  requireLiteral(
    sameLiteral(candidate.courtyard, {
      clearanceFromNominalBodyMm: 0.3,
      disposition: "TI does not publish a courtyard; this envelope is DRC review input only.",
      heightMm: 2.6,
      state: "project-review-input-not-manufacturer-data",
      widthMm: 2.6
    }),
    "courtyard disposition and dimensions"
  )
  requireLiteral(
    sameLiteral(candidate.manufacturerCad, {
      authority: "deny",
      disposition: "datasheet-only-candidate-no-fabrication-release",
      officialCadArtifact: null,
      state: "not-acquired",
      note: "No official TI ECAD or 3D CAD archive is retained by this slice; the PDF is not a CAD import."
    }),
    "complete manufacturer-CAD disposition"
  )
  requireLiteral(
    sameLiteral(candidate.thermal, {
      exposedPadId: "7",
      layoutState: "denied",
      renderDisposition:
        "The review renderer intentionally emits no drilled or plated-hole objects; the two source-coordinate optional vias remain metadata only until an annular-ring and fabricator rule are selected.",
      viaLocations: [
        { drillDiameterMm: 0.2, xMm: 0, yMm: -0.55 },
        { drillDiameterMm: 0.2, xMm: 0, yMm: 0.55 }
      ],
      viaPolicy: "optional-depending-on-application"
    }),
    "thermal layout denial and via disposition"
  )
  requireLiteral(
    sameLiteral(candidate.acceptance, {
      boardFitAccepted: false,
      cadImportAccepted: false,
      electricalPlacementAccepted: false,
      fabricationAuthorized: false,
      independentOrientationAccepted: false,
      projectArtworkRendered: true,
      projectGeometryAccepted: false,
      releaseState: "deny",
      solderMaskAccepted: false,
      solderPasteAccepted: false,
      thermalLayoutAccepted: false
    }),
    "complete acceptance and release denial"
  )
  requireLiteral(candidate.copper.cornerRadiusTypMm === 0.05, "R0.05 copper source guidance")
  requireLiteral(candidate.solderMask.accepted === false, "solder-mask acceptance denial")
  requireLiteral(candidate.paste.accepted === false, "solder-paste acceptance denial")
  requireLiteral(candidate.paste.state === "manufacturer-example-review-only", "solder-paste review state")
  requireLiteral(
    candidate.paste.renderDisposition ===
      "The isolated tscircuit artwork uses one symmetric aperture with the published 88% area; TI's two-aperture segmentation remains source guidance, not a released stencil.",
    "solder-paste render disposition"
  )
  return true
}

const projectFootprint = (
  <footprint name="BP033_TVS2200DRVR_PROJECT_FOOTPRINT" originalLayer="top">
    {bp033Tvs2200Pins.map((pad) => (
      <Fragment key={pad.id}>
        <smtpad
          name={pad.id}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin="0.07mm"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[pad.id, `pin${pad.id}`, pad.role]}
        />
      </Fragment>
    ))}
    <smtpad
      name="7"
      pcbX={exposedPad.xMm}
      pcbY={exposedPad.yMm}
      shape="rect"
      solderMaskMargin="0.07mm"
      solderPasteMargin={`${-exposedPadPasteMarginMm}mm`}
      width={`${exposedPad.widthMm}mm`}
      height={`${exposedPad.heightMm}mm`}
      portHints={["7", "pin7", "GND", "thermal-pad"]}
    />
    <courtyardrect pcbX={0} pcbY={0} width="2.6mm" height="2.6mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp033Tvs2200ProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated review-only component; no board circuit imports this renderer. */
export function Bp033Tvs2200ProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp033Tvs2200ProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="D_BP033_VBUS_TVS"
      manufacturerPartNumber="TVS2200DRVR"
      pinLabels={pinLabels}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export const bp033Tvs2200FootprintGeometry = bp033Tvs2200ProjectFootprintGeometry
export const Bp033Tvs2200DrvrProjectFootprint = Bp033Tvs2200ProjectFootprint

export default Bp033Tvs2200ProjectFootprint
