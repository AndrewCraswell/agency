import { type ReactElement } from "react"
import { CourtyardRect, Footprint, PrimitiveComponent, SmtPad } from "tscircuit"
import { z } from "zod"

/**
 * BP-033 review-only project footprint for canonical U_USB_PORT_PROTECT.
 *
 * The retained TI RGR0020C drawing supplies the copper and package datum. The
 * generated component is intentionally isolated from every board model. It is
 * a source transcription and review input, not imported manufacturer CAD or a
 * fabrication release.
 */

const packageBodyMinimumMm = 3.35
const packageBodyNominalMm = 3.5
const packageBodyMaximumMm = 3.65
const packageHeightMaximumMm = 1
const landPatternSpanMm = 3.3
const padPitchMm = 0.5
const padCenterFromOriginMm = 1.35
const padEndCenterMm = 1
const peripheralPadWidthMm = 0.6
const peripheralPadHeightMm = 0.24
const exposedPadWidthMm = 2.05
const exposedPadHeightMm = 2.05
const solderMaskMarginMm = 0.07
const perimeterPasteWidthMm = 0.56
const perimeterPasteHeightMm = 0.24
const thermalPasteApertureSideMm = 0.92
const thermalPasteApertureCount = 4
const thermalPasteCoveragePercent = 81
const stencilThicknessMm = 0.125
const courtyardClearanceMm = 0.25
const courtyardSideMm = packageBodyMaximumMm + 2 * courtyardClearanceMm
const perimeterPasteReductionPerEdgeMm = (peripheralPadWidthMm - perimeterPasteWidthMm) / 2

const perimeterSolderPasteProps = z.object({
  pcbX: z.number(),
  pcbY: z.number(),
  width: z.number(),
  height: z.number()
})

/**
 * tscircuit's smtpad paste margin is symmetric on both axes. TI's RGR0020C
 * example keeps the 0.24 mm short axis while reducing only the 0.60 mm land
 * axis to a 0.56 mm aperture, so the review footprint emits the rectangular
 * paste primitive directly and keeps copper on the canonical smtpad.
 */
class TpdPerimeterSolderPaste extends PrimitiveComponent<typeof perimeterSolderPasteProps> {
  get config() {
    return { componentName: "TpdPerimeterSolderPaste", zodProps: perimeterSolderPasteProps }
  }

  getPcbSize() {
    return { width: this._parsedProps.width, height: this._parsedProps.height }
  }

  doInitialPcbPrimitiveRender() {
    const root = this.root
    if (root === null || root.pcbDisabled) return
    const { db } = root
    const position = this._getGlobalPcbPositionBeforeLayout()
    const parent = this.getParentNormalComponent()
    db.pcb_solder_paste.insert({
      layer: "top",
      shape: "rect",
      width: this._parsedProps.width,
      height: this._parsedProps.height,
      x: position.x,
      y: position.y,
      pcb_component_id: parent?.pcb_component_id ?? undefined,
      subcircuit_id: this.getSubcircuit()?.subcircuit_id ?? undefined,
      pcb_group_id: this.getGroup()?.pcb_group_id ?? undefined
    })
  }
}

type PinName =
  | "C_SBU1"
  | "C_SBU2"
  | "VBIAS"
  | "C_CC1"
  | "C_CC2"
  | "RPD_G2"
  | "RPD_G1"
  | "GND"
  | "FLT"
  | "VPWR"
  | "CC2"
  | "CC1"
  | "SBU2"
  | "SBU1"
  | "NC"

type PackageSide = "left" | "bottom" | "right" | "top"

type Terminal = {
  readonly pin: number
  readonly name: PinName
  readonly side: PackageSide
  readonly xMm: number
  readonly yMm: number
  readonly copperWidthMm: number
  readonly copperHeightMm: number
}

type CircuitPortAlias = {
  readonly tiPin: number
  readonly tiName: PinName
  readonly circuitPort: string
}

const pinNames: readonly PinName[] = [
  "C_SBU1",
  "C_SBU2",
  "VBIAS",
  "C_CC1",
  "C_CC2",
  "RPD_G2",
  "RPD_G1",
  "GND",
  "FLT",
  "VPWR",
  "CC2",
  "CC1",
  "GND",
  "SBU2",
  "SBU1",
  "NC",
  "NC",
  "GND",
  "NC",
  "NC"
] as const

