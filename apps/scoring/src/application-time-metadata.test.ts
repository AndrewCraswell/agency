import { describe, expect, it } from "vitest"
import {
  MAX_APPLICATION_TIME_ANCHORS,
  MAX_APPLICATION_TIME_ENTRIES,
  createApplicationTimeMetadata
} from "./application-time-metadata.js"
import { DECISION_RECORD_SCHEMA_VERSION, type DecisionRecord } from "./decision-record.js"

function record(recordId: string, decisionAtUs: number, scoringBootId = "stm32-boot-a"): DecisionRecord {
  return {
    captureWindow: {
      firstSequence: decisionAtUs,
      fromUs: decisionAtUs,
      lastSequence: decisionAtUs,
      throughUs: decisionAtUs
    },
    decisionAtUs,
    outcome: {
      disposition: "qualified-hit",
      hitStartedAtUs: decisionAtUs,
      qualifiedAtUs: decisionAtUs,
      side: "left",
      signal: { audible: "requested", latched: true, visual: "valid-hit" },
      weapon: "epee"
    },
    provenance: {
      calibrationProfileRevision: "calibration-1",
      firmware: {
        buildDigest: `sha256:${"a1".repeat(32)}`,
        identity: "stm32-scoring",
        scoringBootId
      },
      hardwareRevision: "evt-a",
      lineContractRevision: "lines-1",
      ruleSetRevision: "rules-1",
      timingTableRevision: "timing-1"
    },
    rawCaptureRefs: [],
    recordId,
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

function model() {
  return createApplicationTimeMetadata({
    applicationBootId: "esp32-boot-a",
    maxAnchorAgeUs: 1_000,
    maximumDriftPpm: 20
  })
}

describe("application time metadata", () => {
  it("keeps offline records deterministically ordered by STM32 time without inventing wall time", () => {
    const time = model()
    const first = time.observe(record("record-1", 100))
    const second = time.observe(record("record-2", 200))

    expect(first).toMatchObject({
      applicationBootId: "esp32-boot-a",
      applicationSequence: 0,
      ordering: {
        previousApplicationRecordId: null,
        relationToPreviousApplicationRecord: "first",
        relationWithinScoringBoot: "first"
      },
      wallClock: { reason: "offline", status: "unavailable" }
    })
    expect(second).toMatchObject({
      applicationSequence: 1,
      ordering: {
        previousApplicationRecordId: "record-1",
        relationToPreviousApplicationRecord: "ordered",
        relationWithinScoringBoot: "ordered"
      },
      wallClock: { reason: "offline", status: "unavailable" }
    })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.monotonic)).toBe(true)
    expect(Object.isFrozen(time.timeline)).toBe(true)
  })

  it("uses a declared RTC uncertainty and drift bound rather than assuming clock accuracy", () => {
    const time = model()
    time.synchronize({
      anchorId: "rtc-a",
      sampledAtUs: 100,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 40,
      wallClockAtUs: 1_000_000
    })

    expect(time.observe(record("record-1", 600)).wallClock).toEqual({
      anchorId: "rtc-a",
      correctionFromPreviousUs: null,
      estimatedAtUs: 1_000_500,
      lowerBoundUs: 1_000_459,
      source: "rtc",
      status: "bounded",
      uncertaintyUs: 41,
      upperBoundUs: 1_000_541
    })
  })

  it("records backward and forward network corrections without rewriting older metadata", () => {
    const time = model()
    time.synchronize({
      anchorId: "network-a",
      sampledAtUs: 100,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 10,
      wallClockAtUs: 10_000
    })
    const beforeBackwardCorrection = time.observe(record("record-1", 150))
    const backward = time.synchronize({
      anchorId: "network-b",
      sampledAtUs: 200,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 12,
      wallClockAtUs: 9_900
    })
    const afterBackwardCorrection = time.observe(record("record-2", 250))
    const forward = time.synchronize({
      anchorId: "network-c",
      sampledAtUs: 300,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 15,
      wallClockAtUs: 10_500
    })
    const afterForwardCorrection = time.observe(record("record-3", 350))

    expect(beforeBackwardCorrection.wallClock).toMatchObject({ anchorId: "network-a", estimatedAtUs: 10_050 })
    expect(backward.correctionFromPreviousUs).toBe(-200)
    expect(afterBackwardCorrection.wallClock).toMatchObject({
      anchorId: "network-b",
      correctionFromPreviousUs: -200,
      estimatedAtUs: 9_950
    })
    expect(forward.correctionFromPreviousUs).toBe(500)
    expect(afterForwardCorrection.wallClock).toMatchObject({
      anchorId: "network-c",
      correctionFromPreviousUs: 500,
      estimatedAtUs: 10_550
    })
    expect(time.timeline[0]).toBe(beforeBackwardCorrection)
    expect(beforeBackwardCorrection.wallClock).toMatchObject({ anchorId: "network-a", estimatedAtUs: 10_050 })
  })

  it("marks anchors stale and never applies an anchor that is later than the decision", () => {
    const time = model()
    time.synchronize({
      anchorId: "network-a",
      sampledAtUs: 1_000,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 10,
      wallClockAtUs: 10_000
    })

    expect(time.observe(record("record-before", 900)).wallClock).toEqual({
      reason: "anchor-after-decision",
      status: "unavailable"
    })
    expect(time.observe(record("record-stale", 2_001)).wallClock).toEqual({
      reason: "stale-anchor",
      status: "unavailable"
    })
  })

  it("uses the latest applicable anchor rather than a later resynchronization", () => {
    const time = model()
    time.synchronize({
      anchorId: "other-boot",
      sampledAtUs: 0,
      scoringBootId: "stm32-boot-b",
      source: "network-time",
      uncertaintyUs: 1,
      wallClockAtUs: 10
    })
    time.synchronize({
      anchorId: "network-a",
      sampledAtUs: 100,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 1,
      wallClockAtUs: 1_000
    })
    time.synchronize({
      anchorId: "network-b",
      sampledAtUs: 200,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 1,
      wallClockAtUs: 2_000
    })
    time.synchronize({
      anchorId: "network-c",
      sampledAtUs: 300,
      scoringBootId: "stm32-boot-a",
      source: "network-time",
      uncertaintyUs: 1,
      wallClockAtUs: 3_000
    })

    expect(time.observe(record("record-between", 150)).wallClock).toMatchObject({
      anchorId: "network-a",
      estimatedAtUs: 1_050,
      status: "bounded"
    })
  })

  it("keeps application append order across a scoring reboot but refuses to call it chronological order", () => {
    const time = model()
    const before = time.observe(record("record-before", 900, "stm32-boot-a"))
    const after = time.observe(record("record-after", 5, "stm32-boot-b"))

    expect(before.ordering.relationToPreviousApplicationRecord).toBe("first")
    expect(after).toMatchObject({
      applicationSequence: 1,
      monotonic: { decisionAtUs: 5, scoringBootId: "stm32-boot-b" },
      ordering: {
        previousApplicationRecordId: "record-before",
        previousScoringBootRecordId: null,
        relationToPreviousApplicationRecord: "indeterminate-across-scoring-boots",
        relationWithinScoringBoot: "first"
      }
    })
  })

  it("preserves FIFO records at a simultaneous authority instant but fails closed for regressions", () => {
    const time = model()
    time.observe(record("record-1", 100))
    expect(time.observe(record("record-simultaneous", 100))).toMatchObject({
      ordering: {
        previousApplicationRecordId: "record-1",
        previousScoringBootRecordId: "record-1",
        relationToPreviousApplicationRecord: "ordered",
        relationWithinScoringBoot: "same-authority-instant"
      }
    })
    expect(() => time.observe(record("record-1", 101))).toThrow("duplicate")
    expect(() => time.observe(record("record-3", 99))).toThrow("ambiguous")
    time.synchronize({
      anchorId: "anchor-a",
      sampledAtUs: 100,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 1,
      wallClockAtUs: 1
    })
    expect(() =>
      time.synchronize({
        anchorId: "anchor-b",
        sampledAtUs: 100,
        scoringBootId: "stm32-boot-a",
        source: "rtc",
        uncertaintyUs: 1,
        wallClockAtUs: 2
      })
    ).toThrow("advance")
  })

  it("bounds construction, anchors, and retained timeline metadata", () => {
    expect(() => createApplicationTimeMetadata(null as never)).toThrow("options")
    expect(() => createApplicationTimeMetadata({ applicationBootId: "x", maximumDriftPpm: -1 })).toThrow("drift")
    expect(() => createApplicationTimeMetadata({ applicationBootId: "x", maximumDriftPpm: 0, maxAnchors: 0 })).toThrow(
      "capacity"
    )
    expect(() =>
      createApplicationTimeMetadata({
        applicationBootId: "x",
        maximumDriftPpm: 0,
        maxEntries: MAX_APPLICATION_TIME_ENTRIES + 1
      })
    ).toThrow("capacity")
    expect(() =>
      createApplicationTimeMetadata({ applicationBootId: "x", maximumDriftPpm: 0, unexpected: true } as never)
    ).toThrow("unknown property")
    const accessorOptions = { applicationBootId: "x", maximumDriftPpm: 0 }
    Object.defineProperty(accessorOptions, "maxEntries", { enumerable: true, get: () => 1 })
    expect(() => createApplicationTimeMetadata(accessorOptions)).toThrow("enumerable data")
    const symbolicOptions = { applicationBootId: "x", maximumDriftPpm: 0 }
    Object.defineProperty(symbolicOptions, Symbol("extension"), { value: true })
    expect(() => createApplicationTimeMetadata(symbolicOptions)).toThrow("unknown property")

    const time = createApplicationTimeMetadata({
      applicationBootId: "esp32-boot-a",
      maxAnchors: 1,
      maxEntries: 1,
      maximumDriftPpm: 0
    })
    time.synchronize({
      anchorId: "anchor-a",
      sampledAtUs: 0,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 0,
      wallClockAtUs: 0
    })
    expect(() =>
      time.synchronize({
        anchorId: "anchor-unknown",
        extra: true,
        sampledAtUs: 1,
        scoringBootId: "stm32-boot-a",
        source: "rtc",
        uncertaintyUs: 0,
        wallClockAtUs: 1
      } as never)
    ).toThrow("unknown property")
    expect(() =>
      time.synchronize({
        anchorId: "anchor-b",
        sampledAtUs: 1,
        scoringBootId: "stm32-boot-a",
        source: "rtc",
        uncertaintyUs: 0,
        wallClockAtUs: 1
      })
    ).toThrow("capacity")
    time.observe(record("record-1", 1))
    expect(() => time.observe(record("record-2", 2))).toThrow("capacity")
    expect(MAX_APPLICATION_TIME_ANCHORS).toBe(32)
  })

  it("rejects malformed public inputs and invalid time bounds before accepting metadata", () => {
    expect(() => createApplicationTimeMetadata("invalid" as never)).toThrow("plain object")
    expect(() => createApplicationTimeMetadata([] as never)).toThrow("plain object")
    expect(() => createApplicationTimeMetadata(Object.create(null) as never)).toThrow("plain object")
    expect(() => createApplicationTimeMetadata({ applicationBootId: "", maximumDriftPpm: 0 })).toThrow("identifier")
    expect(() => createApplicationTimeMetadata({ applicationBootId: "x".repeat(129), maximumDriftPpm: 0 })).toThrow(
      "identifier"
    )
    expect(() => createApplicationTimeMetadata({ applicationBootId: "invalid boot", maximumDriftPpm: 0 })).toThrow(
      "identifier"
    )
    expect(() =>
      createApplicationTimeMetadata({ applicationBootId: "x", maximumDriftPpm: Number.POSITIVE_INFINITY })
    ).toThrow("safe integer")
    expect(() =>
      createApplicationTimeMetadata({ applicationBootId: "x", maximumDriftPpm: 0, maxAnchorAgeUs: -1 })
    ).toThrow("non-negative")
    expect(() =>
      createApplicationTimeMetadata({
        applicationBootId: "x",
        maximumDriftPpm: 0,
        maxAnchors: MAX_APPLICATION_TIME_ANCHORS + 1
      })
    ).toThrow("capacity")
    expect(() => createApplicationTimeMetadata({ applicationBootId: "x", maximumDriftPpm: 1_000_001 })).toThrow(
      "cannot exceed"
    )

    const time = model()
    expect(() =>
      time.synchronize({
        anchorId: "missing-source",
        sampledAtUs: 0,
        scoringBootId: "stm32-boot-a",
        uncertaintyUs: 0,
        wallClockAtUs: 0
      } as never)
    ).toThrow("requires source")
    expect(() =>
      time.synchronize({
        anchorId: "invalid-source",
        sampledAtUs: 0,
        scoringBootId: "stm32-boot-a",
        source: "gps",
        uncertaintyUs: 0,
        wallClockAtUs: 0
      } as never)
    ).toThrow("source")
    expect(() =>
      time.synchronize({
        anchorId: "invalid-wall-clock",
        sampledAtUs: 0,
        scoringBootId: "stm32-boot-a",
        source: "rtc",
        uncertaintyUs: 0,
        wallClockAtUs: Number.NaN
      })
    ).toThrow("safe integer")
    expect(() =>
      time.synchronize({
        anchorId: "invalid-uncertainty",
        sampledAtUs: 0,
        scoringBootId: "stm32-boot-a",
        source: "rtc",
        uncertaintyUs: -1,
        wallClockAtUs: 0
      })
    ).toThrow("non-negative")
  })

  it("fails closed on duplicate anchors and arithmetic bounds", () => {
    const duplicate = model()
    duplicate.synchronize({
      anchorId: "anchor-a",
      sampledAtUs: 0,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 0,
      wallClockAtUs: 0
    })
    expect(Object.isFrozen(duplicate.anchors)).toBe(true)
    expect(() =>
      duplicate.synchronize({
        anchorId: "anchor-a",
        sampledAtUs: 1,
        scoringBootId: "stm32-boot-a",
        source: "rtc",
        uncertaintyUs: 0,
        wallClockAtUs: 1
      })
    ).toThrow("already present")

    const estimateOverflow = createApplicationTimeMetadata({ applicationBootId: "esp32-boot-a", maximumDriftPpm: 0 })
    estimateOverflow.synchronize({
      anchorId: "estimate-overflow",
      sampledAtUs: 0,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 0,
      wallClockAtUs: Number.MAX_SAFE_INTEGER
    })
    expect(() => estimateOverflow.observe(record("estimate-overflow", 1))).toThrow("estimate")

    const lowerBoundOverflow = createApplicationTimeMetadata({ applicationBootId: "esp32-boot-a", maximumDriftPpm: 0 })
    lowerBoundOverflow.synchronize({
      anchorId: "lower-overflow",
      sampledAtUs: 0,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 1,
      wallClockAtUs: Number.MIN_SAFE_INTEGER
    })
    expect(() => lowerBoundOverflow.observe(record("lower-overflow", 0))).toThrow("lower bound")

    const driftOverflow = createApplicationTimeMetadata({
      applicationBootId: "esp32-boot-a",
      maxAnchorAgeUs: Number.MAX_SAFE_INTEGER,
      maximumDriftPpm: 1_000_000
    })
    driftOverflow.synchronize({
      anchorId: "drift-overflow",
      sampledAtUs: 0,
      scoringBootId: "stm32-boot-a",
      source: "rtc",
      uncertaintyUs: 0,
      wallClockAtUs: 0
    })
    expect(() => driftOverflow.observe(record("drift-overflow", Number.MAX_SAFE_INTEGER))).toThrow("drift calculation")
  })

  it("uses capture sequences to reject regressions at an equal authority timestamp", () => {
    const firstSequence = model()
    firstSequence.observe({
      ...record("first-sequence-2", 100),
      captureWindow: { firstSequence: 2, fromUs: 100, lastSequence: 2, throughUs: 100 }
    })
    firstSequence.observe({
      ...record("first-sequence-3", 100),
      captureWindow: { firstSequence: 3, fromUs: 100, lastSequence: 3, throughUs: 100 }
    })
    expect(() =>
      firstSequence.observe({
        ...record("first-sequence-1", 100),
        captureWindow: { firstSequence: 1, fromUs: 100, lastSequence: 1, throughUs: 100 }
      })
    ).toThrow("ambiguous")

    const lastSequence = model()
    lastSequence.observe({
      ...record("last-sequence-2", 100),
      captureWindow: { firstSequence: 1, fromUs: 100, lastSequence: 2, throughUs: 100 }
    })
    lastSequence.observe({
      ...record("last-sequence-3", 100),
      captureWindow: { firstSequence: 1, fromUs: 100, lastSequence: 3, throughUs: 100 }
    })
    expect(() =>
      lastSequence.observe({
        ...record("last-sequence-1", 100),
        captureWindow: { firstSequence: 1, fromUs: 100, lastSequence: 1, throughUs: 100 }
      })
    ).toThrow("ambiguous")
  })
})
