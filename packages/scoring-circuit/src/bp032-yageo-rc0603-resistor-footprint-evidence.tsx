import type { ReactElement } from "react"

const manufacturer = "Yageo"
const packageName = "0603 (1608 metric)"
const packageCode = "0603"
const tenK = "RC0603FR-0710KL"
const oneHundredK = "RC0603FR-07100KL"

const tenKSourcePath = "packages/scoring-circuit/docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf"
const oneHundredKSourcePath = "packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf"
const tenKSha256 = "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497"
const oneHundredKSha256 = "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"

const tenKReferences = [
  "R_STM_WD_CWD",
  "R_ESP_WD_CWD",
  "R_STM_NRST_PULLUP",
  "R_ESP_EN_PULLUP",
  "R_APP_SUPERVISOR_RESET_PULLUP",
  "R_W5500_RESET_PULLUP",
  "R_STM_RESET_ISO_SERIES",
  "R_STM_RESET_GATE",
  "R_DEBUG_RESET_GATE",
  "R_STM_BOOT0",
  "R_ESP_BOOT_PULLUP"
] as const

const oneHundredKReferences = [
  "R_STM_WDI_PULLUP",
  "R_ESP_WDI_PULLUP",
  "R_STM_RESET_ISO_PD",
  "R_STM_RESET_GATE_PD",
  "R_DEBUG_RESET_GATE_PD"
] as const

const affectedReferences = [...tenKReferences, ...oneHundredKReferences] as const
const projectPadGapMm = 0.5
const projectPadLengthMm = 0.9
const projectPadWidthMm = 0.9
const projectPadCenterMm = (projectPadGapMm + projectPadLengthMm) / 2
const projectMaskMarginMm = 0.05
const projectPasteReductionMm = 0.05
const projectCourtyardLengthMm = 2.4
const projectCourtyardWidthMm = 1.4
const projectFootprintId = "yageo-rc0603-project-review"
const artworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"

const sources = [
  {
    id: "bp125-yageo-rc0603fr-0710kl-datasheet",
    ownerWorkUnit: "BP-125",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer,
    manufacturerPartNumber: tenK,
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
    artifactPath: tenKSourcePath,
    sha256: tenKSha256,
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      printedPageLabel: "1",
      package: "0603 / 1608",
      markers: [tenK, "10 kOhms", "1.6mm +/-0.1mm", "0.8mm +/-0.1mm", "0.45mm +/-0.1mm"]
    },
    scope:
      "Exact RC0603FR-0710KL product specification retained by BP-125. It binds the 10 kOhm, 1 percent, 0603 / 1608 orderable and package dimensions; it does not publish an exact land pattern, solder-mask opening, paste aperture, courtyard, or CAD object."
  },
  {
    id: "bp033-yageo-rc0603fr-07100kl-datasheet",
    ownerWorkUnit: "BP-033",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer,
    manufacturerPartNumber: oneHundredK,
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
    artifactPath: oneHundredKSourcePath,
    sha256: oneHundredKSha256,
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      printedPageLabel: "1",
      package: "0603 / 1608",
      markers: [oneHundredK, "100 kOhms", "1.6mm +/-0.1mm", "0.8mm +/-0.1mm", "0.45mm +/-0.1mm"]
    },
    scope:
      "Exact RC0603FR-07100KL product specification retained by BP-033. It binds the 100 kOhm, 1 percent, 0603 / 1608 orderable and package dimensions; it does not publish an exact land pattern, solder-mask opening, paste aperture, courtyard, or CAD object."
  }
] as const

const exactParts = [
  {
    manufacturerPartNumber: tenK,
    resistanceOhms: 10000,
    tolerancePercent: 1,
    package: packageCode,
    sourceId: sources[0].id,
    sourceOwner: "BP-125",
    references: tenKReferences
  },
  {
    manufacturerPartNumber: oneHundredK,
    resistanceOhms: 100000,
    tolerancePercent: 1,
    package: packageCode,
    sourceId: sources[1].id,
    sourceOwner: "BP-033",
    references: oneHundredKReferences
  }
] as const

const referenceBindings = [
  ...tenKReferences.map((reference) => ({
    reference,
    manufacturerPartNumber: tenK,
    resistanceOhms: 10000,
    sourceId: sources[0].id,
    upstreamContract: reference === "R_STM_BOOT0" || reference === "R_ESP_BOOT_PULLUP" ? "BP-125" : "BP-123"
  })),
  ...oneHundredKReferences.map((reference) => ({
    reference,
    manufacturerPartNumber: oneHundredK,
    resistanceOhms: 100000,
    sourceId: sources[1].id,
    upstreamContract: "BP-123"
  }))
] as const