function createTerminals(): readonly Terminal[] {
  const left = pinNames.slice(0, 5).map((name, index) => ({
    pin: index + 1,
    name,
    side: "left" as const,
    xMm: -padCenterFromOriginMm,
    yMm: padEndCenterMm - index * padPitchMm,
    copperWidthMm: peripheralPadWidthMm,
    copperHeightMm: peripheralPadHeightMm
  }))
  const bottom = pinNames.slice(5, 10).map((name, index) => ({
    pin: index + 6,
    name,
    side: "bottom" as const,
    xMm: -padEndCenterMm + index * padPitchMm,
    yMm: -padCenterFromOriginMm,
    copperWidthMm: peripheralPadHeightMm,
    copperHeightMm: peripheralPadWidthMm
  }))
  const right = pinNames.slice(10, 15).map((name, index) => ({
    pin: index + 11,
    name,
    side: "right" as const,
    xMm: padCenterFromOriginMm,
    yMm: -padEndCenterMm + index * padPitchMm,
    copperWidthMm: peripheralPadWidthMm,
    copperHeightMm: peripheralPadHeightMm
  }))
  const top = pinNames.slice(15, 20).map((name, index) => ({
    pin: index + 16,
    name,
    side: "top" as const,
    xMm: padEndCenterMm - index * padPitchMm,
    yMm: padCenterFromOriginMm,
    copperWidthMm: peripheralPadHeightMm,
    copperHeightMm: peripheralPadWidthMm
  }))
  return [...left, ...bottom, ...right, ...top]
}

const terminals = createTerminals()
const circuitPortAliases: readonly CircuitPortAlias[] = [
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
] as const
const exposedPad = {
  id: "21",
  name: "GND" as const,
  xMm: 0,
  yMm: 0,
  copperWidthMm: exposedPadWidthMm,
  copperHeightMm: exposedPadHeightMm,
  thermalViaPolicy: "optional-fill-plug-or-tent" as const
}

const pinLabels = Object.fromEntries(circuitPortAliases.map((alias) => [`pin${alias.tiPin}`, alias.circuitPort]))

function pasteMarginForCoverage(widthMm: number, heightMm: number, coveragePercent: number): number {
  const targetArea = widthMm * heightMm * (coveragePercent / 100)
  const semiperimeter = (widthMm + heightMm) / 2
  return (semiperimeter - Math.sqrt(semiperimeter ** 2 - (widthMm * heightMm - targetArea))) / 2
}

const thermalPasteMarginMm = pasteMarginForCoverage(exposedPadWidthMm, exposedPadHeightMm, thermalPasteCoveragePercent)

