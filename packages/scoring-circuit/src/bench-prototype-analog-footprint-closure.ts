/**
 * BP-031: lane-B analog, protection, reference, and weapon-fixture footprint
 * evidence ledger.
 *
 * This contract freezes source-backed identities and the complete set of
 * repeated cell references. It deliberately does not manufacture land,
 * courtyard, paste, mask, or orientation geometry. Every record remains
 * denied until independent drawing, CAD, artwork, and assembly evidence is
 * archived and reviewed.
 */

import {
  benchPrototypeFixtureHarness,
  validateBenchPrototypeFixtureHarness
} from "./bench-prototype-fixture-harness.js"
import {
  benchPrototypeFootprintReviewTemplate,
  validateBenchPrototypeFootprintReview
} from "./bench-prototype-footprint-review.js"
import {
  benchPrototypeSevenChannelAnalog,
  validateBenchPrototypeSevenChannelAnalog
} from "./bench-prototype-seven-channel-analog.js"
import {
  bp031Ada4177R8FootprintEvidence,
  validateBp031Ada4177R8FootprintEvidence
} from "./bp031-ada4177-r8-footprint-evidence.js"
import {
  bp031Ads8881IdgsDgsFootprintCandidate,
  validateBp031Ads8881IdgsDgsFootprintCandidate
} from "./bp031-ads8881idgs-dgs-footprint-candidate.js"
import {
  bp031Tmux1112PwrPwFootprintEvidence,
  validateBp031Tmux1112PwrPwFootprintEvidence
} from "./bp031-ti-tmux1112pwr-pw-footprint-evidence.js"
import {
  bp031Tpd4e05u06DqaProjectFootprintGeometry,
  validateBp031Tpd4e05u06DqaProjectFootprint
} from "./bp031-tpd4e05u06-dqa-project-footprint.js"
import { findFootprintReleaseEvidence } from "./footprint-release-evidence.js"
import { M404_SINGLE_CHANNEL_COUPON, validateM404SingleChannelCoupon } from "./m4-04-single-channel-coupon.js"
import { manufacturerFootprintEligibility } from "./manufacturer-footprint-adapter.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

type PlainRecord = Record<PropertyKey, unknown>

type FootprintSourceEvidence = {
  readonly state: "not-acquired"
  readonly url: null
  readonly revision: null
  readonly sha256: null
}

type FootprintArtworkEvidence = {
  readonly state: "not-generated"
  readonly artifactPath: null
  readonly generator: null
  readonly sha256: null
}

type FootprintOrientationEvidence = {
  readonly state: "unreviewed"
  readonly assemblyRotationDeg: null
  readonly datum: null
  readonly notes: null
}

type SourcePart = (typeof oneChannelAnalogExperimentBom)[number]

type SharedManufacturerSource = {
  readonly sourceId: string
  readonly sourceWorkUnit: "M4-04"
  readonly exactMpn: string
  readonly manufacturer: string
  readonly package: string
  readonly primaryEvidenceUrl: string
  readonly sourceStatus: "hash-bound" | "series-hash-bound" | "identity-hash-bound"
  readonly acquisition: "exact-drawing-hash-bound" | "series-drawing-hash-bound" | "exact-primary-identity-hash-bound"
  readonly artifactPath: string
  readonly drawingIdentifier: string | null
  readonly drawingUrl: string | null
  readonly identityIdentifier: string | null
  readonly identityUrl: string | null
  readonly sha256: string
  readonly geometry: null
  readonly reviewStatus: "not-reviewed-for-bp-031"
  readonly scope: string
}

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-031 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-031 may contain only enumerable data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (
      !Array.isArray(actual) ||
      !Array.isArray(expected) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype ||
      actual.length !== expected.length
    ) {
      return false
    }
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
    ) {
      return false
    }
    return expected.every((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable &&
        sameDataGraph(descriptor.value, entry, seen)
      )
    })
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const cellReferenceBindings = [
  { key: "esd", baseReference: "U_ESD", role: "connector-side ESD shunt" },
  { key: "series", baseReference: "R_ESD", role: "normal-path protection series resistor" },
  { key: "switch", baseReference: "U_SOURCE_SWITCH", role: "source and sink analog switch" },
  { key: "source", baseReference: "R_SOURCE", role: "reference excitation series resistor" },
  { key: "sourcePullDown", baseReference: "R_SOURCE_PD", role: "source-enable safe-state pull-down" },
  { key: "buffer", baseReference: "U_OVP_BUFFER", role: "over-voltage-tolerant unity buffer" },
  { key: "sarSeries", baseReference: "R_SAR", role: "SAR input isolation resistor" },
  { key: "sarCap", baseReference: "C_SAR", role: "SAR input charge-bucket capacitor" },
  { key: "adc", baseReference: "U_SAR", role: "18-bit SAR converter" },
  { key: "reference", baseReference: "U_REF", role: "2.5 V reference" },
  { key: "referenceInputBypass", baseReference: "C_REF_IN", role: "reference input bypass" },
  { key: "referenceRegulatorOutput", baseReference: "C_REF_REG", role: "reference output reservoir" },
  { key: "referenceRegulatorHighFrequency", baseReference: "C_REF_REG_HF", role: "reference high-frequency bypass" },
  { key: "referenceFeed", baseReference: "R_REF_SAR", role: "SAR reference-feed isolation resistor" },
  { key: "referenceReservoir", baseReference: "C_REF", role: "SAR reference reservoir" },
  { key: "guard", baseReference: "R_FAULT_GUARD", role: "externally interlocked guarded-force resistor" }
] as const

type CellReferenceKey = (typeof cellReferenceBindings)[number]["key"]

const expectedReplicatedCellCount = 7
const expectedCellReferenceCount = 16
const expectedReplicatedCellRecordCount = expectedReplicatedCellCount * expectedCellReferenceCount
const expectedConnectorRecordCount = 1
const expectedTotalRecordCount = expectedReplicatedCellRecordCount + expectedConnectorRecordCount
const expectedSharedManufacturerSourceCount = 16
const expectedSharedSourceLinkedRecordCount = expectedReplicatedCellCount * expectedSharedManufacturerSourceCount
const expectedSharedSourceUnresolvedRecordCount =
  expectedReplicatedCellRecordCount - expectedSharedSourceLinkedRecordCount

function findUniqueSourcePart(reference: string): SourcePart {
  const matches = oneChannelAnalogExperimentBom.filter((part) => part.reference === reference)
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new RangeError(`BP-031 requires exactly one source-backed part row for ${reference}`)
  }
  return matches[0]
}

function emptySourceEvidence(): FootprintSourceEvidence {
  return { state: "not-acquired", url: null, revision: null, sha256: null }
}

function emptyArtworkEvidence(): FootprintArtworkEvidence {
  return { state: "not-generated", artifactPath: null, generator: null, sha256: null }
}

function emptyOrientationEvidence(): FootprintOrientationEvidence {
  return { state: "unreviewed", assemblyRotationDeg: null, datum: null, notes: null }
}

