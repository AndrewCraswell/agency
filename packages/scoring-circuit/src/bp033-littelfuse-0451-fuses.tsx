import type { ReactElement } from "react"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 Littelfuse evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 Littelfuse evidence may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const manufacturer = "Littelfuse"
const series = "451"
const sourceArtifactPath = "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf"
const sourceSha256 = "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2"
const sourceUrl =
  "https://www.littelfuse.com/assetdocs/fuse-451-and-453-datasheet?assetguid=533cd5cc-956c-4243-867f-6ab5a62f6ba1"

const padLengthMm = 1.96
const padWidthMm = 3.15
const padGapMm = 2.95
const padCenterSpacingMm = padLengthMm + padGapMm
const padCenterMm = padCenterSpacingMm / 2
const publishedOuterSpanMm = 6.86
const derivedOuterCopperSpanMm = padCenterSpacingMm + padLengthMm
const packageBodyLengthMm = 6.1
const packageBodyWidthMm = 2.69
const packageBodyHeightMm = 2.69
const packageDesignation = "Littelfuse NANO2 451 series, ceramic square surface-mount fuse with two end caps"
const projectFootprintId = "littelfuse-451-common-recommended-pad-layout-review-only"
const commonPackageDifferenceStatement =
  "Published electrical characteristics vary by ampere rating; no package or copper-land difference is published for these three exact 451 MRL orderables"
const polarityBasis =
  "design inference: the retained manufacturer drawing shows two end caps with no polarity or pin-one marking; Littelfuse does not state polarity on the reviewed pages"
const artworkSha256 = "B127B7445657B735B30DF96B333D8B6EDD9C7154634DF032AFCC97C78E0EE2C0"

const exactFuses = deepFreeze([
  {
    reference: "F_APPLICATION",
    manufacturerPartNumber: "0451002.MRL",
    nominalCurrentA: 2,
    ampCode: "002.",
    maxVoltageV: 125,
    interruptingRating: "50A @125VAC/VDC; 10,000A @75VDC; 300A @32VDC; PSE: 100A @100VAC",
    nominalColdResistanceOhms: 0.0367,
    nominalMeltingI2tA2sec: 0.53
  },
  {
    reference: "F_DISPLAY",
    manufacturerPartNumber: "045106.3MRL",
    nominalCurrentA: 6.3,
    ampCode: "06.3",
    maxVoltageV: 125,
    interruptingRating: "50A @125VAC/VDC; 400A @32VDC; PSE: 100A @100VAC",
    nominalColdResistanceOhms: 0.0096,
    nominalMeltingI2tA2sec: 9.17
  },
  {
    reference: "F_SCORING",
    manufacturerPartNumber: "0451.500MRL",
    nominalCurrentA: 0.5,
    ampCode: ".500",
    maxVoltageV: 125,
    interruptingRating: "50A @125VAC/VDC; 300A @32VDC; PSE: 100A @100VAC",
    nominalColdResistanceOhms: 0.3046,
    nominalMeltingI2tA2sec: 0.0824
  }
] as const)

const sourceDefinitions = [
  {
    id: "bp033-littelfuse-451-453-datasheet-2025-12-01",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer,
    series,
    url: sourceUrl,
    artifactPath: sourceArtifactPath,
    sha256: sourceSha256,
    revised: "GD. 12/01/25",
    retainedPdfPageCount: 4,
    reviewedPages: [2, 4],
    pageBindings: {
      orderables: "page 2 electrical specifications by item",
      packageAndLandPattern: "page 4 product characteristics, dimensions, and recommended pad layout"
    },
    scope:
      "One retained manufacturer datasheet covers the exact 451-series MRL orderables. Page 2 preserves rating-dependent electrical characteristics; page 4 publishes the common two-end-cap package envelope and copper recommended pad layout, but not solder-mask, paste, courtyard, board-fit, or CAD data."
  }
] as const

const padDefinitions = [
  {
    pad: "1",
    terminal: "end-cap-A",
    xMm: -padCenterMm,
    yMm: 0,
    widthMm: padLengthMm,
    heightMm: padWidthMm,
    polarity: "none"
  },
  {
    pad: "2",
    terminal: "end-cap-B",
    xMm: padCenterMm,
    yMm: 0,
    widthMm: padLengthMm,
    heightMm: padWidthMm,
    polarity: "none"
  }
] as const

