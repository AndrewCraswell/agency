import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  calculateBenchPrototypeIrReceiverApertureMm,
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"
import { benchPrototypeIrReceiverProjectFootprintGeometry } from "./bench-prototype-ir-receiver-project-footprint.js"

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
    expect(benchPrototypeIrReceiverFootprintEvidence.throughHoleGeometry).toMatchObject({
      leadPitchNominalMm: 2.54,
      leadWidthMaximumMm: 0.7,
      leadThicknessMaximumMm: 0.5,
      leadDiagonalMaximumMm: 0.8602,
      sourceToleranceRule: "not indicated tolerances ±0.2 mm"
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

  it("defines deterministic project footprint inputs without claiming manufacturer CAD or release", () => {
    expect(benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview).toMatchObject({
      state: "project-footprint-generated-pending-review",
      exactPart: "TSOP38438",
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
        boardPinOneOrientation: "pin-1-at-x0-y0; lead-row-and-lens-face-at-y0; body-extends-positive-y",
        boardRotationDegrees: 0,
        boardRotationToleranceDegrees: 0.1,
        boardCoordinatesMm: { x: 0, y: 0 },
        overlayMatch: false
      },
      lens: {
        boardLensDatum: "lens-face-center-at-x2.5-y0; optical-axis-negative-y",
        boardRotationDegrees: 0,
        boardRotationToleranceDegrees: 0.1,
        boardCoordinatesMm: { x: 2.5, y: 0 },
        overlayMatch: false
      },
      manufacturerCad: { state: "not-acquired", sha256: null, authority: "deny" },
      generatedArtwork: {
        state: "generated-project-review-only",
        generator: "deterministic-svg-overlay-generator",
        generatorVersion: "1.0.0",
        sha256: "5F9662C67CA5144D5ABA88E917EC025DF45E2481A16A10896E6B38728160774A"
      },
      toleranceReview: {
        packageLeadPitchToleranceMm: 0.2,
        status: "project-review-inputs-pending-independent-CAD-review"
      },
      accepted: false,
      fabricationAuthority: "deny"
    })
    expect(benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview.oneToOneOverlayArtifacts).toEqual([
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
    ])
  })

  it("binds the evidence to the source-controlled project footprint artifact", () => {
    const artifact = benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview.projectFootprintArtifact
    expect(artifact).toMatchObject({
      state: "source-controlled-project-review-only",
      artifactPath: "src/bench-prototype-ir-receiver-project-footprint.tsx",
      exportName: "BenchPrototypeIrReceiverProjectFootprint",
      geometryExportName: "benchPrototypeIrReceiverProjectFootprintGeometry",
      componentName: "U_BP146_TSOP38438",
      footprintName: "BP146_TSOP38438_PROJECT_FOOTPRINT",
      gitBlobSha1: "44D776787650030A1622C6356B666F28981673A1",
      sha256: "F8446CC9258EC3C55CF8378C837F4F7EBD08F42F94439AD0F457354FF7F87DC5",
      authority: "deny",
      manufacturerCad: { state: "not-acquired", authority: "deny" }
    })
    expect(artifact.geometry).toEqual(benchPrototypeIrReceiverProjectFootprintGeometry)
    expect(artifact.geometry.manufacturerPartNumber).toBe("TSOP38438")
    expect(artifact.geometry.pins).toEqual([
      { pin: 1, name: "OUT", xMm: 0, yMm: 0 },
      { pin: 2, name: "GND", xMm: 2.54, yMm: 0 },
      { pin: 3, name: "VS", xMm: 5.08, yMm: 0 }
    ])

    const packageRoot = new URL("../", import.meta.url)
    const sourceBytes = readFileSync(new URL(artifact.artifactPath, packageRoot))
    const gitBlobBytes = Buffer.concat([Buffer.from(`blob ${sourceBytes.length}\0`), sourceBytes])
    expect(createHash("sha1").update(gitBlobBytes).digest("hex").toUpperCase()).toBe(artifact.gitBlobSha1)
    expect(createHash("sha256").update(sourceBytes).digest("hex").toUpperCase()).toBe(artifact.sha256)
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

  it("hash-verifies deterministic 1:1 project overlays without granting CAD authority", () => {
    const packageRoot = new URL("../", import.meta.url)
    const overlays = benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview.oneToOneOverlayArtifacts
    for (const overlay of overlays) {
      const bytes = readFileSync(new URL(overlay.artifactPath, packageRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(overlay.sha256)
      expect(bytes.toString("utf8")).toContain("scale 1:1")
      expect(bytes.toString("utf8")).toContain("deterministic-svg-overlay-generator 1.0.0")
      expect(overlay.reviewStatus).toBe("pending")
    }
    const footprintSvg = readFileSync(
      new URL("docs/evidence/bp-146/tsop38438-project-footprint-overlay.svg", packageRoot),
      "utf8"
    )
    const assemblySvg = readFileSync(
      new URL("docs/evidence/bp-146/tsop38438-project-assembly-overlay.svg", packageRoot),
      "utf8"
    )
    expect(footprintSvg).toContain('<rect x="0" y="0" width="5" height="6.95" />')
    expect(assemblySvg).toContain('<rect x="0" y="0" width="5" height="6.95" />')
    expect(assemblySvg).toContain('<line x1="2.5" y1="0" x2="2.5" y2="-3" />')
    expect(assemblySvg).toContain("lens face at y=0")
    expect(assemblySvg).toContain("optical axis points negative y")
    expect(benchPrototypeIrReceiverFootprintEvidence.candidateFootprintReview.manufacturerCad.authority).toBe("deny")
    expect(benchPrototypeIrReceiverFootprintEvidence.acceptance.footprintReleased).toBe(false)
    expect(benchPrototypeIrReceiverFootprintEvidence.opticalCouponReviewProcedure.projectKeepout).toMatchObject({
      copperRadiusMm: 3,
      componentRadiusMm: 3,
      accepted: false
    })
  })
})
