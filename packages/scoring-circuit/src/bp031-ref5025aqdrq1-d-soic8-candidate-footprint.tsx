import type { ReactElement } from "react"

const copperPadLengthMm = 1.55
const copperPadWidthMm = 0.6
const padRowCenterSpanMm = 5.4
const padPitchMm = 1.27
const solderMaskMarginMm = 0.07
const pasteReductionPerEdgeMm = 0
const courtyardClearanceMm = 0.25

const packageBodyWidthMm = { minimum: 3.81, maximum: 3.98 } as const
const packageBodyLengthMm = { minimum: 4.81, maximum: 5.0 } as const
const packageOverallLeadSpanMm = { minimum: 5.8, maximum: 6.19 } as const
const packageHeightMm = { maximum: 1.75 } as const
const leadWidthMm = { minimum: 0.31, maximum: 0.51 } as const
const leadLengthMm = { minimum: 0.41, maximum: 1.27 } as const

const columnOffsetsMm = [1.905, 0.635, -0.635, -1.905] as const
const padRowCenterMm = padRowCenterSpanMm / 2

const projectPads = [
  { pin: 1, xMm: -padRowCenterMm, yMm: columnOffsetsMm[0], function: "DNC" },
  { pin: 2, xMm: -padRowCenterMm, yMm: columnOffsetsMm[1], function: "VIN" },
  { pin: 3, xMm: -padRowCenterMm, yMm: columnOffsetsMm[2], function: "TEMP" },
  { pin: 4, xMm: -padRowCenterMm, yMm: columnOffsetsMm[3], function: "GND" },
  { pin: 5, xMm: padRowCenterMm, yMm: columnOffsetsMm[3], function: "TRIM/NR" },
  { pin: 6, xMm: padRowCenterMm, yMm: columnOffsetsMm[2], function: "VOUT" },
  { pin: 7, xMm: padRowCenterMm, yMm: columnOffsetsMm[1], function: "NC" },
  { pin: 8, xMm: padRowCenterMm, yMm: columnOffsetsMm[0], function: "DNC" }
] as const

const projectPadEnvelope = {
  minimumXMm: -padRowCenterMm - copperPadLengthMm / 2,
  maximumXMm: padRowCenterMm + copperPadLengthMm / 2,
  minimumYMm: columnOffsetsMm[3] - copperPadWidthMm / 2,
  maximumYMm: columnOffsetsMm[0] + copperPadWidthMm / 2
} as const

const maximumPackageEnvelope = {
  minimumXMm: -packageOverallLeadSpanMm.maximum / 2,
  maximumXMm: packageOverallLeadSpanMm.maximum / 2,
  minimumYMm: -packageBodyLengthMm.maximum / 2,
  maximumYMm: packageBodyLengthMm.maximum / 2
} as const

const exactAnalogReferenceMapping = [
  {
    reference: "U_REF_1",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  },
  {
    reference: "U_REF_2",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  },
  {
    reference: "U_REF_3",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  },
  {
    reference: "U_REF_4",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  },
  {
    reference: "U_REF_5",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  },
  {
    reference: "U_REF_6",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  },
  {
    reference: "U_REF_7",
    exactMpn: "REF5025AQDRQ1",
    exactPackage: "D SOIC-8",
    sharedManufacturerSourceId: "M4-04:REF5025AQDRQ1",
    disposition: "DNP-unresolved"
  }
] as const

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
 * BP-031 review-only candidate for the exact TI REF5025AQDRQ1 orderable.
 *
 * TI's D0008A drawing supplies the copper, solder-mask, paste, package and
 * pin-one inputs. The courtyard is a deterministic project review envelope;
 * TI does not publish a courtyard or an exact-MPN native CAD object here.
 */
