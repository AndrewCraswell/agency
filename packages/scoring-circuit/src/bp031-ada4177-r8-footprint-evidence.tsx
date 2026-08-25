import type { ReactElement } from "react"

const packageRowPitchMm = 4.93
const packagePadPitchMm = 1.27
const projectPadLengthMm = 1.98
const projectPadWidthMm = 0.53
const projectPadRowCenterMm = packageRowPitchMm / 2
const projectPadColumnOffsetsMm = [-1.905, -0.635, 0.635, 1.905] as const
const packageBoardPlaneBodyLengthMm = { minimum: 4.8, maximum: 5.0 } as const
const packageBodyWidthMm = { minimum: 3.8, maximum: 4.0 } as const
const packageOverallLeadSpanMm = { minimum: 5.8, maximum: 6.2 } as const
const packageHeightMm = { minimum: 1.35, maximum: 1.75 } as const
const packageLeadLengthMm = { minimum: 0.4, maximum: 1.27 } as const
const packageLeadWidthMm = { minimum: 0.31, maximum: 0.51 } as const
const projectCourtyardClearanceMm = 0.25

const projectPads = [
  { pin: 1, xMm: projectPadColumnOffsetsMm[0], yMm: -projectPadRowCenterMm },
  { pin: 2, xMm: projectPadColumnOffsetsMm[1], yMm: -projectPadRowCenterMm },
  { pin: 3, xMm: projectPadColumnOffsetsMm[2], yMm: -projectPadRowCenterMm },
  { pin: 4, xMm: projectPadColumnOffsetsMm[3], yMm: -projectPadRowCenterMm },
  { pin: 5, xMm: projectPadColumnOffsetsMm[3], yMm: projectPadRowCenterMm },
  { pin: 6, xMm: projectPadColumnOffsetsMm[2], yMm: projectPadRowCenterMm },
  { pin: 7, xMm: projectPadColumnOffsetsMm[1], yMm: projectPadRowCenterMm },
  { pin: 8, xMm: projectPadColumnOffsetsMm[0], yMm: projectPadRowCenterMm }
] as const

const projectPadEnvelope = {
  minimumXMm: Math.min(...projectPads.map(({ xMm }) => xMm - projectPadWidthMm / 2)),
  maximumXMm: Math.max(...projectPads.map(({ xMm }) => xMm + projectPadWidthMm / 2)),
  minimumYMm: Math.min(...projectPads.map(({ yMm }) => yMm - projectPadLengthMm / 2)),
  maximumYMm: Math.max(...projectPads.map(({ yMm }) => yMm + projectPadLengthMm / 2))
} as const

const maximumPackageEnvelope = {
  minimumXMm: -packageBoardPlaneBodyLengthMm.maximum / 2,
  maximumXMm: packageBoardPlaneBodyLengthMm.maximum / 2,
  minimumYMm: -packageOverallLeadSpanMm.maximum / 2,
  maximumYMm: packageOverallLeadSpanMm.maximum / 2
} as const

const projectCourtyardEnvelope = {
  minimumXMm: Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) - projectCourtyardClearanceMm,
  maximumXMm: Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) + projectCourtyardClearanceMm,
  minimumYMm: Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) - projectCourtyardClearanceMm,
  maximumYMm: Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) + projectCourtyardClearanceMm,
  widthMm:
    Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) -
    Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) +
    2 * projectCourtyardClearanceMm,
  heightMm:
    Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) -
    Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) +
    2 * projectCourtyardClearanceMm
} as const

/**
 * BP-031 review-only project footprint and source ledger for ADA4177-1ARZ.
 *
 * The R-8 package dimensions and pin-one datum are manufacturer evidence. The
 * 90-0096 S8 land pattern is retained as an ADI family recommendation only;
 * its pad dimensions are used as explicitly named project review inputs, not
 * as an ADA4177-specific manufacturer-CAD release.
 */
