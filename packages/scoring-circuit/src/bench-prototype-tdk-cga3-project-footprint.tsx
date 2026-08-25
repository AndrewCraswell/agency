import type { ReactElement } from "react"

const projectCopperPadLengthMm = 0.7
const projectCopperPadWidthMm = 0.7
const projectCopperPadGapMm = 0.7
const projectOverallLandSpanMm = Number((projectCopperPadGapMm + 2 * projectCopperPadLengthMm).toFixed(3))
const projectCopperPadCenterXMm = Number(((projectCopperPadGapMm + projectCopperPadLengthMm) / 2).toFixed(3))
const projectSolderMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0.05
const projectSolderMaskOpeningLengthMm = Number((projectCopperPadLengthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectSolderMaskOpeningWidthMm = Number((projectCopperPadWidthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectPasteOpeningLengthMm = Number((projectCopperPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((projectCopperPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectCourtyardLengthMm = 2.4
const projectCourtyardWidthMm = 1.3
const projectCourtyardClearanceMm = 0.15

const affectedReferences = [
  "C_REF_IN_1",
  "C_REF_IN_2",
  "C_REF_IN_3",
  "C_REF_IN_4",
  "C_REF_IN_5",
  "C_REF_IN_6",
  "C_REF_IN_7"
] as const

/**
 * BP-031 project land-pattern candidate for the exact TDK capacitor used by
 * the seven reference-input bypasses. This isolated artifact is not imported
 * by a board model and does not grant fabrication or release authority.
 */
export const benchPrototypeTdkCga3ProjectFootprintGeometry = {
  artifactKind: "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint",
  workUnit: "BP-031",
  manufacturer: "TDK Corporation",
  manufacturerPartNumber: "CGA3E3X7R1H105K080AB",
  sourceContract: "BP-101",
  role: "reference input bypass",
  geometryAuthority: "project-review-input-not-manufacturer-specification",
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "C_REF_IN",
    replicatedReferencePrefix: "C_REF_IN_",
    manufacturer: "TDK",
    manufacturerPartNumber: "CGA3E3X7R1H105K080AB",
    package: "0603"
  },
  affectedReferences,
  primaryProductPageUrl: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E3X7R1H105K080AB",
  sourceControl: {
    basisCommit: "f85f5c35937bc36ee52fc8b5799890150a3adf59",
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
      id: "tdk-exact-part-detail",
      authority: "tdk-product-report-mirrored-by-farnell",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-cga3e3x7r1h105k080ab-detail.pdf",
      sourceUrl: "https://www.farnell.com/datasheets/4491451.pdf",
      sha256: "8692A2973DD875110C6F3FE3EB0A688454C0A155DCC8FCFAF3130F6862EC316F",
      scope:
        "Exact CGA3E3X7R1H105K080AB product report. It names the orderable, package, electrical rating, and PA/PB/PC land-pattern guidance; its associated land image is reference material, not project CAD."
    },
    {
      id: "tdk-automotive-catalog",
      authority: "manufacturer-primary",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-automotive-general-zh.pdf",
      sourceUrl:
        "https://product.tdk.cn/system/files/dam/doc/product/capacitor/ceramic/mlcc/catalog/mlcc_automotive_general_zh.pdf",
      sha256: "E6F5803E89514DC61813BF2C96414D784005274730A8AF43A5EF54EBD546DBFF",
      scope:
        "TDK automotive MLCC catalog. It identifies CGA3 as 1608 and EIA 0603, records the CGA3 body dimensions, and lists the exact 1 uF X7R orderable."
    },
    {
      id: "tdk-virtual-component-library-parts-list",
      authority: "manufacturer-primary",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-virtual-component-library-parts-list.pdf",
      sourceUrl: "https://product.tdk.cn/system/files/dam/tvcl/partslist_mlcc_en.pdf",
      sha256: "B71416318033D9E0E50E4386A758FE58E133805F289B0200DFDE983B4FDA6DA4",
      scope:
        "TDK virtual-component-library parts list. It confirms the exact orderable under the CGA3 automotive general family; it is identity/model evidence and does not supply project geometry."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "Manufacturer CAD was not acquired or retained for this candidate."
  },
  package: {
    designation: "CGA3 (1608 / EIA 0603)",
    lengthMm: { nominal: 1.6, plus: 0.2, minus: 0.1 },
    widthMm: { nominal: 0.8, plus: 0.2, minus: 0.1 },
    thicknessMm: { nominal: 0.8, plus: 0.2, minus: 0.1 },
    terminalWidthMm: { minimum: 0.2 },
    terminalSpacingMm: { minimum: 0.3 }
  },
  manufacturerLandPattern: {
    designation: "TDK CGA3 recommended land pattern",
    sourceScope: "manufacturer guidance only",
    flow: {
      paGapMm: { minimum: 0.7, maximum: 1.0 },
      pbPadLengthMm: { minimum: 0.8, maximum: 1.0 },
      pcPadWidthMm: { minimum: 0.6, maximum: 0.8 }
    },
    reflow: {
      paGapMm: { minimum: 0.6, maximum: 0.8 },
      pbPadLengthMm: { minimum: 0.6, maximum: 0.8 },
      pcPadWidthMm: { minimum: 0.6, maximum: 0.8 }
    }
  },
  projectSelection: {
    solderingMethod: "reflow",
    rationale: "Midpoint selection within the TDK CGA3 PA, PB, and PC reflow ranges.",
    manufacturerParameterSelectionMm: { paGap: 0.7, pbPadLength: 0.7, pcPadWidth: 0.7 },
    copperPad: { lengthMm: projectCopperPadLengthMm, widthMm: projectCopperPadWidthMm },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: projectSolderMaskOpeningLengthMm,
      openingWidthMm: projectSolderMaskOpeningWidthMm,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      derivation: "0.7 mm copper dimension + 2 x 0.05 mm project mask margin",
      status: "project-input"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      derivation: "0.7 mm copper dimension - 2 x 0.05 mm project paste reduction",
      status: "project-input"
    },
    courtyard: {
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      minimumClearanceMm: projectCourtyardClearanceMm,
      derivation:
        "max(2.1 mm land span, 1.8 mm maximum package length) + 2 x 0.15 mm; max(1.0 mm package width, 0.7 mm pad width) + 2 x 0.15 mm",
      status: "project-review-input"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
  ],
  stressOrientationReview: {
    state: "pending-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    ratedVoltageVdc: 50,
    nominalApplicationRailVdc: 5,
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    dcBiasEvidence: "not-retained",
    note: "The ceramic capacitor has no polarity or pin-one requirement. Rotation is functionally equivalent, but rail transient, effective capacitance at the application bias, placement, and assembly-clearance review remain open."
  },
  orientation: {
    state: "pending-review",
    assemblyRotationDeg: null,
    datum: "local two-terminal axis",
    note: "No pin-one or polarity orientation is asserted by this project candidate."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "D1DB1A503674A4E51CFB8E529C93CD02ACF6C30D025C284FD08431E239D945EC",
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const projectFootprint = (
  <footprint name="BP031_TDK_CGA3E3X7R1H105K080AB_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadWidthMm}mm`}
      height={`${projectCopperPadLengthMm}mm`}
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadWidthMm}mm`}
      height={`${projectCopperPadLengthMm}mm`}
      portHints={["2", "B", "non-polar", "pin2"]}
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

export interface BenchPrototypeTdkCga3ProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the BP-031 exact-capacitor review. */
export function BenchPrototypeTdkCga3ProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeTdkCga3ProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_TDK_CGA3E3X7R1H105K080AB"
      manufacturerPartNumber="CGA3E3X7R1H105K080AB"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeTdkCga3ProjectFootprint
