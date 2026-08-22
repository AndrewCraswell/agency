import { describe, expect, it } from "vitest"
import {
  DECISION_RECORD_SCHEMA_VERSION,
  parseDecisionRecord,
  type DecisionRecord,
  type DecisionRecordOutcome
} from "./decision-record.js"

const provenance = {
  calibrationProfileRevision: "calibration-1",
  firmware: {
    buildDigest: `sha256:${"7a".repeat(32)}`,
    identity: "stm32-scoring",
    scoringBootId: "boot-008"
  },
  hardwareRevision: "evt-a",
  lineContractRevision: "lines-1",
  ruleSetRevision: "rules-1",
  timingTableRevision: "timing-1"
} as const

const rawCaptureRefs = [
  {
    captureId: "capture-001",
    contentDigest: `sha256:${"91".repeat(32)}`,
    contentFormatRevision: "capture-1",
    firstSequence: 40,
    fromUs: 10_000,
    kind: "acquisition-samples" as const,
    lastSequence: 44,
    sampleCount: 5,
    throughUs: 11_000
  }
]

function record(outcome: DecisionRecordOutcome): DecisionRecord {
  return {
    captureWindow: { firstSequence: 40, fromUs: 10_000, lastSequence: 44, throughUs: 11_000 },
    decisionAtUs: 10_500,
    outcome,
    provenance,
    rawCaptureRefs,
    recordId: "record-001",
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

const outcomes: readonly DecisionRecordOutcome[] = [
  {
    disposition: "qualified-hit",
    hitStartedAtUs: 10_100,
    qualifiedAtUs: 10_500,
    side: "left",
    signal: { audible: "requested", latched: true, visual: "valid-hit" },
    weapon: "epee"
  },
  {
    disposition: "off-target",
    qualifiedAtUs: 10_500,
    side: "right",
    signal: { audible: "requested", latched: true, visual: "off-target" },
    weapon: "foil"
  },
  {
    attemptedAtUs: 10_500,
    attemptedSide: "left",
    disposition: "rejected-contact",
    reason: "grounded-contact",
    signal: { audible: "none", latched: false, visual: "none" },
    weapon: "epee"
  },
  {
    detectedAtUs: 10_500,
    diagnostic: "open-circuit",
    disposition: "line-fault",
    lineId: "line-defined-by-m0-03",
    persistence: "latched-until-reset",
    side: "right",
    signal: { audible: "requested", latched: true, visual: "diagnostic" }
  },
  {
    cause: "operator",
    disposition: "reset",
    resetAtUs: 10_500,
    scope: "scoring-apparatus",
    signal: { audible: "none", latched: false, visual: "none" }
  },
  {
    disposition: "uncertainty",
    effect: "not-qualified",
    lowerBound: 450,
    observedAtUs: 10_500,
    signal: { audible: "none", latched: false, visual: "diagnostic" },
    subject: "resistance",
    unit: "ohm",
    upperBound: 475
  },
  {
    calibrationId: "fixture-run-026",
    disposition: "calibration",
    performedAtUs: 10_500,
    signal: { audible: "none", latched: false, visual: "diagnostic" },
    status: "passed"
  }
]

describe("decision record schema", () => {
  it("round-trips every M0-05 record class without scoring again", () => {
    for (const outcome of outcomes) {
      const original = record(outcome)
      const restored = parseDecisionRecord(JSON.parse(JSON.stringify(original)))

      expect(restored).toEqual(original)
    }
  })

  it("rejects incompatible schema versions and unstable rejection reasons", () => {
    expect(() => parseDecisionRecord({ ...record(outcomes[0]!), schemaVersion: 2 })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() =>
      parseDecisionRecord({
        ...record(outcomes[2]!),
        outcome: { ...outcomes[2]!, reason: "other" }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(outcomes[0]!),
        decisionAtUs: 10_501
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(outcomes[0]!),
        provenance: { ...provenance, firmware: { ...provenance.firmware, buildDigest: "sha256:short" } }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() => parseDecisionRecord({ ...record(outcomes[0]!), provenance: null })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() => parseDecisionRecord({ ...record(outcomes[0]!), outcome: null })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() =>
      parseDecisionRecord({
        ...record(outcomes[0]!),
        outcome: { ...outcomes[0]!, disposition: "future-outcome" }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
  })
})
