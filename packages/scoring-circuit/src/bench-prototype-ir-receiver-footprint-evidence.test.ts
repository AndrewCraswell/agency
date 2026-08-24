import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  calculateBenchPrototypeIrReceiverApertureMm,
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"

function inflatePdfStreams(bytes: Buffer) {
  let decoded = ""
  let cursor = 0
  while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
    const streamStart =
      bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
        ? cursor + 8
        : bytes[cursor + 6] === 10
          ? cursor + 7
          : cursor + 6
    const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
    if (streamEnd < 0) break
    try {
      decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
    } catch {
      // Metadata and uncompressed streams do not need inflation.
    }
    cursor = streamEnd + "endstream".length
  }
  return decoded
}

describe("BP-146 IR receiver footprint source evidence", () => {
  it("accepts the canonical reviewed source record", () => {
    expect(validateBenchPrototypeIrReceiverFootprintEvidence(benchPrototypeIrReceiverFootprintEvidence)).toBe(true)
    expect(benchPrototypeIrReceiverFootprintEvidence.publishedElectricalOpticalCharacteristics).toEqual({
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
    })
  })

  it("keeps exact package geometry separate from series and application guidance", () => {
    expect(benchPrototypeIrReceiverFootprintEvidence.packageGeometry).toMatchObject({
      sourceId: "vishay-82491-tsop38438-datasheet",
      package: "Minicast, leaded through-hole",
      envelopeMm: { width: 5, height: 6.95, depth: 4.8 },
      drawingNumber: "6.550-5263.01-4"
    })
    expect(benchPrototypeIrReceiverFootprintEvidence.pinOrientation).toMatchObject({
      pinning: [
        { pin: 1, name: "OUT" },
        { pin: 2, name: "GND" },
        { pin: 3, name: "VS" }
      ],
      boardCoordinateRotationDegrees: null,
      boardPinOneOrientation: "not-published"
    })
    expect(benchPrototypeIrReceiverFootprintEvidence.seriesApplicationGuidance).toMatchObject({
      series: "TSOP382.., TSOP384..",
      application: "Remote control",
      mounting: "Leaded",
      qualificationState: "series-and-application-guidance-only; not exact board geometry or prototype acceptance"
    })
  })

  it("records retained assembly limits without turning them into a footprint", () => {
    expect(benchPrototypeIrReceiverFootprintEvidence.assemblyGuidance).toEqual({
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
    })
  })

  it("keeps manufacturer land-pattern, drill, board orientation, and PCB keepout claims fail-closed", () => {
    expect(benchPrototypeIrReceiverFootprintEvidence.landPatternReview).toMatchObject({
      manufacturerSourceStatus: "not-published-in-reviewed-primary-documents",
      manufacturerStatement:
        "The retained Vishay sources provide package and lead geometry, not an exact PCB land pattern, finished drill, pad, mask, paste, or courtyard.",
      boardCadStatus: "not-submitted-for-review",
      finishedDrillDiameterMm: null,
      padDiameterMm: null,
      pinOneOrientationMatchedToBoardCad: false,
      accepted: false
    })
    expect(benchPrototypeIrReceiverFootprintEvidence.opticalWindow).toMatchObject({
      sourceId: "vishay-82756-minicast-window-size",
      manufacturerStatement:
        "Vishay sizes the front-panel window for the required total viewing angle and the distance between the lens and panel.",
      windowFormula: "a = 4 mm + 2d tan(Phi / 2)",
      minimumWindowSizeAtZeroDistanceMm: 4,
      recommendedLightGuideDiameterMm: 4,
      recommendedLightGuideLengthMinimumMm: 12,
      fixedCopperKeepoutRadiusMm: null,
      fixedComponentKeepoutRadiusMm: null
    })
    expect(benchPrototypeIrReceiverFootprintEvidence.opticalKeepoutReview).toMatchObject({
      manufacturerSourceStatus: "window-guidance-only-no-fixed-pcb-keepout",
      projectBoardRuleAuthority: "project-rule-not-manufacturer-specification",
      accepted: false
    })
  })

  it("defines the candidate footprint fields without fabricating geometry or overlay evidence", () => {
    expect(benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview).toMatchObject({
      state: "not-submitted",
      exactPart: "TSOP38438",
      finishedGeometry: {
        drillDiameterMm: null,
        padDiameterMm: null,
        annularRingMm: null,
        solderMaskOpeningDiameterMm: null,
        solderMaskExpansionMm: null,
        courtyardClearanceMm: null,
        pasteOpeningDiameterMm: null
      },
      pinOne: {
        boardPinOneOrientation: null,
        boardRotationDegrees: null,
        boardRotationToleranceDegrees: null,
        overlayMatch: false
      },
      lens: {
        boardLensDatum: null,
        boardRotationDegrees: null,
        boardRotationToleranceDegrees: null,
        overlayMatch: false
      },
      manufacturerCad: { state: "not-acquired", sha256: null, authority: "deny" },
      generatedArtwork: { state: "not-generated", generator: null, generatorVersion: null, sha256: null },
      toleranceReview: { status: "pending-project-CAD-and-fabrication-inputs" },
      accepted: false,
      fabricationAuthority: "deny"
    })
    expect(benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview.oneToOneOverlayArtifacts).toEqual([
      {
        kind: "package-drawing-vs-project-footprint",
        scale: "1:1",
        state: "not-generated",
        artifactPath: null,
        generator: null,
        generatorVersion: null,
        sha256: null,
        reviewedBy: null,
        reviewStatus: "pending"
      },
      {
        kind: "package-drawing-vs-project-assembly-overlay",
        scale: "1:1",
        state: "not-generated",
        artifactPath: null,
        generator: null,
        generatorVersion: null,
        sha256: null,
        reviewedBy: null,
        reviewStatus: "pending"
      }
    ])
  })

  it("defines a dimensioned optical coupon procedure with empty evidence and denied gates", () => {
    expect(benchPrototypeIrReceiverFootprintEvidence.opticalCouponReviewProcedure).toMatchObject({
      state: "not-run",
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
        photos: [],
        photoRecordRequirements: ["artifactPath", "sha256", "captureAtUtc", "view", "scaleReference"],
        calibrationRecords: [],
        calibrationRecordRequirements: [
          "instrumentId",
          "calibrationCertificateId",
          "calibrationCertificateSha256",
          "calibrationDueUtc"
        ],
        rawMeasurementArtifactSha256: null,
        reportArtifactSha256: null
      },
      physicalGates: {
        range20m: { passed: false, evidenceStatus: "pending" },
        angle: { passed: false, evidenceStatus: "pending" },
        latency: { passed: false, evidenceStatus: "pending" },
        flood: { passed: false, evidenceStatus: "pending" },
        resetPowerOff: { passed: false, evidenceStatus: "pending" }
      },
      physicalAuthority: "deny",
      accepted: false,
      fabricationAuthority: "deny"
    })
  })

  it("calculates only the retained Vishay aperture formula", () => {
    expect(calculateBenchPrototypeIrReceiverApertureMm(0, 0)).toBe(4)
    expect(calculateBenchPrototypeIrReceiverApertureMm(2, 90)).toBeCloseTo(8)
    expect(() => calculateBenchPrototypeIrReceiverApertureMm(-1, 45)).toThrow(RangeError)
    expect(() => calculateBenchPrototypeIrReceiverApertureMm(1, 180)).toThrow(RangeError)
  })

  it.each([
    ["retrievedAtUtc", "2026-08-24T08:17:00Z"],
    ["retrievedAtUtc", "2026-08-24T08:17:00.000+00:00"],
    ["reviewedAtUtc", "2026-02-30T08:17:00.000Z"]
  ])("rejects a non-canonical source timestamp (%s)", (field, value) => {
    const candidate = structuredClone(benchPrototypeIrReceiverFootprintEvidence)
    Object.defineProperty(candidate.sources[0], field, { value, enumerable: true, writable: true, configurable: true })
    expect(() => validateBenchPrototypeIrReceiverFootprintEvidence(candidate)).toThrow(RangeError)
  })

  it("hash-verifies retained primary PDFs and checks stable source markers", () => {
    const packageRoot = new URL("../", import.meta.url)
    for (const source of benchPrototypeIrReceiverFootprintEvidence.sources) {
      const bytes = readFileSync(new URL(source.retainedArtifactPath, packageRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
      for (const marker of source.byteMarkers) expect(pdfContent).toContain(marker)
    }
  })
})
