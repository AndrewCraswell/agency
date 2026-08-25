import { Fragment, type ReactElement } from "react"
import { type ThermalPad, type UsbPdFootprint, usbPdFootprints } from "./usb-pd-footprints.js"

/** Source-derived BP-033 artwork for review only. It is never imported by a board model. */
function isTps25730aRef(footprint: UsbPdFootprint): boolean {
  return footprint.mpn === "TPS25730ADREFR"
}

function sourceGeometry(): UsbPdFootprint {
  const footprint = usbPdFootprints.find(isTps25730aRef)
  if (footprint === undefined) throw new RangeError("TPS25730ADREFR REF0038A source geometry is missing")
  return footprint
}

const sourceFootprint = sourceGeometry()
const solderMaskMarginMm = 0.05
const courtyard = { heightMm: 5, widthMm: 7 }

/** A symmetric aperture reduction that matches TI's stated total printed area. */
function pasteMarginForCoverage(thermalPad: ThermalPad): number {
  const coverage = thermalPad.pasteCoveragePercent
  if (coverage === undefined) throw new RangeError(`Thermal pad ${thermalPad.id} has no TI stencil coverage`)
  const printedArea = thermalPad.widthMm * thermalPad.heightMm * (coverage / 100)
  const perimeter = thermalPad.widthMm + thermalPad.heightMm
  return (perimeter - Math.sqrt(perimeter ** 2 - 4 * (thermalPad.widthMm * thermalPad.heightMm - printedArea))) / 4
}

const pinLabels = Object.fromEntries(
  [...sourceFootprint.pads, ...sourceFootprint.thermalPads].map((pad) => [`pin${pad.id}`, pad.id])
)

export const bp033Tps25730aRefProjectFootprintGeometry = {
  artifactKind: "bp033-tps25730a-ref-project-footprint",
  workUnit: "BP-033",
  reference: "U_USB_PD",
  manufacturer: "Texas Instruments",
  orderablePartNumber: "TPS25730ADREFR",
  devicePartNumber: "TPS25730AD",
  package: {
    designation: "WQFN (REF), 38 perimeter pins plus exposed pads 39 and 40",
    packageDrawing: "REF0038A",
    bodyMaximumMm: { height: 4.1, width: 6.1 },
    pitchMm: 0.4
  },
  sources: [
    {
      authority: "manufacturer-primary",
      document: "TPS25730A datasheet",
      reviewedPages: "1, 4-6, 61-63",
      drawingApplicability:
        "TPS25730AD REF0038A: 38-pin top-view pin order, package outline, example board layout, and 0.1 mm stencil example.",
      url: "https://www.ti.com/lit/ds/symlink/tps25730a.pdf",
      artifactPath: "docs/evidence/bp-033/ti-tps25730a-datasheet.pdf",
      sha256: "B7D9836E4C82D28BF400FC1747586F24C26DAF94A629AAB4EE57C49072371D28"
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    reason: "No native TI ECAD or 3D model is imported; REF0038A PDF evidence is not an ECAD import.",
    authority: "deny"
  },
  copper: {
    state: "manufacturer-verified",
    peripheralPads: sourceFootprint.pads,
    exposedPads: sourceFootprint.thermalPads
  },
  solderMask: { state: "project-review-input", marginMm: solderMaskMarginMm, accepted: false },
  solderPaste: {
    state: "source-derived-area-review-only",
    stencilThicknessMm: sourceFootprint.paste.stencilThicknessMm,
    thermalPadPrintedAreaPercent: sourceFootprint.paste.coverage,
    disposition:
      "The rendered symmetric apertures preserve TI's published total area percentages only; they do not accept TI's stencil segmentation or the selected assembler process."
  },
  courtyard: {
    state: "project-review-input",
    widthMm: courtyard.widthMm,
    heightMm: courtyard.heightMm,
    minimumCopperClearanceMm: 0.3,
    disposition: "TI publishes no courtyard; this rectangle is only an explicit DRC-review envelope."
  },
  orientation: {
    boardRotationDegrees: 0,
    pinOne: { id: "1", xMm: -2.925, yMm: 1, sourceDatum: "upper-left of the left edge in TI top view" },
    numbering: "counter-clockwise in TI top view",
    independentlyReviewed: false
  },
  acceptance: {
    projectArtworkRendered: true,
    projectGeometryAccepted: false,
    orientationAccepted: false,
    cadImportAccepted: false,
    boardImportAccepted: false,
    boardFitAccepted: false,
    stencilProcessAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const projectFootprint = (
  <footprint name="BP033_TPS25730A_REF_PROJECT_FOOTPRINT" originalLayer="top">
    {sourceFootprint.pads.map((pad) => (
      <Fragment key={pad.id}>
        <smtpad
          name={pad.id}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin={`${solderMaskMarginMm}mm`}
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[pad.id, `pin${pad.id}`]}
        />
      </Fragment>
    ))}
    {sourceFootprint.thermalPads.map((pad) => (
      <Fragment key={pad.id}>
        <smtpad
          name={pad.id}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin={`${solderMaskMarginMm}mm`}
          solderPasteMargin={`${-pasteMarginForCoverage(pad)}mm`}
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[pad.id, `pin${pad.id}`, pad.role]}
        />
      </Fragment>
    ))}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${courtyard.widthMm}mm`}
      height={`${courtyard.heightMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp033Tps25730aRefProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

export function Bp033Tps25730aRefProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp033Tps25730aRefProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP033_USB_PD"
      manufacturerPartNumber="TPS25730ADREFR"
      pinLabels={pinLabels}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp033Tps25730aRefProjectFootprint
