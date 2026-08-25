import { Fragment, type ReactElement } from "react"

/**
 * BP-032 candidate footprint for the exact STM32G474RET3TR LQFP64 orderable.
 *
 * ST's DS12288 Rev 6 Figure 63 supplies the copper pad and pitch dimensions.
 * Mask, paste, courtyard, and the rendered pin-one marker are project review
 * inputs. This file is intentionally isolated: it is not imported by a board
 * model and cannot grant schematic or fabrication authority.
 */

const source = {
  manufacturer: "STMicroelectronics",
  manufacturerPartNumber: "STM32G474RET3TR",
  document: "STM32G474xB STM32G474xC STM32G474xE",
  documentNumber: "DS12288",
  revision: "6",
  officialUrl: "https://www.st.com/resource/en/datasheet/stm32g474re.pdf",
  artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf",
  sha256: "B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD",
  packageIdentityEvidence: {
    printedPages: [1, 2, 3, 232],
    table: "Table 124 ordering information scheme",
    conclusion: "STM32G474RET3TR decodes to the STM32G474RE 64-pin LQFP, -40 to 125 degree C, tape-and-reel orderable."
  },
  packageDrawingEvidence: {
    printedPages: [210, 211, 212],
    outlineFigure: "Figure 62 LQFP64 - Outline",
    mechanicalTable: "Table 115 LQFP64 - Mechanical data",
    recommendedFootprintFigure: "Figure 63 LQFP64 - Recommended footprint",
    pinOneFigure: "Figure 64 LQFP64 top view example",
    drawingCode: "ai14909c"
  }
} as const

const officialPackageGeometry = {
  package: "LQFP64",
  pinCount: 64,
  body: {
    nominalLengthMm: 10,
    nominalWidthMm: 10,
    heightMm: { minimum: 1.35, nominal: 1.4, maximum: 1.45 },
    sourceSymbols: { length: "D1", width: "E1", height: "A2" }
  },
  leadPitchMm: 0.5,
  recommendedCopper: {
    tangentialWidthMm: 0.3,
    radialLengthMm: 1.2,
    innerPadEdgeSpanMm: 10.3,
    outerPadEdgeSpanMm: 12.7,
    tangentialOuterEdgeSpanMm: 7.8
  }
} as const

const projectGeometry = {
  copper: {
    padWidthMm: 0.3,
    padLengthMm: 1.2,
    radialPadCenterMm: 5.75,
    tangentialFirstCenterMm: -3.75,
    tangentialLastCenterMm: 3.75
  },
  solderMask: {
    marginPerEdgeMm: 0.05,
    openingTangentialMm: 0.4,
    openingRadialMm: 1.3,
    sourceStatus: "project-derived-review-input"
  },
  paste: {
    reductionPerEdgeMm: 0.05,
    openingTangentialMm: 0.2,
    openingRadialMm: 1.1,
    sourceStatus: "project-derived-review-input"
  },
  courtyard: {
    clearanceMm: 0.25,
    widthMm: 13.2,
    heightMm: 13.2,
    sourceStatus: "project-derived-review-input"
  },
  pinOneMarker: {
    shape: "circle",
    centerMm: { x: -5.35, y: -5.35 },
    radiusMm: 0.25,
    sourceStatus: "project-derived-review-input"
  }
} as const

type PadSide = "bottom" | "right" | "top" | "left"

