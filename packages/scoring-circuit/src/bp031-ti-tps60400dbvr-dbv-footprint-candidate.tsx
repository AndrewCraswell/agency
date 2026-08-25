import type { ReactElement } from "react"

const padLengthMm = 1.1
const padWidthMm = 0.6
const padPitchMm = 0.95
const rowCenterSpanMm = 2.6
const padRowCenterMm = rowCenterSpanMm / 2
const padYExtentMm = padPitchMm
const packageBodyLengthMm = { minimum: 2.75, maximum: 3.05 } as const
const packageBodyWidthMm = { minimum: 1.45, maximum: 1.75 } as const
const packageLeadSpanMm = { minimum: 2.6, maximum: 3.0 } as const
const packageHeightMm = { maximum: 1.45 } as const
const packageLeadWidthMm = { minimum: 0.3, maximum: 0.5 } as const
const packageLeadLengthMm = { minimum: 0.3, maximum: 0.6 } as const
const solderMaskMarginMm = 0.07
const courtyardClearanceMm = 0.25

const projectPads = [
  { pin: 1, name: "OUT", xMm: -padRowCenterMm, yMm: padYExtentMm },
  { pin: 2, name: "IN", xMm: -padRowCenterMm, yMm: 0 },
  { pin: 3, name: "CFLY-", xMm: -padRowCenterMm, yMm: -padYExtentMm },
  { pin: 4, name: "GND", xMm: padRowCenterMm, yMm: -padYExtentMm },
  { pin: 5, name: "CFLY+", xMm: padRowCenterMm, yMm: padYExtentMm }
] as const

const projectPadEnvelope = {
  minimumXMm: Math.min(...projectPads.map(({ xMm }) => xMm - padLengthMm / 2)),
  maximumXMm: Math.max(...projectPads.map(({ xMm }) => xMm + padLengthMm / 2)),
  minimumYMm: Math.min(...projectPads.map(({ yMm }) => yMm - padWidthMm / 2)),
  maximumYMm: Math.max(...projectPads.map(({ yMm }) => yMm + padWidthMm / 2))
} as const

const maximumPackageEnvelope = {
  minimumXMm: -packageLeadSpanMm.maximum / 2,
  maximumXMm: packageLeadSpanMm.maximum / 2,
  minimumYMm: -packageBodyLengthMm.maximum / 2,
  maximumYMm: packageBodyLengthMm.maximum / 2
} as const

function roundMillimetres(valueMm: number): number {
  return Math.round(valueMm * 1000) / 1000
}

const projectCourtyardEnvelope = {
  minimumXMm: roundMillimetres(
    Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) - courtyardClearanceMm
  ),
  maximumXMm: roundMillimetres(
    Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) + courtyardClearanceMm
  ),
  minimumYMm: roundMillimetres(
    Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) - courtyardClearanceMm
  ),
  maximumYMm: roundMillimetres(
    Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) + courtyardClearanceMm
  ),
  widthMm: 4.2,
  heightMm: 3.55
} as const

const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf"
const sourceSha256 = "B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347"
const canonicalReadinessSourceSha256 = "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
const canonicalExperimentSourceSha256 = "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
const integrationHead = "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c"

/**
 * BP-031 review-only candidate footprint for exact TI TPS60400DBVR in the
 * DBV0005A SOT-23-5 package. The retained TI datasheet supplies the pin map,
 * package drawing, land-pattern example, mask guidance, and stencil example;
 * it does not supply a manufacturer CAD object or courtyard.
 */
