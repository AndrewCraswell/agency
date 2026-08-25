import type { ReactElement } from "react"

const manufacturer = "Vishay Dale"
const manufacturerPartNumber = "RCWE0603R220FKEA"
const canonicalSourcePath = "packages/scoring-circuit/src/one-channel-analog-readiness.ts"
const canonicalSourceSha256 = "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
const seriesSourcePath = "packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf"
const seriesSourceSha256 = "5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374"
const basisCommit = "d29c549b9da078b7c2e6f23487eb4c613eb4798f"
const solderMaskMarginMm = 0.05
const pasteReductionPerEdgeMm = 0.05
const courtyardClearanceMm = 0.15

export const bp031VishayRcwe0603References = [
  "R_REF_SAR_1",
  "R_REF_SAR_2",
  "R_REF_SAR_3",
  "R_REF_SAR_4",
  "R_REF_SAR_5",
  "R_REF_SAR_6",
  "R_REF_SAR_7"
] as const

const packageBody = {
  designation: "RCWE0603",
  imperialSize: "0603",
  bodyLengthMm: { minimum: 1.5, maximum: 1.7 },
  bodyWidthMm: { minimum: 0.75, maximum: 0.95 },
  bodyHeightMm: { minimum: 0.4, maximum: 0.6 },
  terminalLengthT1Mm: { minimum: 0.1, maximum: 0.5 },
  terminalLengthT2Mm: { minimum: 0.1, maximum: 0.5 }
} as const

const manufacturerReflowLandPattern = {
  padLengthAlongTerminalAxisMm: 0.7,
  padWidthAcrossTerminalAxisMm: 1,
  innerGapMm: 0.8,
  overallCopperSpanMm: 2.2,
  sourceParameters: {
    aPadLengthMm: 0.7,
    bPadWidthMm: 1,
    lInnerGapMm: 0.8
  }
} as const

const padCenterSpanMm =
  manufacturerReflowLandPattern.innerGapMm + manufacturerReflowLandPattern.padLengthAlongTerminalAxisMm

const projectPads = [
  { pin: 1, name: "A", xMm: -padCenterSpanMm / 2, yMm: 0 },
  { pin: 2, name: "B", xMm: padCenterSpanMm / 2, yMm: 0 }
] as const

function calculatePadEnvelope(
  pads: readonly { readonly xMm: number; readonly yMm: number }[],
  padLengthMm: number,
  padWidthMm: number
) {
  return {
    minimumXMm: Math.min(...pads.map(({ xMm }) => xMm - padLengthMm / 2)),
    maximumXMm: Math.max(...pads.map(({ xMm }) => xMm + padLengthMm / 2)),
    minimumYMm: Math.min(...pads.map(({ yMm }) => yMm - padWidthMm / 2)),
    maximumYMm: Math.max(...pads.map(({ yMm }) => yMm + padWidthMm / 2))
  } as const
}

function calculateCourtyard(
  padEnvelope: ReturnType<typeof calculatePadEnvelope>,
  packageLengthMm: number,
  packageWidthMm: number
) {
  const minimumXMm = Math.min(padEnvelope.minimumXMm, -packageLengthMm / 2) - courtyardClearanceMm
  const maximumXMm = Math.max(padEnvelope.maximumXMm, packageLengthMm / 2) + courtyardClearanceMm
  const minimumYMm = Math.min(padEnvelope.minimumYMm, -packageWidthMm / 2) - courtyardClearanceMm
  const maximumYMm = Math.max(padEnvelope.maximumYMm, packageWidthMm / 2) + courtyardClearanceMm
  return {
    centerMm: { x: 0, y: 0 },
    minimumXMm,
    maximumXMm,
    minimumYMm,
    maximumYMm,
    widthMm: maximumXMm - minimumXMm,
    heightMm: maximumYMm - minimumYMm,
    minimumClearanceMm: courtyardClearanceMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  } as const
}

