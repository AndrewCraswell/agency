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
import { benchPrototypeIrReceiverProjectFootprintGeometry } from "./bench-prototype-ir-receiver-project-footprint.js"

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

/**
 * Calculate the minimum front-panel aperture from the retained Vishay window
 * guidance. This is a planning calculation only: the canonical procedure
 * deliberately has no measured panel inputs or accepted result.
 */
export function calculateBenchPrototypeIrReceiverApertureMm(
  lensToPanelDistanceMm: number,
  requiredTotalViewingAngleDegrees: number
): number {
  if (
    !Number.isFinite(lensToPanelDistanceMm) ||
    lensToPanelDistanceMm < 0 ||
    !Number.isFinite(requiredTotalViewingAngleDegrees) ||
    requiredTotalViewingAngleDegrees < 0 ||
    requiredTotalViewingAngleDegrees >= 180
  ) {
    throw new RangeError("BP-146 optical aperture inputs must be finite and within the physical formula domain")
  }
  return 4 + 2 * lensToPanelDistanceMm * Math.tan((requiredTotalViewingAngleDegrees * Math.PI) / 360)
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
      retainedArtifactPath: "docs/evidence/bp-146/vishay-82491-tsop382-tsop384-datasheet.pdf",
      byteMarkers: [
        "TSOP384",
        "Pinning",
        "6.550-5263.01-4",
        "Carrier frequency",
        "38 kHz",
        "Supply voltage",
        "Supply current",
        "2.54 nom.",
        "0.7 max.",
        "0.5 max."
      ],
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
      retainedArtifactPath: "docs/evidence/bp-146/vishay-82756-minicast-window-size.pdf",
      byteMarkers: ["Minicast Package", "Window Size", "4 mm", "4 mm +"],
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
      retainedArtifactPath: "docs/evidence/bp-146/vishay-80068-ir-receiver-assembly.pdf",
      byteMarkers: ["80068", "Assembly Instructions", "1.5", "350", "260", "10 s"],
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
    packageDrawingDatum:
      "The Vishay package drawing shows the Minicast lens face as the front optical datum and the three leads in pin order 1, 2, 3.",
    boardCoordinateRotationDegrees: null,
    boardPinOneOrientation: "not-published",
    orientationDatum:
      "Use the Vishay package drawing front view with the optical window facing the intended IR source; pin numbers and lead pitch are source-controlled.",
    opticalAxis: "Normal to the front optical window; do not infer a PCB rotation from the electrical pin order alone."
  },
  publishedElectricalOpticalCharacteristics: {
    sourceId: "vishay-82491-tsop38438-datasheet",
    sourcePages: "2-3",
    carrierFrequencyKHz: 38,
    agcVariant: "AGC4",
    supplyVoltageV: { minimum: 2, maximum: 5.5 },
    supplyCurrentAtVs3V3mA: {
      minimum: 0.25,
      typical: 0.35,
      maximum: 0.45,
      testCondition: "Ev = 0, VS = 3.3 V"
    },
    transmissionDistanceTest: {
      nominalDistanceM: 30,
      testCondition: "Ev = 0, TSAL6200 IR diode, IF = 50 mA, test signal see Fig. 1"
    },
    halfTransmissionAngleDegrees: 45,
    outputDelaySpecification: "7/f0 < td < 13/f0",
    outputDelayTestCondition: "f0 = carrier frequency, test signal see Fig. 1",
    qualificationState:
      "datasheet-characteristics-only; bench range, angle, latency, flood, reset, and power-off evidence required"
  },
  throughHoleGeometry: {
    sourceId: "vishay-82491-tsop38438-datasheet",
    mounting: "leaded through-hole",
    leadPitchNominalMm: 2.54,
    leadWidthMaximumMm: 0.7,
    leadThicknessMaximumMm: 0.5,
    leadDiagonalMaximumMm: 0.8602,
    sourceToleranceRule: "not indicated tolerances ±0.2 mm",
    drillDiameterMm: null,
    padDiameterMm: null,
    state: "source-reviewed-partial",
    limitation:
      "Vishay specifies lead geometry and pitch but does not specify a finished PCB drill, annular ring, pad diameter, mask, paste, courtyard, or released footprint in the reviewed primary documents."
  },
  seriesApplicationGuidance: {
    sourceId: "vishay-82491-tsop38438-datasheet",
    sourcePages: "2, 6",
    series: "TSOP382.., TSOP384..",
    application: "Remote control",
    mounting: "Leaded",
    agc4Selection: "The parts table lists TSOP38438 in the 38 kHz AGC4 column recommended for long burst codes.",
    qualificationState: "series-and-application-guidance-only; not exact board geometry or prototype acceptance"
  },
  assemblyGuidance: {
    sourceId: "vishay-80068-ir-receiver-assembly",
    sourcePages: "1-2",
    scope: "Vishay leaded IR receiver assembly instructions; not a TSOP38438 PCB land pattern",
    leadBendMinimumFromPackageBottomMm: 1.5,
    leadBendForceRule: "During bending, force must not be transmitted from the leads to the package.",
    throughHoleWithoutHolder: {
      ironSoldering: {
        maximumTemperatureC: 350,
        minimumSolderPositionDistanceFromLowerCaseEdgeMm: 2,
        maximumTimePerPinS: 3
      },
      waveSoldering: {
        temperatureC: 260,
        minimumSolderPositionDistanceFromLowerCaseEdgeMm: 1,
        maximumTimeS: 10
      }
    }
  },
  landPatternReview: {
    manufacturerSourceStatus: "not-published-in-reviewed-primary-documents",
    manufacturerStatement:
      "The retained Vishay sources provide package and lead geometry, not an exact PCB land pattern, finished drill, pad, mask, paste, or courtyard.",
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
    manufacturerStatement:
      "Vishay sizes the front-panel window for the required total viewing angle and the distance between the lens and panel.",
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
  candidateFootprintReview: {
    state: "project-footprint-generated-pending-review",
    sourceBasis: [
      "vishay-82491-tsop38438-datasheet",
      "vishay-82756-minicast-window-size",
      "vishay-80068-ir-receiver-assembly"
    ],
    exactPart: "TSOP38438",
    projectFootprintArtifact: {
      state: "source-controlled-project-review-only",
      artifactPath: "src/bench-prototype-ir-receiver-project-footprint.tsx",
      exportName: "BenchPrototypeIrReceiverProjectFootprint",
      geometryExportName: "benchPrototypeIrReceiverProjectFootprintGeometry",
      componentName: "U_BP146_TSOP38438",
      footprintName: "BP146_TSOP38438_PROJECT_FOOTPRINT",
      gitBlobSha1: "44D776787650030A1622C6356B666F28981673A1",
      sha256: "F8446CC9258EC3C55CF8378C837F4F7EBD08F42F94439AD0F457354FF7F87DC5",
      authority: "deny",
      geometry: {
        artifactKind: "bp146-tsop38438-project-footprint",
        workUnit: "BP-146",
        manufacturer: "Vishay Semiconductors",
        manufacturerPartNumber: "TSOP38438",
        manufacturerCad: {
          state: "not-acquired",
          authority: "deny"
        },
        geometryAuthority: "project-review-input-not-manufacturer-specification",
        pinOne: {
          pin: 1,
          name: "OUT",
          coordinatesMm: { x: 0, y: 0 },
          boardRotationDegrees: 0
        },
        pins: [
          { pin: 1, name: "OUT", xMm: 0, yMm: 0 },
          { pin: 2, name: "GND", xMm: 2.54, yMm: 0 },
          { pin: 3, name: "VS", xMm: 5.08, yMm: 0 }
        ],
        pitchMm: 2.54,
        finishedDrillDiameterMm: 1.1,
        copperPadDiameterMm: 2.2,
        copperPadGeometry: {
          representation: "rounded-rectangle-equivalent-to-circle",
          primitive: "circular_hole_with_rect_pad",
          widthMm: 2.2,
          heightMm: 2.2,
          cornerRadiusMm: 1.1,
          status: "runtime-workaround-for-zero-paste"
        },
        solderMaskOpeningDiameterMm: 2.3,
        solderMaskMarginMm: 0.05,
        pasteOpeningDiameterMm: 0,
        lensDatum: {
          source: "front optical window at the Vishay package drawing front face",
          coordinatesMm: { x: 2.5, y: 0 },
          opticalAxis: "negative-y"
        },
        bodyDatum: {
          source: "Vishay Minicast package drawing 6.550-5263.01-4",
          widthMm: 5,
          heightMm: 6.95,
          depthMm: 4.8,
          frontFaceYMm: 0,
          extendsPositiveY: true
        },
        opticalAuthority: "deny",
        physicalAuthority: "deny",
        fabricationAuthority: "deny",
        accepted: false
      },
      manufacturerCad: {
        state: "not-acquired",
        authority: "deny"
      }
    },
    packageDrawingDatum: "front optical window and pin 1 lead order from Vishay drawing 6.550-5263.01-4",
    boardCoordinateDatum:
      "project-origin-at-pin-1-x0-y0; lead-row-and-lens-face-at-y0; body-extends-positive-y; optical-axis-negative-y",
    finishedGeometry: {
      drillDiameterMm: 1.1,
      padDiameterMm: 2.2,
      annularRingMm: 0.55,
      solderMaskOpeningDiameterMm: 2.3,
      solderMaskExpansionMm: 0.05,
      courtyardClearanceMm: 0.55,
      pasteOpeningDiameterMm: 0,
      geometryAuthority: "project-review-input-not-manufacturer-specification",
      minimumFinishedDrillDiameterMm: 1.05,
      maximumLeadDiagonalMm: 0.8602,
      minimumDiametralClearanceMm: 0.15,
      worstCaseDiametralClearanceMm: 0.1898,
      clearanceRule: "minimum finished drill minus maximum lead diagonal must be at least 0.15 mm",
      clearancePasses: true,
      maskWebAtPitchMm: 0.24,
      maskWebRule: "2.54 mm nominal pitch minus 2.30 mm mask opening must be at least 0.20 mm"
    },
    pinOne: {
      sourceDatum: "Vishay package drawing pin 1 OUT lead at the lens-face front view",
      boardPinOneOrientation: "pin-1-at-x0-y0; lead-row-and-lens-face-at-y0; body-extends-positive-y",
      boardRotationDegrees: 0,
      boardRotationToleranceDegrees: 0.1,
      boardCoordinatesMm: { x: 0, y: 0 },
      overlayMatch: false
    },
    lens: {
      sourceDatum: "front optical window is the y=0 lens face; optical axis points toward negative y",
      boardLensDatum: "lens-face-center-at-x2.5-y0; optical-axis-negative-y",
      boardRotationDegrees: 0,
      boardRotationToleranceDegrees: 0.1,
      boardCoordinatesMm: { x: 2.5, y: 0 },
      overlayMatch: false
    },
    manufacturerCad: {
      state: "not-acquired",
      sourceUrl: null,
      revision: null,
      sha256: null,
      authority: "deny"
    },
    generatedArtwork: {
      state: "generated-project-review-only",
      artifactPath: "docs/evidence/bp-146/tsop38438-project-footprint-overlay.svg",
      generator: "deterministic-svg-overlay-generator",
      generatorVersion: "1.0.0",
      sha256: "5F9662C67CA5144D5ABA88E917EC025DF45E2481A16A10896E6B38728160774A",
      authority: "deny"
    },
    oneToOneOverlayArtifacts: [
      {
        kind: "package-drawing-vs-project-footprint",
        scale: "1:1",
        state: "generated-project-review-only",
        artifactPath: "docs/evidence/bp-146/tsop38438-project-footprint-overlay.svg",
        generator: "deterministic-svg-overlay-generator",
        generatorVersion: "1.0.0",
        sha256: "5F9662C67CA5144D5ABA88E917EC025DF45E2481A16A10896E6B38728160774A",
        reviewedBy: null,
        reviewStatus: "pending"
      },
      {
        kind: "package-drawing-vs-project-assembly-overlay",
        scale: "1:1",
        state: "generated-project-review-only",
        artifactPath: "docs/evidence/bp-146/tsop38438-project-assembly-overlay.svg",
        generator: "deterministic-svg-overlay-generator",
        generatorVersion: "1.0.0",
        sha256: "8B54B54ED85F33B67D77AAF3350EE326A549AAB0643BEAE78CCEC95650093A87",
        reviewedBy: null,
        reviewStatus: "pending"
      }
    ],
    toleranceReview: {
      packageLeadPitchToleranceMm: 0.2,
      drillToleranceMm: 0.05,
      padToleranceMm: 0.05,
      boardRotationToleranceDegrees: 0.1,
      courtyardToleranceMm: 0.1,
      status: "project-review-inputs-pending-independent-CAD-review"
    },
    accepted: false,
    fabricationAuthority: "deny",
    releaseBlocker:
      "Submit exact project footprint and board coordinates, populate finished geometry and tolerances, generate hashed 1:1 overlays, and independently review pin one, lens datum, rotation, and clearances."
  },
  opticalCouponReviewProcedure: {
    state: "not-run",
    sourceBasis: "vishay-82756-minicast-window-size",
    formula: "a = 4 mm + 2d tan(Phi / 2)",
    panelInputs: {
      panelMaterial: null,
      panelThicknessMm: null,
      lensToPanelDistanceMm: null,
      requiredTotalViewingAngleDegrees: null,
      apertureWidthMm: null,
      apertureHeightMm: null,
      lightGuideDiameterMm: 4,
      lightGuideLengthMm: null
    },
    apertureCalculation: {
      minimumAtZeroDistanceMm: 4,
      calculatedApertureMm: null,
      status: "pending-dimensioned-panel-inputs"
    },
    projectKeepout: {
      copperRadiusMm: 3,
      componentRadiusMm: 3,
      authority: "project-rule-not-manufacturer-specification",
      accepted: false
    },
    couponEvidence: {
      state: "not-run",
      measuredPanelThicknessMm: null,
      measuredLensToPanelDistanceMm: null,
      measuredApertureWidthMm: null,
      measuredApertureHeightMm: null,
      measuredViewingAngleDegrees: null,
      measurementMethod: null,
      photos: [],
      photoRecordRequirements: ["artifactPath", "sha256", "captureAtUtc", "view", "scaleReference"],
      calibrationRecords: [],
      calibrationRecordRequirements: [
        "instrumentId",
        "calibrationCertificateId",
        "calibrationCertificateSha256",
        "calibrationDueUtc"
      ],
      rawMeasurementArtifactPath: null,
      rawMeasurementArtifactSha256: null,
      reportArtifactPath: null,
      reportArtifactSha256: null,
      reviewerId: null,
      reviewedAtUtc: null
    },
    physicalGates: {
      range20m: {
        passCriteria: "1000/1000 valid authenticated frames at 20 m and 0 degrees; 100/100 at 20 m and +/-15 degrees",
        failCriteria: "any false accepted command, reset, watchdog fault, or unbounded capture",
        passed: false,
        evidenceStatus: "pending"
      },
      angle: {
        passCriteria: "100/100 valid frames at 5 m at 0, +/-30, and +/-45 degrees; record the first failing angle",
        failCriteria: "any angle causes a reset, direct scoring effect, or accepted malformed frame",
        passed: false,
        evidenceStatus: "pending"
      },
      latency: {
        componentCriteria:
          "scope emitter trigger and TP_IR_RX; first output edge must be 184-342 us after a qualifying burst edge",
        systemCriteria:
          "timestamped IR edge to authenticated command event must be <= 50 ms for every valid test frame",
        failCriteria:
          "out-of-range receiver delay, queue starvation, or a command emitted from an unauthenticated frame",
        passed: false,
        evidenceStatus: "pending"
      },
      flood: {
        setup: "30 minutes of 38 kHz carrier/burst noise at the maximum safe optical level plus 40 klx ambient light",
        passCriteria:
          "zero accepted commands, zero reset/watchdog faults, bounded queue occupancy, and automatic recovery within 1 s",
        failCriteria: "any command, queue growth without bound, or receiver path affecting scoring",
        passed: false,
        evidenceStatus: "pending"
      },
      resetPowerOff: {
        passCriteria:
          "100 power cycles and 100 reset cycles; TP_IR_RX is inactive-high or high-impedance within 10 ms of rail validity and no reset is caused by IR",
        failCriteria: "backfeed above APP_3V3 + 0.3 V, strap disturbance, or a reset/watchdog fault",
        passed: false,
        evidenceStatus: "pending"
      }
    },
    physicalAuthority: "deny",
    accepted: false,
    fabricationAuthority: "deny",
    releaseBlocker:
      "Record dimensioned panel inputs, calculated aperture, 1:1 coupon measurements, calibrated instruments, photos, immutable hashes, and all range, angle, timing, flood, and reset/power-off results before acceptance."
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
      !source.retainedArtifactPath.startsWith("docs/evidence/bp-146/") ||
      source.retainedArtifactPath.includes("..") ||
      source.byteMarkers.some((marker) => marker.trim() === "") ||
      parseRealUtcDate(source.publishedAt) === null ||
      parseCanonicalUtcTimestamp(source.retrievedAtUtc) === null ||
      source.reviewerId.trim() === "" ||
      parseCanonicalUtcTimestamp(source.reviewedAtUtc) === null ||
      source.reviewStatus !== "reviewed"
    ) {
      throw new RangeError("BP-146 source evidence requires a primary URL, digest, and reviewer")
    }
  }
  const characteristics = evidence.publishedElectricalOpticalCharacteristics
  if (
    characteristics.sourceId !== "vishay-82491-tsop38438-datasheet" ||
    characteristics.sourcePages !== "2-3" ||
    characteristics.carrierFrequencyKHz !== 38 ||
    characteristics.agcVariant !== "AGC4" ||
    characteristics.supplyVoltageV.minimum !== 2 ||
    characteristics.supplyVoltageV.maximum !== 5.5 ||
    characteristics.supplyCurrentAtVs3V3mA.minimum !== 0.25 ||
    characteristics.supplyCurrentAtVs3V3mA.typical !== 0.35 ||
    characteristics.supplyCurrentAtVs3V3mA.maximum !== 0.45 ||
    characteristics.supplyCurrentAtVs3V3mA.testCondition !== "Ev = 0, VS = 3.3 V" ||
    characteristics.transmissionDistanceTest.nominalDistanceM !== 30 ||
    characteristics.transmissionDistanceTest.testCondition !==
      "Ev = 0, TSAL6200 IR diode, IF = 50 mA, test signal see Fig. 1" ||
    characteristics.halfTransmissionAngleDegrees !== 45 ||
    characteristics.outputDelaySpecification !== "7/f0 < td < 13/f0" ||
    characteristics.outputDelayTestCondition !== "f0 = carrier frequency, test signal see Fig. 1" ||
    characteristics.qualificationState !==
      "datasheet-characteristics-only; bench range, angle, latency, flood, reset, and power-off evidence required"
  ) {
    throw new RangeError("BP-146 published electrical and optical characteristics drifted")
  }
  const orientation = evidence.pinOrientation
  if (
    orientation.sourceId !== "vishay-82491-tsop38438-datasheet" ||
    orientation.packageDrawingDatum !==
      "The Vishay package drawing shows the Minicast lens face as the front optical datum and the three leads in pin order 1, 2, 3." ||
    orientation.boardCoordinateRotationDegrees !== null ||
    orientation.boardPinOneOrientation !== "not-published"
  ) {
    throw new RangeError("BP-146 package orientation evidence drifted")
  }
  const seriesGuidance = evidence.seriesApplicationGuidance
  if (
    seriesGuidance.sourceId !== "vishay-82491-tsop38438-datasheet" ||
    seriesGuidance.sourcePages !== "2, 6" ||
    seriesGuidance.series !== "TSOP382.., TSOP384.." ||
    seriesGuidance.application !== "Remote control" ||
    seriesGuidance.mounting !== "Leaded" ||
    seriesGuidance.agc4Selection !==
      "The parts table lists TSOP38438 in the 38 kHz AGC4 column recommended for long burst codes." ||
    seriesGuidance.qualificationState !==
      "series-and-application-guidance-only; not exact board geometry or prototype acceptance"
  ) {
    throw new RangeError("BP-146 series/application guidance drifted")
  }
  if (
    evidence.throughHoleGeometry.leadPitchNominalMm !== 2.54 ||
    evidence.throughHoleGeometry.leadWidthMaximumMm !== 0.7 ||
    evidence.throughHoleGeometry.leadThicknessMaximumMm !== 0.5 ||
    evidence.throughHoleGeometry.leadDiagonalMaximumMm !== 0.8602 ||
    evidence.throughHoleGeometry.sourceToleranceRule !== "not indicated tolerances ±0.2 mm"
  ) {
    throw new RangeError("BP-146 Vishay lead envelope and tolerance rule drifted")
  }
  const assembly = evidence.assemblyGuidance
  if (
    assembly.sourceId !== "vishay-80068-ir-receiver-assembly" ||
    assembly.sourcePages !== "1-2" ||
    assembly.scope !== "Vishay leaded IR receiver assembly instructions; not a TSOP38438 PCB land pattern" ||
    assembly.leadBendMinimumFromPackageBottomMm !== 1.5 ||
    assembly.leadBendForceRule !== "During bending, force must not be transmitted from the leads to the package." ||
    assembly.throughHoleWithoutHolder.ironSoldering.maximumTemperatureC !== 350 ||
    assembly.throughHoleWithoutHolder.ironSoldering.minimumSolderPositionDistanceFromLowerCaseEdgeMm !== 2 ||
    assembly.throughHoleWithoutHolder.ironSoldering.maximumTimePerPinS !== 3 ||
    assembly.throughHoleWithoutHolder.waveSoldering.temperatureC !== 260 ||
    assembly.throughHoleWithoutHolder.waveSoldering.minimumSolderPositionDistanceFromLowerCaseEdgeMm !== 1 ||
    assembly.throughHoleWithoutHolder.waveSoldering.maximumTimeS !== 10
  ) {
    throw new RangeError("BP-146 assembly guidance drifted")
  }
  if (
    evidence.landPatternReview.manufacturerStatement !==
      "The retained Vishay sources provide package and lead geometry, not an exact PCB land pattern, finished drill, pad, mask, paste, or courtyard." ||
    evidence.opticalWindow.manufacturerStatement !==
      "Vishay sizes the front-panel window for the required total viewing angle and the distance between the lens and panel."
  ) {
    throw new RangeError("BP-146 manufacturer land-pattern and window statements drifted")
  }
  const candidate = evidence.candidateFootprintReview
  const projectFootprintArtifact = candidate.projectFootprintArtifact
  if (
    candidate.state !== "project-footprint-generated-pending-review" ||
    candidate.exactPart !== "TSOP38438" ||
    candidate.sourceBasis.length !== 3 ||
    projectFootprintArtifact.state !== "source-controlled-project-review-only" ||
    projectFootprintArtifact.artifactPath !== "src/bench-prototype-ir-receiver-project-footprint.tsx" ||
    projectFootprintArtifact.exportName !== "BenchPrototypeIrReceiverProjectFootprint" ||
    projectFootprintArtifact.geometryExportName !== "benchPrototypeIrReceiverProjectFootprintGeometry" ||
    projectFootprintArtifact.componentName !== "U_BP146_TSOP38438" ||
    projectFootprintArtifact.footprintName !== "BP146_TSOP38438_PROJECT_FOOTPRINT" ||
    projectFootprintArtifact.gitBlobSha1 !== "44D776787650030A1622C6356B666F28981673A1" ||
    projectFootprintArtifact.sha256 !== "F8446CC9258EC3C55CF8378C837F4F7EBD08F42F94439AD0F457354FF7F87DC5" ||
    projectFootprintArtifact.authority !== "deny" ||
    projectFootprintArtifact.manufacturerCad.state !== "not-acquired" ||
    projectFootprintArtifact.manufacturerCad.authority !== "deny" ||
    !sameDataGraph(projectFootprintArtifact.geometry, benchPrototypeIrReceiverProjectFootprintGeometry) ||
    candidate.finishedGeometry.drillDiameterMm !== 1.1 ||
    candidate.finishedGeometry.padDiameterMm !== 2.2 ||
    candidate.finishedGeometry.annularRingMm !== 0.55 ||
    candidate.finishedGeometry.solderMaskOpeningDiameterMm !== 2.3 ||
    candidate.finishedGeometry.solderMaskExpansionMm !== 0.05 ||
    candidate.finishedGeometry.courtyardClearanceMm !== 0.55 ||
    candidate.finishedGeometry.pasteOpeningDiameterMm !== 0 ||
    candidate.finishedGeometry.geometryAuthority !== "project-review-input-not-manufacturer-specification" ||
    candidate.finishedGeometry.minimumFinishedDrillDiameterMm !== 1.05 ||
    candidate.finishedGeometry.maximumLeadDiagonalMm !== 0.8602 ||
    candidate.finishedGeometry.minimumDiametralClearanceMm !== 0.15 ||
    candidate.finishedGeometry.worstCaseDiametralClearanceMm !== 0.1898 ||
    candidate.finishedGeometry.clearanceRule !==
      "minimum finished drill minus maximum lead diagonal must be at least 0.15 mm" ||
    candidate.finishedGeometry.clearancePasses !== true ||
    candidate.finishedGeometry.maskWebAtPitchMm !== 0.24 ||
    candidate.finishedGeometry.maskWebRule !==
      "2.54 mm nominal pitch minus 2.30 mm mask opening must be at least 0.20 mm" ||
    candidate.pinOne.boardPinOneOrientation !==
      "pin-1-at-x0-y0; lead-row-and-lens-face-at-y0; body-extends-positive-y" ||
    candidate.pinOne.boardRotationDegrees !== 0 ||
    candidate.pinOne.boardRotationToleranceDegrees !== 0.1 ||
    candidate.pinOne.boardCoordinatesMm.x !== 0 ||
    candidate.pinOne.boardCoordinatesMm.y !== 0 ||
    candidate.pinOne.overlayMatch ||
    candidate.lens.boardLensDatum !== "lens-face-center-at-x2.5-y0; optical-axis-negative-y" ||
    candidate.lens.boardRotationDegrees !== 0 ||
    candidate.lens.boardRotationToleranceDegrees !== 0.1 ||
    candidate.lens.boardCoordinatesMm.x !== 2.5 ||
    candidate.lens.boardCoordinatesMm.y !== 0 ||
    candidate.lens.overlayMatch ||
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.sourceUrl !== null ||
    candidate.manufacturerCad.revision !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.generatedArtwork.state !== "generated-project-review-only" ||
    candidate.generatedArtwork.artifactPath !== "docs/evidence/bp-146/tsop38438-project-footprint-overlay.svg" ||
    candidate.generatedArtwork.generator !== "deterministic-svg-overlay-generator" ||
    candidate.generatedArtwork.generatorVersion !== "1.0.0" ||
    candidate.generatedArtwork.sha256 !== "5F9662C67CA5144D5ABA88E917EC025DF45E2481A16A10896E6B38728160774A" ||
    candidate.generatedArtwork.authority !== "deny" ||
    candidate.oneToOneOverlayArtifacts.length !== 2 ||
    candidate.oneToOneOverlayArtifacts.some(
      (artifact) =>
        artifact.scale !== "1:1" ||
        artifact.state !== "generated-project-review-only" ||
        artifact.artifactPath !==
          (artifact.kind === "package-drawing-vs-project-footprint"
            ? "docs/evidence/bp-146/tsop38438-project-footprint-overlay.svg"
            : "docs/evidence/bp-146/tsop38438-project-assembly-overlay.svg") ||
        artifact.generator !== "deterministic-svg-overlay-generator" ||
        artifact.generatorVersion !== "1.0.0" ||
        artifact.sha256 !==
          (artifact.kind === "package-drawing-vs-project-footprint"
            ? "5F9662C67CA5144D5ABA88E917EC025DF45E2481A16A10896E6B38728160774A"
            : "8B54B54ED85F33B67D77AAF3350EE326A549AAB0643BEAE78CCEC95650093A87") ||
        artifact.reviewedBy !== null ||
        artifact.reviewStatus !== "pending"
    ) ||
    candidate.toleranceReview.packageLeadPitchToleranceMm !== 0.2 ||
    candidate.toleranceReview.drillToleranceMm !== 0.05 ||
    candidate.toleranceReview.padToleranceMm !== 0.05 ||
    candidate.toleranceReview.boardRotationToleranceDegrees !== 0.1 ||
    candidate.toleranceReview.courtyardToleranceMm !== 0.1 ||
    candidate.toleranceReview.status !== "project-review-inputs-pending-independent-CAD-review" ||
    candidate.accepted ||
    candidate.fabricationAuthority !== "deny" ||
    evidence.opticalCouponReviewProcedure.state !== "not-run" ||
    evidence.opticalCouponReviewProcedure.panelInputs.panelMaterial !== null ||
    evidence.opticalCouponReviewProcedure.panelInputs.panelThicknessMm !== null ||
    evidence.opticalCouponReviewProcedure.panelInputs.lensToPanelDistanceMm !== null ||
    evidence.opticalCouponReviewProcedure.panelInputs.requiredTotalViewingAngleDegrees !== null ||
    evidence.opticalCouponReviewProcedure.panelInputs.apertureWidthMm !== null ||
    evidence.opticalCouponReviewProcedure.panelInputs.apertureHeightMm !== null ||
    evidence.opticalCouponReviewProcedure.panelInputs.lightGuideDiameterMm !== 4 ||
    evidence.opticalCouponReviewProcedure.panelInputs.lightGuideLengthMm !== null ||
    evidence.opticalCouponReviewProcedure.apertureCalculation.minimumAtZeroDistanceMm !== 4 ||
    evidence.opticalCouponReviewProcedure.apertureCalculation.calculatedApertureMm !== null ||
    evidence.opticalCouponReviewProcedure.apertureCalculation.status !== "pending-dimensioned-panel-inputs" ||
    evidence.opticalCouponReviewProcedure.projectKeepout.copperRadiusMm !== 3 ||
    evidence.opticalCouponReviewProcedure.projectKeepout.componentRadiusMm !== 3 ||
    evidence.opticalCouponReviewProcedure.projectKeepout.authority !== "project-rule-not-manufacturer-specification" ||
    evidence.opticalCouponReviewProcedure.projectKeepout.accepted ||
    evidence.opticalCouponReviewProcedure.couponEvidence.state !== "not-run" ||
    evidence.opticalCouponReviewProcedure.couponEvidence.photos.length !== 0 ||
    evidence.opticalCouponReviewProcedure.couponEvidence.calibrationRecords.length !== 0 ||
    evidence.opticalCouponReviewProcedure.couponEvidence.rawMeasurementArtifactPath !== null ||
    evidence.opticalCouponReviewProcedure.couponEvidence.rawMeasurementArtifactSha256 !== null ||
    evidence.opticalCouponReviewProcedure.couponEvidence.reportArtifactPath !== null ||
    evidence.opticalCouponReviewProcedure.couponEvidence.reportArtifactSha256 !== null ||
    evidence.opticalCouponReviewProcedure.couponEvidence.reviewerId !== null ||
    evidence.opticalCouponReviewProcedure.couponEvidence.reviewedAtUtc !== null ||
    Object.values(evidence.opticalCouponReviewProcedure.physicalGates).some(
      (gate) => gate.passed || gate.evidenceStatus !== "pending"
    ) ||
    evidence.opticalCouponReviewProcedure.accepted ||
    evidence.opticalCouponReviewProcedure.physicalAuthority !== "deny" ||
    evidence.opticalCouponReviewProcedure.fabricationAuthority !== "deny"
  ) {
    throw new RangeError("BP-146 candidate footprint and optical coupon reviews must remain pending and denied")
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