const tpd4e05u06ReviewEvidenceMappingId = "bp031-tpd4e05u06-dqa-project-footprint"
const tmux1112PwrPwReviewEvidenceMappingId = "bp031-tmux1112pwr-pw-footprint-evidence"
const ads8881IdgsDgsReviewEvidenceMappingId = "bp031-ads8881idgs-dgs-footprint-candidate"
const ada4177ReviewEvidenceMappingId = "bp031-ada4177-1arz-r8-footprint-evidence"

function createTpd4e05u06ReviewEvidenceMapping() {
  const candidate = bp031Tpd4e05u06DqaProjectFootprintGeometry
  const source = candidate.sources[0]
  if (source === undefined) throw new RangeError("BP-031 TPD4E05U06DQAR source evidence is missing")
  return {
    mappingId: tpd4e05u06ReviewEvidenceMappingId,
    reviewState: "root-reviewed-review-input" as const,
    reviewer: "root-final-reviewer" as const,
    reviewedAt: "2026-08-25T08:15:00.000Z",
    reviewScope:
      "Exact identity, source binding, seven-reference mapping, and deny-state integrity only; project geometry, orientation, board fit, CAD import, release, and fabrication remain unapproved.",
    artifactKind: candidate.artifactKind,
    artifactPath: "packages/scoring-circuit/src/bp031-tpd4e05u06-dqa-project-footprint.tsx",
    workUnit: candidate.workUnit,
    baseReference: candidate.reference,
    sourceContract: candidate.sourceContract,
    manufacturer: candidate.manufacturer,
    exactMpn: candidate.manufacturerPartNumber,
    exactPackage: candidate.package.designation,
    role: candidate.role,
    affectedReferences: [...candidate.affectedReferences],
    manufacturerDrawingInput: {
      state: "source-controlled-pending-review" as const,
      acquisition: "exact-drawing-hash-bound" as const,
      artifactPath: source.artifactPath,
      url: source.url,
      revision: "Rev. O",
      reviewedPages: source.reviewedPages,
      sha256: source.sha256,
      authority: "deny" as const
    },
    manufacturerCad: {
      state: candidate.manufacturerCad.state,
      artifactPath: candidate.manufacturerCad.artifactPath,
      sha256: candidate.manufacturerCad.sha256,
      authority: candidate.manufacturerCad.authority,
      note: candidate.manufacturerCad.note
    },
    renderedArtwork: {
      state: candidate.artwork.state,
      representation: candidate.artwork.representation,
      artifactPath: "packages/scoring-circuit/src/bp031-tpd4e05u06-dqa-project-footprint.tsx",
      generator: candidate.artwork.generator,
      generatorVersion: candidate.artwork.generatorVersion,
      sha256: candidate.artwork.sha256,
      authority: candidate.artwork.authority
    },
    pinOneOrientation: {
      state: "source-controlled-pending-review" as const,
      sourceDatum: candidate.pinOne.sourceDatum,
      pin: candidate.pinOne.pin,
      boardCoordinatesMm: {
        x: candidate.pinOne.boardCoordinatesMm.x,
        y: candidate.pinOne.boardCoordinatesMm.y
      },
      boardRotationDegrees: candidate.pinOne.boardRotationDegrees,
      orientationVerified: candidate.pinOne.orientationVerified,
      topViewOrdering: {
        pin1: candidate.pinOne.topViewOrdering.pin1,
        pin5: candidate.pinOne.topViewOrdering.pin5,
        pin6: candidate.pinOne.topViewOrdering.pin6,
        pin10: candidate.pinOne.topViewOrdering.pin10
      },
      authority: "deny" as const
    },
    acceptance: {
      packageIdentityReviewed: candidate.acceptance.packageIdentityReviewed,
      packageDrawingReviewed: candidate.acceptance.packageDrawingReviewed,
      pinFunctionsReviewed: candidate.acceptance.pinFunctionsReviewed,
      projectGeometryAccepted: candidate.acceptance.projectGeometryAccepted,
      pinOneOrientationAccepted: candidate.acceptance.pinOneOrientationAccepted,
      cadImportAccepted: candidate.acceptance.cadImportAccepted,
      boardFitAccepted: candidate.acceptance.boardFitAccepted,
      fabricationAuthorized: candidate.acceptance.fabricationAuthorized,
      releaseState: candidate.acceptance.releaseState
    }
  }
}

const tpd4e05u06ReviewEvidenceMapping = deepFreeze(createTpd4e05u06ReviewEvidenceMapping())

function createTmux1112PwrPwReviewEvidenceMapping() {
  const candidate = bp031Tmux1112PwrPwFootprintEvidence
  const source = candidate.sources[0]
  if (source === undefined) throw new RangeError("BP-031 TMUX1112PWR source evidence is missing")
  return {
    mappingId: tmux1112PwrPwReviewEvidenceMappingId,
    reviewState: "root-reviewed-review-input" as const,
    reviewer: "root-final-reviewer" as const,
    reviewedAt: "2026-08-25T08:56:12.543Z",
    reviewScope:
      "Root-reviewed exact identity, retained source pages, pin functions, seven-reference mapping, and deny-state integrity; project geometry, orientation, board fit, CAD import, release, and fabrication remain unapproved.",
    artifactKind: candidate.artifactKind,
    artifactPath: "packages/scoring-circuit/src/bp031-ti-tmux1112pwr-pw-footprint-evidence.tsx",
    workUnit: candidate.workUnit,
    baseReference: candidate.sourceBinding.canonicalSourceReference,
    sourceContract: candidate.sourceBinding.sourceContract,
    manufacturer: candidate.manufacturer,
    exactMpn: candidate.manufacturerPartNumber,
    exactPackage: candidate.sourceBinding.package,
    role: "source and sink analog switch",
    affectedReferences: benchPrototypeSevenChannelAnalog.channels.map((channel) => channel.references.switch),
    manufacturerDrawingInput: {
      state: "source-controlled-pending-review" as const,
      acquisition: "exact-drawing-hash-bound" as const,
      artifactPath: source.artifactPath,
      url: source.url,
      revision: source.revision,
      reviewedPages: source.reviewedPages,
      sha256: source.sha256,
      authority: "deny" as const
    },
    manufacturerCad: {
      state: candidate.manufacturerCad.state,
      artifactPath: candidate.manufacturerCad.artifactPath,
      sha256: null,
      authority: candidate.manufacturerCad.authority,
      note: candidate.manufacturerCad.note
    },
    renderedArtwork: {
      state: candidate.artwork.state,
      representation: candidate.artwork.representation,
      artifactPath: "packages/scoring-circuit/src/bp031-ti-tmux1112pwr-pw-footprint-evidence.tsx",
      generator: candidate.artwork.generator,
      generatorVersion: candidate.artwork.generatorVersion,
      sha256: candidate.artwork.sha256,
      authority: candidate.artwork.authority
    },
    pinOneOrientation: {
      state: "source-controlled-pending-review" as const,
      sourceDatum: candidate.pinOneOrientation.topViewPinOneDatum,
      pin: candidate.pinOneOrientation.projectPinOnePad.pin,
      boardCoordinatesMm: {
        x: candidate.pinOneOrientation.projectPinOnePad.xMm,
        y: candidate.pinOneOrientation.projectPinOnePad.yMm
      },
      boardRotationDegrees: candidate.pinOneOrientation.projectBoardRotationDegrees,
      orientationVerified: false,
      topViewNumbering: candidate.pinOneOrientation.topViewNumbering,
      authority: "deny" as const
    },
    acceptance: {
      packageIdentityReviewed: true,
      packageDrawingReviewed: true,
      pinFunctionsReviewed: true,
      projectGeometryAccepted: candidate.projectFootprint.accepted,
      pinOneOrientationAccepted: false,
      cadImportAccepted: false,
      boardFitAccepted: false,
      fabricationAuthorized: false as const,
      releaseState: candidate.releaseState
    }
  }
}