export const bp033Tpd4s201RgrProjectFootprintGeometry = {
  artifactKind: "bp033-tpd4s201-rgr-project-footprint",
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
    bodySizeMm: {
      minimum: packageBodyMinimumMm,
      nominal: packageBodyNominalMm,
      maximum: packageBodyMaximumMm
    },
    bodySizeSource: "TI page 1: 3.5mm x 3.5mm nominal; page 26: 3.35mm to 3.65mm",
    landPatternSpanMm,
    heightMaximumMm: packageHeightMaximumMm,
    pitchMm: padPitchMm,
    perimeterPinCount: 20,
    exposedPad: { id: exposedPad.id, net: exposedPad.name, widthMm: exposedPadWidthMm, heightMm: exposedPadHeightMm },
    canonicalLabelDiscrepancy:
      "The canonical label uses TI's exact 3.5mm x 3.5mm nominal body; 3.3mm is the land-pattern span, not the package body. Board fit and release remain denied."
  },
  sources: [
    {
      authority: "manufacturer-primary",
      document: "TPD4S201-Q1 USB Type-C 20V SPR Port Protector datasheet, SLVSI17, June 2025",
      reviewedPages: "1, 3-4, 21, 26-28",
      pagePurposes: {
        exactOrderableAndPackage: "1, 21",
        pinMapAndFunctions: "3-4",
        rgrPackageOutline: "26",
        rgrBoardLayout: "27",
        rgrStencil: "28"
      },
      url: "https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf",
      artifactPath: "docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf",
      sha256: "E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5"
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    sha256: null,
    authority: "deny",
    reason: "No TI-native ECAD or 3D CAD artifact is retained; the PDF package drawing is not an ECAD import."
  },
  copper: {
    state: "manufacturer-primary-transcription",
    peripheralPads: terminals,
    exposedPads: [exposedPad]
  },
  projectSelection: {
    authority: "manufacturer-primary-copper-plus-explicit-review-inputs",
    solderMask: {
      state: "project-review-input",
      marginMm: solderMaskMarginMm,
      perimeterOpeningNote: "TI page 27 shows non-solder-mask-defined preferred copper with 0.07mm maximum all around.",
      accepted: false
    },
    solderPaste: {
      state: "source-derived-area-review-only",
      stencilThicknessMm,
      perimeterAperture: {
        widthMm: perimeterPasteWidthMm,
        heightMm: perimeterPasteHeightMm,
        count: 20
      },
      thermalApertures: {
        count: thermalPasteApertureCount,
        widthMm: thermalPasteApertureSideMm,
        heightMm: thermalPasteApertureSideMm,
        printedAreaPercent: thermalPasteCoveragePercent
      },
      renderedApproximation: {
        thermalPadSymmetricMarginMm: thermalPasteMarginMm,
        disposition:
          "The isolated rendering preserves TI's stated 81% exposed-pad area as one symmetric aperture and emits all twenty perimeter apertures at 0.56mm x 0.24mm; it does not accept TI's four-aperture segmentation or an assembler process."
      },
      accepted: false
    },
    courtyard: {
      state: "project-review-input",
      widthMm: courtyardSideMm,
      heightMm: courtyardSideMm,
      minimumClearanceMm: courtyardClearanceMm,
      disposition: "TI publishes no courtyard; this envelope is DRC review input only.",
      accepted: false
    }
  },
  orientation: {
    boardRotationDegrees: 0,
    pinOne: {
      id: "1",
      xMm: -padCenterFromOriginMm,
      yMm: padEndCenterMm,
      sourceDatum: "RGR0020C page 26 package pin-1 index area at upper-left in top view"
    },
    numbering: "counter-clockwise in TI top view",
    independentlyReviewed: false,
    accepted: false
  },
  terminals,
  circuitPortAliases,
  exposedPad,
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
} as const

function createProjectFootprint() {
  const footprint = new Footprint({
    name: "BP033_TPD4S201TRGRRQ1_RGR_PROJECT_FOOTPRINT",
    originalLayer: "top"
  })
  for (const terminal of terminals) {
    const circuitPort = circuitPortAliases[terminal.pin - 1]?.circuitPort
    footprint.add(
      new SmtPad({
        name: String(terminal.pin),
        pcbX: terminal.xMm,
        pcbY: terminal.yMm,
        shape: "rect",
        solderMaskMargin: solderMaskMarginMm,
        solderPasteMargin: -peripheralPadWidthMm / 2,
        width: terminal.copperWidthMm,
        height: terminal.copperHeightMm,
        portHints: [String(terminal.pin), terminal.name, circuitPort ?? `pin${terminal.pin}`, `pin${terminal.pin}`]
      })
    )
    const pasteWidth =
      terminal.side === "left" || terminal.side === "right"
        ? terminal.copperWidthMm - 2 * perimeterPasteReductionPerEdgeMm
        : terminal.copperWidthMm
    const pasteHeight =
      terminal.side === "left" || terminal.side === "right"
        ? terminal.copperHeightMm
        : terminal.copperHeightMm - 2 * perimeterPasteReductionPerEdgeMm
    footprint.add(
      new TpdPerimeterSolderPaste({
        pcbX: terminal.xMm,
        pcbY: terminal.yMm,
        width: pasteWidth,
        height: pasteHeight
      })
    )
  }
  footprint.add(
    new SmtPad({
      name: exposedPad.id,
      pcbX: exposedPad.xMm,
      pcbY: exposedPad.yMm,
      shape: "rect",
      solderMaskMargin: solderMaskMarginMm,
      solderPasteMargin: -thermalPasteMarginMm,
      width: exposedPad.copperWidthMm,
      height: exposedPad.copperHeightMm,
      portHints: [exposedPad.id, exposedPad.name, "THERMAL_GND", "thermal-pad", "pin21"]
    })
  )
  footprint.add(
    new CourtyardRect({
      pcbX: 0,
      pcbY: 0,
      width: courtyardSideMm,
      height: courtyardSideMm,
      strokeWidth: 0.05
    })
  )
  return footprint
}

