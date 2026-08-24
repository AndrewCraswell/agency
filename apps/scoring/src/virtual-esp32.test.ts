import { describe, expect, it } from "vitest"
import { DECISION_RECORD_SCHEMA_VERSION, type DecisionRecord, type DecisionRecordOutcome } from "./decision-record.js"
import { encodeTransportFrame } from "./transport-frame.js"
import { createVirtualEsp32, type AuthoritativeDecisionPayloadDecoder } from "./virtual-esp32.js"
import { createVirtualProcessorLink, type VirtualLinkAttempt } from "./virtual-processor-link.js"

const provenance = {
  calibrationProfileRevision: "calibration-1",
  firmware: {
    buildDigest: `sha256:${"8f".repeat(32)}`,
    identity: "stm32-scoring",
    scoringBootId: "boot-stm32-1"
  },
  hardwareRevision: "evt-a",
  lineContractRevision: "lines-1",
  ruleSetRevision: "rules-1",
  timingTableRevision: "timing-1"
} as const

function decisionRecord(recordId: string, decisionAtUs: number): DecisionRecord {
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
    provenance,
    rawCaptureRefs: [],
    recordId,
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

function recordForOutcome(recordId: string, outcome: DecisionRecordOutcome): DecisionRecord {
  const decisionAtUs =
    outcome.disposition === "qualified-hit" || outcome.disposition === "off-target"
      ? outcome.qualifiedAtUs
      : outcome.disposition === "rejected-contact"
        ? outcome.attemptedAtUs
        : outcome.disposition === "line-fault"
          ? outcome.detectedAtUs
          : outcome.disposition === "reset"
            ? outcome.resetAtUs
            : outcome.disposition === "uncertainty"
              ? outcome.observedAtUs
              : outcome.performedAtUs
  return {
    ...decisionRecord(recordId, decisionAtUs),
    outcome,
    rawCaptureRefs:
      outcome.disposition === "calibration"
        ? [
            {
              captureId: `calibration-capture-${recordId}`,
              contentDigest: `sha256:${"cd".repeat(32)}`,
              contentFormatRevision: "capture-1",
              firstSequence: decisionAtUs,
              fromUs: decisionAtUs,
              kind: "calibration-measurements",
              lastSequence: decisionAtUs,
              sampleCount: 1,
              throughUs: decisionAtUs
            }
          ]
        : []
  }
}

function decisionFrame(sequence: number, payloadId: number): Uint8Array {
  return encodeTransportFrame({
    flags: 0,
    messageType: "decision-record",
    payload: new Uint8Array([payloadId]),
    sequence
  })
}

function transportFrame(sequence: number, messageType: "request" | "response" | "status"): Uint8Array {
  return encodeTransportFrame({ flags: 0, messageType, payload: new Uint8Array(), sequence })
}

function delivered(
  frame: Uint8Array,
  configure?: Parameters<typeof createVirtualProcessorLink>[0]
): VirtualLinkAttempt {
  const deliveries: VirtualLinkAttempt[] = []
  const link = createVirtualProcessorLink({ ...configure, onDelivery: (attempt) => deliveries.push(attempt) })
  expect(link.send("stm32", frame).outcome).toBe("queued")
  link.clock.runUntilIdle()
  expect(deliveries).toHaveLength(1)
  return deliveries[0]!
}

function decoder(records: ReadonlyMap<number, DecisionRecord>): AuthoritativeDecisionPayloadDecoder {
  return (payload) => {
    const record = records.get(payload[0] ?? -1)
    if (record === undefined) {
      throw new TypeError("Unknown test decision payload")
    }
    return record
  }
}

describe("virtual ESP32 authority guard", () => {
  it("accepts a delivered STM32 decision exactly once without changing it", () => {
    const source = decisionRecord("record-0", 100)
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: decoder(new Map([[1, source]])),
      expectedSequence: 0
    })

    const accepted = receiver.receive(delivered(decisionFrame(0, 1)))
    expect(accepted).toMatchObject({ outcome: "accepted", record: source, sequence: 0 })
    expect(receiver.expectedSequence).toBe(1)
    expect(receiver.records).toEqual([source])
    expect(receiver.records[0]).not.toBe(source)
    expect(Object.isFrozen(receiver.records[0])).toBe(true)
    expect(Object.isFrozen(receiver.records[0]?.outcome)).toBe(true)
    expect(Reflect.set(receiver.records[0]!.outcome, "side", "right")).toBe(false)
    expect(receiver.records[0]?.outcome).toMatchObject({ side: "left", weapon: "epee" })

    // The application can only mutate its own snapshots. It cannot clear,
    // reorder, or change the STM32 decision retained by the receiver.
    const applicationSnapshot = receiver.records.slice()
    applicationSnapshot.reverse()
    applicationSnapshot.length = 0
    expect(receiver.records).toEqual([source])
    expect(Object.isFrozen(accepted)).toBe(true)
    expect(Reflect.set(accepted, "record", null)).toBe(false)
    expect(Reflect.set(source.outcome, "side", "right")).toBe(true)
    expect(receiver.records[0]?.outcome).toMatchObject({ side: "left", weapon: "epee" })

    const duplicate = receiver.receive(delivered(decisionFrame(0, 1)))
    expect(duplicate).toMatchObject({ outcome: "rejected", reason: "out-of-order", record: null, sequence: 0 })
    expect(receiver.records).toHaveLength(1)
  })

  it("rejects a later record ID replay while consuming its transport sequence", () => {
    const source = decisionRecord("record-duplicate", 200)
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: decoder(new Map([[1, source]])),
      expectedSequence: 0
    })

    expect(receiver.receive(delivered(decisionFrame(0, 1))).outcome).toBe("accepted")
    expect(receiver.receive(delivered(decisionFrame(1, 1)))).toMatchObject({
      outcome: "rejected",
      reason: "record-duplicate",
      sequence: 1
    })
    expect(receiver.expectedSequence).toBe(2)
    expect(receiver.records).toHaveLength(1)
  })

  it("does not reorder a missing sequence and accepts it only in source order", () => {
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: decoder(
        new Map([
          [1, decisionRecord("record-0", 0)],
          [2, decisionRecord("record-1", 1)]
        ])
      ),
      expectedSequence: 0
    })

    expect(receiver.receive(delivered(decisionFrame(1, 2)))).toMatchObject({
      outcome: "rejected",
      reason: "out-of-order",
      sequence: 1
    })
    expect(receiver.records).toEqual([])
    expect(receiver.isLinkDegraded).toBe(true)
    expect(receiver.receive(delivered(decisionFrame(0, 1))).outcome).toBe("accepted")
    expect(receiver.receive(delivered(decisionFrame(1, 2))).outcome).toBe("accepted")
    expect(receiver.records.map((record) => record.recordId)).toEqual(["record-0", "record-1"])
  })

  it("rejects corrupt, wrong-direction, and app-forged deliveries before a scoring record exists", () => {
    const calls: number[] = []
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: (payload) => {
        calls.push(payload[0] ?? -1)
        return decisionRecord("record-0", 0)
      },
      expectedSequence: 0
    })

    const corrupt = delivered(decisionFrame(0, 1), { faultScript: [{ kind: "corruption", offset: 14, xor: 1 }] })
    expect(receiver.receive(corrupt)).toMatchObject({ outcome: "rejected", reason: "frame", frameError: "crc" })
    expect(calls).toEqual([])

    const wrongDirection = delivered(transportFrame(0, "request"))
    expect(receiver.receive(wrongDirection)).toMatchObject({
      outcome: "rejected",
      reason: "frame",
      frameError: "direction"
    })

    const genuine = delivered(decisionFrame(0, 1))
    const appForgery: VirtualLinkAttempt = {
      ...genuine,
      direction: "esp32-to-stm32",
      receiver: "stm32",
      sender: "esp32"
    }
    expect(receiver.receive(appForgery)).toMatchObject({ outcome: "rejected", reason: "delivery", sequence: null })
    expect(calls).toEqual([])
    expect(receiver.records).toEqual([])
  })

  it("keeps memory bounded with explicit backpressure rather than evicting authority evidence", () => {
    const calls: number[] = []
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: (payload) => {
        calls.push(payload[0] ?? -1)
        return decisionRecord(`record-${payload[0]}`, payload[0] ?? 0)
      },
      expectedSequence: 0,
      maxRecords: 1
    })

    expect(receiver.receive(delivered(decisionFrame(0, 1))).outcome).toBe("accepted")
    expect(receiver.receive(delivered(decisionFrame(1, 2)))).toMatchObject({
      outcome: "rejected",
      reason: "backpressure",
      sequence: 1
    })
    expect(receiver.expectedSequence).toBe(1)
    expect(receiver.records.map((record) => record.recordId)).toEqual(["record-1"])
    expect(calls).toEqual([1])
  })

  it("uses the opaque decoder boundary, consumes non-decision ordering, and fails closed for an invalid payload", () => {
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: (payload) => {
        if (payload[0] === 2) {
          return decisionRecord("record-2", 2)
        }
        throw new TypeError("Not a decision record")
      },
      expectedSequence: 0
    })

    expect(receiver.receive(delivered(transportFrame(0, "status")))).toMatchObject({ outcome: "ignored", sequence: 0 })
    expect(receiver.expectedSequence).toBe(1)
    expect(receiver.receive(delivered(decisionFrame(1, 1)))).toMatchObject({
      outcome: "rejected",
      reason: "payload",
      sequence: 1
    })
    expect(receiver.expectedSequence).toBe(2)
    expect(receiver.receive(delivered(decisionFrame(2, 2)))).toMatchObject({ outcome: "accepted", sequence: 2 })
    expect(receiver.records.map((record) => record.recordId)).toEqual(["record-2"])
  })

  it("accepts the exact v1 shape of every decision outcome, including capture evidence", () => {
    const outcomes: readonly DecisionRecordOutcome[] = [
      decisionRecord("qualified", 10).outcome,
      {
        disposition: "off-target",
        qualifiedAtUs: 11,
        side: "right",
        signal: { audible: "requested", latched: true, visual: "off-target" },
        weapon: "foil"
      },
      {
        attemptedAtUs: 12,
        attemptedSide: "left",
        disposition: "rejected-contact",
        reason: "grounded-contact",
        signal: { audible: "none", latched: false, visual: "none" },
        weapon: "epee"
      },
      {
        detectedAtUs: 13,
        diagnostic: "open-circuit",
        disposition: "line-fault",
        lineId: "A",
        persistence: "transient",
        side: null,
        signal: { audible: "none", latched: false, visual: "diagnostic" }
      },
      {
        cause: "operator",
        disposition: "reset",
        resetAtUs: 14,
        scope: "stm32",
        signal: { audible: "none", latched: false, visual: "none" }
      },
      {
        disposition: "uncertainty",
        effect: "not-qualified",
        lowerBound: 1,
        observedAtUs: 15,
        signal: { audible: "none", latched: false, visual: "diagnostic" },
        subject: "timing",
        unit: "us",
        upperBound: 2
      },
      {
        disposition: "uncertainty",
        effect: "unavailable",
        identity: { field: "firmware-identity", observed: null, status: "missing" },
        lowerBound: 0,
        observedAtUs: 16,
        signal: { audible: "none", latched: false, visual: "diagnostic" },
        subject: "identity",
        unit: null,
        upperBound: 0
      },
      {
        calibrationId: "cal-1",
        disposition: "calibration",
        performedAtUs: 17,
        signal: { audible: "none", latched: false, visual: "diagnostic" },
        status: "passed"
      }
    ]

    for (const [index, outcome] of outcomes.entries()) {
      const base = recordForOutcome(`record-outcome-${index}`, outcome)
      const source: DecisionRecord =
        index === 0
          ? {
              ...base,
              rawCaptureRefs: [
                {
                  captureId: "capture-1",
                  contentDigest: `sha256:${"ab".repeat(32)}`,
                  contentFormatRevision: "capture-1",
                  firstSequence: 10,
                  fromUs: 10,
                  kind: "acquisition-samples" as const,
                  lastSequence: 10,
                  sampleCount: 1,
                  throughUs: 10
                }
              ]
            }
          : base
      const receiver = createVirtualEsp32({
        decodeDecisionRecordPayload: decoder(new Map([[1, source]])),
        expectedSequence: 0
      })
      expect(receiver.receive(delivered(decisionFrame(0, 1)))).toMatchObject({ outcome: "accepted", record: source })
    }
  })

  it("is deterministic and rejects input and sequence exhaustion safely", () => {
    const records = new Map([
      [1, decisionRecord("record-first", 10)],
      [2, decisionRecord("record-last", 11)]
    ])
    const first = createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records) })
    const second = createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records) })
    const frames = [delivered(decisionFrame(7, 1)), delivered(decisionFrame(8, 2))]

    const firstReceipts = frames.map((frame) => first.receive(frame))
    const secondReceipts = frames.map((frame) => second.receive(frame))
    expect(secondReceipts).toEqual(firstReceipts)
    expect(second.records).toEqual(first.records)
    expect(second.lastReceipt).toEqual(secondReceipts[1])

    const exhausted = createVirtualEsp32({
      decodeDecisionRecordPayload: decoder(new Map([[1, decisionRecord("record-last", 0xffff_ffff)]])),
      expectedSequence: 0xffff_ffff
    })
    expect(exhausted.receive(delivered(decisionFrame(0xffff_ffff, 1))).outcome).toBe("accepted")
    expect(exhausted.expectedSequence).toBeNull()
    expect(exhausted.receive(delivered(decisionFrame(0, 1)))).toMatchObject({
      outcome: "rejected",
      reason: "sequence-exhausted"
    })

    expect(() => createVirtualEsp32(null as never)).toThrow(new TypeError("Virtual ESP32 options must be an object"))
    expect(() => createVirtualEsp32({ decodeDecisionRecordPayload: "no" as never })).toThrow()
    expect(() => createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records), extra: true } as never)).toThrow(
      new TypeError("Virtual ESP32 options have unrecognized fields")
    )
    expect(() => createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records), expectedSequence: -1 })).toThrow()
    expect(() =>
      createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records), expectedSequence: 0x1_0000_0000 })
    ).toThrow()
    expect(() => createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records), maxRecords: 0 })).toThrow()
    expect(() => createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records), maxRecords: 0.5 })).toThrow()
    expect(() => createVirtualEsp32({ decodeDecisionRecordPayload: decoder(records), maxRecords: 1_025 })).toThrow()
  })

  it("fails closed for hostile authoritative decoder values without retaining them", () => {
    const baseline = decisionRecord("record-hostile", 50)
    const holeyReferences: unknown[] = []
    holeyReferences.length = 1
    const cycle: { self?: unknown } = {}
    cycle.self = cycle
    const accessorRecord = { ...baseline }
    Object.defineProperty(accessorRecord, "extra", { enumerable: true, get: () => "not data" })
    const nonenumerableRecord = { ...baseline }
    Object.defineProperty(nonenumerableRecord, "extra", { enumerable: false, value: "not data" })
    const symbolRecord = { ...baseline, [Symbol("extra")]: "not data" }
    const thenableFunction = () => undefined
    Reflect.defineProperty(thenableFunction, ["th", "en"].join(""), { value: () => undefined })
    const hostileValues: readonly unknown[] = [
      { ...baseline, outcome: { ...baseline.outcome, qualifiedAtUs: Number.NaN } },
      { ...baseline, recordId: "x".repeat(4_097) },
      { ...baseline, rawCaptureRefs: {} },
      { ...baseline, rawCaptureRefs: holeyReferences },
      { ...baseline, provenance: new Date() },
      { ...baseline, extra: undefined },
      { ...baseline, extra: cycle },
      { ...baseline, outcome: { ...baseline.outcome, extra: "forgery" } },
      { ...baseline, outcome: { ...baseline.outcome, disposition: "future-outcome" } },
      { ...baseline, provenance: { ...baseline.provenance, extra: "forgery" } },
      {
        ...baseline,
        provenance: { ...baseline.provenance, firmware: { ...baseline.provenance.firmware, extra: "forgery" } }
      },
      accessorRecord,
      nonenumerableRecord,
      symbolRecord,
      Promise.resolve(baseline),
      thenableFunction
    ]

    for (const value of hostileValues) {
      const receiver = createVirtualEsp32({ decodeDecisionRecordPayload: () => value, expectedSequence: 0 })
      expect(receiver.receive(delivered(decisionFrame(0, 1)))).toMatchObject({
        outcome: "rejected",
        reason: "payload",
        sequence: 0
      })
      expect(receiver.records).toEqual([])
      expect(receiver.expectedSequence).toBe(1)
    }
  })

  it("rejects invalid delivery shape and metadata without interpreting a scoring payload", () => {
    const receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: () => decisionRecord("record-unused", 1),
      expectedSequence: 0
    })
    const genuine = delivered(decisionFrame(0, 1))
    const applicationForged: VirtualLinkAttempt = {
      ...genuine,
      frameBytes: genuine.frameBytes.slice(),
      wireBytes: genuine.wireBytes.slice()
    }
    expect(receiver.receive(applicationForged)).toMatchObject({
      outcome: "rejected",
      reason: "delivery",
      sequence: null
    })

    // The callback object's public bytes are diagnostic snapshots. Mutating
    // them cannot substitute a new scoring frame for the link-issued one.
    genuine.wireBytes[0] ^= 0xff
    expect(receiver.receive(genuine)).toMatchObject({ outcome: "accepted", sequence: 0 })

    const secondReceiver = createVirtualEsp32({
      decodeDecisionRecordPayload: () => decisionRecord("record-unused", 1),
      expectedSequence: 0
    })
    const secondGenuine = delivered(decisionFrame(0, 1))
    const mismatchedMetadata: VirtualLinkAttempt = { ...secondGenuine, wireSequence: 1 }
    expect(secondReceiver.receive(mismatchedMetadata)).toMatchObject({
      outcome: "rejected",
      reason: "delivery",
      sequence: null
    })

    const undelivered: VirtualLinkAttempt = { ...secondGenuine, outcome: "queued" }
    expect(secondReceiver.receive(undelivered)).toMatchObject({
      outcome: "rejected",
      reason: "delivery",
      sequence: null
    })
    const missingWireBytes: VirtualLinkAttempt = { ...secondGenuine, wireBytes: null as never }
    expect(secondReceiver.receive(missingWireBytes)).toMatchObject({
      outcome: "rejected",
      reason: "delivery",
      sequence: null
    })
    const proxyWireBytes = new Proxy(secondGenuine.wireBytes, {})
    const unexpectedDecoderFailure: VirtualLinkAttempt = { ...secondGenuine, wireBytes: proxyWireBytes as Uint8Array }
    expect(secondReceiver.receive(unexpectedDecoderFailure)).toMatchObject({
      outcome: "rejected",
      reason: "delivery",
      sequence: null
    })
    expect(secondReceiver.receive(null as never)).toMatchObject({
      outcome: "rejected",
      reason: "delivery",
      sequence: null
    })
  })

  it("rejects reentrant application decoder calls without accepting a decision", () => {
    const frame = delivered(decisionFrame(0, 1))
    let receiver: ReturnType<typeof createVirtualEsp32>
    receiver = createVirtualEsp32({
      decodeDecisionRecordPayload: () => receiver.receive(frame),
      expectedSequence: 0
    })

    expect(receiver.receive(frame)).toMatchObject({ outcome: "rejected", reason: "payload", sequence: 0 })
    expect(receiver.records).toEqual([])
  })
})