const tmux1112PwrPwReviewEvidenceMapping = deepFreeze(createTmux1112PwrPwReviewEvidenceMapping())

function createAds8881IdgsDgsReviewEvidenceMapping() {
  const candidate = bp031Ads8881IdgsDgsFootprintCandidate
  const source = candidate.sources[0]
  if (source === undefined) throw new RangeError("BP-031 ADS8881IDGS source evidence is missing")
  return {
    mappingId: ads8881IdgsDgsReviewEvidenceMappingId,
    reviewState: "root-reviewed-review-input" as const,
    reviewer: "root-final-reviewer" as const,
    reviewedAt: "2026-08-25T10:18:00.000Z",
    reviewScope:
      "Root-reviewed exact identity, retained manufacturer source, pin functions, seven-reference mapping, TI DGS0010A land geometry, pin-one orientation, and deny-state integrity; CAD import, board fit, release, and fabrication remain unapproved.",
    artifactKind: candidate.artifactKind,
    artifactPath: "packages/scoring-circuit/src/bp031-ads8881idgs-dgs-footprint-candidate.tsx",
    workUnit: candidate.workUnit,
    baseReference: candidate.sourceBinding.canonicalSourceReference,
    sourceContract: candidate.sourceBinding.sourceContract,
    manufacturer: candidate.manufacturer,
    exactMpn: candidate.manufacturerPartNumber,
    exactPackage: `${candidate.package.option} ${candidate.package.designation}`,
    affectedReferences: benchPrototypeSevenChannelAnalog.channels.map((channel) => channel.references.adc),
    manufacturerDrawingInput: {
      state: "source-controlled-pending-review" as const,
      acquisition: "exact-drawing-hash-bound" as const,
      artifactPath: source.artifactPath,
      url: source.url,
      revision: source.revision,
      reviewedPages: source.reviewedPages,
      sha256: source.sha256,
      authority: "deny" as const
    },
    manufacturerCad: {
      state: candidate.manufacturerCad.state,
      artifactPath: null,
      sha256: null,
      authority: candidate.manufacturerCad.authority,
      note: candidate.manufacturerCad.note
    },
    renderedArtwork: {
      state: candidate.artwork.state,
      representation: candidate.artwork.representation,
      artifactPath: "packages/scoring-circuit/src/bp031-ads8881idgs-dgs-footprint-candidate.tsx",
      generator: candidate.artwork.generator,
      generatorVersion: candidate.artwork.generatorVersion,
      sha256: candidate.artwork.sha256,
      authority: candidate.artwork.authority
    },
    pinOneOrientation: {
      state: "root-reviewed-manufacturer-drawing-match" as const,
      sourceDatum: candidate.pinOneOrientation.topViewPinOneDatum,
      pin: candidate.pinOneOrientation.projectPinOnePad.pin,
      boardCoordinatesMm: {
        x: candidate.pinOneOrientation.projectPinOnePad.xMm,
        y: candidate.pinOneOrientation.projectPinOnePad.yMm
      },
      boardRotationDegrees: candidate.pinOneOrientation.projectBoardRotationDegrees,
      topViewNumbering: candidate.pinOneOrientation.topViewNumbering,
      exactMatchStatus: candidate.pinOneOrientation.exactMatchStatus,
      authority: "deny" as const
    },
    projectGeometry: {
      state: candidate.projectFootprint.state,
      geometryAuthority: candidate.projectFootprint.geometryAuthority,
      padCount: candidate.projectFootprint.pads.length,
      padLengthMm: candidate.projectFootprint.padLengthMm,
      padWidthMm: candidate.projectFootprint.padWidthMm,
      padRowCenterSpanMm: candidate.projectFootprint.padRowCenterSpanMm,
      padPitchMm: candidate.projectFootprint.padPitchMm,
      courtyard: {
        minimumXMm: candidate.projectFootprint.courtyard.minimumXMm,
        maximumXMm: candidate.projectFootprint.courtyard.maximumXMm,
        minimumYMm: candidate.projectFootprint.courtyard.minimumYMm,
        maximumYMm: candidate.projectFootprint.courtyard.maximumYMm,
        sourceStatus: candidate.projectFootprint.courtyard.sourceStatus,
        status: candidate.projectFootprint.courtyard.status
      },
      orientationStatus: "root-reviewed-manufacturer-drawing-match" as const,
      accepted: true as const,
      fabricationAuthority: candidate.projectFootprint.fabricationAuthority
    },
    acceptance: {
      packageIdentityReviewed: true as const,
      packageDrawingReviewed: true as const,
      pinFunctionsReviewed: true as const,
      projectGeometryAccepted: true as const,
      pinOneOrientationAccepted: true as const,
      cadImportAccepted: false,
      boardFitAccepted: false,
      fabricationAuthorized: false,
      releaseState: candidate.releaseState
    }
  }
}

const ads8881IdgsDgsReviewEvidenceMapping = deepFreeze(createAds8881IdgsDgsReviewEvidenceMapping())

