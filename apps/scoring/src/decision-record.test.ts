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

const calibrationCaptureReference = {
  captureId: "calibration-capture-001",
  contentDigest: `sha256:${"92".repeat(32)}`,
  contentFormatRevision: "capture-1",
  firstSequence: 45,
  fromUs: 10_500,
  kind: "calibration-measurements" as const,
  lastSequence: 45,
  sampleCount: 1,
  throughUs: 10_500
}

function record(outcome: DecisionRecordOutcome): DecisionRecord {
  return {
    captureWindow: { firstSequence: 40, fromUs: 10_000, lastSequence: 44, throughUs: 11_000 },
    decisionAtUs: 10_500,
    outcome,
    provenance,
    rawCaptureRefs:
      outcome.disposition === "calibration" ? [...rawCaptureRefs, calibrationCaptureReference] : rawCaptureRefs,
    recordId: "record-001",
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

const uncertaintyOutcome = {
  disposition: "uncertainty",
  effect: "not-qualified",
  lowerBound: 450_000,
  observedAtUs: 10_500,
  signal: { audible: "none", latched: false, visual: "diagnostic" },
  subject: "resistance",
  unit: "milliOhm",
  upperBound: 475_000
} satisfies DecisionRecordOutcome

const identityUncertaintyOutcome = {
  disposition: "uncertainty",
  effect: "unavailable",
  identity: { field: "firmware-identity", observed: null, status: "missing" },
  lowerBound: 0,
  observedAtUs: 10_500,
  signal: { audible: "none", latched: false, visual: "diagnostic" },
  subject: "identity",
  unit: null,
  upperBound: 0
} satisfies DecisionRecordOutcome

// @ts-expect-error Identity uncertainty requires an exact identity comparison.
const identityUncertaintyWithoutComparison: DecisionRecordOutcome = {
  disposition: "uncertainty",
  effect: "unavailable",
  lowerBound: 0,
  observedAtUs: 10_500,
  signal: { audible: "none", latched: false, visual: "diagnostic" },
  subject: "identity",
  unit: null,
  upperBound: 0
}

const resistanceUncertaintyWithIdentity: DecisionRecordOutcome = {
  ...uncertaintyOutcome,
  // @ts-expect-error Non-identity uncertainty cannot carry an identity comparison.
  identity: { field: "firmware-identity", observed: null, status: "missing" }
}

void identityUncertaintyWithoutComparison
void resistanceUncertaintyWithIdentity

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
  uncertaintyOutcome,
  identityUncertaintyOutcome,
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
      expect(restored).not.toBe(original)
      expect(Object.isFrozen(restored)).toBe(true)
      expect(Object.isFrozen(restored.outcome)).toBe(true)
      expect(Object.isFrozen(restored.provenance)).toBe(true)
      expect(Object.isFrozen(restored.rawCaptureRefs)).toBe(true)
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
    expect(() =>
      parseDecisionRecord({
        ...record(uncertaintyOutcome),
        outcome: { ...uncertaintyOutcome, lowerBound: 450_000.5 }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(uncertaintyOutcome),
        outcome: { ...uncertaintyOutcome, upperBound: Number.MAX_SAFE_INTEGER + 1 }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(uncertaintyOutcome),
        outcome: { ...uncertaintyOutcome, unit: "us" }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(identityUncertaintyOutcome),
        outcome: { ...identityUncertaintyOutcome, unit: "none" }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(identityUncertaintyOutcome),
        outcome: { ...identityUncertaintyOutcome, upperBound: 1 }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(uncertaintyOutcome),
        outcome: {
          ...uncertaintyOutcome,
          identity: { field: "firmware-identity", observed: null, status: "missing" }
        }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(identityUncertaintyOutcome),
        outcome: {
          disposition: "uncertainty",
          effect: "unavailable",
          lowerBound: 0,
          observedAtUs: 10_500,
          signal: { audible: "none", latched: false, visual: "diagnostic" },
          subject: "identity",
          unit: null,
          upperBound: 0
        }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      parseDecisionRecord({
        ...record(outcomes[0]!),
        provenance: { ...provenance, firmware: { ...provenance.firmware, identity: "esp32-scoring" } }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() => parseDecisionRecord(record(outcomes.at(-1)!))).not.toThrow()
  })

  it("requires calibration evidence and rejects non-plain, aliased, accessor, and hidden input data", () => {
    const calibration = record(outcomes.at(-1)!)
    expect(() => parseDecisionRecord({ ...calibration, rawCaptureRefs })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )

    const shared = { ...rawCaptureRefs[0]! }
    const duplicate = { ...record(outcomes[0]!), rawCaptureRefs: [shared, shared] }
    expect(() => parseDecisionRecord(duplicate)).toThrow(new TypeError("Unsupported or invalid decision record"))

    const accessor = structuredClone(record(outcomes[0]!))
    Object.defineProperty(accessor, "recordId", { enumerable: true, get: () => "record-001" })
    expect(() => parseDecisionRecord(accessor)).toThrow(new TypeError("Unsupported or invalid decision record"))

    const hidden = structuredClone(record(outcomes[0]!))
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: true })
    expect(() => parseDecisionRecord(hidden)).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() => parseDecisionRecord(new Map())).toThrow(new TypeError("Unsupported or invalid decision record"))
  })
})

it("rejects malformed uncertainty records and exotic capture arrays", () => {
  expect(() => parseDecisionRecord(record({ ...uncertaintyOutcome, observedAtUs: -1 }))).toThrow()
  expect(() =>
    parseDecisionRecord({ ...record(uncertaintyOutcome), outcome: { ...uncertaintyOutcome, effect: "other" } })
  ).toThrow()
  for (const change of [
    (items: readonly unknown[]) => {
      Object.setPrototypeOf(items, {})
    },
    (items: readonly unknown[]) => {
      Object.defineProperty(items, "0", { enumerable: false })
    }
  ]) {
    const value = structuredClone(record(uncertaintyOutcome))
    change(value.rawCaptureRefs)
    expect(() => parseDecisionRecord(value)).toThrow()
  }
  for (const field of ["observed", "status"]) {
    const value = structuredClone(record(identityUncertaintyOutcome))
    if (value.outcome.disposition !== "uncertainty" || value.outcome.subject !== "identity")
      throw new Error("Missing identity outcome")
    Reflect.deleteProperty(value.outcome.identity, field)
    expect(() => parseDecisionRecord(value)).toThrow()
  }
})

it("rejects unknown identity fields and malformed observed identities", () => {
  for (const change of [{ field: "unknown" }, { observed: "" }]) {
    expect(() =>
      parseDecisionRecord({
        ...record(identityUncertaintyOutcome),
        outcome: { ...identityUncertaintyOutcome, identity: { ...identityUncertaintyOutcome.identity, ...change } }
      })
    ).toThrow()
  }
})
