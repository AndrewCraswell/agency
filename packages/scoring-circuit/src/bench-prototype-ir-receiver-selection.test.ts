import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"
import {
  benchPrototypeIrReceiverSelection,
  validateBenchPrototypeIrReceiverSelection
} from "./bench-prototype-ir-receiver-selection.js"

describe("BP-146 encrypted-IR receiver selection", () => {
  it("selects the exact 38 kHz Vishay receiver and keeps release denied", () => {
    expect(validateBenchPrototypeIrReceiverSelection(benchPrototypeIrReceiverSelection)).toBe(true)
    expect(benchPrototypeIrReceiverSelection.receiver).toMatchObject({
      manufacturer: "Vishay Semiconductors",
      mpn: "TSOP38438",
      carrierFrequencyKHz: 38,
      agcVariant: "AGC4, recommended for long-burst codes",
      package: expect.stringContaining("Minicast")
    })
    expect(benchPrototypeIrReceiverSelection.receiver.pinout).toEqual([
      { pin: 1, name: "OUT", electrical: "active-low demodulated output" },
      { pin: 2, name: "GND", net: "APP_GND" },
      { pin: 3, name: "VS", net: "IR_3V3_FILTERED" }
    ])
    expect(benchPrototypeIrReceiverSelection.releaseState).toBe("deny")
  })

  it("binds reviewed Vishay geometry without treating it as released PCB CAD", () => {
    expect(validateBenchPrototypeIrReceiverFootprintEvidence(benchPrototypeIrReceiverFootprintEvidence)).toBe(true)
    expect(benchPrototypeIrReceiverSelection.footprintEvidence).toBe(benchPrototypeIrReceiverFootprintEvidence)
    expect(benchPrototypeIrReceiverSelection.footprintEvidence.packageGeometry).toMatchObject({
      drawingNumber: "6.550-5263.01-4",
      drawingIssue: "12; 16.04.10"
    })
    expect(benchPrototypeIrReceiverSelection.footprintEvidence.pinOrientation.pinning).toEqual([
      { pin: 1, name: "OUT" },
      { pin: 2, name: "GND" },
      { pin: 3, name: "VS" }
    ])
    expect(
      benchPrototypeIrReceiverSelection.footprintEvidence.candidateFootprintReview.projectFootprintArtifact
    ).toMatchObject({
      artifactPath: "src/bench-prototype-ir-receiver-project-footprint.tsx",
      geometryExportName: "benchPrototypeIrReceiverProjectFootprintGeometry",
      gitBlobSha1: "44D776787650030A1622C6356B666F28981673A1",
      sha256: "F8446CC9258EC3C55CF8378C837F4F7EBD08F42F94439AD0F457354FF7F87DC5",
      authority: "deny",
      manufacturerCad: { state: "not-acquired", authority: "deny" }
    })
    expect(
      benchPrototypeIrReceiverSelection.footprintEvidence.candidateFootprintReview.projectFootprintArtifact.geometry
        .pins
    ).toEqual([
      { pin: 1, name: "OUT", xMm: 0, yMm: 0 },
      { pin: 2, name: "GND", xMm: 2.54, yMm: 0 },
      { pin: 3, name: "VS", xMm: 5.08, yMm: 0 }
    ])
    expect(benchPrototypeIrReceiverSelection.footprintEvidence.throughHoleGeometry).toMatchObject({
      leadPitchNominalMm: 2.54,
      leadWidthMaximumMm: 0.7,
      leadThicknessMaximumMm: 0.5,
      drillDiameterMm: null,
      padDiameterMm: null
    })
    expect(benchPrototypeIrReceiverSelection.footprintEvidence.landPatternReview).toMatchObject({
      manufacturerSourceStatus: "not-published-in-reviewed-primary-documents",
      boardCadStatus: "not-submitted-for-review",
      exactFootprintReference: null,
      finishedDrillDiameterMm: null,
      padDiameterMm: null,
      pinOneOrientationMatchedToBoardCad: false,
      accepted: false
    })
    expect(benchPrototypeIrReceiverSelection.footprintEvidence.opticalWindow).toMatchObject({
      windowFormula: "a = 4 mm + 2d tan(Phi / 2)",
      minimumWindowSizeAtZeroDistanceMm: 4,
      fixedCopperKeepoutRadiusMm: null,
      fixedComponentKeepoutRadiusMm: null
    })
    expect(benchPrototypeIrReceiverSelection.footprintEvidence.opticalKeepoutReview).toMatchObject({
      manufacturerSourceStatus: "window-guidance-only-no-fixed-pcb-keepout",
      projectBoardRuleAuthority: "project-rule-not-manufacturer-specification",
      boardCadStatus: "not-submitted-for-review",
      frontPanelCouponStatus: "not-run",
      accepted: false
    })
    expect(benchPrototypeIrReceiverSelection.evidence.opticalKeepoutReviewed).toBe(true)
    expect(benchPrototypeIrReceiverSelection.evidence.opticalKeepoutAccepted).toBe(false)
    expect(benchPrototypeIrReceiverSelection.evidence.manufacturerCadReviewed).toBe(false)
    expect(benchPrototypeIrReceiverSelection.evidence.footprintReleased).toBe(false)
  })

  it("rejects a standalone evidence record with a relaxed source identity", () => {
    const candidate: any = structuredClone(benchPrototypeIrReceiverFootprintEvidence)
    candidate.sources[0].reviewStatus = "reviewed-without-digest"
    expect(() => validateBenchPrototypeIrReceiverFootprintEvidence(candidate)).toThrow(RangeError)
  })

  it("freezes the exact support network, output protection, and probe point", () => {
    expect(benchPrototypeIrReceiverSelection.supportNetwork).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "R_IR_VS", mpn: "RC0603FR-07100RL" }),
        expect.objectContaining({ reference: "C_IR_VS", mpn: "C0603C104K3RACTU" }),
        expect.objectContaining({ reference: "R_IR_OUT", mpn: "RC0603FR-07100RL" }),
        expect.objectContaining({ reference: "R_IR_PULLUP", mpn: "RC0603FR-0710KL" })
      ])
    )
    expect(benchPrototypeIrReceiverSelection.observation.testPoint).toMatchObject({
      reference: "TP_IR_RX",
      manufacturer: "Keystone Electronics",
      mpn: "5001",
      net: "IR_RX_GPIO35"
    })
    expect(benchPrototypeIrReceiverSelection.observation.forbiddenTestPointConnections).toHaveLength(5)
    expect(benchPrototypeIrReceiverSelection.supportNetworkBasis.manufacturerGuidance).toContain(
      "does not prescribe the selected 100 ohm/100 nF values"
    )
    expect(benchPrototypeIrReceiverSelection.supportNetworkBasis.designChoice).toContain("bench-prototype")
  })

  it("records measurable range, angle, latency, flood, and reset gates", () => {
    expect(benchPrototypeIrReceiverSelection.receiver.publishedTimingLimits).toMatchObject({
      outputDelayMinimumUs: 184,
      outputDelayMaximumUs: 342
    })
    expect(benchPrototypeIrReceiverSelection.benchGates.range.setup).toContain("actual representative handheld")
    expect(benchPrototypeIrReceiverSelection.benchGates.range.pass).toContain("1000/1000")
    expect(benchPrototypeIrReceiverSelection.benchGates.range.pass).toContain("20 m and 0 degrees")
    expect(benchPrototypeIrReceiverSelection.benchGates.range.pass).toContain("20 m and +/-15 degrees")
    expect(benchPrototypeIrReceiverSelection.evidence.range20mEvidence).toBe(false)
    expect(benchPrototypeIrReceiverSelection.benchGates.angle.pass).toContain("+/-45")
    expect(benchPrototypeIrReceiverSelection.benchGates.latency.systemGate).toContain("50 ms")
    expect(benchPrototypeIrReceiverSelection.benchGates.flood.pass).toContain("zero accepted commands")
    expect(benchPrototypeIrReceiverSelection.benchGates.resetPowerOff.pass).toContain("100 power cycles")
  })

  it("does not claim that a demodulator provides encrypted security", () => {
    expect(benchPrototypeIrReceiverSelection.securityBoundary).toContain("firmware")
    expect(benchPrototypeIrReceiverSelection.resetPowerOffAndFaultBehavior.stuckOrFlooded).toEqual(
      expect.arrayContaining([expect.stringContaining("authenticated command queue")])
    )
  })

  it("rejects substitutions and any fabrication-evidence relaxation", () => {
    for (const mutate of [
      (candidate: any) => (candidate.receiver.mpn = "TSOP38238"),
      (candidate: any) => (candidate.receiver.carrierFrequencyKHz = 40),
      (candidate: any) => (candidate.receiver.pinout[0].electrical = "active-high"),
      (candidate: any) => (candidate.evidence.range20mEvidence = true),
      (candidate: any) => (candidate.evidence.fabricationAuthorized = true),
      (candidate: any) => (candidate.benchGates.flood.pass = "accept all frames"),
      (candidate: any) => (candidate.footprintEvidence.sources[0].sha256 = "0".repeat(64)),
      (candidate: any) => (candidate.footprintEvidence.sources[1].reviewerId = ""),
      (candidate: any) => (candidate.footprintEvidence.throughHoleGeometry.drillDiameterMm = 1.2),
      (candidate: any) => (candidate.footprintEvidence.landPatternReview.accepted = true),
      (candidate: any) => (candidate.footprintEvidence.landPatternReview.exactFootprintReference = "U_IR_RX"),
      (candidate: any) => (candidate.footprintEvidence.opticalWindow.fixedCopperKeepoutRadiusMm = 3),
      (candidate: any) => (candidate.footprintEvidence.opticalKeepoutReview.accepted = true),
      (candidate: any) => (candidate.footprintEvidence.manufacturerCad.state = "reviewed"),
      (candidate: any) =>
        (candidate.footprintEvidence.candidateFootprintReview.projectFootprintArtifact.geometry.pins[2].name = "VIN"),
      (candidate: any) =>
        (candidate.footprintEvidence.candidateFootprintReview.projectFootprintArtifact.gitBlobSha1 = "0".repeat(40)),
      (candidate: any) => (candidate.evidence.opticalKeepoutAccepted = true)
    ]) {
      const candidate = structuredClone(benchPrototypeIrReceiverSelection)
      mutate(candidate)
      expect(() => validateBenchPrototypeIrReceiverSelection(candidate)).toThrow(RangeError)
    }
    expect(Object.isFrozen(benchPrototypeIrReceiverSelection)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverSelection.receiver)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverSelection.supportNetwork)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverFootprintEvidence)).toBe(true)
  })
})
