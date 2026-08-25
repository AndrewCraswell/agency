import type { ReactElement } from "react"

const padPitchMm = 0.65
const rowCenterSpanMm = 5.8
const padLengthMm = 1.5
const padWidthMm = 0.45
const padRowCenterMm = rowCenterSpanMm / 2
const padYExtentMm = ((8 - 1) * padPitchMm) / 2
const packageBodyLengthMm = { minimum: 4.9, maximum: 5.1 } as const
const packageBodyWidthMm = { minimum: 4.3, maximum: 4.5 } as const
const packageLeadSpanMm = { minimum: 6.2, maximum: 6.6 } as const
const packageHeightMm = { maximum: 1.2 } as const
const packageLeadWidthMm = { minimum: 0.17, maximum: 0.3 } as const
const packageLeadLengthMm = { minimum: 0.5, maximum: 0.75 } as const
const solderMaskMarginMm = 0.05
const courtyardClearanceMm = 0.25

const projectPads = [
  { pin: 1, name: "SEL1", xMm: -padRowCenterMm, yMm: padYExtentMm },
  { pin: 2, name: "D1", xMm: -padRowCenterMm, yMm: padYExtentMm - padPitchMm },
  { pin: 3, name: "S1", xMm: -padRowCenterMm, yMm: padYExtentMm - 2 * padPitchMm },
  { pin: 4, name: "N.C.", xMm: -padRowCenterMm, yMm: padYExtentMm - 3 * padPitchMm },
  { pin: 5, name: "GND", xMm: -padRowCenterMm, yMm: padYExtentMm - 4 * padPitchMm },
  { pin: 6, name: "S4", xMm: -padRowCenterMm, yMm: padYExtentMm - 5 * padPitchMm },
  { pin: 7, name: "D4", xMm: -padRowCenterMm, yMm: padYExtentMm - 6 * padPitchMm },
  { pin: 8, name: "SEL4", xMm: -padRowCenterMm, yMm: -padYExtentMm },
  { pin: 9, name: "SEL3", xMm: padRowCenterMm, yMm: -padYExtentMm },
  { pin: 10, name: "D3", xMm: padRowCenterMm, yMm: -padYExtentMm + padPitchMm },
  { pin: 11, name: "S3", xMm: padRowCenterMm, yMm: -padYExtentMm + 2 * padPitchMm },
  { pin: 12, name: "N.C.", xMm: padRowCenterMm, yMm: -padYExtentMm + 3 * padPitchMm },
  { pin: 13, name: "VDD", xMm: padRowCenterMm, yMm: -padYExtentMm + 4 * padPitchMm },
  { pin: 14, name: "S2", xMm: padRowCenterMm, yMm: -padYExtentMm + 5 * padPitchMm },
  { pin: 15, name: "D2", xMm: padRowCenterMm, yMm: -padYExtentMm + 6 * padPitchMm },
  { pin: 16, name: "SEL2", xMm: padRowCenterMm, yMm: padYExtentMm }
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

const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/bp-031/ti-tmux1112pwr-pw0016a-datasheet-rev-c.pdf"
const sourceSha256 = "EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D"

/**
 * BP-031 review-only project footprint for the exact TMUX1112PWR PW TSSOP-16.
 *
 * TI's PW0016A drawing supplies the package, pin-one top view, copper land
 * pattern, preferred NSMD mask margin, and stencil dimensions. It does not
 * supply a manufacturer CAD file or courtyard. The rendered geometry below
 * is therefore a project review input and remains denied for fabrication.
 */
export const bp031Tmux1112PwrPwFootprintEvidence = {
  artifactKind: "bp031-ti-tmux1112pwr-pw-tssop16-footprint-evidence",
  workUnit: "BP-031",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TMUX1112PWR",
  package: {
    designation: "PW (TSSOP, 16)",
    packageDrawing: "PW0016A",
    packageStandard: "JEDEC MO-153",
    bodyLengthMm: packageBodyLengthMm,
    bodyWidthMm: packageBodyWidthMm,
    leadSpanMm: packageLeadSpanMm,
    heightMm: packageHeightMm,
    leadPitchMm: padPitchMm,
    leadWidthMm: packageLeadWidthMm,
    leadLengthMm: packageLeadLengthMm,
    terminals: 16
  },
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    canonicalSourceReference: "U_SOURCE_SWITCH",
    replicatedReferencePrefix: "U_SOURCE_SWITCH_",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TMUX1112PWR",
    package: "PW TSSOP-16",
    sourceContract: "BP-102"
  },
  sourceControl: {
    basisCommit: "8c27dd468c3b522f600207405191f136d0e7ee84",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
      }
    ]
  },
  sources: [
    {
      id: "ti-tmux1112pwr-scds408c",
      authority: "manufacturer-primary",
      documentNumber: "SCDS408C",
      revision: "C",
      url: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf",
      reviewedPages: "3, 33, 41-43",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "The retained TI datasheet includes PW0016A package and example land-pattern pages, but no manufacturer CAD object was acquired or retained."
  },
  manufacturerLandPattern: {
    sourceId: "ti-tmux1112pwr-scds408c",
    copper: {
      padLengthMm,
      padWidthMm,
      rowCenterSpanMm,
      pitchMm: padPitchMm,
      sourceStatement: "TI PW0016A example board layout: 16X (1.5), 16X (0.45), 14X (0.65), and (5.8)."
    },
    solderMask: {
      definition: "non-solder-mask-defined-preferred",
      marginPerEdgeMm: solderMaskMarginMm,
      sourceStatement: "TI PW0016A solder-mask details: 0.05 MAX all around for the preferred NSMD option."
    },
    paste: {
      apertureLengthMm: padLengthMm,
      apertureWidthMm: padWidthMm,
      stencilThicknessMm: 0.125,
      sourceStatement: "TI PW0016A example stencil design repeats 16X (1.5) and 16X (0.45)."
    },
    courtyard: {
      status: "not-published",
      sourceStatement: "No courtyard is shown in the retained TI package or land-pattern pages."
    }
  },
  pinOneOrientation: {
    sourceId: "ti-tmux1112pwr-scds408c",
    topViewPinOneDatum: "upper-left pin-one index area in Figure 5-1 and PW0016A package outline",
    topViewNumbering:
      "Pins 1 through 8 run down the left edge; pins 9 through 16 return up the right edge in the TI top view.",
    projectBoardRotationDegrees: 0,
    projectPinOnePad: { pin: 1, xMm: projectPads[0].xMm, yMm: projectPads[0].yMm },
    independentOrientationReview: "pending-independent-review",
    exactMatchStatus: "project-review-input-derived-from-ti-top-view"
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-derived-from-ti-pw0016a",
    padShape: "rectangular-smt",
    padLengthMm,
    padWidthMm,
    padRowCenterSpanMm: rowCenterSpanMm,
    padPitchMm,
    pads: projectPads,
    solderMask: {
      openingLengthMm: padLengthMm + 2 * solderMaskMarginMm,
      openingWidthMm: padWidthMm + 2 * solderMaskMarginMm,
      marginPerEdgeMm: solderMaskMarginMm,
      derivation: "TI preferred NSMD 0.05 mm maximum all around",
      status: "project-input-derived-from-manufacturer-guidance"
    },
    paste: {
      openingLengthMm: padLengthMm,
      openingWidthMm: padWidthMm,
      reductionPerEdgeMm: 0,
      derivation: "TI PW0016A stencil example uses the same 1.5 mm by 0.45 mm aperture as exposed metal",
      status: "project-input-derived-from-manufacturer-guidance"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      ...projectCourtyardEnvelope,
      minimumClearanceMm: courtyardClearanceMm,
      sourceStatus: "not-published",
      derivation: "maximum of TI package envelope and project pad envelope plus 0.25 mm review clearance",
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
    sha256: "9ABFB669F4BE57EED397C1AF2B812653D9B56032F492433BFEAF20EF1F959A7B",
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
    minimumXMm: Math.min(padEnvelope.minimumXMm, packageEnvelope.minimumXMm) - clearanceMm,
    maximumXMm: Math.max(padEnvelope.maximumXMm, packageEnvelope.maximumXMm) + clearanceMm,
    minimumYMm: Math.min(padEnvelope.minimumYMm, packageEnvelope.minimumYMm) - clearanceMm,
    maximumYMm: Math.max(padEnvelope.maximumYMm, packageEnvelope.maximumYMm) + clearanceMm
  }
}

/** Empty output means the deny-by-default evidence record is internally consistent. */
export function validateBp031Tmux1112PwrPwFootprintEvidence(
  candidate: typeof bp031Tmux1112PwrPwFootprintEvidence = bp031Tmux1112PwrPwFootprintEvidence
): readonly string[] {
  const evidence = candidate
  const errors: string[] = []
  const source = evidence.sources[0]
  if (evidence.sources.length !== 1 || evidence.sourceControl.upstreamSources.length !== 1) {
    errors.push("BP-031 exact source set drifted")
  }
  if (
    evidence.workUnit !== "BP-031" ||
    evidence.manufacturer !== "Texas Instruments" ||
    evidence.manufacturerPartNumber !== "TMUX1112PWR" ||
    evidence.package.designation !== "PW (TSSOP, 16)" ||
    evidence.package.packageDrawing !== "PW0016A" ||
    evidence.package.terminals !== 16
  ) {
    errors.push("exact TMUX1112PWR and PW TSSOP-16 identity drifted")
  }
  if (
    evidence.sourceBinding.canonicalSourceReference !== "U_SOURCE_SWITCH" ||
    evidence.sourceBinding.replicatedReferencePrefix !== "U_SOURCE_SWITCH_" ||
    evidence.sourceBinding.manufacturerPartNumber !== "TMUX1112PWR" ||
    evidence.sourceBinding.package !== "PW TSSOP-16" ||
    evidence.sourceBinding.sourceContract !== "BP-102"
  ) {
    errors.push("BP-102 source binding drifted")
  }
  if (
    source === undefined ||
    source.id !== "ti-tmux1112pwr-scds408c" ||
    source.documentNumber !== "SCDS408C" ||
    source.revision !== "C" ||
    source.url !== "https://www.ti.com/lit/ds/symlink/tmux1112.pdf" ||
    source.reviewedPages !== "3, 33, 41-43" ||
    source.artifactPath !== sourceArtifactPath ||
    source.sha256 !== sourceSha256 ||
    !/^[0-9A-F]{64}$/u.test(source.sha256)
  ) {
    errors.push("retained TI source identity or SHA-256 drifted")
  }
  if (
    evidence.package.bodyLengthMm.minimum !== 4.9 ||
    evidence.package.bodyLengthMm.maximum !== 5.1 ||
    evidence.package.bodyWidthMm.minimum !== 4.3 ||
    evidence.package.bodyWidthMm.maximum !== 4.5 ||
    evidence.package.leadSpanMm.minimum !== 6.2 ||
    evidence.package.leadSpanMm.maximum !== 6.6 ||
    evidence.package.leadPitchMm !== 0.65 ||
    evidence.package.leadWidthMm.minimum !== 0.17 ||
    evidence.package.leadWidthMm.maximum !== 0.3 ||
    evidence.package.leadLengthMm.minimum !== 0.5 ||
    evidence.package.leadLengthMm.maximum !== 0.75
  ) {
    errors.push("PW0016A package dimensions or pitch drifted")
  }
  if (
    evidence.manufacturerCad.state !== "not-acquired" ||
    evidence.manufacturerCad.artifactPath !== null ||
    evidence.manufacturerCad.authority !== "deny"
  ) {
    errors.push("manufacturer CAD must remain explicitly unacquired and denied")
  }
  if (
    evidence.pinOneOrientation.topViewPinOneDatum !==
      "upper-left pin-one index area in Figure 5-1 and PW0016A package outline" ||
    evidence.pinOneOrientation.projectBoardRotationDegrees !== 0 ||
    evidence.pinOneOrientation.projectPinOnePad.pin !== 1
  ) {
    errors.push("pin-one orientation datum or project rotation drifted")
  }
  const pads = evidence.projectFootprint.pads
  if (pads.length !== 16) errors.push("PW footprint must contain exactly 16 pads")
  for (const [index, pad] of pads.entries()) {
    const expectedPad = projectPads[index]
    if (
      expectedPad === undefined ||
      pad.pin !== expectedPad.pin ||
      pad.name !== expectedPad.name ||
      pad.xMm !== expectedPad.xMm ||
      pad.yMm !== expectedPad.yMm
    ) {
      errors.push(`PW pin mapping or position drifted at index ${index}`)
    }
  }
  if (
    pads[0]?.xMm !== -2.9 ||
    pads[0]?.yMm !== 2.275 ||
    pads[7]?.xMm !== -2.9 ||
    pads[7]?.yMm !== -2.275 ||
    pads[8]?.xMm !== 2.9 ||
    pads[8]?.yMm !== -2.275 ||
    pads[15]?.xMm !== 2.9 ||
    pads[15]?.yMm !== 2.275
  ) {
    errors.push("PW pad rows or pin-one placement drifted")
  }
  if (
    evidence.projectFootprint.padLengthMm !== padLengthMm ||
    evidence.projectFootprint.padWidthMm !== padWidthMm ||
    evidence.projectFootprint.padPitchMm !== padPitchMm ||
    evidence.projectFootprint.padRowCenterSpanMm !== rowCenterSpanMm
  ) {
    errors.push("project copper dimensions are not TI PW0016A dimensions")
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
    courtyard.widthMm !== derivedCourtyard.maximumXMm - derivedCourtyard.minimumXMm ||
    courtyard.heightMm !== derivedCourtyard.maximumYMm - derivedCourtyard.minimumYMm ||
    courtyard.sourceStatus !== "not-published"
  ) {
    errors.push("project courtyard is not derived from TI package and pad envelopes")
  }
  if (
    evidence.projectFootprint.solderMask.openingLengthMm !== padLengthMm + 2 * solderMaskMarginMm ||
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
  if (!/^[0-9A-F]{64}$/u.test(evidence.artwork.sha256) || evidence.artwork.authority !== "deny") {
    errors.push("rendered artwork must have a bound SHA-256 while remaining denied")
  }
  return errors
}

const projectFootprint = (
  <footprint name="BP031_TMUX1112PWR_PW_TSSOP16_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={projectPads[0].xMm}
      pcbY={projectPads[0].yMm}
      shape="rect"
      solderMaskMargin={`${solderMaskMarginMm}mm`}
      solderPasteMargin="0mm"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      portHints={["1", "SEL1", "pin1", "upper-left"]}
    />
    <smtpad
      name="2"
      pcbX={projectPads[1].xMm}
      pcbY={projectPads[1].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["2", "D1"]}
    />
    <smtpad
      name="3"
      pcbX={projectPads[2].xMm}
      pcbY={projectPads[2].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["3", "S1"]}
    />
    <smtpad
      name="4"
      pcbX={projectPads[3].xMm}
      pcbY={projectPads[3].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["4", "N.C."]}
    />
    <smtpad
      name="5"
      pcbX={projectPads[4].xMm}
      pcbY={projectPads[4].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["5", "GND"]}
    />
    <smtpad
      name="6"
      pcbX={projectPads[5].xMm}
      pcbY={projectPads[5].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["6", "S4"]}
    />
    <smtpad
      name="7"
      pcbX={projectPads[6].xMm}
      pcbY={projectPads[6].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["7", "D4"]}
    />
    <smtpad
      name="8"
      pcbX={projectPads[7].xMm}
      pcbY={projectPads[7].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["8", "SEL4"]}
    />
    <smtpad
      name="9"
      pcbX={projectPads[8].xMm}
      pcbY={projectPads[8].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["9", "SEL3"]}
    />
    <smtpad
      name="10"
      pcbX={projectPads[9].xMm}
      pcbY={projectPads[9].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["10", "D3"]}
    />
    <smtpad
      name="11"
      pcbX={projectPads[10].xMm}
      pcbY={projectPads[10].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["11", "S3"]}
    />
    <smtpad
      name="12"
      pcbX={projectPads[11].xMm}
      pcbY={projectPads[11].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["12", "N.C."]}
    />
    <smtpad
      name="13"
      pcbX={projectPads[12].xMm}
      pcbY={projectPads[12].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["13", "VDD"]}
    />
    <smtpad
      name="14"
      pcbX={projectPads[13].xMm}
      pcbY={projectPads[13].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["14", "S2"]}
    />
    <smtpad
      name="15"
      pcbX={projectPads[14].xMm}
      pcbY={projectPads[14].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["15", "D2"]}
    />
    <smtpad
      name="16"
      pcbX={projectPads[15].xMm}
      pcbY={projectPads[15].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="0mm"
      width="1.5mm"
      height="0.45mm"
      portHints={["16", "SEL2"]}
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

export interface Bp031Tmux1112PwrPwFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for BP-031 review; never imported into a board. */
export function Bp031Tmux1112PwrPwFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031Tmux1112PwrPwFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_TMUX1112PWR"
      manufacturerPartNumber="TMUX1112PWR"
      pinLabels={{
        pin1: "SEL1",
        pin2: "D1",
        pin3: "S1",
        pin4: "N.C.",
        pin5: "GND",
        pin6: "S4",
        pin7: "D4",
        pin8: "SEL4",
        pin9: "SEL3",
        pin10: "D3",
        pin11: "S3",
        pin12: "N.C.",
        pin13: "VDD",
        pin14: "S2",
        pin15: "D2",
        pin16: "SEL2"
      }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031Tmux1112PwrPwFootprint