function createAda4177ReviewEvidenceMapping() {
  const candidate = bp031Ada4177R8FootprintEvidence
  const exactSources = candidate.sources.filter(
    (source) => source.id === "adi-ada4177-datasheet-rev-e" || source.id === "adi-r-8-package-outline"
  )
  const familyLandPatternSource = candidate.sources.find((source) => source.id === "adi-90-0096-s8-land-pattern-rev-m")
  if (exactSources.length !== 2 || familyLandPatternSource === undefined) {
    throw new RangeError("BP-031 ADA4177 exact R-8 sources are incomplete")
  }
  return {
    mappingId: ada4177ReviewEvidenceMappingId,
    reviewState: "root-reviewed-review-input" as const,
    reviewer: "root-final-reviewer" as const,
    reviewedAt: "2026-08-25T10:31:00.000Z",
    reviewScope:
      "Root-reviewed exact ADA4177-1ARZ identity, R-8 package drawing, seven-reference mapping, pin-one orientation, and deny-state integrity; the S8 family land pattern remains non-exact, and project geometry, CAD, board fit, release, and fabrication remain unapproved.",
    artifactKind: candidate.artifactKind,
    artifactPath: "packages/scoring-circuit/src/bp031-ada4177-r8-footprint-evidence.tsx",
    workUnit: candidate.workUnit,
    baseReference: "U_OVP_BUFFER",
    sourceContract: "BP-103" as const,
    manufacturer: candidate.manufacturer,
    exactMpn: candidate.manufacturerPartNumber,
    exactPackage: "R SOIC-8",
    role: "over-voltage-tolerant unity buffer",
    affectedReferences: [
      "U_OVP_BUFFER_1",
      "U_OVP_BUFFER_2",
      "U_OVP_BUFFER_3",
      "U_OVP_BUFFER_4",
      "U_OVP_BUFFER_5",
      "U_OVP_BUFFER_6",
      "U_OVP_BUFFER_7"
    ],
    manufacturerDrawingInputs: {
      state: "source-controlled-pending-review" as const,
      exactSources: structuredClone(exactSources),
      authority: "deny" as const
    },
    familyLandPatternInput: {
      state: "family-reference-only" as const,
      source: structuredClone(familyLandPatternSource),
      exactAda4177Approval: candidate.landPatternReconciliation.exactAda4177Approval,
      authority: "deny" as const
    },
    manufacturerCad: {
      state: candidate.manufacturerCad.state,
      artifactPath: null,
      sha256: null,
      authority: candidate.manufacturerCad.authority,
      note: candidate.manufacturerCad.note
    },
    partnerCad: {
      availability: candidate.partnerCad.availability,
      retainedArtifactPath: candidate.partnerCad.retainedArtifactPath,
      sha256: candidate.partnerCad.sha256,
      authority: candidate.partnerCad.authority,
      note: candidate.partnerCad.note
    },
    pinOneOrientation: {
      state: "root-reviewed-r8-drawing-match" as const,
      sourceId: candidate.pinOneOrientation.sourceId,
      topViewPinOneDatum: candidate.pinOneOrientation.topViewPinOneDatum,
      topViewNumbering: candidate.pinOneOrientation.topViewNumbering,
      projectBoardRotationDegrees: candidate.pinOneOrientation.projectBoardRotationDegrees,
      projectPinOnePad: {
        pin: candidate.pinOneOrientation.projectPinOnePad.pin,
        xMm: candidate.pinOneOrientation.projectPinOnePad.xMm,
        yMm: candidate.pinOneOrientation.projectPinOnePad.yMm
      },
      independentOrientationReview: "root-reviewed" as const,
      authority: "deny" as const
    },
    projectFootprintInput: {
      state: candidate.projectFootprint.state,
      geometryAuthority: candidate.projectFootprint.geometryAuthority,
      padShape: candidate.projectFootprint.padShape,
      padLengthMm: candidate.projectFootprint.padLengthMm,
      padWidthMm: candidate.projectFootprint.padWidthMm,
      padRowCenterSpanMm: candidate.projectFootprint.padRowCenterSpanMm,
      padPitchMm: candidate.projectFootprint.padPitchMm,
      pads: structuredClone(candidate.projectFootprint.pads),
      solderMask: structuredClone(candidate.projectFootprint.solderMask),
      paste: structuredClone(candidate.projectFootprint.paste),
      courtyard: structuredClone(candidate.projectFootprint.courtyard),
      orientationStatus: candidate.projectFootprint.orientationStatus,
      fabricationAuthority: candidate.projectFootprint.fabricationAuthority,
      accepted: candidate.projectFootprint.accepted
    },
    renderedArtwork: {
      state: "not-generated" as const,
      artifactPath: null,
      generator: null,
      sha256: null,
      authority: "deny" as const,
      note: "The retained ADA4177 candidate has deterministic project geometry but no separately hashed rendered artwork artifact."
    },
    acceptance: {
      packageIdentityReviewed: true as const,
      packageDrawingReviewed: true as const,
      referenceMappingReviewed: true as const,
      familyLandPatternAcceptedForExactMpn: false as const,
      projectGeometryAccepted: false as const,
      pinOneOrientationAccepted: true as const,
      cadImportAccepted: false as const,
      boardFitAccepted: false as const,
      fabricationAuthorized: false as const,
      releaseState: "deny" as const
    }
  }
}

const ada4177ReviewEvidenceMapping = deepFreeze(createAda4177ReviewEvidenceMapping())

function existingFootprintEvidence(mpn: string) {
  const eligibility = manufacturerFootprintEligibility(mpn)
  const ledger = findFootprintReleaseEvidence(mpn)
  return {
    eligibleForPcb: false as const,
    reviewGeometryStatus: eligibility.reviewGeometryStatus,
    missingReleaseData: [...eligibility.missingReleaseData],
    existingLedgerLibrary: ledger?.library ?? "unresolved",
    existingLedgerReleaseState: ledger?.releaseState ?? "deny",
    existingGateReferences: [...(ledger?.gateReferences ?? [])]
  }
}