export interface Bp033Tpd4s201RgrProjectFootprintProps {
  readonly name?: string
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review-only component; no board imports this candidate. */
export function Bp033Tpd4s201RgrProjectFootprint({
  name,
  pcbX,
  pcbY,
  pcbRotation
}: Bp033Tpd4s201RgrProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name={name ?? "U_BP033_TPD4S201TRGRRQ1"}
      manufacturerPartNumber="TPD4S201TRGRRQ1"
      pinLabels={pinLabels}
      footprint={createProjectFootprint() as never}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

type Evidence = typeof bp033Tpd4s201RgrProjectFootprintGeometry

/** Return invariant failures; a clean result does not grant fabrication authority. */
export function validateBp033Tpd4s201RgrProjectFootprintGeometry(
  evidence: Evidence = bp033Tpd4s201RgrProjectFootprintGeometry
): readonly string[] {
  const errors: string[] = []
  if (evidence.artifactKind !== "bp033-tpd4s201-rgr-project-footprint") {
    errors.push("RGR artifact kind drifted")
  }
  if (
    evidence.workUnit !== "BP-033" ||
    evidence.reference !== "U_USB_PORT_PROTECT" ||
    evidence.referenceAliases.canonical !== "U_USB_PORT_PROTECT" ||
    evidence.referenceAliases.ledgerAlias !== "U_USB_CC_SBU_PROTECT" ||
    evidence.referenceAliases.disposition !== "ledger-alias-only" ||
    evidence.manufacturer !== "Texas Instruments" ||
    evidence.manufacturerPartNumber !== "TPD4S201TRGRRQ1" ||
    evidence.orderablePartNumber !== "TPD4S201TRGRRQ1" ||
    evidence.devicePartNumber !== "TPD4S201-Q1"
  ) {
    errors.push("exact BP-033 TPD4S201TRGRRQ1 identity drifted")
  }
  if (
    evidence.package.designation !== "VQFN (RGR), 20-pin" ||
    evidence.package.legacyApplicationLabel !== "VQFN-20 (RGR), 3.5mm x 3.5mm nominal body" ||
    evidence.package.sourceDesignation !== "RGR (VQFN, 20)" ||
    evidence.package.packageDrawing !== "RGR0020C" ||
    evidence.package.bodySizeMm.minimum !== packageBodyMinimumMm ||
    evidence.package.bodySizeMm.nominal !== packageBodyNominalMm ||
    evidence.package.bodySizeMm.maximum !== packageBodyMaximumMm ||
    evidence.package.landPatternSpanMm !== landPatternSpanMm ||
    evidence.package.heightMaximumMm !== packageHeightMaximumMm ||
    evidence.package.pitchMm !== padPitchMm ||
    evidence.package.perimeterPinCount !== 20 ||
    evidence.package.exposedPad.id !== "21" ||
    evidence.package.exposedPad.net !== "GND" ||
    evidence.package.exposedPad.widthMm !== exposedPadWidthMm ||
    evidence.package.exposedPad.heightMm !== exposedPadHeightMm
  ) {
    errors.push("RGR0020C package identity or dimensions drifted")
  }
  if (evidence.package.bodySizeSource !== "TI page 1: 3.5mm x 3.5mm nominal; page 26: 3.35mm to 3.65mm") {
    errors.push("RGR package body source note drifted")
  }
  if (
    evidence.package.canonicalLabelDiscrepancy !==
    "The canonical label uses TI's exact 3.5mm x 3.5mm nominal body; 3.3mm is the land-pattern span, not the package body. Board fit and release remain denied."
  ) {
    errors.push("RGR canonical package-label discrepancy note drifted")
  }
  const expectedPinNames = pinNames
  if (
    evidence.terminals.length !== expectedPinNames.length ||
    evidence.terminals.some(
      (terminal, index) => terminal.pin !== index + 1 || terminal.name !== expectedPinNames[index]
    )
  ) {
    errors.push("RGR pin-function map drifted")
  }
  if (
    evidence.circuitPortAliases.length !== circuitPortAliases.length ||
    evidence.circuitPortAliases.some((alias, index) => {
      const expected = circuitPortAliases[index]
      return (
        expected === undefined ||
        alias.tiPin !== expected.tiPin ||
        alias.tiName !== expected.tiName ||
        alias.circuitPort !== expected.circuitPort
      )
    })
  ) {
    errors.push("TI-to-circuit port alias map drifted")
  }
  if (evidence.terminals.length !== 20 || evidence.copper.peripheralPads.length !== 20) {
    errors.push("RGR must have exactly twenty perimeter terminals")
  }
  for (const expected of terminals) {
    const actual = evidence.terminals.find((terminal) => terminal.pin === expected.pin)
    if (
      actual === undefined ||
      actual.name !== expected.name ||
      actual.side !== expected.side ||
      actual.xMm !== expected.xMm ||
      actual.yMm !== expected.yMm ||
      actual.copperWidthMm !== expected.copperWidthMm ||
      actual.copperHeightMm !== expected.copperHeightMm
    ) {
      errors.push(`RGR terminal ${expected.pin} identity or geometry drifted`)
    }
  }
  if (
    evidence.copper.peripheralPads.length !== evidence.terminals.length ||
    evidence.copper.peripheralPads.some((pad, index) => {
      const terminal = evidence.terminals[index]
      return (
        terminal === undefined ||
        pad.pin !== terminal.pin ||
        pad.name !== terminal.name ||
        pad.side !== terminal.side ||
        pad.xMm !== terminal.xMm ||
        pad.yMm !== terminal.yMm ||
        pad.copperWidthMm !== terminal.copperWidthMm ||
        pad.copperHeightMm !== terminal.copperHeightMm
      )
    })
  ) {
    errors.push("RGR copper pad ledger does not match terminal ledger")
  }
  if (
    evidence.exposedPad.id !== "21" ||
    evidence.exposedPad.name !== "GND" ||
    evidence.exposedPad.xMm !== 0 ||
    evidence.exposedPad.yMm !== 0 ||
    evidence.exposedPad.copperWidthMm !== exposedPadWidthMm ||
    evidence.exposedPad.copperHeightMm !== exposedPadHeightMm ||
    evidence.exposedPad.thermalViaPolicy !== "optional-fill-plug-or-tent"
  ) {
    errors.push("RGR exposed pad identity, geometry, or thermal via policy drifted")
  }
  const copperExposedPad = evidence.copper.exposedPads[0]
  if (
    evidence.copper.state !== "manufacturer-primary-transcription" ||
    evidence.copper.exposedPads.length !== 1 ||
    copperExposedPad === undefined ||
    copperExposedPad.id !== "21" ||
    copperExposedPad.name !== "GND" ||
    copperExposedPad.xMm !== 0 ||
    copperExposedPad.yMm !== 0 ||
    copperExposedPad.copperWidthMm !== exposedPadWidthMm ||
    copperExposedPad.copperHeightMm !== exposedPadHeightMm ||
    copperExposedPad.thermalViaPolicy !== "optional-fill-plug-or-tent"
  ) {
    errors.push("RGR copper state or exposed-pad array drifted")
  }
  if (
    evidence.orientation.boardRotationDegrees !== 0 ||
    evidence.orientation.pinOne.id !== "1" ||
    evidence.orientation.pinOne.xMm !== -padCenterFromOriginMm ||
    evidence.orientation.pinOne.yMm !== padEndCenterMm ||
    evidence.orientation.pinOne.sourceDatum !== "RGR0020C page 26 package pin-1 index area at upper-left in top view" ||
    evidence.orientation.numbering !== "counter-clockwise in TI top view" ||
    evidence.orientation.independentlyReviewed ||
    evidence.orientation.accepted
  ) {
    errors.push("RGR pin-one datum or orientation review state drifted")
  }
  const source = evidence.sources[0]
  if (
    evidence.sources.length !== 1 ||
    source === undefined ||
    source.authority !== "manufacturer-primary" ||
    source.document !== "TPD4S201-Q1 USB Type-C 20V SPR Port Protector datasheet, SLVSI17, June 2025" ||
    source.reviewedPages !== "1, 3-4, 21, 26-28" ||
    source.pagePurposes.exactOrderableAndPackage !== "1, 21" ||
    source.pagePurposes.pinMapAndFunctions !== "3-4" ||
    source.pagePurposes.rgrPackageOutline !== "26" ||
    source.pagePurposes.rgrBoardLayout !== "27" ||
    source.pagePurposes.rgrStencil !== "28" ||
    source.url !== "https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf" ||
    source.artifactPath !== "docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf" ||
    source.sha256 !== "E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5"
  ) {
    errors.push("retained TI primary source binding is incomplete")
  }
  if (
    evidence.manufacturerCad.state !== "not-acquired" ||
    evidence.manufacturerCad.artifactPath !== null ||
    evidence.manufacturerCad.sha256 !== null ||
    evidence.manufacturerCad.authority !== "deny"
  ) {
    errors.push("RGR manufacturer CAD must remain explicitly unacquired and denied")
  }
  if (
    evidence.manufacturerCad.reason !==
    "No TI-native ECAD or 3D CAD artifact is retained; the PDF package drawing is not an ECAD import."
  ) {
    errors.push("RGR manufacturer CAD reason drifted")
  }
  if (evidence.projectSelection.authority !== "manufacturer-primary-copper-plus-explicit-review-inputs") {
    errors.push("RGR project-selection authority note drifted")
  }
  if (
    evidence.projectSelection.solderMask.perimeterOpeningNote !==
    "TI page 27 shows non-solder-mask-defined preferred copper with 0.07mm maximum all around."
  ) {
    errors.push("RGR solder-mask source note drifted")
  }
  if (
    evidence.projectSelection.solderMask.marginMm !== solderMaskMarginMm ||
    evidence.projectSelection.solderMask.state !== "project-review-input" ||
    evidence.projectSelection.solderMask.accepted ||
    evidence.projectSelection.solderPaste.state !== "source-derived-area-review-only" ||
    evidence.projectSelection.solderPaste.accepted ||
    evidence.projectSelection.solderPaste.stencilThicknessMm !== stencilThicknessMm ||
    evidence.projectSelection.solderPaste.perimeterAperture.widthMm !== perimeterPasteWidthMm ||
    evidence.projectSelection.solderPaste.perimeterAperture.heightMm !== perimeterPasteHeightMm ||
    evidence.projectSelection.solderPaste.perimeterAperture.count !== 20 ||
    evidence.projectSelection.solderPaste.thermalApertures.count !== thermalPasteApertureCount ||
    evidence.projectSelection.solderPaste.thermalApertures.widthMm !== thermalPasteApertureSideMm ||
    evidence.projectSelection.solderPaste.thermalApertures.heightMm !== thermalPasteApertureSideMm ||
    evidence.projectSelection.solderPaste.thermalApertures.printedAreaPercent !== thermalPasteCoveragePercent ||
    evidence.projectSelection.courtyard.widthMm !== courtyardSideMm ||
    evidence.projectSelection.courtyard.heightMm !== courtyardSideMm ||
    evidence.projectSelection.courtyard.minimumClearanceMm !== courtyardClearanceMm ||
    evidence.projectSelection.courtyard.state !== "project-review-input" ||
    evidence.projectSelection.courtyard.accepted
  ) {
    errors.push("RGR mask, paste, or courtyard review inputs drifted")
  }
  if (
    evidence.projectSelection.solderPaste.renderedApproximation.thermalPadSymmetricMarginMm !== thermalPasteMarginMm
  ) {
    errors.push("RGR rendered thermal-paste approximation drifted")
  }
  if (
    evidence.projectSelection.solderPaste.renderedApproximation.disposition !==
    "The isolated rendering preserves TI's stated 81% exposed-pad area as one symmetric aperture and emits all twenty perimeter apertures at 0.56mm x 0.24mm; it does not accept TI's four-aperture segmentation or an assembler process."
  ) {
    errors.push("RGR rendered thermal-paste disposition drifted")
  }
  if (
    evidence.projectSelection.courtyard.disposition !==
    "TI publishes no courtyard; this envelope is DRC review input only."
  ) {
    errors.push("RGR courtyard disposition drifted")
  }
  if (
    evidence.acceptance.packageIdentityReviewed !== true ||
    evidence.acceptance.packageDrawingReviewed !== true ||
    evidence.acceptance.pinFunctionsReviewed !== true ||
    evidence.acceptance.manufacturerLandPatternCaptured !== true ||
    evidence.acceptance.projectGeometryAccepted ||
    evidence.acceptance.pinOneOrientationAccepted ||
    evidence.acceptance.cadImportAccepted ||
    evidence.acceptance.boardImportAccepted ||
    evidence.acceptance.boardFitAccepted ||
    evidence.acceptance.drcAccepted ||
    evidence.acceptance.fabricationAuthorized ||
    evidence.acceptance.releaseState !== "deny"
  ) {
    errors.push("RGR candidate must remain review-only and fabrication-denied")
  }
  return errors
}