const projectFootprint = {
  state: "review-only",
  geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
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
    openingLengthMm: projectPadLengthMm + 2 * projectMaskMarginMm,
    openingWidthMm: projectPadWidthMm + 2 * projectMaskMarginMm,
    marginPerEdgeMm: projectMaskMarginMm,
    status: "project-input-not-manufacturer-specification"
  },
  paste: {
    openingLengthMm: projectPadLengthMm - 2 * projectPasteReductionMm,
    openingWidthMm: projectPadWidthMm - 2 * projectPasteReductionMm,
    reductionPerEdgeMm: projectPasteReductionMm,
    status: "project-input-not-manufacturer-specification"
  },
  courtyard: {
    centerMm: { x: 0, y: 0 },
    lengthMm: projectCourtyardLengthMm,
    widthMm: projectCourtyardWidthMm,
    clearanceFromPadAndPackageMm: { length: 0.05, width: 0.15 },
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

export const bp032YageoRc0603ResistorFootprintEvidence = {
  artifactKind: "bp032-yageo-rc0603-resistor-footprint-evidence",
  workUnit: "BP-032",
  sourceContracts: ["BP-123", "BP-125", "BP-033"],
  manufacturer,
  package: {
    designation: packageName,
    caseSize: "EIA 0603 / IEC 1608",
    bodyLengthMm: { nominal: 1.6, minimum: 1.5, maximum: 1.7 },
    bodyWidthMm: { nominal: 0.8, minimum: 0.7, maximum: 0.9 },
    bodyThicknessMm: { nominal: 0.45, minimum: 0.35, maximum: 0.55 },
    terminalLengthMm: { nominal: 0.25, minimum: 0.1, maximum: 0.4 },
    terminals: 2
  },
  affectedReferences,
  exactParts,
  referenceBindings,
  sourceBinding: {
    candidateLedger: "packages/scoring-circuit/src/bench-prototype-processor-footprints.ts",
    sourceIdentityRule: "each exact MPN binds only its own retained official PDF bytes",
    genericFamilySubstitution: "denied"
  },
  sources,
  manufacturerLandPattern: {
    sourceScope: "retained exact-part product specifications; land-pattern guidance not published",
    copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
    solderMask: { status: "not-published" },
    paste: { status: "not-published" },
    courtyard: { status: "not-published", lengthMm: null, widthMm: null }
  },
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "No exact Yageo CAD object is retained. Package dimensions and project geometry are not treated as manufacturer CAD."
  },
  projectFootprintId,
  projectFootprint,
  orientation: {
    state: "pending-independent-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    rotationEquivalence: "180-degree rotationally equivalent",
    datum: "local two-terminal resistor axis",
    note: "Electrical polarity is symmetric; printed value orientation, assembly marking, and stress review remain open."
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
    reviewedAt: "2026-08-25T08:18:00.000Z",
    scope:
      "Exact orderables, retained source hashes, 16-reference mapping, package envelope, rendered candidate, and deny-state integrity only; the project land pattern, assembly stress, release, and fabrication remain unapproved.",
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

/** Empty output means the exact two-MPN deny-by-default candidate is consistent. */
export function validateBp032YageoRc0603ResistorFootprintEvidence(
  candidate: typeof bp032YageoRc0603ResistorFootprintEvidence = bp032YageoRc0603ResistorFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  const expectedParts = [
    { mpn: tenK, resistanceOhms: 10000, sourceId: sources[0].id, sourceOwner: "BP-125", references: tenKReferences },
    {
      mpn: oneHundredK,
      resistanceOhms: 100000,
      sourceId: sources[1].id,
      sourceOwner: "BP-033",
      references: oneHundredKReferences
    }
  ] as const
  if (
    candidate.artifactKind !== "bp032-yageo-rc0603-resistor-footprint-evidence" ||
    candidate.workUnit !== "BP-032" ||
    !sameJson(candidate.sourceContracts, ["BP-123", "BP-125", "BP-033"]) ||
    candidate.manufacturer !== manufacturer ||
    !sameJson(candidate.affectedReferences, affectedReferences) ||
    candidate.sourceBinding.candidateLedger !==
      "packages/scoring-circuit/src/bench-prototype-processor-footprints.ts" ||
    candidate.sourceBinding.genericFamilySubstitution !== "denied" ||
    candidate.exactParts.length !== 2 ||
    candidate.referenceBindings.length !== affectedReferences.length ||
    candidate.review.status !== "root-reviewed-review-input" ||
    candidate.review.reviewer !== "root-final-reviewer" ||
    !candidate.review.exactSourcePagesVisuallyReviewed ||
    candidate.review.projectGeometryAccepted ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("BP-032 Yageo candidate identity, exact scope, or deny state drifted")
  }
  for (const [index, expected] of expectedParts.entries()) {
    const part = candidate.exactParts[index]
    if (
      part === undefined ||
      part.manufacturerPartNumber !== expected.mpn ||
      part.resistanceOhms !== expected.resistanceOhms ||
      part.tolerancePercent !== 1 ||
      part.package !== packageCode ||
      part.sourceId !== expected.sourceId ||
      part.sourceOwner !== expected.sourceOwner ||
      !sameJson(part.references, expected.references)
    ) {
      errors.push(`exact Yageo ${expected.mpn} identity or reference set drifted`)
    }
  }
  const expectedSourceFields = [
    {
      id: sources[0].id,
      ownerWorkUnit: "BP-125",
      mpn: tenK,
      path: tenKSourcePath,
      sha256: tenKSha256,
      url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      resistance: "10 kOhms"
    },
    {
      id: sources[1].id,
      ownerWorkUnit: "BP-033",
      mpn: oneHundredK,
      path: oneHundredKSourcePath,
      sha256: oneHundredKSha256,
      url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
      resistance: "100 kOhms"
    }
  ] as const
  if (candidate.sources.length !== expectedSourceFields.length) errors.push("Yageo retained-source count drifted")
  for (const [index, expected] of expectedSourceFields.entries()) {
    const source = candidate.sources[index]
    if (
      source === undefined ||
      source.id !== expected.id ||
      source.ownerWorkUnit !== expected.ownerWorkUnit ||
      source.authority !== "manufacturer-primary-retained-bytes" ||
      source.manufacturer !== manufacturer ||
      source.manufacturerPartNumber !== expected.mpn ||
      source.url !== expected.url ||
      source.artifactPath !== expected.path ||
      source.sha256 !== expected.sha256 ||
      !isSha256(source.sha256) ||
      !sameJson(source.reviewedPages, [1]) ||
      source.pageBinding.retainedPdfPageCount !== 1 ||
      source.pageBinding.exactOrderablePdfPage !== 1 ||
      source.pageBinding.package !== "0603 / 1608" ||
      !source.pageBinding.markers.some((marker) => marker === expected.mpn) ||
      !source.pageBinding.markers.some((marker) => marker === expected.resistance)
    ) {
      errors.push(`retained exact ${expected.mpn} source binding drifted`)
    }
  }
  const expectedBindings = [
    ...tenKReferences.map((reference) => ({
      reference,
      mpn: tenK,
      resistanceOhms: 10000,
      sourceId: sources[0].id,
      upstreamContract: reference === "R_STM_BOOT0" || reference === "R_ESP_BOOT_PULLUP" ? "BP-125" : "BP-123"
    })),
    ...oneHundredKReferences.map((reference) => ({
      reference,
      mpn: oneHundredK,
      resistanceOhms: 100000,
      sourceId: sources[1].id,
      upstreamContract: "BP-123"
    }))
  ] as const
  if (
    candidate.referenceBindings.some(
      (binding, index) =>
        binding.reference !== expectedBindings[index]?.reference ||
        binding.manufacturerPartNumber !== expectedBindings[index]?.mpn ||
        binding.resistanceOhms !== expectedBindings[index]?.resistanceOhms ||
        binding.sourceId !== expectedBindings[index]?.sourceId ||
        binding.upstreamContract !== expectedBindings[index]?.upstreamContract
    )
  ) {
    errors.push("BP-032 exact Yageo reference-to-MPN/source reconciliation drifted")
  }
  if (
    candidate.package.designation !== packageName ||
    candidate.package.caseSize !== "EIA 0603 / IEC 1608" ||
    candidate.package.bodyLengthMm.minimum !== 1.5 ||
    candidate.package.bodyLengthMm.maximum !== 1.7 ||
    candidate.package.bodyWidthMm.minimum !== 0.7 ||
    candidate.package.bodyWidthMm.maximum !== 0.9 ||
    candidate.package.bodyThicknessMm.minimum !== 0.35 ||
    candidate.package.bodyThicknessMm.maximum !== 0.55 ||
    candidate.package.terminalLengthMm.minimum !== 0.1 ||
    candidate.package.terminalLengthMm.maximum !== 0.4 ||
    candidate.package.terminals !== 2
  ) {
    errors.push("exact Yageo package dimensions drifted")
  }
  if (
    candidate.manufacturerLandPattern.copper.status !== "not-published" ||
    candidate.manufacturerLandPattern.copper.padGapMm !== null ||
    candidate.manufacturerLandPattern.solderMask.status !== "not-published" ||
    candidate.manufacturerLandPattern.paste.status !== "not-published" ||
    candidate.manufacturerLandPattern.courtyard.status !== "not-published" ||
    candidate.manufacturerLandPattern.courtyard.lengthMm !== null ||
    candidate.manufacturerLandPattern.courtyard.widthMm !== null ||
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.artifactPath !== null ||
    candidate.manufacturerCad.authority !== "deny"
  ) {
    errors.push("Yageo manufacturer land-pattern or CAD boundary drifted")
  }
  if (
    candidate.projectFootprintId !== projectFootprintId ||
    candidate.projectFootprint.pads.length !== 2 ||
    candidate.projectFootprint.pads[0]?.xMm !== -projectPadCenterMm ||
    candidate.projectFootprint.pads[1]?.xMm !== projectPadCenterMm ||
    candidate.projectFootprint.pads.some(
      (pad) => pad.widthMm !== projectPadLengthMm || pad.heightMm !== projectPadWidthMm || pad.yMm !== 0
    ) ||
    candidate.projectFootprint.solderMask.openingLengthMm !== projectPadLengthMm + 2 * projectMaskMarginMm ||
    candidate.projectFootprint.solderMask.openingWidthMm !== projectPadWidthMm + 2 * projectMaskMarginMm ||
    candidate.projectFootprint.solderMask.marginPerEdgeMm !== projectMaskMarginMm ||
    candidate.projectFootprint.paste.openingLengthMm !== projectPadLengthMm - 2 * projectPasteReductionMm ||
    candidate.projectFootprint.paste.openingWidthMm !== projectPadWidthMm - 2 * projectPasteReductionMm ||
    candidate.projectFootprint.paste.reductionPerEdgeMm !== projectPasteReductionMm ||
    candidate.projectFootprint.courtyard.lengthMm !== projectCourtyardLengthMm ||
    candidate.projectFootprint.courtyard.widthMm !== projectCourtyardWidthMm ||
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny"
  ) {
    errors.push("project Yageo copper, mask, paste, courtyard, or deny geometry drifted")
  }
  if (
    candidate.orientation.state !== "pending-independent-review" ||
    candidate.orientation.polarity !== "non-polar" ||
    candidate.orientation.pinOne !== "not-applicable" ||
    candidate.orientation.assemblyRotationDeg !== null ||
    candidate.projectFootprint.orientation.boardRotationDegrees !== 0 ||
    candidate.projectFootprint.orientation.pinOnePad !== null ||
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.sha256 !== artworkSha256 ||
    !isSha256(candidate.artwork.sha256) ||
    candidate.artwork.authority !== "deny"
  ) {
    errors.push("Yageo orientation or rendered artwork disposition drifted")
  }
  return errors
}

export function bp032YageoRc0603FootprintEvidenceFor(mpn: string, reference: string) {
  const binding = referenceBindings.find(
    (candidate) => candidate.reference === reference && candidate.manufacturerPartNumber === mpn
  )
  if (binding === undefined) return null
  const source = sources.find((candidate) => candidate.id === binding.sourceId)
  if (source === undefined) throw new Error(`Missing retained Yageo source ${binding.sourceId}`)
  return {
    artifactKind: bp032YageoRc0603ResistorFootprintEvidence.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: source.id,
    sourceOwner: source.ownerWorkUnit,
    upstreamContract: binding.upstreamContract,
    sourceArtifactPath: source.artifactPath,
    sourceSha256: source.sha256,
    projectFootprintId,
    manufacturerCad: "not-acquired",
    artwork: "generated-project-review-only",
    orientation: "pending-independent-review",
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  } as const
}

const footprint = (name: string): ReactElement => (
  <footprint name={name} originalLayer="top">
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

export interface Bp032YageoRc0603ResistorFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

function resistorComponent(
  manufacturerPartNumber: string,
  footprintName: string,
  props: Bp032YageoRc0603ResistorFootprintProps
): ReactElement {
  if (manufacturerPartNumber !== tenK && manufacturerPartNumber !== oneHundredK)
    throw new RangeError(`Unsupported exact Yageo MPN ${manufacturerPartNumber}`)
  return (
    <chip
      name={`R_BP032_${manufacturerPartNumber}`}
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={footprint(footprintName)}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
    />
  )
}

export function Bp032YageoRc0603Fr0710KlFootprint(props: Bp032YageoRc0603ResistorFootprintProps = {}): ReactElement {
  return resistorComponent(tenK, "BP032_YAGEO_RC0603_10K_PROJECT_REVIEW_ONLY", props)
}

export function Bp032YageoRc0603Fr07100KlFootprint(props: Bp032YageoRc0603ResistorFootprintProps = {}): ReactElement {
  return resistorComponent(oneHundredK, "BP032_YAGEO_RC0603_100K_PROJECT_REVIEW_ONLY", props)
}

export default Bp032YageoRc0603Fr0710KlFootprint
