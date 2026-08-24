import { describe, expect, it } from "vitest"
import { createApplicationTimeMetadata, type ApplicationTimelineEntry } from "./application-time-metadata.js"
import { DECISION_RECORD_SCHEMA_VERSION, type DecisionRecord } from "./decision-record.js"
import {
  MAX_REPLAY_RENDER_RECORD_BYTES,
  MAX_REPLAY_RENDER_STRING_LENGTH,
  REPLAY_RENDER_SCHEMA_VERSION,
  renderReplayRecord,
  type ReplayRenderInput
} from "./replay-renderer.js"

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

const record: DecisionRecord = {
  captureWindow: { firstSequence: 40, fromUs: 10_000, lastSequence: 44, throughUs: 11_000 },
  decisionAtUs: 10_500,
  outcome: {
    disposition: "qualified-hit",
    hitStartedAtUs: 10_100,
    qualifiedAtUs: 10_500,
    side: "left",
    signal: { audible: "requested", latched: true, visual: "valid-hit" },
    weapon: "epee"
  },
  provenance,
  rawCaptureRefs: [
    {
      captureId: "capture-001",
      contentDigest: `sha256:${"91".repeat(32)}`,
      contentFormatRevision: "capture-1",
      firstSequence: 40,
      fromUs: 10_000,
      kind: "acquisition-samples",
      lastSequence: 44,
      sampleCount: 5,
      throughUs: 11_000
    }
  ],
  recordId: "record-001",
  schemaVersion: DECISION_RECORD_SCHEMA_VERSION
}

const calibrationCaptureReference = {
  captureId: "calibration-capture-001",
  contentDigest: `sha256:${"92".repeat(32)}`,
  contentFormatRevision: "capture-1",
  firstSequence: 44,
  fromUs: 10_500,
  kind: "calibration-measurements" as const,
  lastSequence: 44,
  sampleCount: 1,
  throughUs: 10_500
}

function annotation(): ApplicationTimelineEntry {
  const time = createApplicationTimeMetadata({ applicationBootId: "esp32-boot-a", maximumDriftPpm: 20 })
  time.synchronize({
    anchorId: "rtc-a",
    sampledAtUs: 10_000,
    scoringBootId: "boot-008",
    source: "rtc",
    uncertaintyUs: 40,
    wallClockAtUs: 1_000_000
  })
  return time.observe(record)
}

