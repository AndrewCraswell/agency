import type { ReactElement } from "react"

const projectCopperPadLengthMm = 0.8
const projectCopperPadWidthMm = 0.9
const projectOverallLandSpanMm = 2.1
const projectCopperPadGapMm = projectOverallLandSpanMm - 2 * projectCopperPadLengthMm
const projectCopperPadCenterXMm = (projectCopperPadGapMm + projectCopperPadLengthMm) / 2

/**
 * BP-031 project land pattern for Panasonic ERA3AEB2491V.
 *
 * This isolated review artifact covers the seven source resistors only. It is
 * deliberately not imported by a board model, and its project-defined mask,
 * paste, and courtyard values do not turn Panasonic's land-pattern guidance
 * into fabrication release data.
 */
export const benchPrototypeEra3aProjectFootprintGeometry = {
  artifactKind: "bp031-era3aeb2491v-project-footprint",
  workUnit: "BP-031",
  manufacturer: "Panasonic Industry",
  manufacturerPartNumber: "ERA3AEB2491V",
  appliesToReferences: [
    "R_SOURCE_1",
    "R_SOURCE_2",
    "R_SOURCE_3",
    "R_SOURCE_4",
    "R_SOURCE_5",
    "R_SOURCE_6",
    "R_SOURCE_7"
  ],
  sources: [
    {
      id: "panasonic-era3a-package",
      authority: "manufacturer-primary",
      documentNumber: "AOA0000C309",
      url: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf",
      reviewedPage: 3,
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
      sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79"
    },
    {
      id: "panasonic-1608-rectangular-land-pattern",
      authority: "manufacturer-primary",
      documentNumber: "DMM0000COL20",
      url: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf",
      reviewedPage: 1,
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf",
      sha256: "65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D"
    }
  ],
  manufacturerCad: {
    state: "unavailable",
    authority: "deny"
  },
  package: {
    designation: "1608 (0603)",
    lengthMm: { nominal: 1.6, tolerance: 0.2 },
    widthMm: { nominal: 0.8, tolerance: 0.2 },
    terminalLengthMm: { nominal: 0.3, tolerance: 0.2 },
    terminalWidthMm: { nominal: 0.3, tolerance: 0.2 }
  },
  manufacturerLandPattern: {
    designation: "1608 (0603) rectangular land pattern",
    aPadLengthMm: { minimum: 0.7, maximum: 0.9 },
    bOverallLandSpanMm: { minimum: 2, maximum: 2.2 },
    cPadWidthMm: { minimum: 0.8, maximum: 1 }
  },
  projectSelection: {
    rationale: "Midpoint selection within the Panasonic 1608 high-precision ERA a, b, and c ranges.",
    copperPad: { lengthMm: projectCopperPadLengthMm, widthMm: projectCopperPadWidthMm },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: 0.9,
      openingWidthMm: 1,
      marginMm: 0.05,
      status: "project-input"
    },
    paste: {
      openingLengthMm: 0.7,
      openingWidthMm: 0.8,
      reductionPerEdgeMm: 0.05,
      status: "project-input"
    },
    courtyard: {
      lengthMm: 2.4,
      widthMm: 1.3,
      minimumClearanceMm: 0.15,
      status: "project-review-input"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
  ],
  orientation: {
    state: "pending-review",
    note: "The two terminals are non-polar. No pin-one or placement orientation is asserted by this project artifact."
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const projectFootprint = (
  <footprint name="BP031_ERA3AEB2491V_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.8mm"
      height="0.9mm"
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.8mm"
      height="0.9mm"
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    {/* This is a review-overlay courtyard, not a manufacturer-CAD layer. */}
    <courtyardrect pcbX={0} pcbY={0} width="2.4mm" height="1.3mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface BenchPrototypeEra3aProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the BP-031 source-resistor footprint review. */
export function BenchPrototypeEra3aProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeEra3aProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="R_BP031_ERA3AEB2491V"
      manufacturerPartNumber="ERA3AEB2491V"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeEra3aProjectFootprint