function sharedManufacturerSourcesFor(parts: readonly SourcePart[]): SharedManufacturerSource[] {
  const sources: SharedManufacturerSource[] = []
  for (const part of parts) {
    const m404Footprint = M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === part.mpn)
    if (m404Footprint === undefined) {
      continue
    }
    const manufacturerDrawing = m404Footprint.evidence.manufacturerDrawing
    const manufacturerIdentitySource = m404Footprint.evidence.manufacturerIdentitySource
    const hasDrawingSource =
      manufacturerDrawing !== undefined &&
      (manufacturerDrawing.acquisition === "exact-drawing-hash-bound" ||
        manufacturerDrawing.acquisition === "series-drawing-hash-bound") &&
      manufacturerDrawing.artifactPath !== null &&
      manufacturerDrawing.drawingUrl !== null &&
      manufacturerDrawing.sha256 !== null
    const hasIdentitySource =
      manufacturerIdentitySource !== undefined &&
      manufacturerIdentitySource.acquisition === "exact-primary-identity-hash-bound" &&
      manufacturerIdentitySource.artifactPath !== null &&
      manufacturerIdentitySource.sourceUrl !== null &&
      manufacturerIdentitySource.identityIdentifier !== null &&
      manufacturerIdentitySource.sha256 !== null
    if (
      m404Footprint.manufacturer !== part.manufacturer ||
      m404Footprint.package !== part.package ||
      m404Footprint.evidence.exactMpn !== part.mpn ||
      m404Footprint.evidence.manufacturerPrimaryDocument.url !== part.primaryEvidenceUrl ||
      (!hasDrawingSource && !hasIdentitySource)
    ) {
      continue
    }

    if (hasDrawingSource) {
      sources.push({
        sourceId: `M4-04:${part.mpn}`,
        sourceWorkUnit: "M4-04" as const,
        exactMpn: part.mpn,
        manufacturer: part.manufacturer,
        package: part.package,
        primaryEvidenceUrl: part.primaryEvidenceUrl,
        sourceStatus:
          manufacturerDrawing.acquisition === "exact-drawing-hash-bound"
            ? ("hash-bound" as const)
            : ("series-hash-bound" as const),
        acquisition: manufacturerDrawing.acquisition,
        artifactPath: manufacturerDrawing.artifactPath,
        drawingIdentifier: manufacturerDrawing.drawingIdentifier,
        drawingUrl: manufacturerDrawing.drawingUrl,
        identityIdentifier: null,
        identityUrl: null,
        sha256: manufacturerDrawing.sha256,
        geometry: null,
        reviewStatus: "not-reviewed-for-bp-031" as const,
        scope:
          "Imported source identity only. BP-031 has not reviewed the source against project artwork, CAD, orientation, assembly, schematic integration, or fabrication acceptance."
      })
      continue
    }
    if (
      manufacturerIdentitySource !== undefined &&
      manufacturerIdentitySource.acquisition === "exact-primary-identity-hash-bound" &&
      manufacturerIdentitySource.artifactPath !== null &&
      manufacturerIdentitySource.sourceUrl !== null &&
      manufacturerIdentitySource.identityIdentifier !== null &&
      manufacturerIdentitySource.sha256 !== null
    ) {
      sources.push({
        sourceId: `M4-04:${part.mpn}`,
        sourceWorkUnit: "M4-04" as const,
        exactMpn: part.mpn,
        manufacturer: part.manufacturer,
        package: part.package,
        primaryEvidenceUrl: part.primaryEvidenceUrl,
        sourceStatus: "identity-hash-bound" as const,
        acquisition: manufacturerIdentitySource.acquisition,
        artifactPath: manufacturerIdentitySource.artifactPath,
        drawingIdentifier: null,
        drawingUrl: null,
        identityIdentifier: manufacturerIdentitySource.identityIdentifier,
        identityUrl: manufacturerIdentitySource.sourceUrl,
        sha256: manufacturerIdentitySource.sha256,
        geometry: null,
        reviewStatus: "not-reviewed-for-bp-031" as const,
        scope:
          "Imported source identity only. BP-031 has not reviewed the source against project artwork, CAD, orientation, assembly, schematic integration, or fabrication acceptance."
      })
    }
  }
  return sources
}

const sourceParts = cellReferenceBindings.map((binding) => findUniqueSourcePart(binding.baseReference))
const sharedManufacturerSources = sharedManufacturerSourcesFor(sourceParts)
const sharedManufacturerSourceByMpn = new Map(
  sharedManufacturerSources.map((source) => [source.exactMpn, source] as const)
)

function sourceContractFor(reference: string): "BP-101" | "BP-102" {
  if (["U_REF", "C_REF_IN", "C_REF_REG", "C_REF_REG_HF", "R_REF_SAR", "C_REF", "U_SAR"].includes(reference)) {
    return "BP-101"
  }
  return "BP-102"
}

function createCellRecord(
  channelIndex: number,
  conductor: string,
  connectorNet: string,
  binding: (typeof cellReferenceBindings)[number],
  reference: string
) {
  const sourcePart = findUniqueSourcePart(binding.baseReference)
  return {
    reference,
    sourceContract: "BP-103" as const,
    sourceBaseReference: binding.baseReference,
    sourceSubcontract: sourceContractFor(binding.baseReference),
    channelIndex,
    conductor,
    connectorNet,
    role: binding.role,
    manufacturer: sourcePart.manufacturer,
    exactMpn: sourcePart.mpn,
    exactPackage: sourcePart.package,
    primaryEvidenceUrl: sourcePart.primaryEvidenceUrl,
    sharedManufacturerSourceId: sharedManufacturerSourceByMpn.get(sourcePart.mpn)?.sourceId ?? null,
    reviewEvidenceMappingId:
      binding.baseReference === "U_ESD"
        ? tpd4e05u06ReviewEvidenceMappingId
        : binding.baseReference === "U_SAR"
          ? ads8881IdgsDgsReviewEvidenceMappingId
          : binding.baseReference === "U_SOURCE_SWITCH"
            ? tmux1112PwrPwReviewEvidenceMappingId
            : binding.baseReference === "U_OVP_BUFFER"
              ? ada4177ReviewEvidenceMappingId
              : null,
    manufacturerDrawing: emptySourceEvidence(),
    manufacturerCad: emptySourceEvidence(),
    artwork: emptyArtworkEvidence(),
    orientation: emptyOrientationEvidence(),
    existingFootprintEvidence: existingFootprintEvidence(sourcePart.mpn),
    disposition: "DNP-unresolved" as const,
    findings: [
      "The exact BOM identity has M4-04 source evidence (classified as exact drawing, series-only drawing, or exact identity), but BP-031 has no independently reviewed project artwork, CAD approval, orientation, or fabrication evidence."
    ]
  }
}

function createConnectorRecord() {
  const header = benchPrototypeFixtureHarness.connector.header
  return {
    reference: benchPrototypeFixtureHarness.connector.boardReference,
    sourceContract: "BP-104" as const,
    sourceBaseReference: "J_WEAPON_FIXTURE",
    sourceSubcontract: "BP-104" as const,
    channelIndex: null,
    conductor: null,
    connectorNet: null,
    role: "12-position weapon and piste fixture board header",
    manufacturer: header.manufacturer,
    exactMpn: header.mpn,
    exactPackage: header.family,
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/43045-1200",
    reviewEvidenceMappingId: null,
    manufacturerDrawing: emptySourceEvidence(),
    manufacturerCad: emptySourceEvidence(),
    artwork: emptyArtworkEvidence(),
    orientation: emptyOrientationEvidence(),
    existingFootprintEvidence: existingFootprintEvidence(header.mpn),
    disposition: "DNP-unresolved" as const,
    findings: [
      "The exact polarized 43045-1200 header is selected by BP-104, but its drawing, CAD, generated artwork, circuit-1 orientation, edge clearance, and mating envelope still require independent review."
    ]
  }
}

const records = benchPrototypeSevenChannelAnalog.channels.flatMap((channel) =>
  cellReferenceBindings.map((binding) =>
    createCellRecord(
      channel.chainIndex,
      channel.conductor,
      channel.connectorNet,
      binding,
      channel.references[binding.key as CellReferenceKey]
    )
  )
)

const connectorRecord = createConnectorRecord()