describe("stored-record replay renderer", () => {
  it("renders an authoritative record without changing STM32 fields", () => {
    const original = structuredClone(record)
    const model = renderReplayRecord({ applicationTime: annotation(), record })

    expect(model.schemaVersion).toBe(REPLAY_RENDER_SCHEMA_VERSION)
    expect(model.record).toEqual(record)
    expect(model.record.decisionAtUs).toBe(record.decisionAtUs)
    expect(model.record.outcome).toEqual(record.outcome)
    expect(model.record.provenance).toEqual(record.provenance)
    expect(model.record.rawCaptureRefs).toEqual(record.rawCaptureRefs)
    expect(model.applicationTime?.wallClock).toMatchObject({ status: "bounded", uncertaintyUs: 41 })
    expect(record).toEqual(original)
    expect(Object.isFrozen(model)).toBe(true)
    expect(Object.isFrozen(model.record)).toBe(true)
    expect(Object.isFrozen(model.record.outcome)).toBe(true)
    expect(Object.isFrozen(model.record.rawCaptureRefs)).toBe(true)
    expect(Object.isFrozen(model.applicationTime)).toBe(true)
  })

  it("clones every authoritative disposition without interpreting it", () => {
    const outcomes: DecisionRecord["outcome"][] = [
      {
        disposition: "qualified-hit",
        hitStartedAtUs: 10_100,
        qualifiedAtUs: 10_500,
        side: "left",
        signal: { audible: "requested", latched: true, visual: "valid-hit" },
        weapon: "epee"
      },
      {
        calibrationId: "fixture-run-026",
        disposition: "calibration",
        performedAtUs: 10_500,
        signal: { audible: "none", latched: false, visual: "diagnostic" },
        status: "passed"
      },
      {
        detectedAtUs: 10_500,
        diagnostic: "open-circuit",
        disposition: "line-fault",
        lineId: "line-defined-by-m0-03",
        persistence: "latched-until-reset",
        side: null,
        signal: { audible: "none", latched: true, visual: "diagnostic" }
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
        cause: "operator",
        disposition: "reset",
        resetAtUs: 10_500,
        scope: "scoring-apparatus",
        signal: { audible: "none", latched: false, visual: "none" }
      },
      {
        disposition: "uncertainty",
        effect: "not-qualified",
        lowerBound: 450_000,
        observedAtUs: 10_500,
        signal: { audible: "none", latched: false, visual: "diagnostic" },
        subject: "resistance",
        unit: "milliOhm",
        upperBound: 475_000
      },
      {
        disposition: "uncertainty",
        effect: "unavailable",
        identity: { field: "firmware-identity", observed: null, status: "missing" },
        lowerBound: 0,
        observedAtUs: 10_500,
        signal: { audible: "none", latched: false, visual: "diagnostic" },
        subject: "identity",
        unit: null,
        upperBound: 0
      }
    ]

    for (const [index, outcome] of outcomes.entries()) {
      const source = {
        ...record,
        outcome,
        rawCaptureRefs:
          outcome.disposition === "calibration"
            ? [...record.rawCaptureRefs, calibrationCaptureReference]
            : record.rawCaptureRefs,
        recordId: `record-disposition-${index}`
      }
      const original = structuredClone(source)
      const rendered = renderReplayRecord({ record: source })
      expect(rendered.record).toEqual(source)
      expect(rendered.record.outcome).toEqual(outcome)
      expect(rendered.record.outcome).not.toBe(outcome)
      expect(source).toEqual(original)
      expect(Object.isFrozen(rendered.record)).toBe(true)
      expect(Object.isFrozen(rendered.record.captureWindow)).toBe(true)
      expect(Object.isFrozen(rendered.record.outcome)).toBe(true)
      expect(Object.isFrozen(rendered.record.outcome.signal)).toBe(true)
      expect(Object.isFrozen(rendered.record.provenance)).toBe(true)
      expect(Object.isFrozen(rendered.record.provenance.firmware)).toBe(true)
      expect(Object.isFrozen(rendered.record.rawCaptureRefs)).toBe(true)
      expect(Object.isFrozen(rendered.record.rawCaptureRefs[0])).toBe(true)
    }
  })

  it("renders equivalent input objects with different source key order", () => {
    const first = renderReplayRecord({ record, applicationTime: annotation() })
    const reordered = JSON.parse(
      JSON.stringify({
        record: {
          schemaVersion: record.schemaVersion,
          recordId: record.recordId,
          rawCaptureRefs: record.rawCaptureRefs,
          provenance: record.provenance,
          outcome: record.outcome,
          decisionAtUs: record.decisionAtUs,
          captureWindow: record.captureWindow
        },
        applicationTime: annotation()
      })
    ) as ReplayRenderInput
    const second = renderReplayRecord(reordered)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.record).not.toBe(record)
  })

  it("renders offline records without inventing application time", () => {
    const model = renderReplayRecord({ record })

    expect(model.applicationTime).toBeNull()
    expect(model.record).toEqual(record)
  })

  it("preserves explicit unavailable application uncertainty", () => {
    const offline = annotation()
    const model = renderReplayRecord({
      record,
      applicationTime: { ...offline, wallClock: { reason: "offline", status: "unavailable" } }
    })

    expect(model.applicationTime?.wallClock).toEqual({ reason: "offline", status: "unavailable" })
  })

  it("fails closed for unknown fields, incompatible records, mismatched metadata, and unsafe shapes", () => {
    expect(() => renderReplayRecord(null as never)).toThrow("plain object")
    expect(() => renderReplayRecord({ record, unexpected: true } as never)).toThrow("missing or unrecognized fields")
    expect(() => renderReplayRecord({ record, applicationTime: undefined })).toThrow("plain object")
    expect(() => renderReplayRecord({ record: { ...record, futureField: true } } as never)).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() =>
      renderReplayRecord({ record: { ...record, outcome: { ...record.outcome, futureDisposition: true } } } as never)
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() => renderReplayRecord({ record: { ...record, schemaVersion: 2 } } as never)).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() =>
      renderReplayRecord({ record, applicationTime: { ...annotation(), decisionRecordId: "other-record" } })
    ).toThrow("identify the rendered record")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: { ...annotation(), monotonic: { decisionAtUs: 10_501, scoringBootId: "boot-008" } }
      } as never)
    ).toThrow("preserve STM32 time")
    expect(() =>
      renderReplayRecord({ record, applicationTime: { ...annotation(), unexpected: true } } as never)
    ).toThrow("missing or unrecognized fields")
    expect(() =>
      renderReplayRecord({
        record: {
          ...record,
          provenance: {
            ...record.provenance,
            firmware: { ...record.provenance.firmware, identity: "x".repeat(MAX_REPLAY_RENDER_STRING_LENGTH + 1) }
          }
        }
      } as never)
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    const accessorInput = { record } as { record: DecisionRecord; applicationTime?: ApplicationTimelineEntry }
    Object.defineProperty(accessorInput, "applicationTime", { enumerable: true, get: () => null })
    expect(() => renderReplayRecord(accessorInput)).toThrow("data values")
    const nestedAccessorRecord = structuredClone(record)
    Object.defineProperty(nestedAccessorRecord.provenance, "firmware", {
      enumerable: true,
      get: () => provenance.firmware
    })
    expect(() => renderReplayRecord({ record: nestedAccessorRecord })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    const symbolInput = { record, [Symbol("extension")]: true }
    expect(() => renderReplayRecord(symbolInput as never)).toThrow("string keys")
  })

  it("delegates malformed authoritative records to the canonical parser", () => {
    const withRawCaptureRefs = (rawCaptureRefs: unknown) =>
      renderReplayRecord({ record: { ...record, rawCaptureRefs } } as never)
    expect(() => withRawCaptureRefs(null)).toThrow(new TypeError("Unsupported or invalid decision record"))
    const wrongPrototype = [...record.rawCaptureRefs]
    Object.setPrototypeOf(wrongPrototype, null)
    expect(() => withRawCaptureRefs(wrongPrototype)).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() => withRawCaptureRefs(Array.from({ length: 9 }, () => record.rawCaptureRefs[0]))).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    const extraArrayField = [...record.rawCaptureRefs] as unknown[] & { extra?: boolean }
    extraArrayField.extra = true
    expect(() => withRawCaptureRefs(extraArrayField)).toThrow(new TypeError("Unsupported or invalid decision record"))
    const hiddenArrayEntry = [...record.rawCaptureRefs]
    Object.defineProperty(hiddenArrayEntry, "0", {
      configurable: true,
      enumerable: false,
      value: record.rawCaptureRefs[0]
    })
    expect(() => withRawCaptureRefs(hiddenArrayEntry)).toThrow(new TypeError("Unsupported or invalid decision record"))
    const accessorArrayEntry = [...record.rawCaptureRefs]
    Object.defineProperty(accessorArrayEntry, "0", {
      configurable: true,
      enumerable: true,
      get: () => record.rawCaptureRefs[0]
    })
    expect(() => withRawCaptureRefs(accessorArrayEntry)).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    const sparseArray: unknown[] = []
    sparseArray.length = 1
    expect(() => withRawCaptureRefs(sparseArray)).toThrow(new TypeError("Unsupported or invalid decision record"))
    const descriptorProxy = new Proxy([...record.rawCaptureRefs], {
      getOwnPropertyDescriptor: () => undefined
    })
    expect(() => withRawCaptureRefs(descriptorProxy)).toThrow(TypeError)

    const withSignal = (signal: unknown) =>
      renderReplayRecord({ record: { ...record, outcome: { ...record.outcome, signal } } } as never)
    expect(() => withSignal({ audible: "future", latched: true, visual: "none" })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() => withSignal({ audible: "none", latched: "future", visual: "none" })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() => withSignal({ audible: "none", latched: false, visual: "future" })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() =>
      renderReplayRecord({ record: { ...record, captureWindow: { ...record.captureWindow, lastSequence: 1 } } })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      renderReplayRecord({ record: { ...record, captureWindow: { ...record.captureWindow, throughUs: 1 } } })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      renderReplayRecord({
        record: {
          ...record,
          provenance: { ...record.provenance, firmware: { ...record.provenance.firmware, buildDigest: "bad" } }
        }
      })
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    const raw = record.rawCaptureRefs[0]!
    expect(() => withRawCaptureRefs([{ ...raw, contentDigest: "bad" }])).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() => withRawCaptureRefs([{ ...raw, lastSequence: 1 }])).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() => withRawCaptureRefs([{ ...raw, throughUs: 1 }])).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() => withRawCaptureRefs([{ ...raw, kind: "future" }])).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(() =>
      renderReplayRecord({ record: { ...record, outcome: { ...record.outcome, disposition: 1 } } } as never)
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      renderReplayRecord({ record: { ...record, outcome: { ...record.outcome, disposition: "future" } } } as never)
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      renderReplayRecord({
        record: {
          ...record,
          outcome: {
            detectedAtUs: 10_500,
            diagnostic: "open-circuit",
            disposition: "line-fault",
            lineId: "line-a",
            persistence: "transient",
            side: "future",
            signal: { audible: "none", latched: false, visual: "diagnostic" }
          }
        }
      } as never)
    ).toThrow(new TypeError("Unsupported or invalid decision record"))
    expect(() =>
      renderReplayRecord({ record, applicationTime: { ...annotation(), applicationSequence: "future" } } as never)
    ).toThrow("safe integer")
    expect(() => renderReplayRecord({ record, applicationTime: { ...annotation(), applicationSequence: -1 } })).toThrow(
      "non-negative"
    )
  })

  it("rejects unknown and structurally invalid wall-clock metadata", () => {
    const base = annotation()
    expect(() =>
      renderReplayRecord({ record, applicationTime: { ...base, wallClock: { status: "future" } } } as never)
    ).toThrow("unknown")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: { ...base.wallClock, lowerBoundUs: 2_000_000, upperBoundUs: 1_000_000 }
        }
      } as never)
    ).toThrow("bounds")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: { ...base, ordering: { ...base.ordering, relationWithinScoringBoot: "future" } }
      } as never)
    ).toThrow("unknown")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          ordering: { ...base.ordering, relationToPreviousApplicationRecord: "future" }
        }
      } as never)
    ).toThrow("unknown")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          ordering: {
            ...base.ordering,
            previousApplicationRecordId: "previous",
            relationToPreviousApplicationRecord: "first"
          }
        }
      } as never)
    ).toThrow("first relation")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          ordering: {
            ...base.ordering,
            previousApplicationRecordId: null,
            relationToPreviousApplicationRecord: "ordered"
          }
        }
      } as never)
    ).toThrow("first relation")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          ordering: { ...base.ordering, previousScoringBootRecordId: "previous", relationWithinScoringBoot: "first" }
        }
      } as never)
    ).toThrow("within-boot first relation")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          ordering: { ...base.ordering, previousScoringBootRecordId: null, relationWithinScoringBoot: "ordered" }
        }
      } as never)
    ).toThrow("within-boot first relation")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: { ...base.wallClock, lowerBoundUs: 1_000_460, upperBoundUs: 1_000_541 }
        }
      } as never)
    ).toThrow("plus or minus uncertainty")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: { ...base.wallClock, correctionFromPreviousUs: 0 }
        }
      } as never)
    ).not.toThrow()
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: { ...base.wallClock, source: "network-time" }
        }
      } as never)
    ).not.toThrow()
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: { ...base.wallClock, source: "future" }
        }
      } as never)
    ).toThrow("source")
    for (const reason of ["anchor-after-decision", "stale-anchor"] as const) {
      expect(() =>
        renderReplayRecord({
          record,
          applicationTime: { ...base, wallClock: { reason, status: "unavailable" } }
        })
      ).not.toThrow()
    }
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: { ...base, wallClock: { reason: "future", status: "unavailable" } }
      } as never)
    ).toThrow("reason")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: { ...base.wallClock, lowerBoundUs: 1_000_459, upperBoundUs: 1_000_542 }
        }
      } as never)
    ).toThrow("plus or minus uncertainty")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: {
            ...base.wallClock,
            estimatedAtUs: Number.MAX_SAFE_INTEGER,
            lowerBoundUs: Number.MAX_SAFE_INTEGER - 1,
            upperBoundUs: Number.MAX_SAFE_INTEGER,
            uncertaintyUs: 1
          }
        }
      } as never)
    ).toThrow("safe integer")
    expect(() =>
      renderReplayRecord({
        record,
        applicationTime: {
          ...base,
          wallClock: {
            ...base.wallClock,
            estimatedAtUs: Number.MIN_SAFE_INTEGER,
            lowerBoundUs: Number.MIN_SAFE_INTEGER,
            upperBoundUs: Number.MIN_SAFE_INTEGER + 1,
            uncertaintyUs: 1
          }
        }
      } as never)
    ).toThrow("safe integer")
  })

  it("rejects overlong bounded fields before exposing a model", () => {
    const oversized = {
      ...record,
      provenance: { ...record.provenance, hardwareRevision: `x${"a".repeat(MAX_REPLAY_RENDER_STRING_LENGTH)}` }
    }
    expect(() => renderReplayRecord({ record: oversized })).toThrow(
      new TypeError("Unsupported or invalid decision record")
    )
    expect(MAX_REPLAY_RENDER_RECORD_BYTES).toBe(65_536)
  })
})
