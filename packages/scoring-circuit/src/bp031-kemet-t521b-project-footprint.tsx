import type { ReactElement } from "react"

const projectCopperPadLengthMm = 1
const projectCopperPadWidthMm = 2.2
const projectCopperPadGapMm = 1.9
const projectOverallLandSpanMm = Number((projectCopperPadGapMm + 2 * projectCopperPadLengthMm).toFixed(3))
const projectCopperPadCenterXMm = Number(((projectCopperPadGapMm + projectCopperPadLengthMm) / 2).toFixed(3))
const projectSolderMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0.05
const projectSolderMaskOpeningLengthMm = Number((projectCopperPadLengthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectSolderMaskOpeningWidthMm = Number((projectCopperPadWidthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectPasteOpeningLengthMm = Number((projectCopperPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((projectCopperPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectCourtyardLengthMm = 4.2
const projectCourtyardWidthMm = 3.3
const projectCourtyardClearanceMm = 0.15

const affectedReferences = [
  "C_REF_REG_1",
  "C_REF_REG_2",
  "C_REF_REG_3",
  "C_REF_REG_4",
  "C_REF_REG_5",
  "C_REF_REG_6",
  "C_REF_REG_7"
] as const

/**
 * BP-031 project land-pattern candidate for the exact KEMET polymer tantalum
 * capacitor used on the REF5025 local output. This isolated artifact is not
 * imported by a board model and does not grant fabrication or release
 * authority.
 */
export const benchPrototypeKemetT521bProjectFootprintGeometry = {
  artifactKind: "bp031-kemet-t521b106m025ate100-project-footprint",
  workUnit: "BP-031",
  manufacturer: "KEMET",
  manufacturerPartNumber: "T521B106M025ATE100",
  sourceContract: "BP-101",
  role: "REF5025A-Q1 local output stabilization",
  geometryAuthority: "project-review-input-not-manufacturer-specification",
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "C_REF_REG",
    replicatedReferencePrefix: "C_REF_REG_",
    manufacturer: "KEMET",
    manufacturerPartNumber: "T521B106M025ATE100",
    package: "1411 / 3528 B case"
  },
  affectedReferences,
  primaryProductPageUrl: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
  sourceControl: {
    basisCommit: "7a3566bfcdffb1db64310e4731038f08cac40305",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
        sha256: "ac7a72f68b8d9113b6ad1d161645cc8f8b7062207abf4fe5411042962e22314c"
      }
    ]
  },
  sources: [
    {
      id: "kemet-exact-part-drawing",
      authority: "manufacturer-primary",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf",
      sourceUrl: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
      sha256: "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD",
      scope:
        "Exact KEMET T521B106M025ATE100 product specsheet. It names the orderable, 1411 / 3528 B-case package, polarity end views, package dimensions, and terminal dimensions. It does not publish a PCB land pattern or manufacturer CAD."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "Manufacturer CAD was not acquired or retained for this candidate."
  },
  package: {
    designation: "1411 / 3528 B case",
    lengthMm: { nominal: 3.5, plus: 0.2, minus: 0.2 },
    widthMm: { nominal: 2.8, plus: 0.2, minus: 0.2 },
    heightMm: { nominal: 1.9, plus: 0.1, minus: 0.1 },
    terminalLengthMm: { nominal: 0.8, plus: 0.3, minus: 0.3 },
    terminalWidthMm: { nominal: 2.2, plus: 0.1, minus: 0.1 },
    terminalGapMm: { minimum: 1.9 }
  },
  manufacturerLandPattern: {
    state: "not-published",
    sourceScope: "exact-part package drawing only",
    note: "The retained KEMET drawing describes the component terminals but does not provide a PCB land-pattern recommendation or CAD."
  },
  projectSelection: {
    solderingMethod: "reflow",
    rationale:
      "Project-review copper uses the drawing's nominal terminal width F=2.2 mm across the package and a 1.0 mm pad length along the terminal axis. The 1.0 mm length is a project selection within the drawing's S=0.8 +/- 0.3 mm terminal-length envelope; the 1.9 mm copper gap meets the drawing's A=1.9 mm minimum terminal-gap dimension without claiming manufacturer land guidance.",
    drawingInputsMm: {
      packageLengthNominal: 3.5,
      packageWidthNominal: 2.8,
      terminalLengthNominal: 0.8,
      terminalLengthTolerance: 0.3,
      terminalWidthNominal: 2.2,
      terminalWidthTolerance: 0.1,
      terminalGapMinimum: 1.9
    },
    projectCopperPad: {
      lengthMm: projectCopperPadLengthMm,
      widthMm: projectCopperPadWidthMm
    },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: projectSolderMaskOpeningLengthMm,
      openingWidthMm: projectSolderMaskOpeningWidthMm,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      derivation: "1.0 mm x 2.2 mm project copper + 2 x 0.05 mm project mask margin per axis",
      status: "project-input"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      derivation: "1.0 mm x 2.2 mm project copper - 2 x 0.05 mm project paste reduction per axis",
      status: "project-input"
    },
    courtyard: {
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      minimumClearanceMm: projectCourtyardClearanceMm,
      derivation:
        "max(3.7 mm maximum package length, 3.9 mm selected land span) + 2 x 0.15 mm; max(3.0 mm maximum package width, 2.2 mm selected pad width) + 2 x 0.15 mm",
      status: "project-review-input"
    }
  },
  terminals: [
    {
      pad: "1",
      terminal: "K",
      polarity: "cathode-negative",
      xMm: -projectCopperPadCenterXMm,
      yMm: 0,
      localDatum: "left pad in top view"
    },
    {
      pad: "2",
      terminal: "A",
      polarity: "anode-positive",
      xMm: projectCopperPadCenterXMm,
      yMm: 0,
      localDatum: "right pad in top view"
    }
  ],
  stressOrientationReview: {
    state: "pending-review",
    polarity: "polarized",
    pinOne: "pad 1 is the local cathode-negative datum; independent assembly orientation review is pending",
    ratedVoltageVdc: 25,
    nominalApplicationRailVdc: 2.5,
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    dcBiasEvidence: "not-retained",
    note: "The retained drawing shows separate cathode-negative and anode-positive end views, but it does not establish the board-origin numbering or assembly rotation. Verify the polarity stripe, pad numbering, REF5025A-Q1 rail stress, derating, ripple, placement, and assembly clearance before acceptance."
  },
  orientation: {
    state: "pending-review",
    assemblyRotationDeg: null,
    datum: "local top-view polarity axis; pad 1 left is cathode-negative and pad 2 right is anode-positive",
    note: "The project candidate exposes a polarity datum only; independent orientation and pin-number review remain open."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "43EBA95B452F5F82802DC15C153A4E2555D591177A216923D3E2A1CFA8F3B3A1",
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const projectFootprint = (
  <footprint name="BP031_KEMET_T521B106M025ATE100_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["1", "K", "cathode", "negative", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["2", "A", "anode", "positive", "pin2"]}
    />
    {/* This review courtyard is project geometry, not manufacturer CAD. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardLengthMm}mm`}
      height={`${projectCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface BenchPrototypeKemetT521bProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the BP-031 exact-capacitor review. */
export function BenchPrototypeKemetT521bProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeKemetT521bProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_KEMET_T521B106M025ATE100"
      manufacturerPartNumber="T521B106M025ATE100"
      pinLabels={{ pin1: "K", pin2: "A" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeKemetT521bProjectFootprint
