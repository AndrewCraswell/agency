import { Fragment, type ReactElement } from "react"

/**
 * BP-033 transcription of the manufacturer-recommended PCB layout for the
 * retained Amphenol FCI 10177070-00011LF USB Type-C receptacle.
 *
 * Page 2 of the retained drawing publishes one top-view land row, four
 * merged power/ground lands, eight signal lands, four shell slots, two
 * diameter-0.65 datum holes, and the product-edge datum. Mask, paste,
 * courtyard, chassis, CAD-import, and fabrication decisions are deliberately
 * not represented here.
 */

type UsbSourcePin =
  | "A1"
  | "A4"
  | "A5"
  | "A6"
  | "A7"
  | "A8"
  | "A9"
  | "A12"
  | "B1"
  | "B4"
  | "B5"
  | "B6"
  | "B7"
  | "B8"
  | "B9"
  | "B12"

type LandNetClass = "combined-power-ground" | "signal"

type ManufacturerLand = {
  readonly name: string
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
  readonly netClass: LandNetClass
  readonly sourcePins: readonly UsbSourcePin[]
  readonly signalName: "GND" | "VBUS" | "CC1" | "CC2" | "SBU1" | "SBU2" | "Dp1" | "Dn1" | "Dp2" | "Dn2"
}

const manufacturerLayoutDatum = "bottom shell mounting-slot centerline"
const landLowerEdgeFromShellDatumMm = 4.17
const landUpperEdgeFromShellDatumMm = 5.32
const landRowYFromShellDatumMm = (landLowerEdgeFromShellDatumMm + landUpperEdgeFromShellDatumMm) / 2
const landHeightMm = 1.15
const manufacturerLandXmm = [-3.2, -2.4, -1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75, 2.4, 3.2] as const

const manufacturerLands: readonly ManufacturerLand[] = [
  {
    name: "LAND_A1_B12",
    xMm: manufacturerLandXmm[0],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.6,
    heightMm: landHeightMm,
    netClass: "combined-power-ground",
    sourcePins: ["A1", "B12"],
    signalName: "GND"
  },
  {
    name: "LAND_A4_B9",
    xMm: manufacturerLandXmm[1],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.6,
    heightMm: landHeightMm,
    netClass: "combined-power-ground",
    sourcePins: ["A4", "B9"],
    signalName: "VBUS"
  },
  {
    name: "LAND_B8",
    xMm: manufacturerLandXmm[2],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["B8"],
    signalName: "SBU2"
  },
  {
    name: "LAND_A5",
    xMm: manufacturerLandXmm[3],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["A5"],
    signalName: "CC1"
  },
  {
    name: "LAND_B7",
    xMm: manufacturerLandXmm[4],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["B7"],
    signalName: "Dn2"
  },
  {
    name: "LAND_A6",
    xMm: manufacturerLandXmm[5],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["A6"],
    signalName: "Dp1"
  },
  {
    name: "LAND_A7",
    xMm: manufacturerLandXmm[6],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["A7"],
    signalName: "Dn1"
  },
  {
    name: "LAND_B6",
    xMm: manufacturerLandXmm[7],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["B6"],
    signalName: "Dp2"
  },
  {
    name: "LAND_B5",
    xMm: manufacturerLandXmm[8],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["B5"],
    signalName: "CC2"
  },
  {
    name: "LAND_A8",
    xMm: manufacturerLandXmm[9],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.3,
    heightMm: landHeightMm,
    netClass: "signal",
    sourcePins: ["A8"],
    signalName: "SBU1"
  },
  {
    name: "LAND_B4_A9",
    xMm: manufacturerLandXmm[10],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.6,
    heightMm: landHeightMm,
    netClass: "combined-power-ground",
    sourcePins: ["B4", "A9"],
    signalName: "VBUS"
  },
  {
    name: "LAND_B1_A12",
    xMm: manufacturerLandXmm[11],
    yMm: landRowYFromShellDatumMm,
    widthMm: 0.6,
    heightMm: landHeightMm,
    netClass: "combined-power-ground",
    sourcePins: ["B1", "A12"],
    signalName: "GND"
  }
] as const

