import { Fragment, type ReactElement } from "react"

/**
 * BP-033 project-review land pattern for the exact WIZnet W5500 LQFP-48.
 *
 * The retained WIZnet v1.1.0 package drawing applies to the post-July-2021
 * package. It gives the 48-lead LQFP envelope and lead limits, but it does
 * not publish a PCB land pattern. Copper, mask, paste, and courtyard values
 * below are therefore explicit project review inputs, never manufacturer CAD
 * or fabrication authority.
 */

const leadPitchMm = 0.5
const padsPerSide = 12
const bodySizeMm = 7
const leadTipSpanMm = 9
const padCenterFromBodyCenterMm = 4.35
const firstPadOffsetMm = 2.75
const copperPadLengthMm = 1.5
const copperPadWidthMm = 0.3
const solderMaskMarginMm = 0.05
const solderPasteMarginMm = -0.05
const courtyardSizeMm = 10.8

type Side = "left" | "bottom" | "right" | "top"

type Terminal = {
  readonly pin: number
  readonly side: Side
  readonly xMm: number
  readonly yMm: number
  readonly copperWidthMm: number
  readonly copperHeightMm: number
}

function createSideTerminals(side: Side, firstPin: number): readonly Terminal[] {
  return Array.from({ length: padsPerSide }, (_, index) => {
    const pin = firstPin + index
    const offset = firstPadOffsetMm - index * leadPitchMm
    switch (side) {
      case "left":
        return {
          pin,
          side,
          xMm: -padCenterFromBodyCenterMm,
          yMm: offset,
          copperWidthMm: copperPadLengthMm,
          copperHeightMm: copperPadWidthMm
        }
      case "bottom":
        return {
          pin,
          side,
          xMm: -offset,
          yMm: -padCenterFromBodyCenterMm,
          copperWidthMm: copperPadWidthMm,
          copperHeightMm: copperPadLengthMm
        }
      case "right":
        return {
          pin,
          side,
          xMm: padCenterFromBodyCenterMm,
          yMm: -offset,
          copperWidthMm: copperPadLengthMm,
          copperHeightMm: copperPadWidthMm
        }
      case "top":
        return {
          pin,
          side,
          xMm: offset,
          yMm: padCenterFromBodyCenterMm,
          copperWidthMm: copperPadWidthMm,
          copperHeightMm: copperPadLengthMm
        }
    }
  })
}

const terminals = [
  ...createSideTerminals("left", 1),
  ...createSideTerminals("bottom", 13),
  ...createSideTerminals("right", 25),
  ...createSideTerminals("top", 37)
] as const

const pinLabels = Object.fromEntries(terminals.map((terminal) => [`pin${terminal.pin}`, String(terminal.pin)]))

export const bp033W5500ProjectFootprintGeometry = {
  artifactKind: "bp033-w5500-project-footprint",
  workUnit: "BP-033",
  reference: "U_W5500",
  manufacturer: "WIZnet",
  manufacturerPartNumber: "W5500",
  sources: [
    {
      authority: "manufacturer-primary",
      document: "W5500 Datasheet Version 1.1.0",
      reviewedPages: "2, 7, 64-65",
      drawingApplicability: "post-July-2021 LQFP-48 package; WIZnet Figure 26 and Figure 27",
      url: "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf",
      artifactPath: "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
      sha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D"
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    reason: "No first-party WIZnet CAD artifact is retained by BP-033.",
    authority: "deny"
  },
  package: {
    designation: "48-pin LQFP, JEDEC MS-026 BBC",
    bodySizeMm,
    leadTipSpanMm,
    pitchMm: leadPitchMm,
    leadWidthMm: { minimum: 0.17, nominal: 0.22, maximum: 0.27 },
    leadLengthMm: { minimum: 0.45, nominal: 0.6, maximum: 0.75 },
    bodyHeightMm: { minimum: 1.35, nominal: 1.4, maximum: 1.45 },
    overallHeightMaximumMm: 1.6,
    thermalPad: {
      exists: false,
      sourceDisposition: "No exposed thermal pad is shown by the applicable LQFP drawing.",
      copperPad: null,
      maskOpening: null,
      pasteOpening: null
    }
  },
  projectSelection: {
    authority: "project-review-input-not-manufacturer-land-pattern",
    copper: {
      padLengthMm: copperPadLengthMm,
      padWidthMm: copperPadWidthMm,
      padCenterFromBodyCenterMm,
      outerCopperSpanMm: 10.2
    },
    solderMask: {
      marginMm: solderMaskMarginMm,
      openingWidthMm: copperPadWidthMm + 2 * solderMaskMarginMm,
      openingLengthMm: copperPadLengthMm + 2 * solderMaskMarginMm
    },
    solderPaste: {
      marginMm: solderPasteMarginMm,
      openingWidthMm: copperPadWidthMm + 2 * solderPasteMarginMm,
      openingLengthMm: copperPadLengthMm + 2 * solderPasteMarginMm,
      thermalPadOpeningCount: 0
    },
    courtyard: {
      widthMm: courtyardSizeMm,
      heightMm: courtyardSizeMm,
      minimumClearanceFromCopperMm: 0.3,
      status: "project-review-input"
    }
  },
  pinOne: {
    pin: 1,
    sourceDatum: "WIZnet Figure 26 top view pin-1 corner marker",
    boardCoordinatesMm: { x: -padCenterFromBodyCenterMm, y: firstPadOffsetMm },
    boardRotationDegrees: 0,
    orientationVerified: false
  },
  terminals,
  acceptance: {
    packageDrawingReviewed: true,
    projectGeometryAccepted: false,
    pinOneOrientationAccepted: false,
    cadImportAccepted: false,
    thermalPadDispositionAccepted: false,
    boardFitAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const projectFootprint = (
  <footprint name="BP033_W5500_PROJECT_FOOTPRINT" originalLayer="top">
    {terminals.map((terminal) => (
      <Fragment key={terminal.pin}>
        <smtpad
          name={String(terminal.pin)}
          pcbX={terminal.xMm}
          pcbY={terminal.yMm}
          shape="rect"
          solderMaskMargin={`${solderMaskMarginMm}mm`}
          solderPasteMargin={`${solderPasteMarginMm}mm`}
          width={`${terminal.copperWidthMm}mm`}
          height={`${terminal.copperHeightMm}mm`}
          portHints={
            terminal.pin === 1
              ? [String(terminal.pin), `pin${terminal.pin}`, "pin1"]
              : [String(terminal.pin), `pin${terminal.pin}`]
          }
        />
      </Fragment>
    ))}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${courtyardSizeMm}mm`}
      height={`${courtyardSizeMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp033W5500ProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review-only component. It is intentionally not imported by a board model. */
export function Bp033W5500ProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp033W5500ProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP033_W5500"
      manufacturerPartNumber="W5500"
      pinLabels={pinLabels}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp033W5500ProjectFootprint
