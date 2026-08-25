import type { ReactElement } from "react"

const manufacturer = "TDK"
const manufacturerPartNumber = "C1608X5R1A105K080AC"
const affectedReference = "C_ESP_EN_DELAY"
const packageCode = "0603"
const projectFootprintId = "tdk-c1608-c1608x5r1a105k080ac-project-review"
const characterizationPath =
  "packages/scoring-circuit/docs/evidence/bp-032/tdk-c1608x5r1a105k080ac-characterization.pdf"
const landPatternPath = "packages/scoring-circuit/docs/evidence/bp-032/tdk-c1608-commercial-general-land-pattern.pdf"
const characterizationSha256 = "180BECCB71F93CF9C4E7FDF810F9295BBE2009EF4595D733D32BE9DC4DEFC00D"
const landPatternSha256 = "83CE2395061AB4F3EC0BCF55FC419CA5077FEF4AF13CBF85FBE0B53E4BC80D5C"
const projectPadGapMm = 0.7
const projectPadLengthMm = 0.7
const projectPadWidthMm = 0.7
const projectPadCenterMm = (projectPadGapMm + projectPadLengthMm) / 2
const projectMaskMarginMm = 0.05
const projectPasteReductionMm = 0.05
const projectCourtyardLengthMm = 2.4
const projectCourtyardWidthMm = 1.3
const artworkSha256 = "D1DB1A503674A4E51CFB8E529C93CD02ACF6C30D025C284FD08431E239D945EC"

const sources = [
  {
    id: "bp032-tdk-c1608x5r1a105k080ac-characterization",
    ownerWorkUnit: "BP-032",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer,
    manufacturerPartNumber,
    url: "https://product.tdk.cn/system/files/dam/doc/product/capacitor/ceramic/mlcc/charasheet/c1608x5r1a105k080ac.pdf",
    artifactPath: characterizationPath,
    sha256: characterizationSha256,
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      package: "C1608 [EIA CC0603]",
      markers: [manufacturerPartNumber, "C1608 [EIA CC0603]", "1uF", "X5R", "1.60mm", "0.80mm"]
    },
    scope:
      "Exact TDK characterization sheet. It binds the orderable, C1608/EIA CC0603 package, 1 uF X5R value, and package envelope; it does not publish a CAD object."
  },
  {
    id: "bp032-tdk-c1608-commercial-general-land-pattern",
    ownerWorkUnit: "BP-032",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer,
    manufacturerPartNumber: "C1608 (CC0603) family guidance",
    url: "https://product.tdk.cn/system/files/dam/doc/product/capacitor/ceramic/mlcc/specification/mlccspec_commercial_general_c1608x7r1a106_en.pdf",
    artifactPath: landPatternPath,
    sha256: landPatternSha256,
    reviewedPages: [13],
    pageBinding: {
      retainedPdfPageCount: 30,
      landPatternPage: 13,
      printedPageLabel: "12",
      package: "C1608 (CC0603)",
      markers: ["C1608 (CC0603)", "Reflow soldering", "0.6 ~ 0.8"]
    },
    scope:
      "TDK commercial-general specification retained PDF page 13 (printed page 12). It provides C1608/CC0603 reflow A, B, and C land ranges; it is family-level manufacturer guidance, not exact-part CAD."
  }
] as const

