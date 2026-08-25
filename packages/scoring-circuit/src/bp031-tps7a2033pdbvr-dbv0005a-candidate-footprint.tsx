import type { ReactElement } from "react"

const copperPadLengthMm = 1.1
const copperPadWidthMm = 0.6
const padRowCenterSpanMm = 2.6
const padPitchMm = 0.95
const solderMaskMarginMm = 0.07
const solderMaskOpeningLengthMm = Number((copperPadLengthMm + 2 * solderMaskMarginMm).toFixed(2))
const solderMaskOpeningWidthMm = Number((copperPadWidthMm + 2 * solderMaskMarginMm).toFixed(2))
const pasteReductionPerEdgeMm = 0
const courtyardClearanceMm = 0.25

const packageBodyWidthMm = { minimum: 1.45, maximum: 1.75 } as const
const packageBodyLengthMm = { minimum: 2.75, maximum: 3.05 } as const
const packageOverallLeadSpanMm = { minimum: 2.6, maximum: 3.0 } as const
const packageHeightMm = { maximum: 1.45 } as const
const leadWidthMm = { minimum: 0.3, maximum: 0.5 } as const
const leadLengthMm = { minimum: 0.3, maximum: 0.6 } as const

const padRowCenterMm = padRowCenterSpanMm / 2
const padColumnOffsetsMm = [0.95, 0, -0.95] as const
const affectedReferences = ["U_3V3"] as const

const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf"
const sourceSha256 = "6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1"
const canonicalReadinessSourceSha256 = "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
const canonicalExperimentSourceSha256 = "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
const canonicalTopologySourceSha256 = "1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d"
const renderedArtworkSha256 = "56DB31584BE77A1468001067C9DA285B52D15040790FABBC4FE70E0DBCBCBCD7"

const projectPads = [
  { pin: 1, xMm: -padRowCenterMm, yMm: padColumnOffsetsMm[0], function: "IN" },
  { pin: 2, xMm: -padRowCenterMm, yMm: padColumnOffsetsMm[1], function: "GND" },
  { pin: 3, xMm: -padRowCenterMm, yMm: padColumnOffsetsMm[2], function: "EN" },
  { pin: 4, xMm: padRowCenterMm, yMm: padColumnOffsetsMm[2], function: "N/C" },
  { pin: 5, xMm: padRowCenterMm, yMm: padColumnOffsetsMm[0], function: "OUT" }
] as const

const projectPadEnvelope = {
  minimumXMm: -padRowCenterMm - copperPadLengthMm / 2,
  maximumXMm: padRowCenterMm + copperPadLengthMm / 2,
  minimumYMm: padColumnOffsetsMm[2] - copperPadWidthMm / 2,
  maximumYMm: padColumnOffsetsMm[0] + copperPadWidthMm / 2
} as const

const maximumPackageEnvelope = {
  minimumXMm: -packageBodyWidthMm.maximum / 2,
  maximumXMm: packageBodyWidthMm.maximum / 2,
  minimumYMm: -packageBodyLengthMm.maximum / 2,
  maximumYMm: packageBodyLengthMm.maximum / 2
} as const

const projectCourtyardEnvelope = {
  minimumXMm: Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) - courtyardClearanceMm,
  maximumXMm: Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) + courtyardClearanceMm,
  minimumYMm: Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) - courtyardClearanceMm,
  maximumYMm: Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) + courtyardClearanceMm,
  widthMm:
    Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) -
    Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) +
    2 * courtyardClearanceMm,
  heightMm:
    Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) -
    Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) +
    2 * courtyardClearanceMm
} as const

/**
 * BP-031 review-only candidate for the exact TI TPS7A2033PDBVR orderable.
 *
 * The retained M4-04 TI datasheet supplies the exact orderable, DBV package,
 * pin map, DBV0005A drawing, land, mask, and stencil examples. TI does not
 * publish a courtyard in that drawing, so the courtyard remains project input.
 */