const connectorClosure = {
  boardReference: benchPrototypeFixtureHarness.connector.boardReference,
  harnessReference: benchPrototypeFixtureHarness.connector.bomReference,
  header: {
    manufacturer: benchPrototypeFixtureHarness.connector.header.manufacturer,
    mpn: benchPrototypeFixtureHarness.connector.header.mpn,
    package: benchPrototypeFixtureHarness.connector.header.family,
    positions: benchPrototypeFixtureHarness.connector.header.positions,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/43045-1200"
  },
  mate: {
    manufacturer: benchPrototypeFixtureHarness.connector.mate.manufacturer,
    mpn: benchPrototypeFixtureHarness.connector.mate.mpn,
    package: benchPrototypeFixtureHarness.connector.mate.family,
    positions: benchPrototypeFixtureHarness.connector.mate.positions,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/0430251200"
  },
  terminal: {
    manufacturer: "Molex",
    mpn: benchPrototypeFixtureHarness.connector.mate.terminalMpn,
    package: benchPrototypeFixtureHarness.connector.mate.terminalForm,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/430300007"
  },
  pinMap: structuredClone(benchPrototypeFixtureHarness.connector.pinMap),
  continuityMap: structuredClone(benchPrototypeFixtureHarness.connector.continuityMap),
  populatedBoardPins: [1, 2, 3, 4, 5, 6, 7],
  unpopulatedBoardPins: [8, 9, 10, 11, 12],
  orientationRule:
    "Circuit 1 and the polarized latch/lock must be established from the manufacturer drawing; an independent fixture stop remains mandatory.",
  releaseState: "deny" as const
}

const upstreamSnapshot = deepFreeze({
  bp030: {
    artifactKind: benchPrototypeFootprintReviewTemplate.artifactKind,
    methodId: benchPrototypeFootprintReviewTemplate.methodId,
    bomArtifactKind: benchPrototypeFootprintReviewTemplate.bomArtifactKind,
    releaseState: benchPrototypeFootprintReviewTemplate.releaseState,
    recordCount: benchPrototypeFootprintReviewTemplate.records.length
  },
  bp103: {
    channelOrder: structuredClone(benchPrototypeSevenChannelAnalog.channelOrder),
    channels: structuredClone(
      benchPrototypeSevenChannelAnalog.channels.map((channel) => ({
        chainIndex: channel.chainIndex,
        conductor: channel.conductor,
        connectorNet: channel.connectorNet,
        references: channel.references
      }))
    ),
    cellIdentity: structuredClone(benchPrototypeSevenChannelAnalog.cellIdentity)
  },
  bp104: {
    boardReference: benchPrototypeFixtureHarness.connector.boardReference,
    bomReference: benchPrototypeFixtureHarness.connector.bomReference,
    header: structuredClone(benchPrototypeFixtureHarness.connector.header),
    mate: structuredClone(benchPrototypeFixtureHarness.connector.mate),
    pinMap: structuredClone(benchPrototypeFixtureHarness.connector.pinMap)
  },
  sourceParts: structuredClone(
    cellReferenceBindings.map((binding) => ({
      reference: binding.baseReference,
      part: findUniqueSourcePart(binding.baseReference)
    }))
  ),
  m404SharedManufacturerSources: structuredClone(sharedManufacturerSources)
})

function liveUpstreamSnapshot() {
  return {
    bp030: {
      artifactKind: benchPrototypeFootprintReviewTemplate.artifactKind,
      methodId: benchPrototypeFootprintReviewTemplate.methodId,
      bomArtifactKind: benchPrototypeFootprintReviewTemplate.bomArtifactKind,
      releaseState: benchPrototypeFootprintReviewTemplate.releaseState,
      recordCount: benchPrototypeFootprintReviewTemplate.records.length
    },
    bp103: {
      channelOrder: benchPrototypeSevenChannelAnalog.channelOrder,
      channels: benchPrototypeSevenChannelAnalog.channels.map((channel) => ({
        chainIndex: channel.chainIndex,
        conductor: channel.conductor,
        connectorNet: channel.connectorNet,
        references: channel.references
      })),
      cellIdentity: benchPrototypeSevenChannelAnalog.cellIdentity
    },
    bp104: {
      boardReference: benchPrototypeFixtureHarness.connector.boardReference,
      bomReference: benchPrototypeFixtureHarness.connector.bomReference,
      header: benchPrototypeFixtureHarness.connector.header,
      mate: benchPrototypeFixtureHarness.connector.mate,
      pinMap: benchPrototypeFixtureHarness.connector.pinMap
    },
    sourceParts: cellReferenceBindings.map((binding) => ({
      reference: binding.baseReference,
      part: findUniqueSourcePart(binding.baseReference)
    })),
    m404SharedManufacturerSources: sharedManufacturerSourcesFor(
      cellReferenceBindings.map((binding) => findUniqueSourcePart(binding.baseReference))
    )
  }
}

const definition = {
  artifactKind: "bench-prototype-analog-footprint-closure",
  workUnit: "BP-031",
  targetAssembly: "one-board bench prototype",
  methodId: "BP-030",
  upstream: {
    baselineFootprintReview: "BP-030",
    sevenChannelAnalog: "BP-103",
    weaponFixtureHarness: "BP-104",
    sharedManufacturerSources: "M4-04"
  },
  scope: {
    replicatedCellCount: expectedReplicatedCellCount,
    referencesPerReplicatedCell: expectedCellReferenceCount,
    replicatedCellRecordCount: expectedReplicatedCellRecordCount,
    connectorRecordCount: expectedConnectorRecordCount,
    totalRecordCount: expectedTotalRecordCount,
    sharedManufacturerSourceCount: expectedSharedManufacturerSourceCount,
    sharedSourceLinkedRecordCount: expectedSharedSourceLinkedRecordCount,
    sharedSourceUnresolvedRecordCount: expectedSharedSourceUnresolvedRecordCount,
    closedFootprintCount: 0,
    deniedUnresolvedFootprintCount: expectedTotalRecordCount,
    rule: "Exact identity may be carried forward; no geometry or placement permission is carried forward without independent evidence."
  },
  records: [...records, connectorRecord],
  reviewEvidenceMappings: [
    tpd4e05u06ReviewEvidenceMapping,
    tmux1112PwrPwReviewEvidenceMapping,
    ads8881IdgsDgsReviewEvidenceMapping,
    ada4177ReviewEvidenceMapping
  ],
  sharedManufacturerSources,
  connectorClosure,
  authority: {
    identityReconciled: true,
    manufacturerDrawingEvidenceReviewed: false,
    manufacturerCadEvidenceReviewed: false,
    artworkEvidenceReviewed: false,
    orientationEvidenceReviewed: false,
    footprintClosureAuthorized: false,
    schematicIntegrationAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny" as const
  },
  openGates: [
    "For every record without a shared source record, acquire the exact manufacturer package drawing and record its revision and SHA-256 without substituting a family or generic footprint.",
    "For every M4-04 source record, review its exact or explicitly series-only scope against the seven-channel reference before treating it as BP-031 manufacturer-drawing evidence.",
    "For every record, acquire the exact manufacturer CAD object or explicitly document that no CAD is published; do not infer pads, courtyard, paste, or mask geometry from package prose.",
    "Generate and hash one project artwork object per exact reference only after the drawing/CAD comparison; independently overlay pad mapping, pin one or polarity, orientation, edge clearance, courtyard, and assembly constraints.",
    "Reconcile all seven channel copies, every C0603C102J5GACTU SAR capacitor, the reference loops, and the 43045-1200 connector against one schematic revision before BP-035.",
    "Keep every record DNP-unresolved and keep footprint, schematic integration, layout, and fabrication authority denied until all four evidence classes are independently reviewed."
  ],
  sources: [
    { title: "BP-030 footprint evidence method", url: "src/bench-prototype-footprint-review.ts" },
    { title: "BP-103 seven-channel analog architecture", url: "src/bench-prototype-seven-channel-analog.ts" },
    { title: "BP-104 weapon fixture harness", url: "src/bench-prototype-fixture-harness.ts" },
    { title: "BP-101 reference drive", url: "src/bench-prototype-reference-drive.ts" },
    { title: "BP-102 fault protection", url: "src/bench-prototype-fault-protection.ts" },
    { title: "M4-04 single-channel source registry", url: "src/m4-04-single-channel-coupon.ts" },
    { title: "Molex 43045-1200", url: "https://www.molex.com/en-us/products/part-detail/43045-1200" },
    { title: "Molex 43025-1200", url: "https://www.molex.com/en-us/products/part-detail/0430251200" },
    { title: "Molex 43030-0007", url: "https://www.molex.com/en-us/products/part-detail/430300007" }
  ]
} as const