export const bp031Ada4177R8FootprintEvidence = {
  artifactKind: "bp031-ada4177-1arz-r8-footprint-evidence",
  workUnit: "BP-031",
  manufacturer: "Analog Devices",
  manufacturerPartNumber: "ADA4177-1ARZ",
  package: {
    option: "R-8",
    designation: "8-Lead Standard Small Outline Package [SOIC_N] Narrow Body",
    boardPlaneBodyLengthMm: packageBoardPlaneBodyLengthMm,
    bodyWidthMm: packageBodyWidthMm,
    overallLeadSpanMm: packageOverallLeadSpanMm,
    packageHeightMm,
    leadPitchMm: 1.27,
    leadLengthMm: packageLeadLengthMm,
    leadWidthMm: packageLeadWidthMm,
    coplanarityMaximumMm: 0.1,
    packageStandard: "JEDEC MS-012-AA",
    drawingIdentifier: "012407-A"
  },
  maximumPackageEnvelope,
  sources: [
    {
      id: "adi-ada4177-datasheet-rev-e",
      authority: "manufacturer-primary",
      documentNumber: "ADA4177-1/ADA4177-2/ADA4177-4",
      revision: "E",
      url: "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf",
      reviewedPages: "31, 33",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-ada4177-datasheet-rev-e.pdf",
      sha256: "363C6BB4B4DB88F197F4FB3A0D286CD041FB492B9BFD1900382078B1489078CC"
    },
    {
      id: "adi-r-8-package-outline",
      authority: "manufacturer-primary",
      documentNumber: "R-8",
      revision: "not-stated",
      drawingIdentifier: "012407-A",
      url: "https://www.analog.com/media/en/package-pcb-resources/package/pkg_pdf/soic_narrow-r/r_8.pdf",
      reviewedPages: "1",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-r-8-package-outline.pdf",
      sha256: "83932339A984A08A714727BA5F7F836B6451B9194C3C8DAD160FF4408F28FCAF"
    },
    {
      id: "adi-90-0096-s8-land-pattern-rev-m",
      authority: "manufacturer-primary",
      documentNumber: "90-0096",
      revision: "M",
      url: "https://www.analog.com/media/en/package-pcb-resources/land-pattern/soicn/90-0096.pdf",
      reviewedPages: "1-3",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-90-0096-soicn-land-pattern-rev-m.pdf",
      sha256: "17E97CC5CD3B6348EB44142CDE0F65AC53414F2B963AE6ECC77E9C31D7880729"
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    note: "No ADI-native or partner CAD file is retained by this review artifact."
  },
  partnerCad: {
    sourceUrl: "https://www.analog.com/en/products/ada4177-1.html",
    providersListedByAdi: ["Ultra Librarian", "SamacSys"],
    availability: "listed-by-adi-not-retrieved",
    retainedArtifactPath: null,
    sha256: null,
    authority: "deny",
    note: "The product page exposes partner-CAD links, but no partner object was acquired or represented as manufacturer CAD."
  },
  pinOneOrientation: {
    sourceId: "adi-r-8-package-outline",
    topViewPinOneDatum: "lower-left pin-one identifier",
    topViewNumbering:
      "pins 1 through 4 run left-to-right on the lower edge; pins 5 through 8 return right-to-left on the upper edge",
    projectBoardRotationDegrees: 0,
    projectPinOnePad: { pin: 1, xMm: projectPads[0].xMm, yMm: projectPads[0].yMm },
    independentOrientationReview: "pending",
    exactMatchStatus: "review-input-only"
  },
  landPatternReconciliation: {
    sourceId: "adi-90-0096-s8-land-pattern-rev-m",
    legacyDesignation: "S8",
    r8Designation: "R-8",
    recommendationTitle: 'PACKAGE LAND PATTERN, [S8] 0.150" SOIC, 8 LEADS',
    padLengthMm: { nominal: projectPadLengthMm, tolerance: 0.02 },
    padWidthMm: { nominal: projectPadWidthMm, tolerance: 0.02 },
    rowCenterSpanMm: { nominal: packageRowPitchMm, tolerance: 0.02 },
    padPitchMm: packagePadPitchMm,
    applicability: "family-reference-only",
    exactAda4177Approval: false,
    reconciliation:
      "ADI 90-0096 uses legacy S8 nomenclature for an 8-lead 0.150-inch SOIC family pattern. ADA4177-1ARZ is explicitly R-8 in the Rev. E ordering guide and package drawing. The dimensions are retained for an R-8 review overlay, but 90-0096 is not an exact ADA4177-specific approval and does not supply manufacturer CAD, mask, paste, or courtyard data."
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-derived-from-r8-and-90-0096",
    padShape: "rectangular-smt",
    padLengthMm: projectPadLengthMm,
    padWidthMm: projectPadWidthMm,
    padRowCenterSpanMm: packageRowPitchMm,
    padPitchMm: packagePadPitchMm,
    pads: projectPads,
    solderMask: { marginMm: 0.05, status: "project-input" },
    paste: { reductionPerEdgeMm: 0.05, status: "project-input" },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      ...projectCourtyardEnvelope,
      minimumClearanceMm: projectCourtyardClearanceMm,
      sourceStatus: "not-published",
      status: "project-review-input"
    },
    orientationStatus: "pending-independent-review",
    fabricationAuthority: "deny",
    accepted: false
  }
} as const

