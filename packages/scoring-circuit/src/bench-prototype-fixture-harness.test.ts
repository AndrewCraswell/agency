import { describe, expect, it } from "vitest"
import {
  benchPrototypeFixtureHarness,
  benchPrototypeContinuityThresholds,
  evaluateBenchPrototypeContinuityEvidence,
  validateBenchPrototypeFixtureHarness
} from "./bench-prototype-fixture-harness.js"

describe("BP-104 seven-channel fixture harness", () => {
  it("validates the canonical fail-closed harness contract", () => {
    expect(validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)).toBe(true)
  })

  it("freezes the exact Micro-Fit selection and BP-103 conductor order", () => {
    expect(benchPrototypeFixtureHarness.connector.header).toMatchObject({
      manufacturer: "Molex",
      mpn: "43045-1200",
      positions: 12,
      rows: 2,
      pitchMm: 3,
      orientation: "right-angle",
      mounting: "through-hole",
      keyingToMatingPart: "No",
      polarizedToMatingPart: true,
      lockToMatingPart: true
    })
    expect(benchPrototypeFixtureHarness.connector.mate).toMatchObject({
      manufacturer: "Molex",
      mpn: "43025-1200",
      positions: 12,
      rows: 2,
      pitchMm: 3,
      terminalMpn: "43030-0007",
      keyingToMatingPart: "No",
      polarizedToMatingPart: true,
      lockToMatingPart: true
    })
    expect(benchPrototypeFixtureHarness.connector.testPlug).toMatchObject({
      mpn: "44242-0005",
      materialNumber: "442420005",
      positions: 12,
      rows: 2,
      pitchMm: 3,
      keyingToMatingPart: "No",
      polarizedToMatingPart: false,
      lockToMatingPart: true,
      availability: "check-availability",
      sampleEligible: false
    })
    expect(benchPrototypeFixtureHarness.connector.pinMap.map((pin) => pin.signal)).toEqual([
      "LEFT_WEAPON_A",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_C",
      "RIGHT_WEAPON_A",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_C",
      "PISTE",
      "PISTE_RETURN",
      "FIXTURE_RETURN_REVIEW_REQUIRED",
      "ESD_RETURN_REVIEW_REQUIRED",
      "NC",
      "NC"
    ])
    expect(benchPrototypeFixtureHarness.connector.pinMap.slice(0, 7).every((pin) => pin.populated)).toBe(true)
    expect(benchPrototypeFixtureHarness.connector.pinMap.slice(7).every((pin) => !pin.populated)).toBe(true)
  })

  it("keeps return candidates distinct and refuses unsafe shared returns", () => {
    expect(benchPrototypeFixtureHarness.connector.returnPolicy).toMatchObject({
      scoredReturnNet: "SCORING_SGND",
      scoredReturnBondedToConnector: false,
      sharedReturnAllowed: false,
      reviewOnlySignals: ["PISTE_RETURN", "FIXTURE_RETURN_REVIEW_REQUIRED", "ESD_RETURN_REVIEW_REQUIRED"]
    })
    expect(benchPrototypeFixtureHarness.connector.pinMap.slice(7).map((pin) => pin.boardNet)).toEqual([
      null,
      null,
      null,
      null,
      null
    ])
    expect(
      benchPrototypeFixtureHarness.connector.continuityMap.slice(7).every((entry) => entry.expected.startsWith("open;"))
    ).toBe(true)
  })

  it("records labels, orientation, strain relief, and executable miswire checks", () => {
    expect(benchPrototypeFixtureHarness.connector.labels).toMatchObject({
      boardSilkscreen: expect.stringContaining("pin-1"),
      labelRule: expect.stringContaining("named signal")
    })
    expect(benchPrototypeFixtureHarness.connector.matingOrientation).toMatchObject({
      keyingToMatingPart: "No",
      polarizedToMatingPart: true,
      lockToMatingPart: true,
      fixtureStopRequired: true,
      energizedMating: false,
      evidenceStatus: "open"
    })
    expect(benchPrototypeFixtureHarness.connector.sampleFitProcedure).toMatchObject({
      continuityUsesTestPlug: "44242-0005 only",
      status: "unresolved"
    })
    expect(benchPrototypeFixtureHarness.connector.strainRelief).toMatchObject({
      required: true,
      selectionStatus: "open"
    })
    expect(benchPrototypeFixtureHarness.miswireTestPlan).toHaveLength(5)
    expect(benchPrototypeFixtureHarness.miswireTestPlan.map((test) => test.id)).toEqual([
      "BP104-CONT-01",
      "BP104-CONT-02",
      "BP104-MISWIRE-01",
      "BP104-MISWIRE-02",
      "BP104-RETURN-01"
    ])
  })

  it("evaluates reproducible physical continuity evidence and keeps acceptance unresolved without it", () => {
    expect(benchPrototypeFixtureHarness.connector.continuityAcceptance).toMatchObject({
      status: "unresolved",
      testPlugMpn: "44242-0005",
      evaluator: "evaluateBenchPrototypeContinuityEvidence",
      thresholds: benchPrototypeContinuityThresholds
    })
    expect(
      evaluateBenchPrototypeContinuityEvidence({
        artifactKind: "bench-prototype-fixture-continuity-evidence",
        evidenceId: "BP104-EVIDENCE-001",
        status: "not-measured",
        testPlugMpn: "44242-0005"
      })
    ).toMatchObject({ accepted: false })

    const validEvidence = {
      artifactKind: "bench-prototype-fixture-continuity-evidence",
      evidenceId: "BP104-EVIDENCE-002",
      status: "measured",
      recordedAtUtc: "2026-08-23T19:45:00.000Z",
      operator: "bench-operator",
      boardId: "board-001",
      harnessId: "harness-001",
      testPlugMpn: "44242-0005",
      equipment: {
        manufacturer: "Example Instruments",
        model: "4W-1000",
        serialNumber: "SN-001",
        calibrationCertificate: "CAL-001",
        calibrationDueDate: "2027-08-23"
      },
      method: {
        powerState: "off-and-discharged",
        continuityTestVoltageV: 1,
        isolationTestVoltageV: 5,
        leadCompensationMethod: "zeroed-with-same-leads-at-fixture",
        compensatedLeadResidualOhms: 0.05
      },
      endToEnd: [
        "LEFT_WEAPON_A",
        "LEFT_WEAPON_B",
        "LEFT_WEAPON_C",
        "RIGHT_WEAPON_A",
        "RIGHT_WEAPON_B",
        "RIGHT_WEAPON_C",
        "PISTE"
      ].map((signal, index) => ({
        boardPin: index + 1,
        harnessCircuit: index + 1,
        signal,
        resistanceOhms: 0.4
      })),
      isolation: Array.from({ length: 12 }, (_, index) => index + 1).flatMap((boardPinA) =>
        Array.from({ length: 12 - boardPinA }, (_, offset) => ({
          boardPinA,
          boardPinB: boardPinA + offset + 1,
          resistanceOhms: benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms,
          testVoltageV: 5
        }))
      ),
      openCircuitChecks: Array.from({ length: 5 }, (_, index) => ({
        boardPin: index + 8,
        harnessCircuit: index + 8,
        resistanceOhms: benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms
      })),
      negativeTests: [
        { id: "BP104-NEG-SWAP", result: "rejected", observation: "adjacent swap rejected" },
        { id: "BP104-NEG-OPEN", result: "rejected", observation: "open conductor rejected" },
        { id: "BP104-NEG-RETURN-BOND", result: "rejected", observation: "return bond rejected" },
        { id: "BP104-NEG-REVERSED-MATE", result: "rejected", observation: "reversed mate rejected" }
      ]
    }
    expect(evaluateBenchPrototypeContinuityEvidence(validEvidence)).toEqual({ accepted: true, reasons: [] })

    const badEvidence = structuredClone(validEvidence)
    badEvidence.endToEnd[0]!.resistanceOhms = 3
    expect(evaluateBenchPrototypeContinuityEvidence(badEvidence)).toMatchObject({ accepted: false })

    const malformedTimestamp = structuredClone(validEvidence)
    malformedTimestamp.recordedAtUtc = "2026-8-23T19:45:00Z"
    expect(evaluateBenchPrototypeContinuityEvidence(malformedTimestamp)).toMatchObject({ accepted: false })

    const impossibleTimestamp = structuredClone(validEvidence)
    impossibleTimestamp.recordedAtUtc = "2026-02-30T19:45:00.000Z"
    expect(evaluateBenchPrototypeContinuityEvidence(impossibleTimestamp)).toMatchObject({ accepted: false })

    const offsetTimestamp = structuredClone(validEvidence)
    offsetTimestamp.recordedAtUtc = "2026-08-23T19:45:00.000+00:00"
    expect(evaluateBenchPrototypeContinuityEvidence(offsetTimestamp)).toMatchObject({ accepted: false })

    const impossibleCalibrationDate = structuredClone(validEvidence)
    impossibleCalibrationDate.equipment.calibrationDueDate = "2026-02-30"
    expect(evaluateBenchPrototypeContinuityEvidence(impossibleCalibrationDate)).toMatchObject({ accepted: false })

    const expiredCalibration = structuredClone(validEvidence)
    expiredCalibration.equipment.calibrationDueDate = "2026-08-22"
    expect(evaluateBenchPrototypeContinuityEvidence(expiredCalibration)).toMatchObject({ accepted: false })
  })

  it.each([
    [
      "board header",
      (copy: typeof benchPrototypeFixtureHarness) => ((copy.connector.header as { mpn: string }).mpn = "wrong")
    ],
    [
      "mate housing",
      (copy: typeof benchPrototypeFixtureHarness) => ((copy.connector.mate as { mpn: string }).mpn = "wrong")
    ],
    [
      "terminal",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.connector.mate as { terminalMpn: string }).terminalMpn = "wrong")
    ],
    [
      "channel order",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.connector.pinMap[1] as { signal: string }).signal = "LEFT_WEAPON_C")
    ],
    [
      "return isolation",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.connector.returnPolicy as { sharedReturnAllowed: boolean }).sharedReturnAllowed = true)
    ],
    [
      "return disposition",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.connector.pinMap[7] as { disposition: string }).disposition = "scored-conductor")
    ],
    [
      "NC position",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.connector.pinMap[10] as { populated: boolean }).populated = true)
    ],
    [
      "continuity expectation",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.connector.continuityMap[7] as { expected: string }).expected = "short")
    ],
    [
      "release gate",
      (copy: typeof benchPrototypeFixtureHarness) =>
        ((copy.authority as { fabricationAuthorized: boolean }).fabricationAuthorized = true)
    ]
  ])("rejects a changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeFixtureHarness)
    mutate(copy)
    expect(() => validateBenchPrototypeFixtureHarness(copy)).toThrow(RangeError)
  })

  it("rejects incomplete, cyclic, aliased, and accessor graphs", () => {
    expect(() => validateBenchPrototypeFixtureHarness(null)).toThrow(RangeError)
    expect(() => validateBenchPrototypeFixtureHarness({})).toThrow(RangeError)

    const cycle = structuredClone(benchPrototypeFixtureHarness) as { self?: unknown }
    cycle.self = cycle
    expect(() => validateBenchPrototypeFixtureHarness(cycle)).toThrow(RangeError)

    const alias = structuredClone(benchPrototypeFixtureHarness) as {
      connector: { pinMap: unknown; continuityMap: unknown }
    }
    alias.connector.continuityMap = alias.connector.pinMap
    expect(() => validateBenchPrototypeFixtureHarness(alias)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeFixtureHarness)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "deny" })
    expect(() => validateBenchPrototypeFixtureHarness(accessor)).toThrow(RangeError)
  })

  it("keeps the canonical graph immutable and all physical evidence open", () => {
    expect(Object.isFrozen(benchPrototypeFixtureHarness)).toBe(true)
    expect(Object.isFrozen(benchPrototypeFixtureHarness.connector)).toBe(true)
    expect(Object.isFrozen(benchPrototypeFixtureHarness.connector.pinMap)).toBe(true)
    expect(Object.isFrozen(benchPrototypeFixtureHarness.connector.continuityMap)).toBe(true)
    expect(benchPrototypeFixtureHarness.evidence).toMatchObject({
      sampleFit: "open",
      harnessContinuity: "open",
      miswireRejection: "open",
      strainRelief: "open"
    })
    expect(benchPrototypeFixtureHarness.authority).toMatchObject({
      exactSelectionFrozen: true,
      footprintEvidenceApproved: false,
      sampleFitApproved: false,
      continuityVerified: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(benchPrototypeFixtureHarness.fabricationDisposition).toBe("DENY")
  })
})