function createEvidence() {
  const evidenceFuses = exactFuses.map((fuse) => ({ ...fuse }))
  const evidenceSources = sourceDefinitions.map((source) => ({
    ...source,
    pageBindings: { ...source.pageBindings }
  }))
  const evidencePads = padDefinitions.map((pad) => ({ ...pad }))
  const projectFootprint = {
    state: "review-only",
    geometryAuthority: "manufacturer-recommended-pad-layout-transcription",
    footprintId: projectFootprintId,
    padShape: "rectangular-smt",
    pads: evidencePads,
    dimensions: {
      padLengthMm,
      padWidthMm,
      padGapMm,
      padCenterSpacingMm,
      publishedSourceOuterSpanMm: publishedOuterSpanMm,
      outerCopperSpanMm: derivedOuterCopperSpanMm
    },
    solderMask: {
      status: "not-published",
      opening: null
    },
    paste: {
      status: "not-published",
      opening: null
    },
    courtyard: {
      status: "not-published",
      dimensionsMm: null
    },
    orientation: {
      datum: "top view, fuse long axis on local X; pad 1 at negative local X",
      boardRotationDegrees: 0,
      pinOne: "not-applicable",
      polarity: "non-polar",
      polarityBasis,
      reversal: "180-degree electrically equivalent",
      marking: "product marking is on the top face; marking readability and assembly orientation remain unreviewed"
    },
    accepted: false,
    fabricationAuthority: "deny"
  } as const

  return {
    artifactKind: "bp033-littelfuse-0451-fuses-footprint-evidence",
    workUnit: "BP-033",
    scope: "bounded-review-only-footprint-evidence",
    manufacturer,
    series,
    commonPackageCoverage: {
      disposition: "single-exact-451-package-and-land-pattern-covers-all-three",
      exactOrderableCount: exactFuses.length,
      packageDesignation,
      packageIdentityRule: "all three orderables retain series 451, MRL packaging, and the page-4 package/pad drawing",
      differences: commonPackageDifferenceStatement
    },
    exactFuses: evidenceFuses,
    sources: evidenceSources,
    sourceBinding: {
      sourceIdentityRule: "each canonical reference binds the exact MPN and the same retained manufacturer PDF bytes",
      genericFamilySubstitution: "denied",
      exactSourceArtifactPath: sourceArtifactPath,
      exactSourceSha256: sourceSha256
    },
    package: {
      designation: packageDesignation,
      caseSize: "manufacturer dimensions, not a generic 1206 substitution",
      bodyLengthMm: { nominal: packageBodyLengthMm, minimum: 5.9, maximum: 6.3 },
      bodyWidthMm: { nominal: packageBodyWidthMm, minimum: 2.44, maximum: 2.94 },
      bodyHeightMm: { nominal: packageBodyHeightMm, minimum: 2.44, maximum: 2.94 },
      terminals: 2,
      terminalDisposition: "two end caps; exact MRL orderables use the 451-series RoHS/HF termination construction",
      thermalPad: {
        exists: false,
        disposition: "no exposed central thermal pad is shown by the applicable two-terminal package drawing"
      }
    },
    terminalAndPolarity: {
      terminalCount: 2,
      padOne: { name: "end-cap-A", polarity: "none", assignment: "arbitrary fuse terminal" },
      padTwo: { name: "end-cap-B", polarity: "none", assignment: "arbitrary fuse terminal" },
      polarity: "non-polar",
      polarityBasis,
      pinOne: "not-applicable",
      orientationEquivalence:
        "pad 1 and pad 2 may be exchanged electrically; printed marking face remains a separate assembly review"
    },
    manufacturerLandPattern: {
      status: "manufacturer-recommended-copper-layout",
      sourceId: evidenceSources[0].id,
      reviewedPage: 4,
      sourceLabel: "Recommended pad layout",
      copper: {
        padLengthMm,
        padWidthMm,
        padGapMm,
        padCenterSpacingMm,
        publishedSourceOuterSpanMm: publishedOuterSpanMm,
        outerCopperSpanMm: derivedOuterCopperSpanMm,
        dimensionsDisposition: "manufacturer-published nominal dimensions"
      },
      solderMask: { status: "not-published", accepted: false },
      paste: { status: "not-published", accepted: false },
      courtyard: { status: "not-published", accepted: false },
      thermalRelief: { status: "not-applicable-no-thermal-pad", accepted: false }
    },
    projectFootprint,
    artwork: {
      state: "generated-project-review-only",
      representation: "tscircuit-two-pad-copper-transcription",
      authority: "deny",
      sha256: artworkSha256
    },
    review: {
      status: "pending-root-review",
      exactOrderablesBound: true,
      commonPackageAndLandPatternVerified: true,
      exactSourcePagesReviewed: true,
      projectGeometryAccepted: false,
      reviewer: null,
      reviewedAt: null,
      scope:
        "Exact orderables, common package/terminal/polarity disposition, manufacturer copper land pattern, orientation datum, and retained source hash only."
    },
    acceptance: {
      currentRatingReviewAccepted: false,
      thermalReviewAccepted: false,
      boardFitAccepted: false,
      releaseAccepted: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    },
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  } as const
}

