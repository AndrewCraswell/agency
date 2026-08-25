import { Fragment, type ReactElement } from "react"

const packageBodyLengthMm = { minimum: 4.75, maximum: 5.05 } as const
const packageBodyWidthMm = { minimum: 2.9, maximum: 3.1 } as const
const packageHeightMaximumMm = 1.1
const packageLeadPitchMm = 0.5
const manufacturerPadLengthMm = 1.45
const manufacturerPadWidthMm = 0.3
const manufacturerRowCenterSpanMm = 4.4
const manufacturerPadCornerRadiusMm = 0.05
const projectSolderMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0
const projectCourtyardClearanceMm = 0.25
const projectPadRowCenterMm = manufacturerRowCenterSpanMm / 2
const projectPadColumnOffsetsMm = [-1, -0.5, 0, 0.5, 1] as const

const projectPads = [
  { pin: 1, xMm: -projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[0] },
  { pin: 2, xMm: -projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[1] },
  { pin: 3, xMm: -projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[2] },
  { pin: 4, xMm: -projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[3] },
  { pin: 5, xMm: -projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[4] },
  { pin: 6, xMm: projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[4] },
  { pin: 7, xMm: projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[3] },
  { pin: 8, xMm: projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[2] },
  { pin: 9, xMm: projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[1] },
  { pin: 10, xMm: projectPadRowCenterMm, yMm: projectPadColumnOffsetsMm[0] }
] as const

type Envelope = {
  readonly minimumXMm: number
  readonly maximumXMm: number
  readonly minimumYMm: number
  readonly maximumYMm: number
}

function calculatePadEnvelope(): Envelope {
  return {
    minimumXMm: Math.min(...projectPads.map(({ xMm }) => xMm - manufacturerPadLengthMm / 2)),
    maximumXMm: Math.max(...projectPads.map(({ xMm }) => xMm + manufacturerPadLengthMm / 2)),
    minimumYMm: Math.min(...projectPads.map(({ yMm }) => yMm - manufacturerPadWidthMm / 2)),
    maximumYMm: Math.max(...projectPads.map(({ yMm }) => yMm + manufacturerPadWidthMm / 2))
  }
}

function roundMillimetres(value: number): number {
  return Math.round(value * 100_000) / 100_000
}

const maximumPackageEnvelope = {
  minimumXMm: -packageBodyLengthMm.maximum / 2,
  maximumXMm: packageBodyLengthMm.maximum / 2,
  minimumYMm: -packageBodyWidthMm.maximum / 2,
  maximumYMm: packageBodyWidthMm.maximum / 2
} as const

const projectPadEnvelope = calculatePadEnvelope()
const projectCourtyardEnvelope = {
  minimumXMm: roundMillimetres(
    Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) - projectCourtyardClearanceMm
  ),
  maximumXMm: roundMillimetres(
    Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) + projectCourtyardClearanceMm
  ),
  minimumYMm: roundMillimetres(
    Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) - projectCourtyardClearanceMm
  ),
  maximumYMm: roundMillimetres(
    Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) + projectCourtyardClearanceMm
  ),
  widthMm: roundMillimetres(
    Math.max(projectPadEnvelope.maximumXMm, maximumPackageEnvelope.maximumXMm) -
      Math.min(projectPadEnvelope.minimumXMm, maximumPackageEnvelope.minimumXMm) +
      2 * projectCourtyardClearanceMm
  ),
  heightMm: roundMillimetres(
    Math.max(projectPadEnvelope.maximumYMm, maximumPackageEnvelope.maximumYMm) -
      Math.min(projectPadEnvelope.minimumYMm, maximumPackageEnvelope.minimumYMm) +
      2 * projectCourtyardClearanceMm
  )
} as const

/**
 * BP-031 review-only project footprint for the exact Texas Instruments
 * ADS8881IDGS (DGS VSSOP-10) orderable.
 *
 * Copper, mask, paste, and pin-one coordinates are transcribed from TI's
 * DGS0010A drawing and example board/stencil layouts. The courtyard is a
 * project review envelope because TI does not publish a courtyard. No CAD
 * export is retained, so this candidate is permanently denied for fabrication.
 */