export const bp031Tps7a2033PdbvrDbv0005aCandidateFootprint = {
  artifactKind: "bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint",
  workUnit: "BP-031",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TPS7A2033PDBVR",
  sourceContract: "BP-100",
  affectedReferences,
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "U_3V3",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TPS7A2033PDBVR",
    package: "DBV SOT-23-5",
    sourceContract: "BP-100"
  },
  sourceControl: {
    basisCommit: "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c",
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
  package: {
    family: "SOT-23",
    option: "DBV",
    pinCount: 5,
    designation: "DBV0005A SOT-23 - 1.45 mm max height",
    drawingIdentifier: "DBV0005A",
    drawingDocument: "SBVS338H",
    drawingRevision: "K",
    embeddedDrawingRevision: "4214839/K 08/2024",
    bodyWidthMm: packageBodyWidthMm,
    bodyLengthMm: packageBodyLengthMm,
    overallLeadSpanMm: packageOverallLeadSpanMm,
    packageHeightMm,
    leadPitchMm: padPitchMm,
    leadWidthMm,
    leadLengthMm,
    standard: "JEDEC MO-178",
    supportPinMayDiffer: true
  },
  maximumPackageEnvelope,
  sources: [
    {
      id: "ti-tps7a20-dbvr-datasheet-rev-h",
      authority: "manufacturer-primary",
      documentNumber: "SBVS338H",
      revision: "H",
      url: "https://www.ti.com/lit/ds/symlink/tps7a20.pdf",
      reviewedPages: "4, 45, 60-62",
      role: "Exact TPS7A2033PDBVR orderable/package identity, SOT-23 pin map, DBV0005A geometry, land, mask, and stencil examples.",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256,
      orderableStatus: "Active",
      addendum: {
        title: "PACKAGE OPTION ADDENDUM",
        page: 45,
        orderable: "TPS7A2033PDBVR",
        package: "SOT-23 (DBV) | 5",
        status: "Active"
      },
      evidenceScope: "retained-M4-04-exact-mpn-source"
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    availability: "not-established-from-retained-m4-04-evidence",
    retainedArtifactPath: null,
    sha256: null,
    disposition: "not-acquired-no-substitute",
    note: "The retained TI PDF is the source drawing and does not include a native CAD object. No partner CAD artifact is represented as TI CAD."
  },
  pinOneOrientation: {
    sourceId: "ti-tps7a20-dbvr-datasheet-rev-h",
    sourceTopViewPinOneDatum: "pin 1 identifier at upper-left in TI DBV top view",
    topViewNumbering:
      "pins 1 through 3 run top-to-bottom on the left edge; pins 4 and 5 run bottom-to-top on the right edge",
    projectBoardRotationDegrees: 0,
    projectPinOnePad: { pin: 1, xMm: projectPads[0].xMm, yMm: projectPads[0].yMm },
    independentOrientationReview: "pending",
    exactMatchStatus: "review-input-only"
  },
  datasheetPinMap: projectPads,
  landPattern: {
    sourceId: "ti-tps7a20-dbvr-datasheet-rev-h",
    method: "TI DBV0005A example board layout",
    copper: {
      padShape: "rectangular-smt",
      padLengthMm: copperPadLengthMm,
      padWidthMm: copperPadWidthMm,
      rowCenterSpanMm: padRowCenterSpanMm,
      padPitchMm,
      roundedCornerRadiusMm: 0.05,
      status: "manufacturer-drawing-example"
    },
    solderMask: {
      selectedDefinition: "non-solder-mask-defined",
      marginMm: solderMaskMarginMm,
      openingLengthMm: solderMaskOpeningLengthMm,
      openingWidthMm: solderMaskOpeningWidthMm,
      sourceRange: "0.07 mm maximum all around for NSMD example (preferred)",
      status: "manufacturer-drawing-example"
    },
    paste: {
      stencilThicknessMm: 0.125,
      openingLengthMm: copperPadLengthMm,
      openingWidthMm: copperPadWidthMm,
      reductionPerEdgeMm: pasteReductionPerEdgeMm,
      sourceRange: "same 1.10 mm by 0.60 mm example aperture",
      status: "manufacturer-drawing-example"
    }
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "derived-from-ti-dbv0005a-drawing-example",
    pads: projectPads,
    solderMask: {
      selectedDefinition: "non-solder-mask-defined",
      marginMm: solderMaskMarginMm,
      openingLengthMm: solderMaskOpeningLengthMm,
      openingWidthMm: solderMaskOpeningWidthMm,
      status: "drawing-derived-review-input"
    },
    paste: {
      stencilThicknessMm: 0.125,
      openingLengthMm: copperPadLengthMm,
      openingWidthMm: copperPadWidthMm,
      reductionPerEdgeMm: pasteReductionPerEdgeMm,
      status: "drawing-derived-review-input"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      ...projectCourtyardEnvelope,
      minimumClearanceMm: courtyardClearanceMm,
      sourceStatus: "not-published",
      status: "project-review-input"
    },
    orientationStatus: "pending-independent-review",
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: renderedArtworkSha256,
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

type Envelope = {
  readonly minimumXMm: number
  readonly maximumXMm: number
  readonly minimumYMm: number
  readonly maximumYMm: number
}

function calculatePadEnvelope(candidate: typeof bp031Tps7a2033PdbvrDbv0005aCandidateFootprint): Envelope {
  const pads = candidate.projectFootprint.pads
  return {
    minimumXMm: Math.min(...pads.map(({ xMm }) => xMm - candidate.landPattern.copper.padLengthMm / 2)),
    maximumXMm: Math.max(...pads.map(({ xMm }) => xMm + candidate.landPattern.copper.padLengthMm / 2)),
    minimumYMm: Math.min(...pads.map(({ yMm }) => yMm - candidate.landPattern.copper.padWidthMm / 2)),
    maximumYMm: Math.max(...pads.map(({ yMm }) => yMm + candidate.landPattern.copper.padWidthMm / 2))
  }
}

function calculateCourtyardEnvelope(padEnvelope: Envelope, packageEnvelope: Envelope, clearanceMm: number): Envelope {
  return {
    minimumXMm: Math.min(padEnvelope.minimumXMm, packageEnvelope.minimumXMm) - clearanceMm,
    maximumXMm: Math.max(padEnvelope.maximumXMm, packageEnvelope.maximumXMm) + clearanceMm,
    minimumYMm: Math.min(padEnvelope.minimumYMm, packageEnvelope.minimumYMm) - clearanceMm,
    maximumYMm: Math.max(padEnvelope.maximumYMm, packageEnvelope.maximumYMm) + clearanceMm
  }
}

/** Return exact review failures; an empty result means the denied record is internally consistent. */
export function validateBp031Tps7a2033PdbvrDbv0005aCandidateFootprint(
  candidate: typeof bp031Tps7a2033PdbvrDbv0005aCandidateFootprint = bp031Tps7a2033PdbvrDbv0005aCandidateFootprint
): readonly string[] {
  const errors: string[] = []
  if (
    candidate.artifactKind !== "bp031-tps7a2033pdbvr-dbv0005a-candidate-footprint" ||
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== "Texas Instruments" ||
    candidate.manufacturerPartNumber !== "TPS7A2033PDBVR"
  ) {
    errors.push("exact BP-031 TI TPS7A2033PDBVR identity drifted")
  }
  if (
    candidate.sourceContract !== "BP-100" ||
    candidate.affectedReferences.length !== 1 ||
    candidate.affectedReferences[0] !== "U_3V3" ||
    candidate.sourceBinding.canonicalSourcePath !== "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    candidate.sourceBinding.canonicalSourceReference !== "U_3V3" ||
    candidate.sourceBinding.manufacturer !== "Texas Instruments" ||
    candidate.sourceBinding.manufacturerPartNumber !== "TPS7A2033PDBVR" ||
    candidate.sourceBinding.package !== "DBV SOT-23-5" ||
    candidate.sourceBinding.sourceContract !== "BP-100" ||
    candidate.sourceControl.basisCommit !== "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c" ||
    candidate.sourceControl.upstreamSources.length !== 3
  ) {
    errors.push("BP-100 U_3V3 exact-reference source binding drifted")
  }
  const expectedUpstreamSources = [
    ["packages/scoring-circuit/src/one-channel-analog-readiness.ts", canonicalReadinessSourceSha256],
    ["packages/scoring-circuit/src/one-channel-analog-experiment.ts", canonicalExperimentSourceSha256],
    ["packages/scoring-circuit/src/bench-prototype-analog-topology.ts", canonicalTopologySourceSha256]
  ] as const
  if (
    expectedUpstreamSources.some(
      ([path, sha256], index) =>
        candidate.sourceControl.upstreamSources[index]?.path !== path ||
        candidate.sourceControl.upstreamSources[index]?.sha256 !== sha256
    )
  ) {
    errors.push("BP-100 U_3V3 upstream exact references drifted")
  }
  if (
    candidate.package.family !== "SOT-23" ||
    candidate.package.option !== "DBV" ||
    candidate.package.pinCount !== 5 ||
    candidate.package.designation !== "DBV0005A SOT-23 - 1.45 mm max height" ||
    candidate.package.drawingIdentifier !== "DBV0005A" ||
    candidate.package.drawingDocument !== "SBVS338H" ||
    candidate.package.drawingRevision !== "K" ||
    candidate.package.embeddedDrawingRevision !== "4214839/K 08/2024" ||
    candidate.package.standard !== "JEDEC MO-178" ||
    candidate.package.supportPinMayDiffer !== true
  ) {
    errors.push("exact TI DBV SOT-23-5 package identity drifted")
  }
  if (
    candidate.package.bodyWidthMm.minimum !== 1.45 ||
    candidate.package.bodyWidthMm.maximum !== 1.75 ||
    candidate.package.bodyLengthMm.minimum !== 2.75 ||
    candidate.package.bodyLengthMm.maximum !== 3.05 ||
    candidate.package.overallLeadSpanMm.minimum !== 2.6 ||
    candidate.package.overallLeadSpanMm.maximum !== 3.0 ||
    candidate.package.packageHeightMm.maximum !== 1.45 ||
    candidate.package.leadPitchMm !== 0.95 ||
    candidate.package.leadWidthMm.minimum !== 0.3 ||
    candidate.package.leadWidthMm.maximum !== 0.5 ||
    candidate.package.leadLengthMm.minimum !== 0.3 ||
    candidate.package.leadLengthMm.maximum !== 0.6
  ) {
    errors.push("TI DBV0005A package dimensions drifted")
  }
  if (
    candidate.sources.length !== 1 ||
    candidate.sources[0]?.id !== "ti-tps7a20-dbvr-datasheet-rev-h" ||
    candidate.sources[0]?.authority !== "manufacturer-primary" ||
    candidate.sources[0]?.documentNumber !== "SBVS338H" ||
    candidate.sources[0]?.revision !== "H" ||
    candidate.sources[0]?.url !== "https://www.ti.com/lit/ds/symlink/tps7a20.pdf" ||
    candidate.sources[0]?.reviewedPages !== "4, 45, 60-62" ||
    candidate.sources[0]?.role !==
      "Exact TPS7A2033PDBVR orderable/package identity, SOT-23 pin map, DBV0005A geometry, land, mask, and stencil examples." ||
    candidate.sources[0]?.sha256 !== sourceSha256 ||
    candidate.sources[0]?.artifactPath !== sourceArtifactPath ||
    candidate.sources[0]?.orderableStatus !== "Active" ||
    candidate.sources[0]?.addendum?.title !== "PACKAGE OPTION ADDENDUM" ||
    candidate.sources[0]?.addendum?.page !== 45 ||
    candidate.sources[0]?.addendum?.orderable !== "TPS7A2033PDBVR" ||
    candidate.sources[0]?.addendum?.package !== "SOT-23 (DBV) | 5" ||
    candidate.sources[0]?.addendum?.status !== "Active" ||
    candidate.sources[0]?.evidenceScope !== "retained-M4-04-exact-mpn-source"
  ) {
    errors.push("exact retained TI TPS7A20 source is required")
  }
  for (const source of candidate.sources) {
    if (!/^[0-9A-F]{64}$/u.test(source.sha256) || source.artifactPath.length === 0) {
      errors.push(`retained TI source hash/path is invalid for ${source.id}`)
    }
  }
  if (
    candidate.pinOneOrientation.sourceId !== "ti-tps7a20-dbvr-datasheet-rev-h" ||
    candidate.pinOneOrientation.sourceTopViewPinOneDatum !== "pin 1 identifier at upper-left in TI DBV top view" ||
    candidate.pinOneOrientation.topViewNumbering !==
      "pins 1 through 3 run top-to-bottom on the left edge; pins 4 and 5 run bottom-to-top on the right edge" ||
    candidate.pinOneOrientation.projectPinOnePad.pin !== 1 ||
    candidate.pinOneOrientation.projectPinOnePad.xMm !== -padRowCenterMm ||
    candidate.pinOneOrientation.projectPinOnePad.yMm !== padColumnOffsetsMm[0] ||
    candidate.pinOneOrientation.projectBoardRotationDegrees !== 0
  ) {
    errors.push("TI pin-one orientation or project rotation drifted")
  }
  const expectedPins = projectPads.map(({ pin, xMm, yMm, function: pinFunction }) => ({
    pin,
    xMm,
    yMm,
    function: pinFunction
  }))
  if (JSON.stringify(candidate.projectFootprint.pads) !== JSON.stringify(expectedPins)) {
    errors.push("project pads do not preserve TI DBV top-view pin mapping")
  }
  if (JSON.stringify(candidate.datasheetPinMap) !== JSON.stringify(expectedPins)) {
    errors.push("datasheet pin map does not preserve TI DBV top-view pin mapping")
  }
  if (
    candidate.landPattern.sourceId !== "ti-tps7a20-dbvr-datasheet-rev-h" ||
    candidate.landPattern.method !== "TI DBV0005A example board layout" ||
    candidate.landPattern.copper.padShape !== "rectangular-smt" ||
    candidate.landPattern.copper.padLengthMm !== copperPadLengthMm ||
    candidate.landPattern.copper.padWidthMm !== copperPadWidthMm ||
    candidate.landPattern.copper.rowCenterSpanMm !== padRowCenterSpanMm ||
    candidate.landPattern.copper.padPitchMm !== padPitchMm ||
    candidate.landPattern.copper.roundedCornerRadiusMm !== 0.05 ||
    candidate.landPattern.copper.status !== "manufacturer-drawing-example" ||
    candidate.landPattern.solderMask.selectedDefinition !== "non-solder-mask-defined" ||
    candidate.landPattern.solderMask.marginMm !== solderMaskMarginMm ||
    candidate.landPattern.solderMask.openingLengthMm !== solderMaskOpeningLengthMm ||
    candidate.landPattern.solderMask.openingWidthMm !== solderMaskOpeningWidthMm ||
    candidate.landPattern.solderMask.status !== "manufacturer-drawing-example" ||
    candidate.landPattern.paste.stencilThicknessMm !== 0.125 ||
    candidate.landPattern.paste.openingLengthMm !== copperPadLengthMm ||
    candidate.landPattern.paste.openingWidthMm !== copperPadWidthMm ||
    candidate.landPattern.paste.reductionPerEdgeMm !== pasteReductionPerEdgeMm ||
    candidate.landPattern.paste.status !== "manufacturer-drawing-example"
  ) {
    errors.push("TI DBV0005A copper, mask, or paste dimensions drifted")
  }
  if (
    candidate.maximumPackageEnvelope.minimumXMm !== -packageBodyWidthMm.maximum / 2 ||
    candidate.maximumPackageEnvelope.maximumXMm !== packageBodyWidthMm.maximum / 2 ||
    candidate.maximumPackageEnvelope.minimumYMm !== -packageBodyLengthMm.maximum / 2 ||
    candidate.maximumPackageEnvelope.maximumYMm !== packageBodyLengthMm.maximum / 2
  ) {
    errors.push("maximum package envelope is not derived from TI DBV0005A limits")
  }
  const derivedCourtyard = calculateCourtyardEnvelope(
    calculatePadEnvelope(candidate),
    candidate.maximumPackageEnvelope,
    candidate.projectFootprint.courtyard.minimumClearanceMm
  )
  const courtyard = candidate.projectFootprint.courtyard
  if (
    courtyard.minimumXMm !== derivedCourtyard.minimumXMm ||
    courtyard.maximumXMm !== derivedCourtyard.maximumXMm ||
    courtyard.minimumYMm !== derivedCourtyard.minimumYMm ||
    courtyard.maximumYMm !== derivedCourtyard.maximumYMm ||
    courtyard.widthMm !== derivedCourtyard.maximumXMm - derivedCourtyard.minimumXMm ||
    courtyard.heightMm !== derivedCourtyard.maximumYMm - derivedCourtyard.minimumYMm ||
    courtyard.sourceStatus !== "not-published"
  ) {
    errors.push("project courtyard must enclose TI package/pads and retain not-published status")
  }
  if (
    candidate.projectFootprint.state !== "review-only" ||
    candidate.projectFootprint.geometryAuthority !== "derived-from-ti-dbv0005a-drawing-example" ||
    candidate.projectFootprint.solderMask.selectedDefinition !== "non-solder-mask-defined" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.availability !== "not-established-from-retained-m4-04-evidence" ||
    candidate.manufacturerCad.disposition !== "not-acquired-no-substitute" ||
    candidate.manufacturerCad.retainedArtifactPath !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.projectFootprint.solderMask.marginMm !== solderMaskMarginMm ||
    candidate.projectFootprint.solderMask.openingLengthMm !== solderMaskOpeningLengthMm ||
    candidate.projectFootprint.solderMask.openingWidthMm !== solderMaskOpeningWidthMm ||
    candidate.projectFootprint.solderMask.status !== "drawing-derived-review-input" ||
    candidate.projectFootprint.paste.stencilThicknessMm !== 0.125 ||
    candidate.projectFootprint.paste.openingLengthMm !== copperPadLengthMm ||
    candidate.projectFootprint.paste.openingWidthMm !== copperPadWidthMm ||
    candidate.projectFootprint.paste.reductionPerEdgeMm !== pasteReductionPerEdgeMm ||
    candidate.projectFootprint.paste.status !== "drawing-derived-review-input" ||
    candidate.projectFootprint.courtyard.centerMm.x !== 0 ||
    candidate.projectFootprint.courtyard.centerMm.y !== 0 ||
    candidate.projectFootprint.courtyard.status !== "project-review-input" ||
    candidate.projectFootprint.orientationStatus !== "pending-independent-review" ||
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
    candidate.artwork.generator !== "tscircuit" ||
    candidate.artwork.generatorVersion !== "0.0.2271" ||
    candidate.artwork.sha256 !== renderedArtworkSha256 ||
    candidate.artwork.authority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("CAD uncertainty and fabrication denial must remain fail-closed")
  }
  return errors
}

function projectSmtPad(pad: (typeof projectPads)[number]): ReactElement {
  return (
    <smtpad
      name={String(pad.pin)}
      pcbX={pad.xMm}
      pcbY={pad.yMm}
      shape="rect"
      solderMaskMargin="0.07mm"
      solderPasteMargin="0mm"
      width="1.1mm"
      height="0.6mm"
      portHints={pad.pin === 1 ? [String(pad.pin), pad.function, "pin1-upper-left"] : [String(pad.pin), pad.function]}
    />
  )
}

const projectFootprint = (
  <footprint name="BP031_TPS7A2033PDBVR_DBV0005A_CANDIDATE" originalLayer="top">
    {projectSmtPad(projectPads[0])}
    {projectSmtPad(projectPads[1])}
    {projectSmtPad(projectPads[2])}
    {projectSmtPad(projectPads[3])}
    {projectSmtPad(projectPads[4])}
    {/* TI does not publish a courtyard; this is a derived project review envelope. */}
    <courtyardrect pcbX={0} pcbY={0} width="4.2mm" height="3.55mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp031Tps7a2033PdbvrDbv0005aCandidateFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit candidate for review; it is not imported into a board. */
export function Bp031Tps7a2033PdbvrDbv0005aCandidateFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031Tps7a2033PdbvrDbv0005aCandidateFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_TPS7A2033PDBVR"
      manufacturerPartNumber="TPS7A2033PDBVR"
      pinLabels={{ pin1: "1", pin2: "2", pin3: "3", pin4: "4", pin5: "5" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031Tps7a2033PdbvrDbv0005aCandidateFootprint
