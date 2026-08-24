/**
 * BP-146 source evidence for the Vishay TSOP38438 mechanical interface.
 *
 * This is source evidence, not a PCB library. The Vishay drawing gives the
 * package outline, pin order, lead pitch, and lead limits. It does not give a
 * finished drill or land pattern, a fixed radial copper keepout, or a first-
 * party CAD artifact. Those omissions are recorded explicitly so release
 * cannot acquire fabrication credit by implication.
 */

import { parseCanonicalUtcTimestamp, parseRealUtcDate } from "./bench-prototype-evidence-time.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-146 footprint evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-146 footprint evidence may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const definition = {
  artifactKind: "bp146-tsop38438-footprint-optical-source-evidence",
  workUnit: "BP-146",
  manufacturer: "Vishay Semiconductors",
  receiverMpn: "TSOP38438",
  sources: [
    {
      id: "vishay-82491-tsop38438-datasheet",
      authority: "manufacturer-primary",
      url: "https://www.vishay.com/docs/82491/tsop382.pdf",
      documentNumber: "82491",
      revision: "2.1",
      publishedAt: "2025-05-27",
      reviewedPages: "2, 7",
      sha256: "5F81C36AA02E9901E51C749D03AEE75A23A29B8195B30BF1CBA95F536C865074",
      retrievedAtUtc: "2026-08-24T08:17:00.000Z",
      reviewerId: "implementation-agent",
      reviewedAtUtc: "2026-08-24T08:17:00.000Z",
      reviewStatus: "reviewed",
      reviewScope: "TSOP38438 identity, pin order, package drawing, orientation, and lead geometry"
    },
    {
      id: "vishay-82756-minicast-window-size",
      authority: "manufacturer-primary",
      url: "https://www.vishay.com/docs/82756/windowsizeminicast.pdf",
      documentNumber: "82756",
      revision: "1.0",
      publishedAt: "2016-08-18",
      reviewedPages: "1",
      sha256: "C8A78F338915815E93C5AB4CC98ABF588504CC8B2E4CD3288794660810985BC1",
      retrievedAtUtc: "2026-08-24T08:17:00.000Z",
      reviewerId: "implementation-agent",
      reviewedAtUtc: "2026-08-24T08:17:00.000Z",
      reviewStatus: "reviewed",
      reviewScope: "Minicast front-panel window sizing formula and light-guide recommendation"
    },
    {
      id: "vishay-80068-ir-receiver-assembly",
      authority: "manufacturer-primary",
      url: "https://www.vishay.com/docs/80068/assembly.pdf",
      documentNumber: "80068",
      revision: "1.8",
      publishedAt: "2026-05-20",
      reviewedPages: "1, 2",
      sha256: "8DEE97CE1235CB20794A6CB15BD7364277EAAF6FAE908B32F67E8362962FD1A6",
      retrievedAtUtc: "2026-08-24T08:17:00.000Z",
      reviewerId: "implementation-agent",
      reviewedAtUtc: "2026-08-24T08:17:00.000Z",
      reviewStatus: "reviewed",
      reviewScope: "leaded through-hole assembly and lead-bend constraints"
    }
  ],
  packageGeometry: {
    sourceId: "vishay-82491-tsop38438-datasheet",
    package: "Minicast, leaded through-hole",
    envelopeMm: { width: 5, height: 6.95, depth: 4.8 },
    drawingNumber: "6.550-5263.01-4",
    drawingIssue: "12; 16.04.10",
    drawingDimensions: {
      leadPitchNominal: 2.54,
      leadWidthMaximum: 0.7,
      leadThicknessMaximum: 0.5,
      bodyWidthNominal: 5,
      bodyHeightReference: 6.95,
      bodyHeightTolerance: 0.3,
      bodyDepthNominal: 4.8,
      bodyDepthReference: 2.8,
      notIndicatedTolerance: 0.2
    }
  },
  pinOrientation: {
    sourceId: "vishay-82491-tsop38438-datasheet",
    pinning: [
      { pin: 1, name: "OUT" },
      { pin: 2, name: "GND" },
      { pin: 3, name: "VS" }
    ],
    orientationDatum:
      "Use the Vishay package drawing front view with the optical window facing the intended IR source; pin numbers and lead pitch are source-controlled.",
    opticalAxis: "Normal to the front optical window; do not infer a PCB rotation from the electrical pin order alone."
  },
  throughHoleGeometry: {
    sourceId: "vishay-82491-tsop38438-datasheet",
    mounting: "leaded through-hole",
    leadPitchNominalMm: 2.54,
    leadWidthMaximumMm: 0.7,
    leadThicknessMaximumMm: 0.5,
    drillDiameterMm: null,
    padDiameterMm: null,
    state: "source-reviewed-partial",
    limitation:
      "Vishay specifies lead geometry and pitch but does not specify a finished PCB drill, annular ring, pad diameter, mask, paste, courtyard, or released footprint in the reviewed primary documents."
  },
  landPatternReview: {
    manufacturerSourceStatus: "not-published-in-reviewed-primary-documents",
    boardCadStatus: "not-submitted-for-review",
    exactFootprintReference: null,
    finishedDrillDiameterMm: null,
    padDiameterMm: null,
    courtyardDefined: false,
    pinOneOrientationMatchedToBoardCad: false,
    accepted: false,
    releaseBlocker:
      "A board-CAD footprint, including pin 1 orientation, finished drill, pad, mask, and courtyard, must be reviewed against Vishay drawing 6.550-5263.01-4 before release."
  },
  opticalWindow: {
    sourceId: "vishay-82756-minicast-window-size",
    windowFormula: "a = 4 mm + 2d tan(Phi / 2)",
    minimumWindowSizeAtZeroDistanceMm: 4,
    distanceBetweenLensAndPanelSymbol: "d",
    requiredTotalViewingAngleSymbol: "Phi",
    recommendedLightGuideDiameterMm: 4,
    recommendedLightGuideLengthMinimumMm: 12,
    fixedCopperKeepoutRadiusMm: null,
    fixedComponentKeepoutRadiusMm: null,
    state: "source-reviewed-no-fixed-keepout",
    limitation:
      "Vishay sizes the front-panel window from viewing angle and lens-to-panel distance; it does not publish a fixed PCB copper or component keepout radius."
  },
  opticalKeepoutReview: {
    manufacturerSourceStatus: "window-guidance-only-no-fixed-pcb-keepout",
    projectBoardRule: "3 mm radial copper and component keepout around the lens",
    projectBoardRuleAuthority: "project-rule-not-manufacturer-specification",
    boardCadStatus: "not-submitted-for-review",
    frontPanelCouponStatus: "not-run",
    accepted: false,
    releaseBlocker:
      "Review the board optical aperture and a physical front-panel coupon against the required viewing angle and lens-to-panel distance before release."
  },
  manufacturerCad: {
    sourcePageUrl: "https://www.vishay.com/en/product/82491/",
    state: "not-acquired",
    artifactId: null,
    sha256: null,
    reviewerId: "implementation-agent",
    reviewedAtUtc: "2026-08-24T08:17:00.000Z",
    reviewStatus: "reviewed-not-acquired",
    limitation:
      "The Vishay product page links ECAD downloads to Ultra Librarian, a third-party service. No first-party CAD artifact was acquired or treated as released geometry."
  },
  acceptance: {
    packageDrawingReviewed: true,
    pinOrientationReviewed: true,
    throughHoleGeometryReviewed: true,
    opticalWindowGuidanceReviewed: true,
    manufacturerCadReleased: false,
    boardLandPatternAccepted: false,
    opticalKeepoutAccepted: false,
    footprintReleased: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  review: {
    reviewerId: "implementation-agent",
    reviewedAtUtc: "2026-08-24T08:17:00.000Z",
    reviewStatus: "source-review-only",
    independentApproval: false
  }
} as const