export const bp031Ads8881IdgsDgsFootprintCandidate = {
  artifactKind: "bp031-ads8881idgs-dgs-footprint-candidate",
  workUnit: "BP-031",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "ADS8881IDGS",
  package: {
    option: "DGS",
    designation: "VSSOP-10",
    bodyLengthMm: packageBodyLengthMm,
    bodyWidthMm: packageBodyWidthMm,
    packageHeightMaximumMm,
    leadPitchMm: packageLeadPitchMm,
    manufacturerRowCenterSpanMm,
    manufacturerPadLengthMm,
    manufacturerPadWidthMm,
    manufacturerPadCornerRadiusMm,
    drawingIdentifier: "DGS0010A",
    drawingRevision: "4221984/A 05/2015"
  },
  sourceBinding: {
    sourceContract: "BP-101",
    canonicalSourcePath: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
    canonicalSourceReference: "U_SAR",
    replicatedReferencePrefix: "U_SAR_",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "ADS8881IDGS",
    package: "DGS VSSOP-10"
  },
  sourceControl: {
    basisRef: "refs/heads/main",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
        sha256: "1F888DD5AA328FAD823738F09A48502EF50189775D5E1920A09413A32C14360D"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
        sha256: "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144"
      }
    ]
  },
  maximumPackageEnvelope,
  sources: [
    {
      id: "ti-ads8881-sbas547d-rev-d-dgs0010a",
      authority: "manufacturer-primary",
      documentNumber: "SBAS547D",
      revision: "D",
      drawingIdentifier: "DGS0010A / 4221984/A",
      url: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
      reviewedPages: "6-7, 50, 55-57",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf",
      sha256: "EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8",
      scope:
        "Page 50 binds the exact ADS8881IDGS orderable to VSSOP (DGS) with 10 pins; pages 6-7 provide the DGS pin map, and pages 55-57 provide DGS0010A mechanical, board-layout, and stencil geometry."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    note: "TI's ADS8881 product page links DGS VSSOP-10 CAD through Ultra Librarian; no TI-native or authorized CAD export is retained in this artifact."
  },
  partnerCad: {
    provider: "Ultra Librarian",
    sourceUrl: "https://vendor.ultralibrarian.com/TI/embedded/?gpn=ADS8881&package=DGS&pin=10",
    availability: "listed-by-ti-not-retrieved",
    retainedArtifactPath: null,
    sha256: null,
    authority: "deny",
    note: "The partner preview is discoverable, but the CAD object was not acquired or represented as manufacturer evidence."
  },
  pinOneOrientation: {
    sourceId: "ti-ads8881-sbas547d-rev-d-dgs0010a",
    topViewPinOneDatum: "top-left pin-one identifier area",
    topViewNumbering:
      "pins 1 through 5 run top-to-bottom on the left edge; pins 6 through 10 return bottom-to-top on the right edge",
    projectBoardRotationDegrees: 0,
    projectPinOnePad: { pin: 1, xMm: projectPads[0].xMm, yMm: projectPads[0].yMm },
    independentOrientationReview: "not-completed",
    exactMatchStatus: "manufacturer-drawing-derived"
  },
  manufacturerLandPattern: {
    sourceId: "ti-ads8881-sbas547d-rev-d-dgs0010a",
    copperPadLengthMm: manufacturerPadLengthMm,
    copperPadWidthMm: manufacturerPadWidthMm,
    padPitchMm: packageLeadPitchMm,
    rowCenterSpanMm: manufacturerRowCenterSpanMm,
    solderMask: {
      selectedDefinition: "non-solder-mask-defined",
      marginPerEdgeMm: projectSolderMaskMarginMm,
      manufacturerGuidance: "0.05 mm maximum all around"
    },
    paste: {
      selectedReductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      manufacturerGuidance: "10 x (1.45 mm) by 10 x (0.3 mm) example stencil apertures"
    }
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "manufacturer-drawing-and-layout-derived-project-review-input",
    padShape: "rectangular-smt-approximation-of-r0.05-typical-corners",
    padLengthMm: manufacturerPadLengthMm,
    padWidthMm: manufacturerPadWidthMm,
    padRowCenterSpanMm: manufacturerRowCenterSpanMm,
    padPitchMm: packageLeadPitchMm,
    pads: projectPads,
    solderMask: { marginMm: projectSolderMaskMarginMm, status: "manufacturer-guidance-selected" },
    paste: { reductionPerEdgeMm: projectPasteReductionPerEdgeMm, status: "manufacturer-stencil-dimension-selected" },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      ...projectCourtyardEnvelope,
      minimumClearanceMm: projectCourtyardClearanceMm,
      sourceStatus: "not-published",
      status: "project-review-input"
    },
    orientationStatus: "manufacturer-drawing-derived-awaiting-independent-review",
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "7A3D47D9C7F6B7F8BC1C67CB6329B579B21C9353581F510A18888B6A87D19783",
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

function isDigest(value: string): boolean {
  return /^[0-9A-F]{64}$/u.test(value)
}

type SourceControl = {
  readonly basisRef: string
  readonly upstreamSources: readonly { readonly path: string; readonly sha256: string }[]
}

/** Validate the exact source snapshot that supplied the BP-101 identity. */
export function validateBp031Ads8881IdgsDgsSourceControl(sourceControl: SourceControl): readonly string[] {
  const expectedHashes: Readonly<Record<string, string>> = {
    "packages/scoring-circuit/src/bench-prototype-analog-topology.ts":
      "1F888DD5AA328FAD823738F09A48502EF50189775D5E1920A09413A32C14360D",
    "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts":
      "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144"
  }
  const errors: string[] = []
  if (sourceControl.basisRef !== "refs/heads/main") errors.push("source basis ref drifted")
  if (sourceControl.upstreamSources.length !== Object.keys(expectedHashes).length) {
    errors.push("source control file count drifted")
  }
  for (const source of sourceControl.upstreamSources) {
    const expectedHash = expectedHashes[source.path]
    if (expectedHash === undefined || source.sha256 !== expectedHash) {
      errors.push(`source control hash drifted for ${source.path}`)
    }
  }
  return errors
}

/** Return exact review checks; an empty result means the deny-by-default record is internally consistent. */
export function validateBp031Ads8881IdgsDgsFootprintCandidate(
  candidate: typeof bp031Ads8881IdgsDgsFootprintCandidate = bp031Ads8881IdgsDgsFootprintCandidate
): readonly string[] {
  const errors: string[] = []
  const sourceIds = new Set(candidate.sources.map((source) => source.id))
  const exactSource = candidate.sources.find((source) => source.id === "ti-ads8881-sbas547d-rev-d-dgs0010a")

  if (
    candidate.workUnit !== "BP-031" ||
    candidate.manufacturer !== "Texas Instruments" ||
    candidate.manufacturerPartNumber !== "ADS8881IDGS" ||
    candidate.package.option !== "DGS" ||
    candidate.package.designation !== "VSSOP-10"
  ) {
    errors.push("exact BP-031 MPN or DGS package identity drifted")
  }
  if (
    candidate.package.bodyLengthMm.minimum !== 4.75 ||
    candidate.package.bodyLengthMm.maximum !== 5.05 ||
    candidate.package.bodyWidthMm.minimum !== 2.9 ||
    candidate.package.bodyWidthMm.maximum !== 3.1 ||
    candidate.package.packageHeightMaximumMm !== 1.1 ||
    candidate.package.leadPitchMm !== 0.5 ||
    candidate.package.manufacturerRowCenterSpanMm !== 4.4 ||
    candidate.package.manufacturerPadLengthMm !== 1.45 ||
    candidate.package.manufacturerPadWidthMm !== 0.3 ||
    candidate.package.manufacturerPadCornerRadiusMm !== 0.05 ||
    candidate.package.drawingIdentifier !== "DGS0010A" ||
    candidate.package.drawingRevision !== "4221984/A 05/2015"
  ) {
    errors.push("DGS0010A package or manufacturer land-pattern dimensions drifted")
  }
  if (
    candidate.sourceBinding.canonicalSourceReference !== "U_SAR" ||
    candidate.sourceBinding.manufacturerPartNumber !== "ADS8881IDGS" ||
    candidate.sourceBinding.package !== "DGS VSSOP-10" ||
    candidate.sourceControl.basisRef !== "refs/heads/main"
  ) {
    errors.push("exact source binding drifted")
  }
  errors.push(...validateBp031Ads8881IdgsDgsSourceControl(candidate.sourceControl))
  for (const source of candidate.sourceControl.upstreamSources) {
    if (!isDigest(source.sha256)) errors.push(`upstream source hash is invalid for ${source.path}`)
  }
  for (const source of candidate.sources) {
    if (!isDigest(source.sha256) || source.artifactPath.length === 0) {
      errors.push(`retained manufacturer source hash/path is invalid for ${source.id}`)
    }
  }
  if (!sourceIds.has("ti-ads8881-sbas547d-rev-d-dgs0010a")) {
    errors.push("exact TI ADS8881 DGS source is required")
  }
  if (exactSource?.reviewedPages !== "6-7, 50, 55-57") {
    errors.push("exact TI ADS8881 reviewed page scope drifted")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.partnerCad.retainedArtifactPath !== null ||
    candidate.partnerCad.sha256 !== null ||
    candidate.partnerCad.authority !== "deny"
  ) {
    errors.push("manufacturer and partner CAD must remain explicitly unacquired")
  }
  if (
    candidate.pinOneOrientation.topViewPinOneDatum !== "top-left pin-one identifier area" ||
    candidate.pinOneOrientation.projectPinOnePad.pin !== 1 ||
    candidate.pinOneOrientation.projectPinOnePad.xMm !== -2.2 ||
    candidate.pinOneOrientation.projectPinOnePad.yMm !== -1 ||
    candidate.pinOneOrientation.projectBoardRotationDegrees !== 0
  ) {
    errors.push("DGS pin-one datum or project rotation drifted")
  }
  const expectedPins = [
    [1, -2.2, -1],
    [2, -2.2, -0.5],
    [3, -2.2, 0],
    [4, -2.2, 0.5],
    [5, -2.2, 1],
    [6, 2.2, 1],
    [7, 2.2, 0.5],
    [8, 2.2, 0],
    [9, 2.2, -0.5],
    [10, 2.2, -1]
  ] as const
  if (
    candidate.projectFootprint.pads.length !== expectedPins.length ||
    candidate.projectFootprint.pads.some(
      (pad, index) =>
        pad.pin !== expectedPins[index][0] || pad.xMm !== expectedPins[index][1] || pad.yMm !== expectedPins[index][2]
    )
  ) {
    errors.push("DGS pin map or rendered pad coordinates are not exact")
  }
  const courtyard = candidate.projectFootprint.courtyard
  if (
    courtyard.minimumXMm !== -3.175 ||
    courtyard.maximumXMm !== 3.175 ||
    courtyard.minimumYMm !== -1.8 ||
    courtyard.maximumYMm !== 1.8 ||
    courtyard.widthMm !== 6.35 ||
    courtyard.heightMm !== 3.6 ||
    courtyard.sourceStatus !== "not-published"
  ) {
    errors.push("project courtyard is not derived from DGS body and pad envelopes")
  }
  if (
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("review-only footprint cannot be accepted or fabrication-authorized")
  }
  if (!isDigest(candidate.artwork.sha256)) errors.push("rendered artwork hash is invalid")
  return errors
}

const projectFootprint = (
  <footprint name="BP031_ADS8881IDGS_DGS_PROJECT_FOOTPRINT" originalLayer="top">
    {projectPads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={`${pad.pin}`}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
          solderPasteMargin={`${projectPasteReductionPerEdgeMm}mm`}
          width={`${manufacturerPadLengthMm}mm`}
          height={`${manufacturerPadWidthMm}mm`}
          portHints={[`${pad.pin}`, pad.pin === 1 ? "pin1" : `pin${pad.pin}`]}
        />
      </Fragment>
    ))}
    {/* TI does not publish a courtyard; this rectangle is a derived review envelope only. */}
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardEnvelope.widthMm}mm`}
      height={`${projectCourtyardEnvelope.heightMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031Ads8881IdgsDgsFootprintCandidateProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for review; it is not imported into a board. */
export function Bp031Ads8881IdgsDgsFootprintCandidate({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031Ads8881IdgsDgsFootprintCandidateProps = {}): ReactElement {
  return (
    <chip
      name="U_BP031_ADS8881IDGS"
      manufacturerPartNumber="ADS8881IDGS"
      pinLabels={{
        pin1: "1",
        pin2: "2",
        pin3: "3",
        pin4: "4",
        pin5: "5",
        pin6: "6",
        pin7: "7",
        pin8: "8",
        pin9: "9",
        pin10: "10"
      }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031Ads8881IdgsDgsFootprintCandidate