export const benchPrototypeAnalogFootprintClosure = deepFreeze(definition)
export const benchPrototypeAnalogFootprintClosureUpstreamSnapshot = upstreamSnapshot

function assertUpstreamContracts(): void {
  validateBenchPrototypeFootprintReview(benchPrototypeFootprintReviewTemplate)
  validateBenchPrototypeSevenChannelAnalog(benchPrototypeSevenChannelAnalog)
  validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)
  validateM404SingleChannelCoupon(M404_SINGLE_CHANNEL_COUPON)
  if (validateBp031Tpd4e05u06DqaProjectFootprint().length !== 0) {
    throw new RangeError("BP-031 TPD4E05U06DQAR project-review candidate drifted")
  }
  if (validateBp031Tmux1112PwrPwFootprintEvidence().length !== 0) {
    throw new RangeError("BP-031 TMUX1112PWR project-review candidate drifted")
  }
  if (validateBp031Ads8881IdgsDgsFootprintCandidate().length !== 0) {
    throw new RangeError("BP-031 ADS8881IDGS project-review candidate drifted")
  }
  if (validateBp031Ada4177R8FootprintEvidence().length !== 0) {
    throw new RangeError("BP-031 ADA4177-1ARZ R-8 project-review candidate drifted")
  }
  if (!sameDataGraph(liveUpstreamSnapshot(), upstreamSnapshot)) {
    throw new RangeError("BP-030, BP-103, BP-104, M4-04, or analog source-part evidence drifted")
  }
}