const shellMountingSlots = [
  { name: "SHELL_SLOT_TOP_LEFT", xMm: -4.32, yMm: 4.18, widthMm: 1.17, heightMm: 2.1 },
  { name: "SHELL_SLOT_TOP_RIGHT", xMm: 4.32, yMm: 4.18, widthMm: 1.17, heightMm: 2.1 },
  { name: "SHELL_SLOT_BOTTOM_LEFT", xMm: -4.32, yMm: 0, widthMm: 1.4, heightMm: 1.8 },
  { name: "SHELL_SLOT_BOTTOM_RIGHT", xMm: 4.32, yMm: 0, widthMm: 1.4, heightMm: 1.8 }
] as const

const manufacturerDatumHoles = [
  { name: "SHELL_DATUM_HOLE_LEFT", xMm: -2.89, yMm: 3.68, diameterMm: 0.65 },
  { name: "SHELL_DATUM_HOLE_RIGHT", xMm: 2.89, yMm: 3.68, diameterMm: 0.65 }
] as const

const pinLabels = Object.fromEntries(manufacturerLands.map((land, index) => [`pin${index + 1}`, land.signalName]))

export const bp033UsbCProjectFootprintGeometry = {
  artifactKind: "bp033-usb-c-project-footprint",
  workUnit: "BP-033",
  reference: "J_USB_C",
  manufacturer: "Amphenol ICC",
  manufacturerAliases: ["Amphenol FCI", "Amphenol Communications Solutions"],
  manufacturerPartNumber: "10177070-00011LF",
  sources: [
    {
      authority: "manufacturer-primary",
      document: "Amphenol FCI 10177070 product drawing",
      revision: "A",
      reviewedPages: "1-2",
      drawingApplicability: "Recommended PCB layout, top view; released 2025-06-27",
      url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf",
      artifactPath: "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
      sha256: "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF"
    }
  ],
  manufacturerCad: {
    state: "not-acquired-access-gated",
    url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip",
    reason:
      "The official product page lists a 3D model, but its download requires manufacturer account access; no CAD archive is retained.",
    authority: "deny"
  },
  package: {
    designation: "USB Type-C 16-position right-angle SMT receptacle",
    drawingNumber: "10177070",
    bodyWidthMm: 8.94,
    bodyDepthMm: { minimum: 7.1, nominal: 7.35, maximum: 7.6 },
    contactOpeningWidthMm: { minimum: 8.32, nominal: 8.34, maximum: 8.4 },
    pcbThicknessMm: 0.8,
    defaultToleranceMm: 0.05,
    electricalPinCount: 16,
    manufacturerLandCount: 12,
    matingDirection: "right-angle, normal to the board edge",
    sourceDisposition:
      "Page 2 publishes the recommended copper land layout; mask, paste, courtyard, and CAD remain unreviewed."
  },
  manufacturerRecommendedLayout: {
    view: "top",
    boardThicknessMm: 0.8,
    defaultToleranceMm: 0.05,
    productEdge: {
      datum: "horizontal product-edge line shown on page 2",
      sourceDimension: "line shown; no offset from the shell-slot centerline is published"
    },
    coordinateDatum: manufacturerLayoutDatum,
    landEdgeSourceDimensions: {
      lowerMm: landLowerEdgeFromShellDatumMm,
      upperMm: landUpperEdgeFromShellDatumMm,
      count: 12,
      derivedCenterMm: landRowYFromShellDatumMm,
      derivedHeightMm: landHeightMm
    },
    electricalLands: manufacturerLands,
    mountingSlots: shellMountingSlots,
    datumHoles: manufacturerDatumHoles,
    slotSourceDimensions: {
      top: { count: 2, widthMm: 1.17, heightMm: 2.1 },
      bottom: { count: 2, widthMm: 1.4, heightMm: 1.8 },
      centerSpacingMm: 4.18,
      slotCenterSpacingMm: 8.64
    },
    datumHoleSourceDimensions: { count: 2, diameterMm: 0.65, centerSpacingMm: 5.78, offsetFromShellDatumMm: 3.68 }
  },
  orientation: {
    view: "top",
    productEdgeDatum: "horizontal product-edge line shown; offset not dimensioned",
    coordinateDatum: manufacturerLayoutDatum,
    landRowYFromShellDatumMm: landRowYFromShellDatumMm,
    boardRotationDegrees: 0,
    sourceDatum: "A1/B12 is the leftmost merged land; B1/A12 is the rightmost merged land.",
    independentlyReviewed: true
  },
  review: {
    state: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    scope:
      "Exact orderable and package, retained drawing, 12-land source-pin/net order, slot and datum-hole geometry, product-edge wording, top-view orientation, and deny-state integrity."
  },
  acceptance: {
    packageDrawingReviewed: true,
    manufacturerLandPatternCaptured: true,
    manufacturerCadImportAccepted: false,
    independentLandOverlayAccepted: true,
    pinOneOrientationAccepted: true,
    boardEdgeDatumAccepted: true,
    maskAndPasteAccepted: false,
    courtyardAccepted: false,
    chassisSupportAccepted: false,
    boardFitAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const expectedSourcePins: readonly (readonly UsbSourcePin[])[] = [
  ["A1", "B12"],
  ["A4", "B9"],
  ["B8"],
  ["A5"],
  ["B7"],
  ["A6"],
  ["A7"],
  ["B6"],
  ["B5"],
  ["A8"],
  ["B4", "A9"],
  ["B1", "A12"]
]

export function validateBp033UsbCProjectFootprintGeometry(value: unknown): true {
  if (value === null || typeof value !== "object") throw new RangeError("BP-033 USB-C geometry must be an object")
  const candidate = value as {
    manufacturerRecommendedLayout?: {
      boardThicknessMm?: number
      defaultToleranceMm?: number
      electricalLands?: readonly ManufacturerLand[]
      mountingSlots?: readonly (typeof shellMountingSlots)[number][]
      datumHoles?: readonly (typeof manufacturerDatumHoles)[number][]
      coordinateDatum?: string
      landEdgeSourceDimensions?: {
        lowerMm?: number
        upperMm?: number
        count?: number
        derivedCenterMm?: number
        derivedHeightMm?: number
      }
      productEdge?: { datum?: string; sourceDimension?: string }
      slotSourceDimensions?: {
        top?: { count?: number; widthMm?: number; heightMm?: number }
        bottom?: { count?: number; widthMm?: number; heightMm?: number }
        centerSpacingMm?: number
        slotCenterSpacingMm?: number
      }
      datumHoleSourceDimensions?: {
        count?: number
        diameterMm?: number
        centerSpacingMm?: number
        offsetFromShellDatumMm?: number
      }
    }
    orientation?: {
      landRowYFromShellDatumMm?: number
      productEdgeDatum?: string
      coordinateDatum?: string
      independentlyReviewed?: boolean
    }
    review?: { state?: string; reviewer?: string; reviewedAt?: string }
    acceptance?: {
      independentLandOverlayAccepted?: boolean
      pinOneOrientationAccepted?: boolean
      boardEdgeDatumAccepted?: boolean
      maskAndPasteAccepted?: boolean
      courtyardAccepted?: boolean
      boardFitAccepted?: boolean
      fabricationAuthorized?: boolean
      releaseState?: string
    }
  }
  const layout = candidate.manufacturerRecommendedLayout
  if (
    layout === undefined ||
    layout.boardThicknessMm !== 0.8 ||
    layout.defaultToleranceMm !== 0.05 ||
    layout.electricalLands?.length !== 12 ||
    layout.mountingSlots?.length !== 4 ||
    layout.datumHoles?.length !== 2 ||
    layout.coordinateDatum !== manufacturerLayoutDatum ||
    layout.productEdge?.datum !== "horizontal product-edge line shown on page 2" ||
    layout.productEdge?.sourceDimension !== "line shown; no offset from the shell-slot centerline is published" ||
    layout.landEdgeSourceDimensions?.lowerMm !== landLowerEdgeFromShellDatumMm ||
    layout.landEdgeSourceDimensions?.upperMm !== landUpperEdgeFromShellDatumMm ||
    layout.landEdgeSourceDimensions?.count !== 12 ||
    layout.landEdgeSourceDimensions?.derivedCenterMm !== landRowYFromShellDatumMm ||
    layout.landEdgeSourceDimensions?.derivedHeightMm !== landHeightMm ||
    layout.slotSourceDimensions?.top?.count !== 2 ||
    layout.slotSourceDimensions?.top?.widthMm !== 1.17 ||
    layout.slotSourceDimensions?.top?.heightMm !== 2.1 ||
    layout.slotSourceDimensions?.bottom?.count !== 2 ||
    layout.slotSourceDimensions?.bottom?.widthMm !== 1.4 ||
    layout.slotSourceDimensions?.bottom?.heightMm !== 1.8 ||
    layout.slotSourceDimensions?.centerSpacingMm !== 4.18 ||
    layout.slotSourceDimensions?.slotCenterSpacingMm !== 8.64 ||
    layout.datumHoleSourceDimensions?.count !== 2 ||
    layout.datumHoleSourceDimensions?.diameterMm !== 0.65 ||
    layout.datumHoleSourceDimensions?.centerSpacingMm !== 5.78 ||
    layout.datumHoleSourceDimensions?.offsetFromShellDatumMm !== 3.68 ||
    candidate.orientation?.landRowYFromShellDatumMm !== landRowYFromShellDatumMm ||
    candidate.orientation.productEdgeDatum !== "horizontal product-edge line shown; offset not dimensioned" ||
    candidate.orientation.coordinateDatum !== manufacturerLayoutDatum ||
    candidate.orientation.independentlyReviewed !== true ||
    candidate.review?.state !== "root-reviewed-review-input" ||
    candidate.review.reviewer !== "root-final-reviewer" ||
    candidate.acceptance?.independentLandOverlayAccepted !== true ||
    candidate.acceptance.pinOneOrientationAccepted !== true ||
    candidate.acceptance.boardEdgeDatumAccepted !== true ||
    candidate.acceptance.maskAndPasteAccepted !== false ||
    candidate.acceptance.courtyardAccepted !== false ||
    candidate.acceptance.boardFitAccepted !== false ||
    candidate.acceptance.fabricationAuthorized !== false ||
    candidate.acceptance.releaseState !== "deny"
  )
    throw new RangeError("BP-033 USB-C manufacturer layout is incomplete")

  layout.electricalLands.forEach((land, index) => {
    if (
      land.xMm !== manufacturerLandXmm[index] ||
      land.yMm !== landRowYFromShellDatumMm ||
      land.heightMm !== landHeightMm ||
      land.sourcePins.length !== expectedSourcePins[index]?.length ||
      land.sourcePins.some((pin, pinIndex) => pin !== expectedSourcePins[index]?.[pinIndex]) ||
      (index === 0 || index === 1 || index === 10 || index === 11
        ? land.widthMm !== 0.6 || land.netClass !== "combined-power-ground"
        : land.widthMm !== 0.3 || land.netClass !== "signal")
    )
      throw new RangeError("BP-033 USB-C land row mirror or source-pin substitution detected")
  })
  if (
    layout.mountingSlots.some((slot, index) => {
      const expected = shellMountingSlots[index]
      return (
        expected === undefined ||
        slot.name !== expected.name ||
        slot.xMm !== expected.xMm ||
        slot.yMm !== expected.yMm ||
        slot.widthMm !== expected.widthMm ||
        slot.heightMm !== expected.heightMm
      )
    }) ||
    layout.datumHoles.some((hole, index) => {
      const expected = manufacturerDatumHoles[index]
      return (
        expected === undefined ||
        hole.name !== expected.name ||
        hole.xMm !== expected.xMm ||
        hole.yMm !== expected.yMm ||
        hole.diameterMm !== expected.diameterMm
      )
    })
  )
    throw new RangeError("BP-033 USB-C mounting feature geometry changed")
  return true
}

validateBp033UsbCProjectFootprintGeometry(bp033UsbCProjectFootprintGeometry)

const projectFootprint = (
  <footprint name="BP033_USB_C_MANUFACTURER_LAYOUT" originalLayer="top">
    {manufacturerLands.map((land, index) => (
      <Fragment key={land.name}>
        <smtpad
          name={land.name}
          pcbX={land.xMm}
          pcbY={land.yMm}
          shape="rect"
          width={`${land.widthMm}mm`}
          height={`${land.heightMm}mm`}
          portHints={[`pin${index + 1}`, ...land.sourcePins]}
        />
      </Fragment>
    ))}
    {shellMountingSlots.map((slot) => (
      <Fragment key={slot.name}>
        <hole
          name={slot.name}
          shape="pill"
          width={`${slot.widthMm}mm`}
          height={`${slot.heightMm}mm`}
          pcbX={slot.xMm}
          pcbY={slot.yMm}
        />
      </Fragment>
    ))}
    {manufacturerDatumHoles.map((hole) => (
      <Fragment key={hole.name}>
        <hole name={hole.name} diameter={`${hole.diameterMm}mm`} pcbX={hole.xMm} pcbY={hole.yMm} />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp033UsbCProjectFootprintProps {
  readonly name?: string
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review-only component. It is intentionally not imported by a board model. */
export function Bp033UsbCProjectFootprint({
  name,
  pcbX,
  pcbY,
  pcbRotation
}: Bp033UsbCProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name={name ?? "J_BP033_USB_C"}
      manufacturerPartNumber="10177070-00011LF"
      pinLabels={pinLabels}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp033UsbCProjectFootprint