const projectPadLengthMm = manufacturerReflowLandPattern.padLengthAlongTerminalAxisMm
const projectPadWidthMm = manufacturerReflowLandPattern.padWidthAcrossTerminalAxisMm
const projectPadEnvelope = calculatePadEnvelope(projectPads, projectPadLengthMm, projectPadWidthMm)

const projectFootprint = {
  state: "review-only",
  geometryAuthority: "project-review-input-derived-from-vishay-rcwe0603-reflow-guidance",
  padShape: "rectangular-smt",
  padLengthMm: projectPadLengthMm,
  padWidthMm: projectPadWidthMm,
  padCenterSpanMm,
  padGapMm: manufacturerReflowLandPattern.innerGapMm,
  pads: projectPads,
  solderMask: {
    openingLengthMm: projectPadLengthMm + 2 * solderMaskMarginMm,
    openingWidthMm: projectPadWidthMm + 2 * solderMaskMarginMm,
    marginPerEdgeMm: solderMaskMarginMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  },
  paste: {
    openingLengthMm: projectPadLengthMm - 2 * pasteReductionPerEdgeMm,
    openingWidthMm: projectPadWidthMm - 2 * pasteReductionPerEdgeMm,
    reductionPerEdgeMm: pasteReductionPerEdgeMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  },
  courtyard: calculateCourtyard(projectPadEnvelope, packageBody.bodyLengthMm.maximum, packageBody.bodyWidthMm.maximum),
  orientation: {
    polarity: "non-polar",
    pinOne: "not-applicable",
    state: "pending-independent-review",
    assemblyRotationDeg: null,
    datum: "two-terminal resistor axis",
    note: "The resistor is electrically non-polar; value marking direction and assembly rotation remain open."
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const sources = [
  {
    id: "vishay-rcwe-series-rev-2023-10-24",
    authority: "manufacturer-primary",
    documentNumber: "20019",
    revision: "24-Oct-2023",
    url: "https://www.vishay.com/docs/20019/rcwe.pdf",
    reviewedPages: "1-2",
    artifactPath: seriesSourcePath,
    sha256: seriesSourceSha256,
    scope:
      "Pages 1-2 establish the RCWE0603 family, its 0.033 to 0.976 ohm range, the global part-number fields, the 0603 package dimensions, and the 0.033 to 0.976 ohm reflow land pattern. The PDF does not name the exact RCWE0603R220FKEA orderable and does not publish exact-orderable CAD, solder-mask, paste, or courtyard objects."
  },
  {
    id: "bp031-rcwe0603-selected-mpn-record",
    authority: "project-canonical-source",
    documentNumber: null,
    revision: "BP-031 source snapshot",
    url: null,
    reviewedPages: null,
    artifactPath: canonicalSourcePath,
    sha256: canonicalSourceSha256,
    scope:
      "The canonical project source binds R_REF_SAR to exact MPN RCWE0603R220FKEA and selected value 0.22 ohm. This source is identity and replication evidence only, not manufacturer evidence or exact-orderable CAD."
  }
] as const

const exactSelectedPart = {
  canonicalReference: "R_REF_SAR",
  replicatedReferencePrefix: "R_REF_SAR_",
  replicatedReferences: bp031VishayRcwe0603References,
  role: "ADS8881 reference-feed isolation resistor",
  manufacturer,
  manufacturerPartNumber,
  resistanceOhms: 0.22,
  tolerancePercent: 1,
  tcrPpmPerC: 100,
  package: "0603",
  exactIdentitySourceId: "bp031-rcwe0603-selected-mpn-record",
  exactMpnNamedInManufacturerSource: false
} as const

export const bp031VishayRcwe0603FootprintEvidence = {
  artifactKind: "bp031-vishay-rcwe0603-r220-footprint-evidence",
  workUnit: "BP-031",
  manufacturer,
  manufacturerPartNumber,
  package: packageBody,
  sourceBinding: {
    canonicalSourcePath,
    canonicalSourceReference: "R_REF_SAR",
    replicatedReferencePrefix: "R_REF_SAR_",
    replicatedReferences: bp031VishayRcwe0603References,
    manufacturerPartNumber,
    package: "0603",
    sourceContract: "one-channel-analog-readiness"
  },
  sourceControl: {
    basisCommit,
    upstreamSources: [
      { path: canonicalSourcePath, sha256: canonicalSourceSha256 },
      { path: seriesSourcePath, sha256: seriesSourceSha256 }
    ]
  },
  sources,
  exactSelectedPart,
  manufacturerLandPattern: {
    sourceId: "vishay-rcwe-series-rev-2023-10-24",
    method: "reflow",
    padLengthAlongTerminalAxisMm: manufacturerReflowLandPattern.padLengthAlongTerminalAxisMm,
    padWidthAcrossTerminalAxisMm: manufacturerReflowLandPattern.padWidthAcrossTerminalAxisMm,
    innerGapMm: manufacturerReflowLandPattern.innerGapMm,
    overallCopperSpanMm: manufacturerReflowLandPattern.overallCopperSpanMm,
    sourceParameterMapping: manufacturerReflowLandPattern.sourceParameters,
    sourceStatement:
      "Vishay RCWE page 2, 0603 and 0.033 to 0.976 ohm row: a=0.70 mm along the terminal axis, b=1.00 mm across the terminal axis, and l=0.80 mm inner gap."
  },
  projectFootprint,
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "The retained Vishay source is a series datasheet and no exact-orderable CAD object was acquired or retained."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "18B1E594373C011BB7264CCBDE2E8F489D3311D461B4D9442281BE84E6A8F592",
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

type Candidate = typeof bp031VishayRcwe0603FootprintEvidence

/** Empty output means the exact-MPN, series-evidence, and deny state are consistent. */
export function validateBp031VishayRcwe0603FootprintEvidence(
  candidate: Candidate = bp031VishayRcwe0603FootprintEvidence
) {
  const errors: string[] = []
  const source = candidate.sources.find((entry) => entry.id === "vishay-rcwe-series-rev-2023-10-24")
  const identitySource = candidate.sources.find((entry) => entry.id === "bp031-rcwe0603-selected-mpn-record")
  if (
    candidate.artifactKind !== "bp031-vishay-rcwe0603-r220-footprint-evidence" ||
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== manufacturer ||
    candidate.manufacturerPartNumber !== manufacturerPartNumber ||
    candidate.sourceControl.basisCommit !== basisCommit ||
    candidate.sources.length !== 2 ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("BP-031 RCWE0603 evidence identity, source control, or deny state drifted")
  }
  if (
    source === undefined ||
    source.authority !== "manufacturer-primary" ||
    source.documentNumber !== "20019" ||
    source.revision !== "24-Oct-2023" ||
    source.url !== "https://www.vishay.com/docs/20019/rcwe.pdf" ||
    source.reviewedPages !== "1-2" ||
    source.artifactPath !== seriesSourcePath ||
    source.sha256 !== seriesSourceSha256 ||
    !/^[0-9A-F]{64}$/u.test(source.sha256)
  ) {
    errors.push("Vishay RCWE series source identity or SHA-256 drifted")
  }
  if (
    identitySource === undefined ||
    identitySource.authority !== "project-canonical-source" ||
    identitySource.artifactPath !== canonicalSourcePath ||
    identitySource.sha256 !== canonicalSourceSha256 ||
    identitySource.url !== null ||
    identitySource.reviewedPages !== null
  ) {
    errors.push("exact RCWE0603 MPN source must remain project-only identity evidence")
  }
  if (
    candidate.sourceControl.upstreamSources.length !== 2 ||
    candidate.sourceControl.upstreamSources[0]?.path !== canonicalSourcePath ||
    candidate.sourceControl.upstreamSources[0]?.sha256 !== canonicalSourceSha256 ||
    candidate.sourceControl.upstreamSources[1]?.path !== seriesSourcePath ||
    candidate.sourceControl.upstreamSources[1]?.sha256 !== seriesSourceSha256
  ) {
    errors.push("RCWE0603 upstream source hash bindings drifted")
  }
  if (
    candidate.sourceBinding.canonicalSourcePath !== canonicalSourcePath ||
    candidate.sourceBinding.canonicalSourceReference !== "R_REF_SAR" ||
    candidate.sourceBinding.replicatedReferencePrefix !== "R_REF_SAR_" ||
    candidate.sourceBinding.manufacturerPartNumber !== manufacturerPartNumber ||
    candidate.sourceBinding.package !== "0603" ||
    candidate.sourceBinding.replicatedReferences.length !== 7
  ) {
    errors.push("RCWE0603 exact source binding or seven-reference replication drifted")
  }
  if (
    candidate.exactSelectedPart.canonicalReference !== exactSelectedPart.canonicalReference ||
    candidate.exactSelectedPart.replicatedReferencePrefix !== exactSelectedPart.replicatedReferencePrefix ||
    candidate.exactSelectedPart.manufacturerPartNumber !== manufacturerPartNumber ||
    candidate.exactSelectedPart.resistanceOhms !== 0.22 ||
    candidate.exactSelectedPart.tolerancePercent !== 1 ||
    candidate.exactSelectedPart.tcrPpmPerC !== 100 ||
    candidate.exactSelectedPart.package !== "0603" ||
    candidate.exactSelectedPart.exactIdentitySourceId !== "bp031-rcwe0603-selected-mpn-record" ||
    candidate.exactSelectedPart.exactMpnNamedInManufacturerSource ||
    candidate.exactSelectedPart.replicatedReferences.join(",") !== bp031VishayRcwe0603References.join(",")
  ) {
    errors.push("exact RCWE0603 MPN, package, value, or replication identity drifted")
  }
  if (
    candidate.package.bodyLengthMm.minimum !== packageBody.bodyLengthMm.minimum ||
    candidate.package.bodyLengthMm.maximum !== packageBody.bodyLengthMm.maximum ||
    candidate.package.bodyWidthMm.minimum !== packageBody.bodyWidthMm.minimum ||
    candidate.package.bodyWidthMm.maximum !== packageBody.bodyWidthMm.maximum ||
    candidate.package.bodyHeightMm.minimum !== packageBody.bodyHeightMm.minimum ||
    candidate.package.bodyHeightMm.maximum !== packageBody.bodyHeightMm.maximum
  ) {
    errors.push("RCWE0603 package dimensions drifted")
  }
  if (
    candidate.manufacturerLandPattern.sourceId !== "vishay-rcwe-series-rev-2023-10-24" ||
    candidate.manufacturerLandPattern.method !== "reflow" ||
    candidate.manufacturerLandPattern.padLengthAlongTerminalAxisMm !== 0.7 ||
    candidate.manufacturerLandPattern.padWidthAcrossTerminalAxisMm !== 1 ||
    candidate.manufacturerLandPattern.innerGapMm !== 0.8 ||
    candidate.manufacturerLandPattern.overallCopperSpanMm !== 2.2
  ) {
    errors.push("RCWE0603 manufacturer reflow land pattern drifted")
  }
  const project = candidate.projectFootprint
  if (
    project.state !== "review-only" ||
    project.padLengthMm !== projectPadLengthMm ||
    project.padWidthMm !== projectPadWidthMm ||
    project.padCenterSpanMm !== padCenterSpanMm ||
    project.padGapMm !== manufacturerReflowLandPattern.innerGapMm ||
    project.pads.length !== 2 ||
    project.solderMask.openingLengthMm !== projectPadLengthMm + 2 * solderMaskMarginMm ||
    project.solderMask.openingWidthMm !== projectPadWidthMm + 2 * solderMaskMarginMm ||
    project.solderMask.marginPerEdgeMm !== solderMaskMarginMm ||
    project.solderMask.sourceStatus !== "not-published" ||
    project.paste.openingLengthMm !== projectPadLengthMm - 2 * pasteReductionPerEdgeMm ||
    project.paste.openingWidthMm !== projectPadWidthMm - 2 * pasteReductionPerEdgeMm ||
    project.paste.reductionPerEdgeMm !== pasteReductionPerEdgeMm ||
    project.paste.sourceStatus !== "not-published" ||
    project.courtyard.sourceStatus !== "not-published" ||
    project.courtyard.minimumClearanceMm !== courtyardClearanceMm ||
    project.orientation.polarity !== "non-polar" ||
    project.orientation.pinOne !== "not-applicable" ||
    project.accepted ||
    project.fabricationAuthority !== "deny"
  ) {
    errors.push("RCWE0603 project geometry must remain derived, review-only, and denied")
  }
  for (const [index, pad] of project.pads.entries()) {
    const expectedPad = projectPads[index]
    if (
      expectedPad === undefined ||
      pad.pin !== expectedPad.pin ||
      pad.name !== expectedPad.name ||
      pad.xMm !== expectedPad.xMm ||
      pad.yMm !== expectedPad.yMm
    ) {
      errors.push(`RCWE0603 pad mapping drifted at index ${index}`)
    }
  }
  const expectedCourtyard = calculateCourtyard(
    projectPadEnvelope,
    packageBody.bodyLengthMm.maximum,
    packageBody.bodyWidthMm.maximum
  )
  if (
    project.courtyard.minimumXMm !== expectedCourtyard.minimumXMm ||
    project.courtyard.maximumXMm !== expectedCourtyard.maximumXMm ||
    project.courtyard.minimumYMm !== expectedCourtyard.minimumYMm ||
    project.courtyard.maximumYMm !== expectedCourtyard.maximumYMm ||
    project.courtyard.widthMm !== expectedCourtyard.widthMm ||
    project.courtyard.heightMm !== expectedCourtyard.heightMm
  ) {
    errors.push("RCWE0603 courtyard derivation drifted")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.artifactPath !== null ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.artwork.authority !== "deny" ||
    !/^[0-9A-F]{64}$/u.test(candidate.artwork.sha256)
  ) {
    errors.push("RCWE0603 manufacturer CAD and artwork authority must remain denied")
  }
  return errors
}

function resistorFootprint(reference: string) {
  return (
    <footprint name={`BP031_${reference}_PROJECT_FOOTPRINT`} originalLayer="top">
      <smtpad
        name="1"
        pcbX={projectPads[0].xMm}
        pcbY={projectPads[0].yMm}
        shape="rect"
        solderMaskMargin={`${solderMaskMarginMm}mm`}
        solderPasteMargin={`-${pasteReductionPerEdgeMm}mm`}
        width={`${projectPadLengthMm}mm`}
        height={`${projectPadWidthMm}mm`}
        portHints={["1", "A", "non-polar"]}
      />
      <smtpad
        name="2"
        pcbX={projectPads[1].xMm}
        pcbY={projectPads[1].yMm}
        shape="rect"
        solderMaskMargin={`${solderMaskMarginMm}mm`}
        solderPasteMargin={`-${pasteReductionPerEdgeMm}mm`}
        width={`${projectPadLengthMm}mm`}
        height={`${projectPadWidthMm}mm`}
        portHints={["2", "B", "non-polar"]}
      />
      <courtyardrect
        pcbX={0}
        pcbY={0}
        width={`${projectFootprint.courtyard.widthMm}mm`}
        height={`${projectFootprint.courtyard.heightMm}mm`}
        strokeWidth="0.05mm"
      />
    </footprint>
  )
}

export interface Bp031VishayRcwe0603FootprintProps {
  readonly reference?: (typeof bp031VishayRcwe0603References)[number]
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated review-only candidate footprint for each of the seven R_REF_SAR instances. */
export function Bp031VishayRcwe0603R220FkeaFootprint({
  reference = bp031VishayRcwe0603References[0],
  pcbRotation,
  pcbX,
  pcbY
}: Bp031VishayRcwe0603FootprintProps = {}): ReactElement {
  return (
    <chip
      name={reference}
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={resistorFootprint(reference)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031VishayRcwe0603R220FkeaFootprint