export function validateBenchPrototypeAnalogFootprintClosure(value: unknown): true {
  assertUpstreamContracts()
  if (!sameDataGraph(value, benchPrototypeAnalogFootprintClosure)) {
    throw new RangeError("BP-031 footprint ledger must exactly match the reviewed deny-by-default contract")
  }

  const contract = benchPrototypeAnalogFootprintClosure
  const cellRecords = contract.records.filter((record) => record.sourceContract === "BP-103")
  const connectorRecords = contract.records.filter((record) => record.sourceContract === "BP-104")
  const tpd4e05u06Mapping = contract.reviewEvidenceMappings.find(
    (mapping) => mapping.mappingId === tpd4e05u06ReviewEvidenceMappingId
  )
  const tmux1112PwrPwMapping = contract.reviewEvidenceMappings.find(
    (mapping) => mapping.mappingId === tmux1112PwrPwReviewEvidenceMappingId
  )
  const ads8881IdgsDgsMapping = contract.reviewEvidenceMappings.find(
    (mapping) => mapping.mappingId === ads8881IdgsDgsReviewEvidenceMappingId
  )
  const ada4177Mapping = contract.reviewEvidenceMappings.find(
    (mapping) => mapping.mappingId === ada4177ReviewEvidenceMappingId
  )
  const expectedTpd4e05u06Mapping = createTpd4e05u06ReviewEvidenceMapping()
  const expectedTmux1112PwrPwMapping = createTmux1112PwrPwReviewEvidenceMapping()
  const expectedAds8881IdgsDgsMapping = createAds8881IdgsDgsReviewEvidenceMapping()
  const expectedAda4177Mapping = createAda4177ReviewEvidenceMapping()
  const mappedTpd4e05u06Records = cellRecords.filter(
    (record) => record.reviewEvidenceMappingId === tpd4e05u06ReviewEvidenceMappingId
  )
  const mappedTmux1112PwrPwRecords = cellRecords.filter(
    (record) => record.reviewEvidenceMappingId === tmux1112PwrPwReviewEvidenceMappingId
  )
  const mappedAds8881IdgsDgsRecords = cellRecords.filter(
    (record) => record.reviewEvidenceMappingId === ads8881IdgsDgsReviewEvidenceMappingId
  )
  const mappedAda4177Records = cellRecords.filter(
    (record) => record.reviewEvidenceMappingId === ada4177ReviewEvidenceMappingId
  )
  if (
    cellReferenceBindings.length !== expectedCellReferenceCount ||
    cellRecords.length !== expectedReplicatedCellRecordCount ||
    connectorRecords.length !== expectedConnectorRecordCount ||
    contract.scope.replicatedCellCount !== expectedReplicatedCellCount ||
    contract.scope.referencesPerReplicatedCell !== expectedCellReferenceCount ||
    contract.scope.replicatedCellRecordCount !== expectedReplicatedCellRecordCount ||
    contract.scope.connectorRecordCount !== expectedConnectorRecordCount ||
    contract.scope.totalRecordCount !== expectedTotalRecordCount ||
    contract.scope.totalRecordCount !== contract.records.length ||
    contract.scope.sharedManufacturerSourceCount !== expectedSharedManufacturerSourceCount ||
    contract.scope.sharedSourceLinkedRecordCount !== expectedSharedSourceLinkedRecordCount ||
    contract.scope.sharedSourceUnresolvedRecordCount !== expectedSharedSourceUnresolvedRecordCount ||
    contract.scope.closedFootprintCount !== 0 ||
    contract.scope.deniedUnresolvedFootprintCount !== contract.records.length ||
    contract.authority.footprintClosureAuthorized ||
    contract.authority.schematicIntegrationAuthorized ||
    contract.authority.fabricationAuthorized ||
    contract.authority.releaseState !== "deny" ||
    contract.connectorClosure.releaseState !== "deny" ||
    contract.reviewEvidenceMappings.length !== 4 ||
    tpd4e05u06Mapping === undefined ||
    tmux1112PwrPwMapping === undefined ||
    ads8881IdgsDgsMapping === undefined ||
    ada4177Mapping === undefined ||
    !sameDataGraph(tpd4e05u06Mapping, expectedTpd4e05u06Mapping) ||
    !sameDataGraph(tmux1112PwrPwMapping, expectedTmux1112PwrPwMapping) ||
    !sameDataGraph(ads8881IdgsDgsMapping, expectedAds8881IdgsDgsMapping) ||
    !sameDataGraph(ada4177Mapping, expectedAda4177Mapping) ||
    mappedTpd4e05u06Records.length !== 7 ||
    mappedTmux1112PwrPwRecords.length !== 7 ||
    mappedAds8881IdgsDgsRecords.length !== 7 ||
    mappedAda4177Records.length !== 7 ||
    !sameDataGraph(
      mappedTpd4e05u06Records.map((record) => record.reference),
      expectedTpd4e05u06Mapping.affectedReferences
    ) ||
    !sameDataGraph(
      mappedTmux1112PwrPwRecords.map((record) => record.reference),
      expectedTmux1112PwrPwMapping.affectedReferences
    ) ||
    !sameDataGraph(
      mappedAds8881IdgsDgsRecords.map((record) => record.reference),
      expectedAds8881IdgsDgsMapping.affectedReferences
    ) ||
    !sameDataGraph(
      mappedAda4177Records.map((record) => record.reference),
      expectedAda4177Mapping.affectedReferences
    ) ||
    cellRecords.some(
      (record) =>
        (record.sourceBaseReference === "U_ESD") !==
        (record.reviewEvidenceMappingId === tpd4e05u06ReviewEvidenceMappingId)
    ) ||
    cellRecords.some(
      (record) =>
        (record.sourceBaseReference === "U_SOURCE_SWITCH") !==
        (record.reviewEvidenceMappingId === tmux1112PwrPwReviewEvidenceMappingId)
    ) ||
    cellRecords.some(
      (record) =>
        (record.sourceBaseReference === "U_SAR") !==
        (record.reviewEvidenceMappingId === ads8881IdgsDgsReviewEvidenceMappingId)
    ) ||
    cellRecords.some(
      (record) =>
        (record.sourceBaseReference === "U_OVP_BUFFER") !==
        (record.reviewEvidenceMappingId === ada4177ReviewEvidenceMappingId)
    ) ||
    contract.records.some(
      (record) =>
        record.sourceBaseReference !== "U_ESD" &&
        record.sourceBaseReference !== "U_SOURCE_SWITCH" &&
        record.sourceBaseReference !== "U_SAR" &&
        record.sourceBaseReference !== "U_OVP_BUFFER" &&
        record.reviewEvidenceMappingId !== null
    ) ||
    contract.records.some(
      (record) =>
        record.disposition !== "DNP-unresolved" ||
        record.manufacturerDrawing.state !== "not-acquired" ||
        record.manufacturerCad.state !== "not-acquired" ||
        record.artwork.state !== "not-generated" ||
        record.orientation.state !== "unreviewed" ||
        record.existingFootprintEvidence.eligibleForPcb
    )
  ) {
    throw new RangeError("BP-031 must retain complete per-reference evidence denial")
  }

  const sharedSourcesByMpn = new Map(contract.sharedManufacturerSources.map((source) => [source.exactMpn, source]))
  const sharedSourceIds = new Set(contract.sharedManufacturerSources.map((source) => source.sourceId))
  const sourceLinkedRecords = cellRecords.filter((record) => record.sharedManufacturerSourceId !== null)
  if (
    sharedSourcesByMpn.size !== expectedSharedManufacturerSourceCount ||
    sharedSourceIds.size !== expectedSharedManufacturerSourceCount ||
    sourceLinkedRecords.length !== expectedSharedSourceLinkedRecordCount ||
    cellRecords.length - sourceLinkedRecords.length !== expectedSharedSourceUnresolvedRecordCount ||
    contract.sharedManufacturerSources.some(
      (source) =>
        source.sourceId !== `M4-04:${source.exactMpn}` ||
        source.sourceWorkUnit !== "M4-04" ||
        (source.sourceStatus !== "hash-bound" &&
          source.sourceStatus !== "series-hash-bound" &&
          source.sourceStatus !== "identity-hash-bound") ||
        (source.acquisition !== "exact-drawing-hash-bound" &&
          source.acquisition !== "series-drawing-hash-bound" &&
          source.acquisition !== "exact-primary-identity-hash-bound") ||
        source.artifactPath === null ||
        source.sha256 === null ||
        source.geometry !== null ||
        (source.acquisition === "exact-primary-identity-hash-bound"
          ? source.sourceStatus !== "identity-hash-bound" ||
            source.drawingIdentifier !== null ||
            source.drawingUrl !== null ||
            source.identityIdentifier === null ||
            source.identityUrl === null
          : source.sourceStatus === "identity-hash-bound" ||
            source.drawingIdentifier === null ||
            source.drawingUrl === null ||
            source.identityIdentifier !== null ||
            source.identityUrl !== null) ||
        source.reviewStatus !== "not-reviewed-for-bp-031"
    ) ||
    cellRecords.some(
      (record) => record.sharedManufacturerSourceId !== (sharedSourcesByMpn.get(record.exactMpn)?.sourceId ?? null)
    )
  ) {
    throw new RangeError("BP-031 shared M4-04 source provenance must remain exact, centralized, and unreviewed")
  }

  const channelCounts = new Map<number, number>()
  for (const record of cellRecords)
    channelCounts.set(record.channelIndex, (channelCounts.get(record.channelIndex) ?? 0) + 1)
  if (
    channelCounts.size !== 7 ||
    [...channelCounts.values()].some((count) => count !== expectedCellReferenceCount) ||
    !sameDataGraph(
      cellRecords.map((record) => record.conductor).filter((value, index, values) => values.indexOf(value) === index),
      benchPrototypeSevenChannelAnalog.channelOrder
    )
  ) {
    throw new RangeError("BP-031 replicated channel references do not reconcile to BP-103")
  }

  const connector = connectorRecords[0]
  if (
    connector === undefined ||
    connector.reference !== "J_WEAPON_FIXTURE" ||
    connector.exactMpn !== "43045-1200" ||
    contract.connectorClosure.header.mpn !== "43045-1200" ||
    contract.connectorClosure.mate.mpn !== "43025-1200" ||
    contract.connectorClosure.terminal.mpn !== "43030-0007" ||
    contract.connectorClosure.pinMap.length !== 12 ||
    !sameDataGraph(contract.connectorClosure.populatedBoardPins, [1, 2, 3, 4, 5, 6, 7]) ||
    !sameDataGraph(contract.connectorClosure.unpopulatedBoardPins, [8, 9, 10, 11, 12])
  ) {
    throw new RangeError("BP-031 weapon-fixture connector identity or pin map drifted")
  }
  return true
}

validateBenchPrototypeAnalogFootprintClosure(benchPrototypeAnalogFootprintClosure)