type Envelope = {
  readonly minimumXMm: number
  readonly maximumXMm: number
  readonly minimumYMm: number
  readonly maximumYMm: number
}

function calculatePadEnvelope(
  pads: readonly { readonly xMm: number; readonly yMm: number }[],
  padWidthMm: number,
  padLengthMm: number
): Envelope {
  return {
    minimumXMm: Math.min(...pads.map(({ xMm }) => xMm - padWidthMm / 2)),
    maximumXMm: Math.max(...pads.map(({ xMm }) => xMm + padWidthMm / 2)),
    minimumYMm: Math.min(...pads.map(({ yMm }) => yMm - padLengthMm / 2)),
    maximumYMm: Math.max(...pads.map(({ yMm }) => yMm + padLengthMm / 2))
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

/** Return exact review checks; an empty result means the deny-by-default record is internally consistent. */
export function validateBp031Ada4177R8FootprintEvidence(): readonly string[] {
  const evidence = bp031Ada4177R8FootprintEvidence
  const errors: string[] = []
  const sourceIds = new Set(evidence.sources.map((source) => source.id))

  if (evidence.workUnit !== "BP-031" || evidence.manufacturerPartNumber !== "ADA4177-1ARZ") {
    errors.push("exact BP-031 MPN identity drifted")
  }
  if (evidence.package.option !== "R-8" || evidence.package.leadPitchMm !== 1.27) {
    errors.push("exact R-8 package identity or pitch drifted")
  }
  if (
    evidence.package.boardPlaneBodyLengthMm.minimum !== 4.8 ||
    evidence.package.boardPlaneBodyLengthMm.maximum !== 5.0 ||
    evidence.package.bodyWidthMm.minimum !== 3.8 ||
    evidence.package.bodyWidthMm.maximum !== 4.0 ||
    evidence.package.overallLeadSpanMm.minimum !== 5.8 ||
    evidence.package.overallLeadSpanMm.maximum !== 6.2 ||
    evidence.package.packageHeightMm.minimum !== 1.35 ||
    evidence.package.packageHeightMm.maximum !== 1.75 ||
    evidence.package.leadLengthMm.minimum !== 0.4 ||
    evidence.package.leadLengthMm.maximum !== 1.27 ||
    evidence.package.leadWidthMm.minimum !== 0.31 ||
    evidence.package.leadWidthMm.maximum !== 0.51
  ) {
    errors.push("R-8 drawing dimension semantics or limits drifted")
  }
  const expectedMaximumPackageEnvelope = {
    minimumXMm: -evidence.package.boardPlaneBodyLengthMm.maximum / 2,
    maximumXMm: evidence.package.boardPlaneBodyLengthMm.maximum / 2,
    minimumYMm: -evidence.package.overallLeadSpanMm.maximum / 2,
    maximumYMm: evidence.package.overallLeadSpanMm.maximum / 2
  }
  if (
    evidence.maximumPackageEnvelope.minimumXMm !== expectedMaximumPackageEnvelope.minimumXMm ||
    evidence.maximumPackageEnvelope.maximumXMm !== expectedMaximumPackageEnvelope.maximumXMm ||
    evidence.maximumPackageEnvelope.minimumYMm !== expectedMaximumPackageEnvelope.minimumYMm ||
    evidence.maximumPackageEnvelope.maximumYMm !== expectedMaximumPackageEnvelope.maximumYMm
  ) {
    errors.push("maximum package envelope is not derived from R-8 body length and lead span")
  }
  for (const source of evidence.sources) {
    if (!/^[0-9A-F]{64}$/u.test(source.sha256) || source.artifactPath.length === 0) {
      errors.push(`retained source hash/path is invalid for ${source.id}`)
    }
  }
  if (!sourceIds.has("adi-ada4177-datasheet-rev-e") || !sourceIds.has("adi-r-8-package-outline")) {
    errors.push("exact ADA4177 datasheet and R-8 outline are required")
  }
  if (
    evidence.landPatternReconciliation.legacyDesignation !== "S8" ||
    evidence.landPatternReconciliation.r8Designation !== "R-8" ||
    evidence.landPatternReconciliation.exactAda4177Approval
  ) {
    errors.push("S8-to-R-8 reconciliation must remain family-reference-only")
  }
  if (
    evidence.pinOneOrientation.topViewPinOneDatum !== "lower-left pin-one identifier" ||
    evidence.pinOneOrientation.projectPinOnePad.pin !== 1 ||
    evidence.pinOneOrientation.projectBoardRotationDegrees !== 0
  ) {
    errors.push("pin-one datum or project rotation drifted")
  }
  const pins = evidence.projectFootprint.pads
  if (
    pins.length !== 8 ||
    pins[0].pin !== 1 ||
    pins[0].xMm !== -1.905 ||
    pins[0].yMm !== -2.465 ||
    pins[4].pin !== 5 ||
    pins[4].xMm !== 1.905 ||
    pins[4].yMm !== 2.465
  ) {
    errors.push("project pin-one/pin-five mapping is not exact")
  }
  const courtyard = evidence.projectFootprint.courtyard
  const derivedCourtyard = calculateCourtyardEnvelope(
    calculatePadEnvelope(
      evidence.projectFootprint.pads,
      evidence.projectFootprint.padWidthMm,
      evidence.projectFootprint.padLengthMm
    ),
    evidence.maximumPackageEnvelope,
    courtyard.minimumClearanceMm
  )
  if (
    courtyard.minimumXMm !== derivedCourtyard.minimumXMm ||
    courtyard.maximumXMm !== derivedCourtyard.maximumXMm ||
    courtyard.minimumYMm !== derivedCourtyard.minimumYMm ||
    courtyard.maximumYMm !== derivedCourtyard.maximumYMm ||
    courtyard.widthMm !== derivedCourtyard.maximumXMm - derivedCourtyard.minimumXMm ||
    courtyard.heightMm !== derivedCourtyard.maximumYMm - derivedCourtyard.minimumYMm ||
    courtyard.sourceStatus !== "not-published"
  ) {
    errors.push("project courtyard is not derived from pad and package envelopes")
  }
  if (evidence.projectFootprint.accepted || evidence.projectFootprint.fabricationAuthority !== "deny") {
    errors.push("review-only footprint cannot be accepted or fabrication-authorized")
  }
  if (
    evidence.manufacturerCad.authority !== "deny" ||
    evidence.partnerCad.retainedArtifactPath !== null ||
    evidence.partnerCad.authority !== "deny"
  ) {
    errors.push("manufacturer and partner CAD must remain explicitly unacquired")
  }
  return errors
}

const projectFootprint = (
  <footprint name="BP031_ADA4177_1ARZ_R8_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={projectPads[0].xMm}
      pcbY={projectPads[0].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["1", "pin1", "lower-left"]}
    />
    <smtpad
      name="2"
      pcbX={projectPads[1].xMm}
      pcbY={projectPads[1].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["2"]}
    />
    <smtpad
      name="3"
      pcbX={projectPads[2].xMm}
      pcbY={projectPads[2].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["3"]}
    />
    <smtpad
      name="4"
      pcbX={projectPads[3].xMm}
      pcbY={projectPads[3].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["4"]}
    />
    <smtpad
      name="5"
      pcbX={projectPads[4].xMm}
      pcbY={projectPads[4].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["5"]}
    />
    <smtpad
      name="6"
      pcbX={projectPads[5].xMm}
      pcbY={projectPads[5].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["6"]}
    />
    <smtpad
      name="7"
      pcbX={projectPads[6].xMm}
      pcbY={projectPads[6].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["7"]}
    />
    <smtpad
      name="8"
      pcbX={projectPads[7].xMm}
      pcbY={projectPads[7].yMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.53mm"
      height="1.98mm"
      portHints={["8"]}
    />
    {/* This courtyard is a project review envelope, not manufacturer CAD. */}
    <courtyardrect pcbX={0} pcbY={0} width="5.5mm" height="7.41mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp031Ada4177R8ProjectFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for review; it is not imported into a board. */
export function Bp031Ada4177R8ProjectFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031Ada4177R8ProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_ADA4177_1ARZ"
      manufacturerPartNumber="ADA4177-1ARZ"
      pinLabels={{ pin1: "1", pin2: "2", pin3: "3", pin4: "4", pin5: "5", pin6: "6", pin7: "7", pin8: "8" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031Ada4177R8ProjectFootprint
