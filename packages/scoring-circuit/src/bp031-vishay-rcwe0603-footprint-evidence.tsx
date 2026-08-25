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

function freezeDataGraph<const Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freezeDataGraph(child)
  return Object.freeze(value)
}

const privateBp031VishayRcwe0603References = [
  "R_REF_SAR_1",
  "R_REF_SAR_2",
  "R_REF_SAR_3",
  "R_REF_SAR_4",
  "R_REF_SAR_5",
  "R_REF_SAR_6",
  "R_REF_SAR_7"
] as const

export const bp031VishayRcwe0603References = freezeDataGraph([...privateBp031VishayRcwe0603References] as const)

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
  replicatedReferences: privateBp031VishayRcwe0603References,
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

const frozenBp031VishayRcwe0603FootprintEvidence = freezeDataGraph({
  artifactKind: "bp031-vishay-rcwe0603-r220-footprint-evidence",
  workUnit: "BP-031",
  manufacturer,
  manufacturerPartNumber,
  package: packageBody,
  sourceBinding: {
    canonicalSourcePath,
    canonicalSourceReference: "R_REF_SAR",
    replicatedReferencePrefix: "R_REF_SAR_",
    replicatedReferences: [...privateBp031VishayRcwe0603References],
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
} as const)

export const bp031VishayRcwe0603FootprintEvidence = freezeDataGraph(
  structuredClone(frozenBp031VishayRcwe0603FootprintEvidence)
)

function isExactPlainDataGraph(
  candidate: unknown,
  expected: unknown,
  seenCandidates = new Set<object>(),
  seenExpected = new Set<object>()
): boolean {
  if (candidate === null || expected === null || typeof candidate !== "object" || typeof expected !== "object") {
    return Object.is(candidate, expected)
  }
  try {
    if (seenCandidates.has(candidate) || seenExpected.has(expected)) return false
    seenCandidates.add(candidate)
    seenExpected.add(expected)
    if (Array.isArray(candidate) !== Array.isArray(expected)) return false
    if (Object.getPrototypeOf(candidate) !== Object.getPrototypeOf(expected)) return false
    const candidateSymbols = Object.getOwnPropertySymbols(candidate)
    const expectedSymbols = Object.getOwnPropertySymbols(expected)
    if (candidateSymbols.length !== expectedSymbols.length) return false
    const candidateNames = Object.getOwnPropertyNames(candidate)
    const expectedNames = Object.getOwnPropertyNames(expected)
    if (candidateNames.length !== expectedNames.length) return false
    for (const name of expectedNames) {
      const candidateDescriptor = Object.getOwnPropertyDescriptor(candidate, name)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, name)
      if (
        candidateDescriptor === undefined ||
        expectedDescriptor === undefined ||
        !("value" in candidateDescriptor) ||
        !("value" in expectedDescriptor) ||
        !isExactPlainDataGraph(candidateDescriptor.value, expectedDescriptor.value, seenCandidates, seenExpected)
      ) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

/** Empty output means a plain-data clone exactly matches the private frozen evidence graph. */
export function validateBp031VishayRcwe0603FootprintEvidence(
  candidate: unknown = bp031VishayRcwe0603FootprintEvidence
): readonly string[] {
  return isExactPlainDataGraph(candidate, frozenBp031VishayRcwe0603FootprintEvidence)
    ? []
    : ["BP-031 RCWE0603 evidence must exactly match the frozen series-only, fabrication-denied baseline"]
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