const projectFootprint = {
  state: "review-only",
  geometryAuthority: "project-review-input-derived-from-manufacturer-land-guidance",
  padShape: "rectangular-smt",
  pads: [
    {
      pad: "1",
      terminal: "A",
      xMm: -projectPadCenterMm,
      yMm: 0,
      widthMm: projectPadLengthMm,
      heightMm: projectPadWidthMm
    },
    {
      pad: "2",
      terminal: "B",
      xMm: projectPadCenterMm,
      yMm: 0,
      widthMm: projectPadLengthMm,
      heightMm: projectPadWidthMm
    }
  ],
  solderMask: {
    openingLengthMm: Number((projectPadLengthMm + 2 * projectMaskMarginMm).toFixed(3)),
    openingWidthMm: Number((projectPadWidthMm + 2 * projectMaskMarginMm).toFixed(3)),
    marginPerEdgeMm: projectMaskMarginMm,
    status: "project-input-not-manufacturer-specification"
  },
  paste: {
    openingLengthMm: Number((projectPadLengthMm - 2 * projectPasteReductionMm).toFixed(3)),
    openingWidthMm: Number((projectPadWidthMm - 2 * projectPasteReductionMm).toFixed(3)),
    reductionPerEdgeMm: projectPasteReductionMm,
    status: "project-input-not-manufacturer-specification"
  },
  courtyard: {
    centerMm: { x: 0, y: 0 },
    lengthMm: projectCourtyardLengthMm,
    widthMm: projectCourtyardWidthMm,
    clearanceFromPadAndPackageMm: { length: 0.15, width: 0.2 },
    status: "project-review-input-not-manufacturer-specification"
  },
  orientation: {
    datum: "pad 1 at negative local X; pad 2 at positive local X",
    boardRotationDegrees: 0,
    pinOnePad: null,
    polarity: "non-polar"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

export const bp032TdkC1608CapacitorFootprintEvidence = {
  artifactKind: "bp032-tdk-c1608-capacitor-footprint-evidence",
  workUnit: "BP-032",
  sourceContracts: ["BP-123", "BP-125"],
  manufacturer,
  package: {
    designation: "C1608 (EIA CC0603)",
    caseSize: "0603 / 1608 metric",
    bodyLengthMm: { nominal: 1.6, minimum: 1.5, maximum: 1.75 },
    bodyWidthMm: { nominal: 0.8, minimum: 0.7, maximum: 0.95 },
    bodyThicknessMm: { nominal: 0.8, minimum: 0.7, maximum: 0.95 },
    terminalWidthMm: { minimum: 0.2 },
    terminalSpacingMm: { minimum: 0.3 },
    terminals: 2
  },
  exactPart: {
    manufacturerPartNumber,
    value: "1 uF X5R, 10 V, ±10%",
    package: packageCode,
    sourceId: sources[0].id,
    references: [affectedReference]
  },
  affectedReferences: [affectedReference],
  sourceBinding: {
    candidateLedger: "packages/scoring-circuit/src/bench-prototype-processor-footprints.ts",
    upstreamContract: "BP-123 reset/watchdog exact selection",
    sourceIdentityRule:
      "the exact MPN binds to its retained TDK characterization sheet; land guidance remains family-level",
    genericFamilySubstitution: "denied"
  },
  sources,
  manufacturerLandPattern: {
    sourceId: sources[1].id,
    sourceScope: "TDK C1608/CC0603 family-level reflow guidance",
    method: "reflow",
    A: { minimumMm: 0.6, maximumMm: 0.8, meaning: "terminal-to-terminal land gap" },
    B: { minimumMm: 0.6, maximumMm: 0.8, meaning: "land length" },
    C: { minimumMm: 0.6, maximumMm: 0.8, meaning: "land width" },
    disposition: "manufacturer-guidance-retained-project-input-not-manufacturer-cad"
  },
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "No exact TDK CAD object was acquired or retained. The project candidate is derived from the retained family land ranges and is not manufacturer CAD."
  },
  projectFootprintId,
  projectFootprint,
  orientation: {
    state: "pending-independent-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    rotationEquivalence: "180-degree rotationally equivalent",
    datum: "local two-terminal capacitor axis",
    note: "TDK identifies a symmetric two-terminal MLCC; no polarity or pin-one mark is asserted. Assembly rotation, placement stress, and board-level keepout review remain open."
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: artworkSha256,
    authority: "deny"
  },
  review: {
    status: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    scope:
      "Exact TDK orderable, package, retained manufacturer bytes, family land guidance, one-reference mapping, review artwork, orientation boundary, and deny-state integrity.",
    exactSourcePagesVisuallyReviewed: true,
    projectGeometryAccepted: false
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateBp032TdkC1608CapacitorFootprintEvidence(
  candidate: typeof bp032TdkC1608CapacitorFootprintEvidence = bp032TdkC1608CapacitorFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  if (
    candidate.artifactKind !== "bp032-tdk-c1608-capacitor-footprint-evidence" ||
    candidate.workUnit !== "BP-032" ||
    !sameJson(candidate.sourceContracts, ["BP-123", "BP-125"]) ||
    candidate.manufacturer !== manufacturer ||
    !sameJson(candidate.affectedReferences, [affectedReference]) ||
    candidate.exactPart.manufacturerPartNumber !== manufacturerPartNumber ||
    candidate.exactPart.package !== packageCode ||
    !sameJson(candidate.exactPart.references, [affectedReference]) ||
    candidate.sourceBinding.candidateLedger !==
      "packages/scoring-circuit/src/bench-prototype-processor-footprints.ts" ||
    candidate.sourceBinding.genericFamilySubstitution !== "denied" ||
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.artifactPath !== null ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.projectFootprintId !== projectFootprintId ||
    candidate.review.status !== "root-reviewed-review-input" ||
    candidate.review.reviewer !== "root-final-reviewer" ||
    !candidate.review.exactSourcePagesVisuallyReviewed ||
    candidate.review.projectGeometryAccepted ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("TDK C1608 candidate identity, exact scope, review boundary, or deny state drifted")
  }
  if (candidate.sources.length !== 2) errors.push("TDK C1608 retained-source count drifted")
  const expectedSources = [
    {
      id: sources[0].id,
      path: characterizationPath,
      sha256: characterizationSha256,
      url: sources[0].url,
      mpn: manufacturerPartNumber
    },
    {
      id: sources[1].id,
      path: landPatternPath,
      sha256: landPatternSha256,
      url: sources[1].url,
      mpn: "C1608 (CC0603) family guidance"
    }
  ] as const
  for (const [index, expected] of expectedSources.entries()) {
    const source = candidate.sources[index]
    if (
      source === undefined ||
      source.id !== expected.id ||
      source.artifactPath !== expected.path ||
      source.sha256 !== expected.sha256 ||
      source.url !== expected.url ||
      source.manufacturerPartNumber !== expected.mpn ||
      !isSha256(source.sha256)
    ) {
      errors.push(`retained TDK C1608 source ${expected.id} drifted`)
    }
  }
  if (
    candidate.package.designation !== "C1608 (EIA CC0603)" ||
    candidate.package.caseSize !== "0603 / 1608 metric" ||
    candidate.package.bodyLengthMm.nominal !== 1.6 ||
    candidate.package.bodyLengthMm.maximum !== 1.75 ||
    candidate.package.bodyWidthMm.nominal !== 0.8 ||
    candidate.package.bodyWidthMm.maximum !== 0.95 ||
    candidate.package.bodyThicknessMm.nominal !== 0.8 ||
    candidate.package.bodyThicknessMm.maximum !== 0.95 ||
    candidate.package.terminalWidthMm.minimum !== 0.2 ||
    candidate.package.terminalSpacingMm.minimum !== 0.3
  ) {
    errors.push("exact TDK C1608 package envelope drifted")
  }
  if (
    candidate.manufacturerLandPattern.sourceId !== sources[1].id ||
    candidate.manufacturerLandPattern.method !== "reflow" ||
    candidate.manufacturerLandPattern.A.minimumMm !== 0.6 ||
    candidate.manufacturerLandPattern.A.maximumMm !== 0.8 ||
    candidate.manufacturerLandPattern.B.minimumMm !== 0.6 ||
    candidate.manufacturerLandPattern.B.maximumMm !== 0.8 ||
    candidate.manufacturerLandPattern.C.minimumMm !== 0.6 ||
    candidate.manufacturerLandPattern.C.maximumMm !== 0.8
  ) {
    errors.push("TDK C1608 manufacturer land-pattern guidance drifted")
  }
  if (
    candidate.projectFootprint.pads.length !== 2 ||
    candidate.projectFootprint.pads[0]?.xMm !== -projectPadCenterMm ||
    candidate.projectFootprint.pads[1]?.xMm !== projectPadCenterMm ||
    candidate.projectFootprint.pads.some(
      (pad) => pad.widthMm !== projectPadLengthMm || pad.heightMm !== projectPadWidthMm || pad.yMm !== 0
    ) ||
    candidate.projectFootprint.solderMask.openingLengthMm !==
      Number((projectPadLengthMm + 2 * projectMaskMarginMm).toFixed(3)) ||
    candidate.projectFootprint.solderMask.openingWidthMm !==
      Number((projectPadWidthMm + 2 * projectMaskMarginMm).toFixed(3)) ||
    candidate.projectFootprint.paste.openingLengthMm !==
      Number((projectPadLengthMm - 2 * projectPasteReductionMm).toFixed(3)) ||
    candidate.projectFootprint.paste.openingWidthMm !==
      Number((projectPadWidthMm - 2 * projectPasteReductionMm).toFixed(3)) ||
    candidate.projectFootprint.courtyard.lengthMm !== projectCourtyardLengthMm ||
    candidate.projectFootprint.courtyard.widthMm !== projectCourtyardWidthMm ||
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny"
  ) {
    errors.push("TDK C1608 project copper, mask, paste, courtyard, or deny geometry drifted")
  }
  if (
    candidate.orientation.state !== "pending-independent-review" ||
    candidate.orientation.polarity !== "non-polar" ||
    candidate.orientation.pinOne !== "not-applicable" ||
    candidate.orientation.assemblyRotationDeg !== null ||
    candidate.artwork.state !== "generated-project-review-only" ||
    !isSha256(candidate.artwork.sha256) ||
    candidate.artwork.authority !== "deny"
  ) {
    errors.push("TDK C1608 orientation or rendered artwork disposition drifted")
  }
  return errors
}

export function bp032TdkC1608FootprintEvidenceFor(mpn: string, reference: string) {
  if (mpn !== manufacturerPartNumber || reference !== affectedReference) return null
  const source = sources[0]
  return {
    artifactKind: bp032TdkC1608CapacitorFootprintEvidence.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: source.id,
    sourceOwner: source.ownerWorkUnit,
    upstreamContract: "BP-123",
    sourceArtifactPath: source.artifactPath,
    sourceSha256: source.sha256,
    projectFootprintId,
    manufacturerCad: "not-acquired",
    manufacturerLandPattern: "manufacturer-guidance-retained-not-cad",
    artwork: "generated-project-review-only",
    orientation: "pending-independent-review",
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  } as const
}

const footprint = (
  <footprint name="BP032_TDK_C1608_C1608X5R1A105K080AC_PROJECT_REVIEW_ONLY" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectPadCenterMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionMm}mm`}
      width={`${projectPadLengthMm}mm`}
      height={`${projectPadWidthMm}mm`}
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectPadCenterMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionMm}mm`}
      width={`${projectPadLengthMm}mm`}
      height={`${projectPadWidthMm}mm`}
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardLengthMm}mm`}
      height={`${projectCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp032TdkC1608CapacitorFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

export function Bp032TdkC1608CapacitorFootprint(props: Bp032TdkC1608CapacitorFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP032_TDK_C1608_C1608X5R1A105K080AC"
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={footprint}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
    />
  )
}

export default Bp032TdkC1608CapacitorFootprint