const expectedEvidence = deepFreeze(createEvidence())
export const bp033Littelfuse0451FuseFootprintEvidence = deepFreeze(createEvidence())

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
  for (const key of rightKeys) {
    if (!leftKeys.some((candidate) => Object.is(candidate, key))) return false
    const leftDescriptor = Object.getOwnPropertyDescriptor(left, key)
    const rightDescriptor = Object.getOwnPropertyDescriptor(right, key)
    if (
      leftDescriptor === undefined ||
      rightDescriptor === undefined ||
      !("value" in leftDescriptor) ||
      !("value" in rightDescriptor) ||
      leftDescriptor.enumerable !== rightDescriptor.enumerable ||
      !sameDataValue(leftDescriptor.value, rightDescriptor.value, seen)
    ) {
      return false
    }
  }
  return true
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Empty output means the bounded BP-033 fuse review artifact is internally consistent. */
export function validateBp033Littelfuse0451FuseFootprintEvidence(
  candidate: unknown = bp033Littelfuse0451FuseFootprintEvidence
): readonly string[] {
  if (!sameDataValue(candidate, expectedEvidence)) {
    return ["BP-033 Littelfuse 0451 identity, common-footprint proof, or deny state drifted"]
  }
  if (!isRecord(candidate)) return ["BP-033 Littelfuse evidence has an invalid shape"]
  const sources = candidate.sources
  const artwork = candidate.artwork
  if (
    !Array.isArray(sources) ||
    !isRecord(sources[0]) ||
    !isRecord(artwork) ||
    !isSha256(sources[0].sha256) ||
    !isSha256(artwork.sha256)
  ) {
    return ["BP-033 Littelfuse 0451 retained source or artwork digest is invalid"]
  }
  return []
}

export function bp033Littelfuse0451FuseFor(reference: (typeof exactFuses)[number]["reference"]) {
  const exactFuse = exactFuses.find((candidate) => candidate.reference === reference)
  if (exactFuse === undefined) throw new RangeError(`Unsupported BP-033 fuse reference ${reference}`)
  return {
    artifactKind: bp033Littelfuse0451FuseFootprintEvidence.artifactKind,
    reference: exactFuse.reference,
    manufacturerPartNumber: exactFuse.manufacturerPartNumber,
    nominalCurrentA: exactFuse.nominalCurrentA,
    sourceArtifactPath,
    sourceSha256,
    package: packageDesignation,
    projectFootprintId,
    polarity: "non-polar",
    polarityBasis,
    orientation: "pad 1 at negative local X; 180-degree reversal electrically equivalent",
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  } as const
}

const footprint = (name: string): ReactElement => (
  <footprint name={name} originalLayer="top">
    <smtpad
      name="1"
      pcbX={-padCenterMm}
      pcbY={0}
      shape="rect"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      // Littelfuse does not publish a stencil aperture; suppress tscircuit's default paste artifact.
      solderPasteMargin="-1mm"
      portHints={["1", "end-cap-A", "non-polar", "polarity-design-inference"]}
    />
    <smtpad
      name="2"
      pcbX={padCenterMm}
      pcbY={0}
      shape="rect"
      width={`${padLengthMm}mm`}
      height={`${padWidthMm}mm`}
      // Littelfuse does not publish a stencil aperture; suppress tscircuit's default paste artifact.
      solderPasteMargin="-1mm"
      portHints={["2", "end-cap-B", "non-polar", "polarity-design-inference"]}
    />
  </footprint>
)

export interface Bp033Littelfuse0451FuseProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
  readonly reference?: (typeof exactFuses)[number]["reference"]
}

/** Isolated review-only component. It is intentionally not imported by any board model. */
export function Bp033Littelfuse0451Fuse({
  pcbRotation,
  pcbX,
  pcbY,
  reference = "F_APPLICATION"
}: Bp033Littelfuse0451FuseProps = {}): ReactElement {
  const exactFuse = bp033Littelfuse0451FuseFor(reference)
  return (
    <chip
      name={`BP033_${reference}`}
      manufacturerPartNumber={exactFuse.manufacturerPartNumber}
      pinLabels={{ pin1: "end-cap-A", pin2: "end-cap-B" }}
      footprint={footprint(`BP033_LITTELFUSE_0451_${reference}_REVIEW_ONLY`)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}