export const bp031Ref5025Aqdrq1DSoic8CandidateFootprint = {
  artifactKind: "bp031-ref5025aqdrq1-d-soic8-candidate-footprint",
  workUnit: "BP-031",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "REF5025AQDRQ1",
  sourceBinding: {
    sourceContract: "BP-031",
    canonicalSourceReference: "U_REF",
    replicatedReferencePrefix: "U_REF_",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "REF5025AQDRQ1",
    package: "D SOIC-8",
    references: exactAnalogReferenceMapping
  },
  package: {
    family: "SOIC",
    option: "D",
    pinCount: 8,
    designation: "D0008A SOIC - 1.75 mm max height",
    drawingIdentifier: "D0008A",
    drawingDocumentRevision: "MSOI002K",
    embeddedDrawingRevision: "4214825/C 02/2019",
    bodyWidthMm: packageBodyWidthMm,
    bodyLengthMm: packageBodyLengthMm,
    overallLeadSpanMm: packageOverallLeadSpanMm,
    packageHeightMm,
    leadPitchMm: padPitchMm,
    leadWidthMm,
    leadLengthMm,
    standard: "JEDEC MS-012 variation AA"
  },
  maximumPackageEnvelope,
  sources: [
    {
      id: "ti-ref50xxa-q1-datasheet-rev-h",
      authority: "manufacturer-primary",
      documentNumber: "SBOS456H",
      revision: "H",
      url: "https://www.ti.com/lit/ds/symlink/ref5025a-q1.pdf",
      reviewedPages: "4, 18-26",
      role: "Exact REF5025AQDRQ1 orderable/package identity and D-package top-view pin map.",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-ref50xxa-q1-ref5025aqdrq1-datasheet-rev-h.pdf",
      sha256: "908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B"
    },
    {
      id: "ti-d0008a-soic8-package-outline-rev-k",
      authority: "manufacturer-primary",
      documentNumber: "MSOI002K",
      revision: "K",
      drawingIdentifier: "D0008A",
      url: "https://www.ti.com/lit/pdf/MSOI002K",
      reviewedPages: "1-3",
      role: "D0008A package dimensions, exposed-metal land, NSMD mask, and stencil examples.",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-d0008a-soic8-package-outline-rev-k.pdf",
      sha256: "E064777954A2161CFB76C801A7F699EEC23A9FB4434ACF27A9DC37E57FF39655"
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    officialProvider: "TI packaging page links Ultra Librarian",
    availability: "listed-by-ti-not-retrieved",
    retainedArtifactPath: null,
    sha256: null,
    disposition: "not-acquired-no-substitute",
    note: "No TI-native or partner CAD object is retained. The review geometry is derived only from the retained TI drawings."
  },
  pinOneOrientation: {
    sourceIds: ["ti-ref50xxa-q1-datasheet-rev-h", "ti-d0008a-soic8-package-outline-rev-k"],
    sourceTopViewPinOneDatum: "pin 1 identifier at upper-left in TI top view",
    topViewNumbering:
      "pins 1 through 4 run top-to-bottom on the left edge; pins 5 through 8 run bottom-to-top on the right edge",
    projectBoardRotationDegrees: 0,
    projectPinOnePad: { pin: 1, xMm: projectPads[0].xMm, yMm: projectPads[0].yMm },
    independentOrientationReview: "pending",
    exactMatchStatus: "review-input-only"
  },
  datasheetPinMap: projectPads,
  landPattern: {
    sourceId: "ti-d0008a-soic8-package-outline-rev-k",
    method: "TI D0008A example board layout",
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
      openingLengthMm: copperPadLengthMm + 2 * solderMaskMarginMm,
      openingWidthMm: copperPadWidthMm + 2 * solderMaskMarginMm,
      sourceRange: "0.07 mm maximum all around for NSMD example",
      status: "manufacturer-drawing-example"
    },
    paste: {
      stencilThicknessMm: 0.125,
      openingLengthMm: copperPadLengthMm,
      openingWidthMm: copperPadWidthMm,
      reductionPerEdgeMm: pasteReductionPerEdgeMm,
      sourceRange: "same 1.55 mm by 0.60 mm example aperture",
      status: "manufacturer-drawing-example"
    }
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "derived-from-ti-d0008a-drawing-example",
    pads: projectPads,
    solderMask: {
      selectedDefinition: "non-solder-mask-defined",
      marginMm: solderMaskMarginMm,
      openingLengthMm: copperPadLengthMm + 2 * solderMaskMarginMm,
      openingWidthMm: copperPadWidthMm + 2 * solderMaskMarginMm,
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
    boardIntegrationAuthority: "deny",
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "BEB1A3CA6092E5488ACB6C0485D5002ED78A666DB043CC5AC7A83B4A7113C375",
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

function isDigest(value: string): boolean {
  return /^[0-9A-F]{64}$/u.test(value)
}

function sameDataValue(left: unknown, right: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const prior = seen.get(left)
  if (prior !== undefined) return prior === right
  seen.set(left, right)
  const leftKeys = Reflect.ownKeys(left)
  const rightKeys = Reflect.ownKeys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return rightKeys.every((key) => {
    if (!leftKeys.some((candidate) => Object.is(candidate, key))) return false
    const leftDescriptor = Object.getOwnPropertyDescriptor(left, key)
    const rightDescriptor = Object.getOwnPropertyDescriptor(right, key)
    return (
      leftDescriptor !== undefined &&
      rightDescriptor !== undefined &&
      "value" in leftDescriptor &&
      "value" in rightDescriptor &&
      leftDescriptor.enumerable === rightDescriptor.enumerable &&
      sameDataValue(leftDescriptor.value, rightDescriptor.value, seen)
    )
  })
}

function calculatePadEnvelope(candidate: typeof bp031Ref5025Aqdrq1DSoic8CandidateFootprint): Envelope {
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
export function validateBp031Ref5025Aqdrq1DSoic8CandidateFootprint(
  candidate: typeof bp031Ref5025Aqdrq1DSoic8CandidateFootprint = bp031Ref5025Aqdrq1DSoic8CandidateFootprint
): readonly string[] {
  const errors: string[] = []
  if (
    candidate.artifactKind !== "bp031-ref5025aqdrq1-d-soic8-candidate-footprint" ||
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== "Texas Instruments" ||
    candidate.manufacturerPartNumber !== "REF5025AQDRQ1"
  ) {
    errors.push("exact BP-031 TI REF5025AQDRQ1 identity drifted")
  }
  if (
    JSON.stringify(candidate.sourceBinding) !== JSON.stringify(bp031Ref5025Aqdrq1DSoic8CandidateFootprint.sourceBinding)
  ) {
    errors.push("exact seven-reference BP-031 source mapping drifted")
  }
  if (
    candidate.package.family !== "SOIC" ||
    candidate.package.option !== "D" ||
    candidate.package.pinCount !== 8 ||
    candidate.package.drawingIdentifier !== "D0008A"
  ) {
    errors.push("exact TI D SOIC-8 package identity drifted")
  }
  if (
    candidate.package.bodyWidthMm.minimum !== 3.81 ||
    candidate.package.bodyWidthMm.maximum !== 3.98 ||
    candidate.package.bodyLengthMm.minimum !== 4.81 ||
    candidate.package.bodyLengthMm.maximum !== 5.0 ||
    candidate.package.overallLeadSpanMm.minimum !== 5.8 ||
    candidate.package.overallLeadSpanMm.maximum !== 6.19 ||
    candidate.package.packageHeightMm.maximum !== 1.75 ||
    candidate.package.leadPitchMm !== 1.27 ||
    candidate.package.leadWidthMm.minimum !== 0.31 ||
    candidate.package.leadWidthMm.maximum !== 0.51 ||
    candidate.package.leadLengthMm.minimum !== 0.41 ||
    candidate.package.leadLengthMm.maximum !== 1.27
  ) {
    errors.push("TI D0008A package dimensions drifted")
  }
  const requiredSourceIds = ["ti-ref50xxa-q1-datasheet-rev-h", "ti-d0008a-soic8-package-outline-rev-k"] as const
  if (
    candidate.sources.length !== requiredSourceIds.length ||
    requiredSourceIds.some((id) => !candidate.sources.some((source) => source.id === id))
  ) {
    errors.push("exact retained TI sources are required")
  }
  for (const source of candidate.sources) {
    if (!/^[0-9A-F]{64}$/u.test(source.sha256) || source.artifactPath.length === 0) {
      errors.push(`retained TI source hash/path is invalid for ${source.id}`)
    }
  }
  if (JSON.stringify(candidate.sources) !== JSON.stringify(bp031Ref5025Aqdrq1DSoic8CandidateFootprint.sources)) {
    errors.push("retained TI source identity, revision, page scope, or hash drifted")
  }
  if (
    candidate.pinOneOrientation.sourceIds.length !== 2 ||
    candidate.pinOneOrientation.sourceIds[0] !== "ti-ref50xxa-q1-datasheet-rev-h" ||
    candidate.pinOneOrientation.sourceIds[1] !== "ti-d0008a-soic8-package-outline-rev-k" ||
    candidate.pinOneOrientation.sourceTopViewPinOneDatum !== "pin 1 identifier at upper-left in TI top view" ||
    candidate.pinOneOrientation.topViewNumbering !==
      "pins 1 through 4 run top-to-bottom on the left edge; pins 5 through 8 run bottom-to-top on the right edge" ||
    candidate.pinOneOrientation.independentOrientationReview !== "pending" ||
    candidate.pinOneOrientation.exactMatchStatus !== "review-input-only" ||
    candidate.pinOneOrientation.projectPinOnePad.pin !== 1 ||
    candidate.pinOneOrientation.projectPinOnePad.xMm !== -padRowCenterMm ||
    candidate.pinOneOrientation.projectPinOnePad.yMm !== columnOffsetsMm[0] ||
    candidate.pinOneOrientation.projectBoardRotationDegrees !== 0
  ) {
    errors.push("TI pin-one datum or project rotation drifted")
  }
  const expectedPins = projectPads.map(({ pin, xMm, yMm, function: pinFunction }) => ({
    pin,
    xMm,
    yMm,
    function: pinFunction
  }))
  if (JSON.stringify(candidate.projectFootprint.pads) !== JSON.stringify(expectedPins)) {
    errors.push("project pads do not preserve TI top-view pin mapping")
  }
  if (
    candidate.landPattern.copper.padLengthMm !== copperPadLengthMm ||
    candidate.landPattern.copper.padWidthMm !== copperPadWidthMm ||
    candidate.landPattern.copper.rowCenterSpanMm !== padRowCenterSpanMm ||
    candidate.landPattern.copper.padPitchMm !== padPitchMm ||
    candidate.landPattern.solderMask.marginMm !== solderMaskMarginMm ||
    candidate.landPattern.solderMask.openingLengthMm !== copperPadLengthMm + 2 * solderMaskMarginMm ||
    candidate.landPattern.solderMask.openingWidthMm !== copperPadWidthMm + 2 * solderMaskMarginMm ||
    candidate.landPattern.paste.openingLengthMm !== copperPadLengthMm ||
    candidate.landPattern.paste.openingWidthMm !== copperPadWidthMm ||
    candidate.landPattern.paste.reductionPerEdgeMm !== pasteReductionPerEdgeMm
  ) {
    errors.push("TI D0008A copper, mask, or paste dimensions drifted")
  }
  const derivedCourtyard = calculateCourtyardEnvelope(
    calculatePadEnvelope(candidate),
    candidate.maximumPackageEnvelope,
    candidate.projectFootprint.courtyard.minimumClearanceMm
  )
  if (
    candidate.maximumPackageEnvelope.minimumXMm !== -packageOverallLeadSpanMm.maximum / 2 ||
    candidate.maximumPackageEnvelope.maximumXMm !== packageOverallLeadSpanMm.maximum / 2 ||
    candidate.maximumPackageEnvelope.minimumYMm !== -packageBodyLengthMm.maximum / 2 ||
    candidate.maximumPackageEnvelope.maximumYMm !== packageBodyLengthMm.maximum / 2
  ) {
    errors.push("maximum package envelope is not derived from TI D0008A limits")
  }
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
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.availability !== "listed-by-ti-not-retrieved" ||
    candidate.manufacturerCad.disposition !== "not-acquired-no-substitute" ||
    candidate.manufacturerCad.retainedArtifactPath !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.projectFootprint.solderMask.marginMm !== solderMaskMarginMm ||
    candidate.projectFootprint.solderMask.openingLengthMm !== copperPadLengthMm + 2 * solderMaskMarginMm ||
    candidate.projectFootprint.solderMask.openingWidthMm !== copperPadWidthMm + 2 * solderMaskMarginMm ||
    candidate.projectFootprint.paste.openingLengthMm !== copperPadLengthMm ||
    candidate.projectFootprint.paste.openingWidthMm !== copperPadWidthMm ||
    candidate.projectFootprint.paste.reductionPerEdgeMm !== pasteReductionPerEdgeMm ||
    candidate.projectFootprint.state !== "review-only" ||
    candidate.projectFootprint.geometryAuthority !== "derived-from-ti-d0008a-drawing-example" ||
    candidate.projectFootprint.orientationStatus !== "pending-independent-review" ||
    candidate.projectFootprint.boardIntegrationAuthority !== "deny" ||
    candidate.projectFootprint.releaseState !== "deny" ||
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("CAD uncertainty and fabrication denial must remain fail-closed")
  }
  if (
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
    candidate.artwork.generator !== "tscircuit" ||
    candidate.artwork.generatorVersion !== "0.0.2271" ||
    candidate.artwork.sha256 !== "BEB1A3CA6092E5488ACB6C0485D5002ED78A666DB043CC5AC7A83B4A7113C375" ||
    !isDigest(candidate.artwork.sha256) ||
    candidate.artwork.authority !== "deny"
  ) {
    errors.push("rendered artwork hash or authority drifted")
  }
  if (errors.length === 0 && !sameDataValue(candidate, bp031Ref5025Aqdrq1DSoic8CandidateFootprint)) {
    errors.push("unreviewed REF5025 evidence property or object shape drifted")
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
      width="1.55mm"
      height="0.6mm"
      portHints={pad.pin === 1 ? [String(pad.pin), pad.function, "pin1-upper-left"] : [String(pad.pin), pad.function]}
    />
  )
}

const projectFootprint = (
  <footprint name="BP031_REF5025AQDRQ1_D_SOIC8_CANDIDATE" originalLayer="top">
    {projectSmtPad(projectPads[0])}
    {projectSmtPad(projectPads[1])}
    {projectSmtPad(projectPads[2])}
    {projectSmtPad(projectPads[3])}
    {projectSmtPad(projectPads[4])}
    {projectSmtPad(projectPads[5])}
    {projectSmtPad(projectPads[6])}
    {projectSmtPad(projectPads[7])}
    {/* TI does not publish a courtyard; this is a derived project review envelope. */}
    <courtyardrect pcbX={0} pcbY={0} width="7.45mm" height="5.5mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp031Ref5025Aqdrq1DSoic8CandidateFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit candidate for review; it is not imported into a board. */
export function Bp031Ref5025Aqdrq1DSoic8CandidateFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031Ref5025Aqdrq1DSoic8CandidateFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_REF5025AQDRQ1"
      manufacturerPartNumber="REF5025AQDRQ1"
      pinLabels={{ pin1: "1", pin2: "2", pin3: "3", pin4: "4", pin5: "5", pin6: "6", pin7: "7", pin8: "8" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031Ref5025Aqdrq1DSoic8CandidateFootprint