export const bp031TiTps60400DbvrDbvFootprintCandidate = {
  artifactKind: "bp031-ti-tps60400dbvr-dbv-sot23-5-footprint-candidate",
  workUnit: "BP-031",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TPS60400DBVR",
  package: {
    designation: "DBV0005A (SOT-23-5)",
    packageDrawing: "DBV0005A",
    packageStandard: "JEDEC MO-178",
    bodyLengthMm: packageBodyLengthMm,
    bodyWidthMm: packageBodyWidthMm,
    leadSpanMm: packageLeadSpanMm,
    heightMm: packageHeightMm,
    leadPitchMm: padPitchMm,
    leadWidthMm: packageLeadWidthMm,
    leadLengthMm: packageLeadLengthMm,
    terminals: 5
  },
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "U_NEGATIVE_RAIL",
    replicatedReferencePrefix: "U_NEGATIVE_RAIL_",
    pinMapSourcePath: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
    pinMapSourceReference: "physicalPinMaps.tps60400Dbv",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TPS60400DBVR",
    package: "DBV SOT-23-5",
    pinMap: { 1: "OUT", 2: "IN", 3: "CFLY-", 4: "GND", 5: "CFLY+" },
    sourceContract: "BP-100"
  },
  sourceControl: {
    basisCommit: integrationHead,
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        sha256: canonicalReadinessSourceSha256
      },
      {
        path: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
        sha256: canonicalExperimentSourceSha256
      }
    ]
  },
  sources: [
    {
      id: "ti-tps60400-slvs324c",
      authority: "manufacturer-primary",
      documentNumber: "SLVS324C",
      revision: "C",
      url: "https://www.ti.com/lit/ds/symlink/tps60400.pdf",
      reviewedPages: "3, 23, 30-32",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256,
      addendum: {
        label: "Addendum-Page 1",
        pdfPage: 23,
        date: "2026-01-09",
        exactOrderable: "TPS60400DBVR",
        status: "Active",
        materialType: "Production",
        package: "SOT-23 (DBV) | 5",
        packageQuantityAndCarrier: "3000 | LARGE T&R",
        operatingTemperatureC: "-40 to 85",
        partMarking: "PFKI"
      }
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "The retained TI datasheet contains DBV0005A package and example land-pattern pages, but no manufacturer CAD object was acquired or retained."
  },
  manufacturerLandPattern: {
    sourceId: "ti-tps60400-slvs324c",
    copper: {
      padLengthMm,
      padWidthMm,
      rowCenterSpanMm,
      pitchMm: padPitchMm,
      sourceStatement: "TI DBV0005A example board layout: 5X (1.1), 5X (0.6), 2X (0.95), and (2.6)."
    },
    solderMask: {
      definition: "non-solder-mask-defined-preferred",
      marginPerEdgeMm: solderMaskMarginMm,
      sourceStatement:
        "TI DBV0005A solder-mask details: the preferred NSMD option specifies 0.07 mm maximum all around."
    },
    paste: {
      apertureLengthMm: padLengthMm,
      apertureWidthMm: padWidthMm,
      stencilThicknessMm: 0.125,
      sourceStatement: "TI DBV0005A example stencil design repeats 5X (1.1) and 5X (0.6) based on a 0.125 mm stencil."
    },
    courtyard: {
      status: "not-published",
      sourceStatement: "No courtyard is shown in the retained TI package, board-layout, or stencil pages."
    }
  },
  pinOneOrientation: {
    sourceId: "ti-tps60400-slvs324c",
    topViewPinOneDatum: "upper-left pin-one index area in Figure 6-1 and DBV0005A package outline",
    topViewNumbering:
      "Pin 1 is upper-left; pins 1, 2, and 3 descend the left edge, while pins 4 and 5 occupy the lower-right and upper-right positions.",
    projectBoardRotationDegrees: 0,
    projectPinOnePad: { pin: 1, xMm: projectPads[0].xMm, yMm: projectPads[0].yMm },
    independentOrientationReview: "pending-independent-review",
    exactMatchStatus: "project-review-input-derived-from-ti-top-view"
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-derived-from-ti-dbv0005a",
    padShape: "rectangular-smt",
    padLengthMm,
    padWidthMm,
    padRowCenterSpanMm: rowCenterSpanMm,
    padPitchMm,
    pads: projectPads,
    solderMask: {
      openingLengthMm: roundMillimetres(padLengthMm + 2 * solderMaskMarginMm),
      openingWidthMm: padWidthMm + 2 * solderMaskMarginMm,
      marginPerEdgeMm: solderMaskMarginMm,
      derivation: "TI preferred NSMD 0.07 mm maximum all around",
      status: "project-input-derived-from-manufacturer-guidance"
    },
    paste: {
      openingLengthMm: padLengthMm,
      openingWidthMm: padWidthMm,
      reductionPerEdgeMm: 0,
      derivation: "TI DBV0005A stencil example uses the same 1.1 mm by 0.6 mm aperture on a 0.125 mm stencil",
      status: "project-input-derived-from-manufacturer-guidance"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      ...projectCourtyardEnvelope,
      minimumClearanceMm: courtyardClearanceMm,
      sourceStatus: "not-published",
      derivation: "maximum of TI package lead/body envelope and project pad envelope plus 0.25 mm review clearance",
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
    sha256: "56DB31584BE77A1468001067C9DA285B52D15040790FABBC4FE70E0DBCBCBCD7",
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

function calculatePadEnvelope(
  pads: readonly { readonly xMm: number; readonly yMm: number }[],
  lengthMm: number,
  widthMm: number
): Envelope {
  return {
    minimumXMm: Math.min(...pads.map(({ xMm }) => xMm - lengthMm / 2)),
    maximumXMm: Math.max(...pads.map(({ xMm }) => xMm + lengthMm / 2)),
    minimumYMm: Math.min(...pads.map(({ yMm }) => yMm - widthMm / 2)),
    maximumYMm: Math.max(...pads.map(({ yMm }) => yMm + widthMm / 2))
  }
}

function calculateCourtyardEnvelope(padEnvelope: Envelope, packageEnvelope: Envelope, clearanceMm: number): Envelope {
  return {
    minimumXMm: roundMillimetres(Math.min(padEnvelope.minimumXMm, packageEnvelope.minimumXMm) - clearanceMm),
    maximumXMm: roundMillimetres(Math.max(padEnvelope.maximumXMm, packageEnvelope.maximumXMm) + clearanceMm),
    minimumYMm: roundMillimetres(Math.min(padEnvelope.minimumYMm, packageEnvelope.minimumYMm) - clearanceMm),
    maximumYMm: roundMillimetres(Math.max(padEnvelope.maximumYMm, packageEnvelope.maximumYMm) + clearanceMm)
  }
}

/** Empty output means the deny-by-default evidence record is internally consistent. */
export function validateBp031TiTps60400DbvrDbvFootprintCandidate(
  candidate: typeof bp031TiTps60400DbvrDbvFootprintCandidate = bp031TiTps60400DbvrDbvFootprintCandidate
): readonly string[] {
  const evidence = candidate
  const errors: string[] = []
  const source = evidence.sources[0]
  const upstreamReadiness = evidence.sourceControl.upstreamSources[0]
  const upstreamExperiment = evidence.sourceControl.upstreamSources[1]
  if (evidence.sources.length !== 1 || evidence.sourceControl.upstreamSources.length !== 2) {
    errors.push("BP-031 exact source set drifted")
  }
  if (
    evidence.workUnit !== "BP-031" ||
    evidence.manufacturer !== "Texas Instruments" ||
    evidence.manufacturerPartNumber !== "TPS60400DBVR" ||
    evidence.package.designation !== "DBV0005A (SOT-23-5)" ||
    evidence.package.packageDrawing !== "DBV0005A" ||
    evidence.package.packageStandard !== "JEDEC MO-178" ||
    evidence.package.terminals !== 5
  ) {
    errors.push("exact TPS60400DBVR and DBV0005A SOT-23-5 identity drifted")
  }
  if (
    evidence.sourceBinding.canonicalSourceReference !== "U_NEGATIVE_RAIL" ||
    evidence.sourceBinding.replicatedReferencePrefix !== "U_NEGATIVE_RAIL_" ||
    evidence.sourceBinding.canonicalSourcePath !== "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    evidence.sourceBinding.pinMapSourcePath !== "packages/scoring-circuit/src/one-channel-analog-experiment.ts" ||
    evidence.sourceBinding.pinMapSourceReference !== "physicalPinMaps.tps60400Dbv" ||
    evidence.sourceBinding.manufacturer !== "Texas Instruments" ||
    evidence.sourceBinding.manufacturerPartNumber !== "TPS60400DBVR" ||
    evidence.sourceBinding.package !== "DBV SOT-23-5" ||
    evidence.sourceBinding.sourceContract !== "BP-100" ||
    JSON.stringify(evidence.sourceBinding.pinMap) !==
      JSON.stringify({ 1: "OUT", 2: "IN", 3: "CFLY-", 4: "GND", 5: "CFLY+" })
  ) {
    errors.push("BP-100 exact TPS60400DBVR source binding or pin map drifted")
  }
  if (
    evidence.sourceControl.basisCommit !== integrationHead ||
    upstreamReadiness?.path !== "packages/scoring-circuit/src/one-channel-analog-readiness.ts" ||
    upstreamReadiness?.sha256 !== canonicalReadinessSourceSha256 ||
    upstreamExperiment?.path !== "packages/scoring-circuit/src/one-channel-analog-experiment.ts" ||
    upstreamExperiment?.sha256 !== canonicalExperimentSourceSha256
  ) {
    errors.push("canonical TPS60400DBVR source-control binding drifted")
  }
  if (
    source === undefined ||
    source.id !== "ti-tps60400-slvs324c" ||
    source.documentNumber !== "SLVS324C" ||
    source.revision !== "C" ||
    source.url !== "https://www.ti.com/lit/ds/symlink/tps60400.pdf" ||
    source.reviewedPages !== "3, 23, 30-32" ||
    source.artifactPath !== sourceArtifactPath ||
    source.sha256 !== sourceSha256 ||
    !/^[0-9A-F]{64}$/u.test(source.sha256) ||
    source.addendum?.label !== "Addendum-Page 1" ||
    source.addendum?.pdfPage !== 23 ||
    source.addendum?.date !== "2026-01-09" ||
    source.addendum?.exactOrderable !== "TPS60400DBVR" ||
    source.addendum?.status !== "Active" ||
    source.addendum?.materialType !== "Production" ||
    source.addendum?.package !== "SOT-23 (DBV) | 5" ||
    source.addendum?.packageQuantityAndCarrier !== "3000 | LARGE T&R" ||
    source.addendum?.operatingTemperatureC !== "-40 to 85" ||
    source.addendum?.partMarking !== "PFKI"
  ) {
    errors.push("retained TI TPS60400 source identity, page scope, or SHA-256 drifted")
  }
  if (
    evidence.package.bodyLengthMm.minimum !== 2.75 ||
    evidence.package.bodyLengthMm.maximum !== 3.05 ||
    evidence.package.bodyWidthMm.minimum !== 1.45 ||
    evidence.package.bodyWidthMm.maximum !== 1.75 ||
    evidence.package.leadSpanMm.minimum !== 2.6 ||
    evidence.package.leadSpanMm.maximum !== 3.0 ||
    evidence.package.heightMm.maximum !== 1.45 ||
    evidence.package.leadPitchMm !== 0.95 ||
    evidence.package.leadWidthMm.minimum !== 0.3 ||
    evidence.package.leadWidthMm.maximum !== 0.5 ||
    evidence.package.leadLengthMm.minimum !== 0.3 ||
    evidence.package.leadLengthMm.maximum !== 0.6
  ) {
    errors.push("DBV0005A package dimensions or pitch drifted")
  }
  if (
    evidence.manufacturerCad.state !== "not-acquired" ||
    evidence.manufacturerCad.artifactPath !== null ||
    evidence.manufacturerCad.authority !== "deny"
  ) {
    errors.push("manufacturer CAD must remain explicitly unacquired and denied")
  }
  if (
    evidence.manufacturerLandPattern.sourceId !== "ti-tps60400-slvs324c" ||
    evidence.manufacturerLandPattern.copper.padLengthMm !== padLengthMm ||
    evidence.manufacturerLandPattern.copper.padWidthMm !== padWidthMm ||
    evidence.manufacturerLandPattern.copper.rowCenterSpanMm !== rowCenterSpanMm ||
    evidence.manufacturerLandPattern.copper.pitchMm !== padPitchMm ||
    evidence.manufacturerLandPattern.copper.sourceStatement !==
      "TI DBV0005A example board layout: 5X (1.1), 5X (0.6), 2X (0.95), and (2.6)." ||
    evidence.manufacturerLandPattern.solderMask.definition !== "non-solder-mask-defined-preferred" ||
    evidence.manufacturerLandPattern.solderMask.marginPerEdgeMm !== solderMaskMarginMm ||
    evidence.manufacturerLandPattern.solderMask.sourceStatement !==
      "TI DBV0005A solder-mask details: the preferred NSMD option specifies 0.07 mm maximum all around." ||
    evidence.manufacturerLandPattern.paste.apertureLengthMm !== padLengthMm ||
    evidence.manufacturerLandPattern.paste.apertureWidthMm !== padWidthMm ||
    evidence.manufacturerLandPattern.paste.stencilThicknessMm !== 0.125 ||
    evidence.manufacturerLandPattern.paste.sourceStatement !==
      "TI DBV0005A example stencil design repeats 5X (1.1) and 5X (0.6) based on a 0.125 mm stencil." ||
    evidence.manufacturerLandPattern.courtyard.status !== "not-published" ||
    evidence.manufacturerLandPattern.courtyard.sourceStatement !==
      "No courtyard is shown in the retained TI package, board-layout, or stencil pages."
  ) {
    errors.push("TI DBV land, mask, stencil, or courtyard guidance drifted")
  }
  if (
    evidence.pinOneOrientation.topViewPinOneDatum !==
      "upper-left pin-one index area in Figure 6-1 and DBV0005A package outline" ||
    evidence.pinOneOrientation.sourceId !== "ti-tps60400-slvs324c" ||
    evidence.pinOneOrientation.topViewNumbering !==
      "Pin 1 is upper-left; pins 1, 2, and 3 descend the left edge, while pins 4 and 5 occupy the lower-right and upper-right positions." ||
    evidence.pinOneOrientation.projectBoardRotationDegrees !== 0 ||
    evidence.pinOneOrientation.projectPinOnePad.pin !== 1 ||
    evidence.pinOneOrientation.projectPinOnePad.xMm !== -1.3 ||
    evidence.pinOneOrientation.projectPinOnePad.yMm !== 0.95 ||
    evidence.pinOneOrientation.independentOrientationReview !== "pending-independent-review" ||
    evidence.pinOneOrientation.exactMatchStatus !== "project-review-input-derived-from-ti-top-view"
  ) {
    errors.push("pin-one orientation datum or project rotation drifted")
  }
  const pads = evidence.projectFootprint.pads
  if (pads.length !== 5) errors.push("DBV footprint must contain exactly 5 pads")
  for (const [index, pad] of pads.entries()) {
    const expectedPad = projectPads[index]
    if (
      expectedPad === undefined ||
      pad.pin !== expectedPad.pin ||
      pad.name !== expectedPad.name ||
      pad.xMm !== expectedPad.xMm ||
      pad.yMm !== expectedPad.yMm
    ) {
      errors.push(`DBV pin mapping or position drifted at index ${index}`)
    }
  }
  if (
    evidence.projectFootprint.state !== "review-only" ||
    evidence.projectFootprint.geometryAuthority !== "project-review-input-derived-from-ti-dbv0005a" ||
    evidence.projectFootprint.padShape !== "rectangular-smt" ||
    pads[0]?.xMm !== -1.3 ||
    pads[0]?.yMm !== 0.95 ||
    pads[2]?.xMm !== -1.3 ||
    pads[2]?.yMm !== -0.95 ||
    pads[3]?.xMm !== 1.3 ||
    pads[3]?.yMm !== -0.95 ||
    pads[4]?.xMm !== 1.3 ||
    pads[4]?.yMm !== 0.95
  ) {
    errors.push("DBV pad rows or pin-one placement drifted")
  }
  if (
    evidence.projectFootprint.padLengthMm !== padLengthMm ||
    evidence.projectFootprint.padWidthMm !== padWidthMm ||
    evidence.projectFootprint.padPitchMm !== padPitchMm ||
    evidence.projectFootprint.padRowCenterSpanMm !== rowCenterSpanMm ||
    evidence.projectFootprint.solderMask.derivation !== "TI preferred NSMD 0.07 mm maximum all around" ||
    evidence.projectFootprint.solderMask.status !== "project-input-derived-from-manufacturer-guidance" ||
    evidence.projectFootprint.paste.derivation !==
      "TI DBV0005A stencil example uses the same 1.1 mm by 0.6 mm aperture on a 0.125 mm stencil" ||
    evidence.projectFootprint.paste.status !== "project-input-derived-from-manufacturer-guidance" ||
    evidence.projectFootprint.courtyard.status !== "project-review-input" ||
    evidence.projectFootprint.courtyard.derivation !==
      "maximum of TI package lead/body envelope and project pad envelope plus 0.25 mm review clearance" ||
    evidence.projectFootprint.orientationStatus !== "pending-independent-review"
  ) {
    errors.push("project copper dimensions are not TI DBV0005A dimensions")
  }
  const derivedCourtyard = calculateCourtyardEnvelope(
    calculatePadEnvelope(pads, evidence.projectFootprint.padLengthMm, evidence.projectFootprint.padWidthMm),
    maximumPackageEnvelope,
    evidence.projectFootprint.courtyard.minimumClearanceMm
  )
  const courtyard = evidence.projectFootprint.courtyard
  if (
    courtyard.minimumXMm !== derivedCourtyard.minimumXMm ||
    courtyard.maximumXMm !== derivedCourtyard.maximumXMm ||
    courtyard.minimumYMm !== derivedCourtyard.minimumYMm ||
    courtyard.maximumYMm !== derivedCourtyard.maximumYMm ||
    courtyard.widthMm !== courtyard.maximumXMm - courtyard.minimumXMm ||
    courtyard.heightMm !== courtyard.maximumYMm - courtyard.minimumYMm ||
    courtyard.sourceStatus !== "not-published"
  ) {
    errors.push("project courtyard is not derived from TI package and pad envelopes")
  }
  if (
    evidence.projectFootprint.solderMask.openingLengthMm !== roundMillimetres(padLengthMm + 2 * solderMaskMarginMm) ||
    evidence.projectFootprint.solderMask.openingWidthMm !== padWidthMm + 2 * solderMaskMarginMm ||
    evidence.projectFootprint.solderMask.marginPerEdgeMm !== solderMaskMarginMm ||
    evidence.projectFootprint.paste.openingLengthMm !== padLengthMm ||
    evidence.projectFootprint.paste.openingWidthMm !== padWidthMm ||
    evidence.projectFootprint.paste.reductionPerEdgeMm !== 0
  ) {
    errors.push("project mask or paste geometry is not derived from TI examples")
  }
  if (
    evidence.projectFootprint.accepted ||
    evidence.projectFootprint.fabricationAuthority !== "deny" ||
    evidence.releaseState !== "deny" ||
    evidence.fabricationAuthority !== "deny" ||
    evidence.accepted
  ) {
    errors.push("BP-031 candidate must remain review-only, denied, and unaccepted")
  }
  if (
    evidence.artwork.state !== "generated-project-review-only" ||
    evidence.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
    evidence.artwork.generator !== "tscircuit" ||
    evidence.artwork.generatorVersion !== "0.0.2271" ||
    !/^[0-9A-F]{64}$/u.test(evidence.artwork.sha256) ||
    evidence.artwork.authority !== "deny"
  ) {
    errors.push("rendered artwork must have a bound digest while remaining denied")
  }
  return errors
}

const projectFootprint = (
  <footprint name="BP031_TPS60400DBVR_DBV_SOT23_5_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={projectPads[0].xMm}
      pcbY={projectPads[0].yMm}
      shape="rect"
      solderMaskMargin={`${solderMaskMarginMm}mm`}
      solderPasteMargin="0mm"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      portHints={["1", "OUT", "pin1", "upper-left"]}
    />
    <smtpad
      name="2"
      pcbX={projectPads[1].xMm}
      pcbY={projectPads[1].yMm}
      shape="rect"
      solderMaskMargin={`${solderMaskMarginMm}mm`}
      solderPasteMargin="0mm"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      portHints={["2", "IN"]}
    />
    <smtpad
      name="3"
      pcbX={projectPads[2].xMm}
      pcbY={projectPads[2].yMm}
      shape="rect"
      solderMaskMargin={`${solderMaskMarginMm}mm`}
      solderPasteMargin="0mm"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      portHints={["3", "CFLY-"]}
    />
    <smtpad
      name="4"
      pcbX={projectPads[3].xMm}
      pcbY={projectPads[3].yMm}
      shape="rect"
      solderMaskMargin={`${solderMaskMarginMm}mm`}
      solderPasteMargin="0mm"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      portHints={["4", "GND"]}
    />
    <smtpad
      name="5"
      pcbX={projectPads[4].xMm}
      pcbY={projectPads[4].yMm}
      shape="rect"
      solderMaskMargin={`${solderMaskMarginMm}mm`}
      solderPasteMargin="0mm"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      portHints={["5", "CFLY+"]}
    />
    {/* This courtyard is a project review envelope, not manufacturer CAD. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardEnvelope.widthMm}mm`}
      height={`${projectCourtyardEnvelope.heightMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031TiTps60400DbvrDbvFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for BP-031 review; never imported into a board. */
export function Bp031TiTps60400DbvrDbvFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031TiTps60400DbvrDbvFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_TPS60400DBVR"
      manufacturerPartNumber="TPS60400DBVR"
      pinLabels={{
        pin1: "OUT",
        pin2: "IN",
        pin3: "CFLY-",
        pin4: "GND",
        pin5: "CFLY+"
      }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031TiTps60400DbvrDbvFootprint