export const benchPrototypeIrReceiverFootprintEvidence = deepFreeze(definition)

export type BenchPrototypeIrReceiverFootprintEvidence = typeof benchPrototypeIrReceiverFootprintEvidence

/** Reject substitutions, invented geometry, missing digests, or approval credit. */
export function validateBenchPrototypeIrReceiverFootprintEvidence(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeIrReceiverFootprintEvidence)) {
    throw new RangeError("BP-146 footprint evidence must exactly match the reviewed Vishay source record")
  }
  const evidence = benchPrototypeIrReceiverFootprintEvidence
  for (const source of evidence.sources) {
    if (
      source.authority !== "manufacturer-primary" ||
      !source.url.startsWith("https://") ||
      !/^[0-9A-F]{64}$/u.test(source.sha256) ||
      parseRealUtcDate(source.publishedAt) === null ||
      parseCanonicalUtcTimestamp(source.retrievedAtUtc) === null ||
      source.reviewerId.trim() === "" ||
      parseCanonicalUtcTimestamp(source.reviewedAtUtc) === null ||
      source.reviewStatus !== "reviewed"
    ) {
      throw new RangeError("BP-146 source evidence requires a primary URL, digest, and reviewer")
    }
  }
  if (parseCanonicalUtcTimestamp(evidence.manufacturerCad.reviewedAtUtc) === null) {
    throw new RangeError("BP-146 manufacturer CAD evidence requires a canonical UTC review timestamp")
  }
  if (parseCanonicalUtcTimestamp(evidence.review.reviewedAtUtc) === null) {
    throw new RangeError("BP-146 review evidence requires a canonical UTC review timestamp")
  }
  if (
    evidence.receiverMpn !== "TSOP38438" ||
    evidence.throughHoleGeometry.drillDiameterMm !== null ||
    evidence.throughHoleGeometry.padDiameterMm !== null ||
    evidence.landPatternReview.manufacturerSourceStatus !== "not-published-in-reviewed-primary-documents" ||
    evidence.landPatternReview.boardCadStatus !== "not-submitted-for-review" ||
    evidence.landPatternReview.exactFootprintReference !== null ||
    evidence.landPatternReview.finishedDrillDiameterMm !== null ||
    evidence.landPatternReview.padDiameterMm !== null ||
    evidence.landPatternReview.courtyardDefined ||
    evidence.landPatternReview.pinOneOrientationMatchedToBoardCad ||
    evidence.landPatternReview.accepted ||
    evidence.opticalWindow.fixedCopperKeepoutRadiusMm !== null ||
    evidence.opticalWindow.fixedComponentKeepoutRadiusMm !== null ||
    evidence.opticalKeepoutReview.manufacturerSourceStatus !== "window-guidance-only-no-fixed-pcb-keepout" ||
    evidence.opticalKeepoutReview.projectBoardRuleAuthority !== "project-rule-not-manufacturer-specification" ||
    evidence.opticalKeepoutReview.boardCadStatus !== "not-submitted-for-review" ||
    evidence.opticalKeepoutReview.frontPanelCouponStatus !== "not-run" ||
    evidence.opticalKeepoutReview.accepted ||
    evidence.manufacturerCad.state !== "not-acquired" ||
    evidence.manufacturerCad.sha256 !== null ||
    evidence.acceptance.manufacturerCadReleased ||
    evidence.acceptance.boardLandPatternAccepted ||
    evidence.acceptance.opticalKeepoutAccepted ||
    evidence.acceptance.footprintReleased ||
    evidence.acceptance.fabricationAuthorized ||
    evidence.acceptance.releaseState !== "deny" ||
    evidence.review.independentApproval
  ) {
    throw new RangeError("BP-146 footprint evidence must fail closed until CAD and layout are accepted")
  }
  return true
}