type LqfpPad = {
  readonly pin: number
  readonly side: PadSide
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

function padsForSide(side: PadSide): readonly LqfpPad[] {
  return Array.from({ length: 16 }, (_, index) => {
    const tangent = -3.75 + index * 0.5
    if (side === "bottom") {
      return { pin: index + 1, side, xMm: tangent, yMm: -5.75, widthMm: 0.3, heightMm: 1.2 }
    }
    if (side === "right") {
      return { pin: index + 17, side, xMm: 5.75, yMm: tangent, widthMm: 1.2, heightMm: 0.3 }
    }
    if (side === "top") {
      return { pin: index + 33, side, xMm: 3.75 - index * 0.5, yMm: 5.75, widthMm: 0.3, heightMm: 1.2 }
    }
    return { pin: index + 49, side, xMm: -5.75, yMm: 3.75 - index * 0.5, widthMm: 1.2, heightMm: 0.3 }
  })
}

const pads = Object.freeze([
  ...padsForSide("bottom"),
  ...padsForSide("right"),
  ...padsForSide("top"),
  ...padsForSide("left")
] as LqfpPad[])

const sourceRecord = {
  ...source,
  evidenceRole: "official-family-datasheet-and-package-drawing",
  scope:
    "The retained family datasheet identifies the exact orderable and supplies the LQFP64 outline and recommended footprint. It is not exact-orderable CAD.",
  cad: {
    state: "not-acquired",
    authority: "deny",
    officialProductPage: "https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html",
    listedSuppliers: ["Ultra Librarian", "SamacSys"],
    retainedArtifactPath: null,
    note: "The ST product page lists supplier EDA downloads, but no exact-orderable CAD archive was retained for this slice. No supplier or generic substitute is imported."
  }
} as const

export const bp032Stm32G474Ret3TrLqfp64FootprintEvidence = {
  artifactKind: "bp032-stm32g474ret3tr-lqfp64-footprint-evidence",
  workUnit: "BP-032",
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false,
  source: sourceRecord,
  manufacturerDrawing: {
    state: "retained-family-datasheet-package-drawing",
    authority: "source-only-no-exact-orderable-cad",
    artifactPath: source.artifactPath,
    sha256: source.sha256,
    drawing: source.packageDrawingEvidence.recommendedFootprintFigure
  },
  manufacturerCad: sourceRecord.cad,
  projectFootprint: {
    state: "review-only",
    orientationStatus: "pending-independent-review",
    fabricationAuthority: "deny",
    accepted: false
  },
  package: officialPackageGeometry,
  projectGeometry,
  pinOne: {
    sourceDatum: "lower-left pin-one identifier in the LQFP64 top view",
    pin: 1,
    coordinatesMm: { x: -3.75, y: -5.75 },
    boardRotationDegrees: 0,
    numbering:
      "pins 1 through 16 run left-to-right on the bottom edge; 17 through 32 run bottom-to-top on the right edge; 33 through 48 run right-to-left on the top edge; 49 through 64 run top-to-bottom on the left edge",
    independentOrientationReview: "pending"
  },
  pads,
  requiredFollowUp: [
    "Retain and review an exact-orderable CAD or land-pattern archive if an authoritative source becomes available.",
    "Independently review pin-one marking, assembly rotation, stencil apertures, solder-mask web, and courtyard against the released PCB tool output.",
    "Do not import this candidate into a fabrication board or treat it as manufacturer CAD."
  ]
} as const

type FootprintEvidence = typeof bp032Stm32G474Ret3TrLqfp64FootprintEvidence

function expectedPad(pin: number): LqfpPad | undefined {
  return pads.find((candidate) => candidate.pin === pin)
}

/** Returns drift errors; an empty list is necessary but not sufficient for release. */
export function validateBp032Stm32G474Ret3TrLqfp64FootprintEvidence(
  value: FootprintEvidence = bp032Stm32G474Ret3TrLqfp64FootprintEvidence
): readonly string[] {
  const errors: string[] = []
  const close = (left: number, right: number) => Math.abs(left - right) <= 1e-9
  if (value.workUnit !== "BP-032") errors.push("work unit must remain BP-032")
  if (value.source.manufacturerPartNumber !== "STM32G474RET3TR") errors.push("exact MPN binding drifted")
  if (value.package.package !== "LQFP64" || value.package.pinCount !== 64) errors.push("package identity drifted")
  if (value.source.documentNumber !== "DS12288" || value.source.revision !== "6") {
    errors.push("retained official source must remain DS12288 Rev 6")
  }
  if (!/^[0-9A-F]{64}$/u.test(value.source.sha256)) errors.push("source SHA-256 must be uppercase and complete")
  if (value.source.packageDrawingEvidence.recommendedFootprintFigure !== "Figure 63 LQFP64 - Recommended footprint") {
    errors.push("recommended-footprint source binding drifted")
  }
  const seen = new Set<number>()
  for (const pad of value.pads) {
    if (seen.has(pad.pin)) errors.push(`duplicate pad ${pad.pin}`)
    seen.add(pad.pin)
    const expected = expectedPad(pad.pin)
    if (expected === undefined) {
      errors.push(`unexpected pad ${pad.pin}`)
      continue
    }
    for (const coordinate of ["xMm", "yMm", "widthMm", "heightMm"] as const) {
      if (pad[coordinate] !== expected[coordinate]) errors.push(`pad ${pad.pin} ${coordinate} drifted`)
    }
  }
  if (value.pads.length !== 64 || seen.size !== 64) errors.push("LQFP64 must contain exactly 64 unique pads")
  const sourceCopper = value.package.recommendedCopper
  const copper = value.projectGeometry.copper
  if (copper.padWidthMm !== sourceCopper.tangentialWidthMm || copper.padLengthMm !== sourceCopper.radialLengthMm) {
    errors.push("project copper must retain the Figure 63 recommended pad dimensions")
  }
  if (
    !close(
      value.projectGeometry.solderMask.openingTangentialMm,
      copper.padWidthMm + 2 * value.projectGeometry.solderMask.marginPerEdgeMm
    ) ||
    !close(
      value.projectGeometry.solderMask.openingRadialMm,
      copper.padLengthMm + 2 * value.projectGeometry.solderMask.marginPerEdgeMm
    )
  ) {
    errors.push("solder-mask openings must derive from copper plus the stated margin")
  }
  if (
    !close(
      value.projectGeometry.paste.openingTangentialMm,
      copper.padWidthMm - 2 * value.projectGeometry.paste.reductionPerEdgeMm
    ) ||
    !close(
      value.projectGeometry.paste.openingRadialMm,
      copper.padLengthMm - 2 * value.projectGeometry.paste.reductionPerEdgeMm
    )
  ) {
    errors.push("paste openings must derive from copper minus the stated reduction")
  }
  const requiredCourtyard =
    Math.max(value.package.body.nominalLengthMm, sourceCopper.outerPadEdgeSpanMm) +
    2 * value.projectGeometry.courtyard.clearanceMm
  if (
    value.projectGeometry.courtyard.widthMm < requiredCourtyard ||
    value.projectGeometry.courtyard.heightMm < requiredCourtyard
  ) {
    errors.push("courtyard must enclose body and outer copper span with its stated clearance")
  }
  if (value.fabricationAuthority !== "deny" || value.accepted !== false || value.source.cad.authority !== "deny") {
    errors.push("candidate and CAD authority must remain denied")
  }
  return errors
}

const footprint = (
  <footprint name="BP032_STM32G474RET3TR_LQFP64_CANDIDATE" originalLayer="top">
    {pads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={String(pad.pin)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin="0.05mm"
          solderPasteMargin="-0.05mm"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[String(pad.pin), `pin${pad.pin}`, pad.side, ...(pad.pin === 1 ? ["pin1"] : [])]}
        />
      </Fragment>
    ))}
    <courtyardrect pcbX={0} pcbY={0} width="13.2mm" height="13.2mm" strokeWidth="0.05mm" />
    <silkscreencircle pcbX={-5.35} pcbY={-5.35} radius="0.25mm" strokeWidth="0.1mm" />
  </footprint>
)

export interface Bp032Stm32G474Ret3TrLqfp64FootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review component; it is not a fabrication-release footprint. */
export function Bp032Stm32G474Ret3TrLqfp64CandidateFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp032Stm32G474Ret3TrLqfp64FootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_STM32G474RET3TR"
      manufacturerPartNumber="STM32G474RET3TR"
      footprint={footprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp032Stm32G474Ret3TrLqfp64CandidateFootprint
