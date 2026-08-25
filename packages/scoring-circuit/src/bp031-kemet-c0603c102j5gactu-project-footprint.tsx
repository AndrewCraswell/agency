import type { ReactElement } from "react"

const affectedReferences = ["C_SAR_1", "C_SAR_2", "C_SAR_3", "C_SAR_4", "C_SAR_5", "C_SAR_6", "C_SAR_7"] as const

const packageLengthMm = { nominal: 1.6, minimum: 1.45, maximum: 1.75 } as const
const packageWidthMm = { nominal: 0.8, minimum: 0.65, maximum: 0.95 } as const
const packageThicknessMm = { nominal: 0.8, minimum: 0.73, maximum: 0.87 } as const
const terminalBandwidthMm = { nominal: 0.35, minimum: 0.2, maximum: 0.5 } as const
const terminalSeparationMinimumMm = 0.5

// KEMET Table 4, standard termination, density level B (median/nominal).
const manufacturerPadGapMm = 0.8
const manufacturerPadLengthMm = 0.95
const manufacturerPadWidthMm = 1.0
const manufacturerGridCourtyardLengthMm = 3.1
const manufacturerGridCourtyardWidthMm = 1.5

// These layer dimensions are project review inputs, not KEMET-published CAD.
const projectMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0.05
const projectPadCenterXMm = (manufacturerPadGapMm + manufacturerPadLengthMm) / 2
const projectCourtyardClearanceLengthMm = 0.2
const projectCourtyardClearanceWidthMm = 0.25
const projectMaskOpeningLengthMm = Number((manufacturerPadLengthMm + 2 * projectMaskMarginMm).toFixed(3))
const projectMaskOpeningWidthMm = Number((manufacturerPadWidthMm + 2 * projectMaskMarginMm).toFixed(3))
const projectPasteOpeningLengthMm = Number((manufacturerPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((manufacturerPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))

const sourceExactPartArtifactPath =
  "packages/scoring-circuit/docs/evidence/bp-031/bp031-kemet-c0603c102j5gactu-cer-eng-kit-29.pdf"
const sourceLandPatternArtifactPath =
  "packages/scoring-circuit/docs/evidence/bp-031/bp031-kemet-c0603c102j5gactu-c0g-esd-land-pattern.pdf"
const sourceExactPartSha256 = "73A53686BECC6EE192B0D265C22752E17B9F1E3DE2E979E6964470E005EE7596"
const sourceLandPatternSha256 = "E7A71BB470BBC82E77E3ECBFCE7749D3F5C963985E62D4494AD52DE285945189"
const canonicalReadinessSourceSha256 = "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
const canonicalExperimentSourceSha256 = "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
const canonicalTopologySourceSha256 = "1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d"

/**
 * BP-031 review-only project footprint for exact KEMET C0603C102J5GACTU.
 * KEMET publishes the package and IPC-7351 copper/grid-courtyard guidance;
 * mask, paste, and CAD-layer objects remain explicit project inputs.
 */
export const bp031KemetC0603C102J5GactuProjectFootprint = {
  artifactKind: "bp031-kemet-c0603c102j5gactu-project-footprint",
  workUnit: "BP-031",
  manufacturer: "KEMET",
  manufacturerPartNumber: "C0603C102J5GACTU",
  sourceContract: "BP-102",
  role: "SAR filter capacitor",
  affectedReferences,
  geometryAuthority: "project-review-input-with-kemet-ipc-guidance",
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "C_SAR",
    replicatedReferencePrefix: "C_SAR_",
    manufacturer: "KEMET",
    manufacturerPartNumber: "C0603C102J5GACTU",
    package: "0603",
    primarySourceId: "kemet-cer-eng-kit-29",
    sourceContract: "BP-102"
  },
  sourceControl: {
    basisCommit: "0f9e3f5a3a0aa8183b5bc71ca2b553445a462dbc",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        sha256: canonicalReadinessSourceSha256
      },
      {
        path: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
        sha256: canonicalExperimentSourceSha256
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
        sha256: canonicalTopologySourceSha256
      }
    ]
  },
  sources: [
    {
      id: "kemet-cer-eng-kit-29",
      authority: "manufacturer-primary",
      documentNumber: "CER ENG KIT 29",
      revision: "2023-10-02",
      url: "https://content.kemet.com/datasheets/CER_ENG_KIT_29.pdf",
      reviewedPages: "1-2",
      artifactPath: sourceExactPartArtifactPath,
      sha256: sourceExactPartSha256,
      scope:
        "KEMET exact-part sample-kit table and 0603/1608 dimensions. It names C0603C102J5GACTU as 1000 pF, ±5%, 50 V, C0G, with 0.80 ±0.07 mm thickness."
    },
    {
      id: "kemet-c1091-c0g-esd-land-pattern",
      authority: "manufacturer-primary",
      documentNumber: "C1091_C0G_ESD",
      revision: "2025-02-26",
      url: "https://content.kemet.com/datasheets/KEM_C1091_C0G_ESD.pdf",
      reviewedPages: "9-10",
      artifactPath: sourceLandPatternArtifactPath,
      sha256: sourceLandPatternSha256,
      scope:
        "KEMET C0G standard-termination family guidance. Table 4 supplies IPC-7351 density-level-B 0603 copper dimensions and V1/V2 grid-placement courtyard values; it is not a KEMET CAD object for this exact orderable."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "KEMET primary PDFs provide package and IPC guidance but no exact-orderable CAD object was acquired or retained."
  },
  package: {
    designation: "0603 (1608 metric) ceramic chip capacitor",
    caseSize: "EIA 0603 / IEC 1608",
    dielectric: "C0G",
    capacitancePf: 1000,
    tolerancePercent: 5,
    ratedVoltageVdc: 50,
    lengthMm: packageLengthMm,
    widthMm: packageWidthMm,
    thicknessMm: packageThicknessMm,
    terminalBandwidthMm,
    terminalSeparationMinimumMm,
    terminals: 2
  },
  manufacturerLandPattern: {
    sourceId: "kemet-c1091-c0g-esd-land-pattern",
    sourceScope: "manufacturer IPC-7351 guidance, not exact-orderable CAD",
    termination: "standard",
    densityLevel: "B",
    copper: {
      padGapMm: manufacturerPadGapMm,
      padLengthMm: manufacturerPadLengthMm,
      padWidthMm: manufacturerPadWidthMm,
      padCenterSpanMm: manufacturerPadGapMm + manufacturerPadLengthMm,
      sourceStatement:
        "KEMET C1091 Table 4 density-level-B standard-termination 0603 row: C 0.80 mm, Y 0.95 mm, X 1.00 mm."
    },
    solderMask: {
      status: "not-published",
      sourceStatement:
        "The retained KEMET primary PDFs do not specify an exact-orderable solder-mask opening or margin."
    },
    paste: {
      status: "not-published",
      sourceStatement:
        "The retained KEMET primary PDFs do not specify an exact-orderable stencil aperture or reduction."
    },
    courtyard: {
      status: "ipc-grid-placement-published",
      lengthMm: manufacturerGridCourtyardLengthMm,
      widthMm: manufacturerGridCourtyardWidthMm,
      sourceStatement:
        "KEMET C1091 Table 4 density-level-B V1 3.10 mm and V2 1.50 mm grid-placement courtyard guidance."
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectPadCenterXMm, yMm: 0 }
  ],
  projectSelection: {
    solderingMethod: "reflow",
    manufacturerParameterSelectionMm: {
      densityLevel: "B",
      padGap: manufacturerPadGapMm,
      padLength: manufacturerPadLengthMm,
      padWidth: manufacturerPadWidthMm,
      gridCourtyardLength: manufacturerGridCourtyardLengthMm,
      gridCourtyardWidth: manufacturerGridCourtyardWidthMm
    },
    copperPad: {
      lengthMm: manufacturerPadLengthMm,
      widthMm: manufacturerPadWidthMm,
      gapMm: manufacturerPadGapMm,
      centerSpanMm: manufacturerPadGapMm + manufacturerPadLengthMm
    },
    solderMask: {
      openingLengthMm: projectMaskOpeningLengthMm,
      openingWidthMm: projectMaskOpeningWidthMm,
      marginPerEdgeMm: projectMaskMarginMm,
      derivation: "project NSMD review input: KEMET copper dimensions plus 0.05 mm per edge",
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      derivation: "project reflow review input: KEMET copper dimensions less 0.05 mm per edge",
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      lengthMm: manufacturerGridCourtyardLengthMm,
      widthMm: manufacturerGridCourtyardWidthMm,
      clearanceFromPadAndPackageMm: {
        length: projectCourtyardClearanceLengthMm,
        width: projectCourtyardClearanceWidthMm
      },
      derivation:
        "project review adopts KEMET density-level-B V1/V2 grid-placement courtyard; copper envelope is 2.70 mm by 1.00 mm and the package maximum is 1.75 mm by 0.95 mm",
      status: "project-review-input-from-manufacturer-grid-guidance"
    }
  },
  orientation: {
    state: "pending-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    rotationEquivalence: "180-degree rotationally equivalent",
    datum: "local two-terminal capacitor axis",
    note: "C0603C102J5GACTU has no polarity or pin-one requirement. A and B are arbitrary review endpoints; rail transient, bias-dependent capacitance, assembly placement, and stress review remain open."
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-with-kemet-ipc-guidance",
    padShape: "rectangular-smt",
    pads: [
      { pad: "1", terminal: "A", xMm: -projectPadCenterXMm, yMm: 0 },
      { pad: "2", terminal: "B", xMm: projectPadCenterXMm, yMm: 0 }
    ],
    solderMask: {
      openingLengthMm: projectMaskOpeningLengthMm,
      openingWidthMm: projectMaskOpeningWidthMm,
      marginPerEdgeMm: projectMaskMarginMm,
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      lengthMm: manufacturerGridCourtyardLengthMm,
      widthMm: manufacturerGridCourtyardWidthMm,
      status: "project-review-input-from-manufacturer-grid-guidance"
    },
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "F88A68AD1C2F808FD5CF38F97A26B843BB68FAE50A046250385E2E55A7C2CF84",
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

/** Empty output means the deny-by-default candidate is internally consistent. */
export function validateBp031KemetC0603C102J5GactuProjectFootprint(
  candidate: typeof bp031KemetC0603C102J5GactuProjectFootprint = bp031KemetC0603C102J5GactuProjectFootprint
): readonly string[] {
  const evidence = candidate
  const errors: string[] = []
  const exactSource = evidence.sources[0]
  const landSource = evidence.sources[1]
  const upstreamReadiness = evidence.sourceControl.upstreamSources[0]
  const upstreamExperiment = evidence.sourceControl.upstreamSources[1]
  const upstreamTopology = evidence.sourceControl.upstreamSources[2]
  if (evidence.sources.length !== 2 || evidence.sourceControl.upstreamSources.length !== 3) {
    errors.push("BP-031 KEMET source set drifted")
  }
  if (
    evidence.workUnit !== "BP-031" ||
    evidence.manufacturer !== "KEMET" ||
    evidence.manufacturerPartNumber !== "C0603C102J5GACTU" ||
    evidence.sourceContract !== "BP-102" ||
    evidence.role !== "SAR filter capacitor" ||
    JSON.stringify(evidence.affectedReferences) !== JSON.stringify(affectedReferences)
  ) {
    errors.push("exact KEMET C0603C102J5GACTU identity or seven-reference scope drifted")
  }
  if (
    evidence.sourceBinding.canonicalSourcePath !== "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    evidence.sourceBinding.canonicalSourceReference !== "C_SAR" ||
    evidence.sourceBinding.replicatedReferencePrefix !== "C_SAR_" ||
    evidence.sourceBinding.manufacturer !== "KEMET" ||
    evidence.sourceBinding.manufacturerPartNumber !== "C0603C102J5GACTU" ||
    evidence.sourceBinding.package !== "0603" ||
    evidence.sourceBinding.primarySourceId !== "kemet-cer-eng-kit-29" ||
    evidence.sourceBinding.sourceContract !== "BP-102"
  ) {
    errors.push("C_SAR canonical source binding drifted")
  }
  if (
    evidence.sourceControl.basisCommit !== "0f9e3f5a3a0aa8183b5bc71ca2b553445a462dbc" ||
    upstreamReadiness?.path !== "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    upstreamReadiness?.sha256 !== canonicalReadinessSourceSha256 ||
    upstreamExperiment?.path !== "packages/scoring-circuit/src/one-channel-analog-experiment.ts" ||
    upstreamExperiment?.sha256 !== canonicalExperimentSourceSha256 ||
    upstreamTopology?.path !== "packages/scoring-circuit/src/bench-prototype-analog-topology.ts" ||
    upstreamTopology?.sha256 !== canonicalTopologySourceSha256
  ) {
    errors.push("C_SAR upstream source-control hashes drifted")
  }
  if (
    exactSource === undefined ||
    exactSource.id !== "kemet-cer-eng-kit-29" ||
    exactSource.authority !== "manufacturer-primary" ||
    exactSource.documentNumber !== "CER ENG KIT 29" ||
    exactSource.revision !== "2023-10-02" ||
    exactSource.url !== "https://content.kemet.com/datasheets/CER_ENG_KIT_29.pdf" ||
    exactSource.reviewedPages !== "1-2" ||
    exactSource.artifactPath !== sourceExactPartArtifactPath ||
    exactSource.sha256 !== sourceExactPartSha256 ||
    !/^[0-9A-F]{64}$/u.test(exactSource.sha256)
  ) {
    errors.push("KEMET exact-part source identity or SHA-256 drifted")
  }
  if (
    landSource === undefined ||
    landSource.id !== "kemet-c1091-c0g-esd-land-pattern" ||
    landSource.authority !== "manufacturer-primary" ||
    landSource.documentNumber !== "C1091_C0G_ESD" ||
    landSource.revision !== "2025-02-26" ||
    landSource.url !== "https://content.kemet.com/datasheets/KEM_C1091_C0G_ESD.pdf" ||
    landSource.reviewedPages !== "9-10" ||
    landSource.artifactPath !== sourceLandPatternArtifactPath ||
    landSource.sha256 !== sourceLandPatternSha256 ||
    !/^[0-9A-F]{64}$/u.test(landSource.sha256)
  ) {
    errors.push("KEMET land-pattern source identity or SHA-256 drifted")
  }
  if (
    evidence.package.designation !== "0603 (1608 metric) ceramic chip capacitor" ||
    evidence.package.caseSize !== "EIA 0603 / IEC 1608" ||
    evidence.package.dielectric !== "C0G" ||
    evidence.package.capacitancePf !== 1000 ||
    evidence.package.tolerancePercent !== 5 ||
    evidence.package.ratedVoltageVdc !== 50 ||
    evidence.package.lengthMm.minimum !== 1.45 ||
    evidence.package.lengthMm.maximum !== 1.75 ||
    evidence.package.widthMm.minimum !== 0.65 ||
    evidence.package.widthMm.maximum !== 0.95 ||
    evidence.package.thicknessMm.minimum !== 0.73 ||
    evidence.package.thicknessMm.maximum !== 0.87 ||
    evidence.package.terminalBandwidthMm.minimum !== 0.2 ||
    evidence.package.terminalBandwidthMm.maximum !== 0.5 ||
    evidence.package.terminalSeparationMinimumMm !== 0.5 ||
    evidence.package.terminals !== 2
  ) {
    errors.push("KEMET 0603 package or exact electrical dimensions drifted")
  }
  if (
    evidence.manufacturerCad.state !== "not-acquired" ||
    evidence.manufacturerCad.artifactPath !== null ||
    evidence.manufacturerCad.authority !== "deny"
  ) {
    errors.push("KEMET manufacturer CAD must remain unacquired and denied")
  }
  if (
    evidence.manufacturerLandPattern.sourceId !== "kemet-c1091-c0g-esd-land-pattern" ||
    evidence.manufacturerLandPattern.termination !== "standard" ||
    evidence.manufacturerLandPattern.densityLevel !== "B" ||
    evidence.manufacturerLandPattern.copper.padGapMm !== 0.8 ||
    evidence.manufacturerLandPattern.copper.padLengthMm !== 0.95 ||
    evidence.manufacturerLandPattern.copper.padWidthMm !== 1.0 ||
    evidence.manufacturerLandPattern.courtyard.lengthMm !== 3.1 ||
    evidence.manufacturerLandPattern.courtyard.widthMm !== 1.5 ||
    evidence.manufacturerLandPattern.solderMask.status !== "not-published" ||
    evidence.manufacturerLandPattern.paste.status !== "not-published"
  ) {
    errors.push("KEMET primary-vs-project land-pattern distinction drifted")
  }
  if (
    evidence.projectSelection.copperPad.gapMm !== manufacturerPadGapMm ||
    evidence.projectSelection.copperPad.lengthMm !== manufacturerPadLengthMm ||
    evidence.projectSelection.copperPad.widthMm !== manufacturerPadWidthMm ||
    evidence.projectSelection.copperPad.centerSpanMm !== manufacturerPadGapMm + manufacturerPadLengthMm ||
    evidence.projectSelection.solderMask.openingLengthMm !== projectMaskOpeningLengthMm ||
    evidence.projectSelection.solderMask.openingWidthMm !== projectMaskOpeningWidthMm ||
    evidence.projectSelection.solderMask.marginPerEdgeMm !== projectMaskMarginMm ||
    evidence.projectSelection.solderMask.status !== "project-input-not-manufacturer-specification" ||
    evidence.projectSelection.paste.openingLengthMm !== projectPasteOpeningLengthMm ||
    evidence.projectSelection.paste.openingWidthMm !== projectPasteOpeningWidthMm ||
    evidence.projectSelection.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    evidence.projectSelection.paste.status !== "project-input-not-manufacturer-specification" ||
    evidence.projectSelection.courtyard.lengthMm !== manufacturerGridCourtyardLengthMm ||
    evidence.projectSelection.courtyard.widthMm !== manufacturerGridCourtyardWidthMm
  ) {
    errors.push("project C0603 copper, mask, paste, or courtyard derivation drifted")
  }
  if (
    evidence.terminals.length !== 2 ||
    evidence.terminals[0]?.polarity !== "non-polar" ||
    evidence.terminals[1]?.polarity !== "non-polar" ||
    evidence.orientation.polarity !== "non-polar" ||
    evidence.orientation.pinOne !== "not-applicable" ||
    evidence.orientation.rotationEquivalence !== "180-degree rotationally equivalent"
  ) {
    errors.push("C0603 non-polar terminal or orientation disposition drifted")
  }
  if (
    evidence.projectFootprint.pads.length !== 2 ||
    evidence.projectFootprint.pads[0]?.xMm !== -projectPadCenterXMm ||
    evidence.projectFootprint.pads[1]?.xMm !== projectPadCenterXMm ||
    evidence.projectFootprint.pads[0]?.yMm !== 0 ||
    evidence.projectFootprint.pads[1]?.yMm !== 0 ||
    evidence.projectFootprint.courtyard.lengthMm !== manufacturerGridCourtyardLengthMm ||
    evidence.projectFootprint.courtyard.widthMm !== manufacturerGridCourtyardWidthMm ||
    evidence.projectFootprint.accepted ||
    evidence.projectFootprint.fabricationAuthority !== "deny" ||
    evidence.releaseState !== "deny" ||
    evidence.fabricationAuthority !== "deny" ||
    evidence.accepted
  ) {
    errors.push("project footprint geometry or deny state drifted")
  }
  if (!/^[0-9A-F]{64}$/u.test(evidence.artwork.sha256) || evidence.artwork.authority !== "deny") {
    errors.push("rendered artwork must have a bound SHA-256 while remaining denied")
  }
  return errors
}

const projectFootprint = (
  <footprint name="BP031_KEMET_C0603C102J5GACTU_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${manufacturerPadLengthMm}mm`}
      height={`${manufacturerPadWidthMm}mm`}
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${manufacturerPadLengthMm}mm`}
      height={`${manufacturerPadWidthMm}mm`}
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    {/* This review courtyard is project geometry based on KEMET V1/V2 guidance. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${manufacturerGridCourtyardLengthMm}mm`}
      height={`${manufacturerGridCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031KemetC0603C102J5GactuProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the BP-031 exact-capacitor review. */
export function Bp031KemetC0603C102J5GactuProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031KemetC0603C102J5GactuProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_KEMET_C0603C102J5GACTU"
      manufacturerPartNumber="C0603C102J5GACTU"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031KemetC0603C102J5GactuProjectFootprint
