import type { ReactElement } from "react"

const projectCopperPadLengthMm = 0.7
const projectCopperPadWidthMm = 1.3
const projectCopperPadGapMm = 1.2
const projectOverallLandSpanMm = Number((projectCopperPadGapMm + 2 * projectCopperPadLengthMm).toFixed(3))
const projectCopperPadCenterXMm = Number(((projectCopperPadGapMm + projectCopperPadLengthMm) / 2).toFixed(3))
const projectSolderMaskMarginMm = 0.05
const projectSolderMaskOpeningLengthMm = Number((projectCopperPadLengthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectSolderMaskOpeningWidthMm = Number((projectCopperPadWidthMm + 2 * projectSolderMaskMarginMm).toFixed(3))
const projectPasteReductionPerEdgeMm = 0.05
const projectPasteOpeningLengthMm = Number((projectCopperPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((projectCopperPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectCourtyardLengthMm = 3.1
const projectCourtyardWidthMm = 1.9
const projectCourtyardClearanceMm = 0.25

const integrationBasisCommit = "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c"
const canonicalSourceSha256 = "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB"
const retainedMurataSourceSha256 = "E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F"
const renderedGeometrySha256 = "0C97468EE0E3B398EAC314577D0C1D10AFBE7AC0A064B4DC1862935190C7C15D"

const affectedReferences = ["C_REF_1", "C_REF_2", "C_REF_3", "C_REF_4", "C_REF_5", "C_REF_6", "C_REF_7"] as const

/**
 * BP-031 review-only candidate for the exact Murata GRM21BR71A106KE51L
 * reference reservoir replicated as C_REF_1 through C_REF_7.
 *
 * Murata publishes package dimensions and reflow land guidance, but not a
 * finished PCB CAD footprint. Mask, paste, courtyard, and release state are
 * therefore explicit project-review inputs and remain denied.
 */
export const bp031MurataGrm21br71a106ke51l0805CandidateFootprint = {
  artifactKind: "bp031-murata-grm21br71a106ke51l-0805-candidate-footprint",
  workUnit: "BP-031",
  manufacturer: "Murata",
  manufacturerPartNumber: "GRM21BR71A106KE51L",
  sourceContract: "BP-101",
  role: "SAR reference reservoir",
  geometryAuthority: "project-review-input-not-manufacturer-cad",
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
    canonicalSourceReference: "C_REF",
    replicatedReferencePrefix: "C_REF_",
    manufacturer: "Murata",
    manufacturerPartNumber: "GRM21BR71A106KE51L",
    package: "0805 (2012M)",
    sourceSha256: canonicalSourceSha256
  },
  sourceControl: {
    basisCommit: integrationBasisCommit,
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
        sha256: canonicalSourceSha256
      }
    ]
  },
  affectedReferences,
  primaryProductPageUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71A106KE51L",
  sources: [
    {
      id: "murata-grm21br71a106ke51-reference-sheet",
      authority: "manufacturer-primary",
      documentNumber: "GRM21BR71A106KE51-01",
      revision: "X",
      url: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf",
      reviewedPages: "1, 24-25",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf",
      sha256: retainedMurataSourceSha256,
      role: "Exact GRM21BR71A106KE51L identity, GRM21 0805/2012M package dimensions, and Murata reflow land guidance."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    availability: "not-confirmed",
    retainedArtifactPath: null,
    sha256: null,
    disposition: "not-acquired-no-substitute",
    note: "Murata CAD was not acquired or retained for this exact MPN. No generic 0805 CAD is represented as Murata geometry."
  },
  package: {
    designation: "GRM21 (2012M / 0805)",
    packageCode: "21",
    lengthMm: { nominal: 2, plus: 0.15, minus: 0.15 },
    widthMm: { nominal: 1.25, plus: 0.15, minus: 0.15 },
    thicknessMm: { nominal: 1.25, plus: 0.15, minus: 0.15 },
    terminalLengthMm: { minimum: 0.2, maximum: 0.7 },
    terminalGapMm: { minimum: 0.7 }
  },
  electrical: {
    nominalCapacitanceUf: 10,
    tolerancePercent: 10,
    dielectric: "X7R",
    ratedVoltageVdc: 10,
    operatingTemperatureC: { minimum: -55, maximum: 125 }
  },
  manufacturerLandPattern: {
    designation: "Murata GRM21 reflow land guidance",
    sourceScope: "manufacturer guidance only",
    sourceId: "murata-grm21br71a106ke51-reference-sheet",
    reviewedPage: 25,
    sourceTable: "Table 2 Reflow Soldering Method",
    chipDimensionRow: "2.0 x 1.25 mm (±0.15)",
    innerGapMm: { minimum: 1.2, maximum: 1.2 },
    padLengthMm: { minimum: 0.6, maximum: 0.8 },
    padWidthMm: { minimum: 1.2, maximum: 1.4 },
    note: "Murata asks that the suitable land dimension be confirmed on the actual set and PCB; this is not manufacturer CAD."
  },
  projectSelection: {
    solderingMethod: "reflow",
    rationale:
      "Midpoint selection within Murata's exact GRM21 2.0 x 1.25 mm (±0.15) reflow row: a=1.2 mm inner gap, b=0.7 mm pad length, and c=1.3 mm pad width.",
    manufacturerParameterSelectionMm: { aInnerGap: 1.2, bPadLength: 0.7, cPadWidth: 1.3 },
    copperPad: { lengthMm: projectCopperPadLengthMm, widthMm: projectCopperPadWidthMm },
    overallLandSpanMm: projectOverallLandSpanMm,
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: projectSolderMaskOpeningLengthMm,
      openingWidthMm: projectSolderMaskOpeningWidthMm,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      derivation:
        "0.7 mm x 1.3 mm project copper plus 2 x 0.05 mm project mask margin per axis; Murata does not publish a finished NSMD expansion for this candidate.",
      status: "project-input"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      derivation:
        "0.7 mm x 1.3 mm project copper minus 2 x 0.05 mm project paste reduction per axis; Murata does not publish a finished stencil aperture for this candidate.",
      status: "project-input"
    },
    courtyard: {
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      minimumClearanceMm: projectCourtyardClearanceMm,
      derivation:
        "max(2.30 mm maximum package length, 2.60 mm selected copper span) + 2 x 0.25 mm; max(1.40 mm maximum package width, 1.30 mm selected pad width) + 2 x 0.25 mm.",
      sourceStatus: "not-published",
      status: "project-review-input"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
  ],
  orientation: {
    state: "non-polar",
    assemblyRotationDeg: null,
    datum: "local two-terminal axis",
    pinOne: "not-applicable",
    note: "Murata's ceramic capacitor is non-polar. No pin-one, cathode, anode, or assembly rotation is asserted; rotation is electrically equivalent, subject to independent placement and stress review."
  },
  stressOrientationReview: {
    state: "pending-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    ratedVoltageVdc: 10,
    nominalApplicationRailVdc: 2.5,
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    dcBiasEvidence: "not-retained",
    note: "The exact Murata reference sheet supplies the electrical rating and package dimensions, but effective capacitance under DC bias, placement stress, assembly clearance, and final orientation remain open."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: renderedGeometrySha256,
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const projectFootprint = (
  <footprint name="BP031_MURATA_GRM21BR71A106KE51L_0805_CANDIDATE" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["1", "A", "non-polar", "terminal-a"]}
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
      portHints={["2", "B", "non-polar", "terminal-b"]}
    />
    {/* This review courtyard is project geometry, not Murata CAD. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardLengthMm}mm`}
      height={`${projectCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031MurataGrm21br71a106ke51l0805CandidateFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for the seven-reference BP-031 review. */
export function Bp031MurataGrm21br71a106ke51l0805CandidateFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031MurataGrm21br71a106ke51l0805CandidateFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_MURATA_GRM21BR71A106KE51L"
      manufacturerPartNumber="GRM21BR71A106KE51L"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

type Candidate = typeof bp031MurataGrm21br71a106ke51l0805CandidateFootprint

function expectedSource(candidate: Candidate) {
  return candidate.sources[0]
}

/** Return exact review failures; an empty result means the denied record is internally consistent. */
export function validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(
  candidate: Candidate = bp031MurataGrm21br71a106ke51l0805CandidateFootprint
): readonly string[] {
  const errors: string[] = []
  const source = expectedSource(candidate)
  if (
    candidate.artifactKind !== "bp031-murata-grm21br71a106ke51l-0805-candidate-footprint" ||
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== "Murata" ||
    candidate.manufacturerPartNumber !== "GRM21BR71A106KE51L" ||
    candidate.sourceContract !== "BP-101" ||
    candidate.role !== "SAR reference reservoir" ||
    candidate.geometryAuthority !== "project-review-input-not-manufacturer-cad"
  ) {
    errors.push("exact BP-031 Murata GRM21BR71A106KE51L identity drifted")
  }
  if (
    candidate.sourceBinding.canonicalSourcePath !==
      "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts" ||
    candidate.sourceBinding.canonicalSourceReference !== "C_REF" ||
    candidate.sourceBinding.replicatedReferencePrefix !== "C_REF_" ||
    candidate.sourceBinding.manufacturer !== "Murata" ||
    candidate.sourceBinding.manufacturerPartNumber !== "GRM21BR71A106KE51L" ||
    candidate.sourceBinding.package !== "0805 (2012M)" ||
    candidate.sourceBinding.sourceSha256 !== canonicalSourceSha256 ||
    JSON.stringify(candidate.affectedReferences) !== JSON.stringify(affectedReferences)
  ) {
    errors.push("C_REF seven-reference source binding drifted")
  }
  if (
    candidate.sourceControl.basisCommit !== integrationBasisCommit ||
    candidate.sourceControl.upstreamSources.length !== 1 ||
    candidate.sourceControl.upstreamSources[0]?.path !== candidate.sourceBinding.canonicalSourcePath ||
    candidate.sourceControl.upstreamSources[0]?.sha256 !== canonicalSourceSha256
  ) {
    errors.push("BP-031 canonical source control binding drifted")
  }
  if (
    candidate.sources.length !== 1 ||
    source?.id !== "murata-grm21br71a106ke51-reference-sheet" ||
    source?.authority !== "manufacturer-primary" ||
    source?.documentNumber !== "GRM21BR71A106KE51-01" ||
    source?.revision !== "X" ||
    source?.url !== "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf" ||
    source?.reviewedPages !== "1, 24-25" ||
    source?.artifactPath !== "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf" ||
    source?.sha256 !== retainedMurataSourceSha256
  ) {
    errors.push("exact retained Murata GRM21 source is required")
  }
  for (const source of candidate.sources) {
    if (!/^[0-9A-F]{64}$/u.test(source.sha256) || source.artifactPath.length === 0) {
      errors.push(`retained Murata source hash/path is invalid for ${source.id}`)
    }
  }
  if (
    candidate.package.designation !== "GRM21 (2012M / 0805)" ||
    candidate.package.packageCode !== "21" ||
    candidate.package.lengthMm.nominal !== 2 ||
    candidate.package.lengthMm.plus !== 0.15 ||
    candidate.package.lengthMm.minus !== 0.15 ||
    candidate.package.widthMm.nominal !== 1.25 ||
    candidate.package.widthMm.plus !== 0.15 ||
    candidate.package.widthMm.minus !== 0.15 ||
    candidate.package.thicknessMm.nominal !== 1.25 ||
    candidate.package.terminalLengthMm.minimum !== 0.2 ||
    candidate.package.terminalLengthMm.maximum !== 0.7 ||
    candidate.package.terminalGapMm.minimum !== 0.7
  ) {
    errors.push("Murata GRM21 0805 package dimensions drifted")
  }
  if (
    candidate.electrical.nominalCapacitanceUf !== 10 ||
    candidate.electrical.tolerancePercent !== 10 ||
    candidate.electrical.dielectric !== "X7R" ||
    candidate.electrical.ratedVoltageVdc !== 10 ||
    candidate.electrical.operatingTemperatureC.minimum !== -55 ||
    candidate.electrical.operatingTemperatureC.maximum !== 125
  ) {
    errors.push("Murata GRM21 electrical identity drifted")
  }
  if (
    candidate.manufacturerLandPattern.designation !== "Murata GRM21 reflow land guidance" ||
    candidate.manufacturerLandPattern.sourceScope !== "manufacturer guidance only" ||
    candidate.manufacturerLandPattern.sourceId !== "murata-grm21br71a106ke51-reference-sheet" ||
    candidate.manufacturerLandPattern.reviewedPage !== 25 ||
    candidate.manufacturerLandPattern.sourceTable !== "Table 2 Reflow Soldering Method" ||
    candidate.manufacturerLandPattern.chipDimensionRow !== "2.0 x 1.25 mm (±0.15)" ||
    candidate.manufacturerLandPattern.innerGapMm.minimum !== 1.2 ||
    candidate.manufacturerLandPattern.innerGapMm.maximum !== 1.2 ||
    candidate.manufacturerLandPattern.padLengthMm.minimum !== 0.6 ||
    candidate.manufacturerLandPattern.padLengthMm.maximum !== 0.8 ||
    candidate.manufacturerLandPattern.padWidthMm.minimum !== 1.2 ||
    candidate.manufacturerLandPattern.padWidthMm.maximum !== 1.4
  ) {
    errors.push("Murata GRM21 reflow land guidance drifted")
  }
  const selection = candidate.projectSelection
  if (
    selection.solderingMethod !== "reflow" ||
    selection.manufacturerParameterSelectionMm.aInnerGap !== 1.2 ||
    selection.manufacturerParameterSelectionMm.bPadLength !== 0.7 ||
    selection.manufacturerParameterSelectionMm.cPadWidth !== 1.3 ||
    selection.copperPad.lengthMm !== projectCopperPadLengthMm ||
    selection.copperPad.widthMm !== projectCopperPadWidthMm ||
    selection.derivedCopperPadGapMm !== projectCopperPadGapMm ||
    selection.overallLandSpanMm !== projectOverallLandSpanMm ||
    selection.derivedCopperPadCenterXMm !== projectCopperPadCenterXMm ||
    selection.solderMask.openingLengthMm !== projectSolderMaskOpeningLengthMm ||
    selection.solderMask.openingWidthMm !== projectSolderMaskOpeningWidthMm ||
    selection.solderMask.marginPerEdgeMm !== projectSolderMaskMarginMm ||
    selection.solderMask.status !== "project-input" ||
    selection.paste.openingLengthMm !== projectPasteOpeningLengthMm ||
    selection.paste.openingWidthMm !== projectPasteOpeningWidthMm ||
    selection.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    selection.paste.status !== "project-input" ||
    selection.courtyard.lengthMm !== projectCourtyardLengthMm ||
    selection.courtyard.widthMm !== projectCourtyardWidthMm ||
    selection.courtyard.minimumClearanceMm !== projectCourtyardClearanceMm ||
    selection.courtyard.sourceStatus !== "not-published" ||
    selection.courtyard.status !== "project-review-input"
  ) {
    errors.push("Murata-derived project copper, mask, paste, or courtyard drifted")
  }
  if (
    JSON.stringify(candidate.terminals) !==
      JSON.stringify([
        { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
        { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
      ]) ||
    candidate.orientation.state !== "non-polar" ||
    candidate.orientation.pinOne !== "not-applicable" ||
    candidate.orientation.assemblyRotationDeg !== null ||
    candidate.stressOrientationReview.state !== "pending-review" ||
    candidate.stressOrientationReview.polarity !== "non-polar" ||
    candidate.stressOrientationReview.pinOne !== "not-applicable" ||
    candidate.stressOrientationReview.ratedVoltageVdc !== 10 ||
    candidate.stressOrientationReview.nominalApplicationRailVdc !== 2.5 ||
    candidate.stressOrientationReview.operatingTemperatureC.minimum !== -55 ||
    candidate.stressOrientationReview.operatingTemperatureC.maximum !== 125 ||
    candidate.stressOrientationReview.dcBiasEvidence !== "not-retained"
  ) {
    errors.push("Murata GRM21 non-polar orientation drifted")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.availability !== "not-confirmed" ||
    candidate.manufacturerCad.retainedArtifactPath !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.manufacturerCad.disposition !== "not-acquired-no-substitute" ||
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
    candidate.artwork.generator !== "tscircuit" ||
    candidate.artwork.generatorVersion !== "0.0.2271" ||
    candidate.artwork.sha256 !== renderedGeometrySha256 ||
    candidate.artwork.authority !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.accepted !== false
  ) {
    errors.push("Murata CAD uncertainty and fabrication denial must remain fail-closed")
  }
  return errors
}
