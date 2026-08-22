import { describe, expect, it } from "vitest"
import {
  advanceEmulatedDevice,
  advanceVirtualStm32,
  calculateDecisionRecordCrc32c,
  createEmulatedDeviceState,
  decodeScoringEvent,
  encodeScoringEvent,
  receiveEsp32Event,
  type FrontEndReading,
  type ScoringEvent,
  type SensorFrame
} from "./device.js"

const OPEN: FrontEndReading = { aToBClosed: false, guardOrPisteGrounded: false }
const HIT: FrontEndReading = { aToBClosed: true, guardOrPisteGrounded: false }
const GROUNDED: FrontEndReading = { aToBClosed: true, guardOrPisteGrounded: true }

function frame(atUs: number, left = OPEN, right = OPEN): SensorFrame {
  return { atUs, left, right }
}

function replayEvent(sequence = 0): ScoringEvent {
  const record = {
    capturedFromUs: 0,
    capturedThroughUs: 27_000,
    classification: "on-target" as const,
    firmwareDigest: "sha256:stm32-emulator-dev",
    firmwareIdentity: "stm32-emulator-dev",
    hit: { qualifiedAtUs: 2_000, side: "left" as const, startedAtUs: 0 },
    rejectionReason: null,
    samples: [
      { atUs: 0, packedInputs: 1 },
      { atUs: 2_000, packedInputs: 1 },
      { atUs: 27_000, packedInputs: 0 }
    ],
    scoringBootId: "stm32-boot-0",
    sequenceRange: { first: sequence, last: sequence },
    timing: { contactMinimumUs: 2_000, postCaptureUs: 25_000, preCaptureUs: 100_000 },
    timingRevision: "fie-2026-epee"
  }

  return {
    protocolVersion: 2,
    record,
    recordCrc32c: calculateDecisionRecordCrc32c(record),
    sequence,
    type: "decision-record"
  }
}

describe("two-processor device emulator", () => {
  it("round-trips an immutable STM32 decision record", () => {
    const event = replayEvent()

    expect(decodeScoringEvent(encodeScoringEvent(event))).toEqual(event)
  })

  it("rejects malformed replay evidence at the ESP32 boundary", () => {
    expect(() => decodeScoringEvent("null")).toThrow(new TypeError("Invalid STM32 scoring event"))
    expect(() => decodeScoringEvent(JSON.stringify({ ...replayEvent(), record: null }))).toThrow(
      new TypeError("Invalid STM32 scoring event")
    )
    expect(() => decodeScoringEvent('{"protocolVersion":2,"sequence":0,"type":"decision-record"}')).toThrow(
      new TypeError("Invalid STM32 scoring event")
    )
    expect(() =>
      decodeScoringEvent(
        JSON.stringify({
          ...replayEvent(),
          record: { ...replayEvent().record, capturedFromUs: 28_000, capturedThroughUs: 27_000 }
        })
      )
    ).toThrow(new TypeError("Invalid STM32 scoring event"))

    expect(() =>
      decodeScoringEvent(JSON.stringify({ ...replayEvent(), recordCrc32c: replayEvent().recordCrc32c + 1 }))
    ).toThrow(new TypeError("Invalid STM32 scoring event"))

    const event = replayEvent()
    const samples = [...event.record.samples].reverse()
    const record = { ...event.record, samples }
    expect(() =>
      decodeScoringEvent(JSON.stringify({ ...event, record, recordCrc32c: calculateDecisionRecordCrc32c(record) }))
    ).toThrow(new TypeError("Invalid STM32 scoring event"))

    for (const invalidRecord of [
      { ...event.record, samples: null },
      { ...event.record, hit: { ...event.record.hit, side: "center" } }
    ]) {
      expect(() =>
        decodeScoringEvent(
          JSON.stringify({
            ...event,
            record: invalidRecord,
            recordCrc32c: 0
          })
        )
      ).toThrow(new TypeError("Invalid STM32 scoring event"))
    }
  })

  it("keeps scoring authority and replay capture in the virtual STM32", () => {
    const initial = createEmulatedDeviceState()
    const started = advanceVirtualStm32(initial.stm32, frame(0, HIT))
    const qualified = advanceVirtualStm32(started.state, frame(2_000, HIT))
    const captured = advanceVirtualStm32(qualified.state, frame(27_000))

    expect(qualified.events).toEqual([])
    expect(captured.events).toHaveLength(1)
    expect(captured.events[0]?.record).toMatchObject({
      capturedThroughUs: 27_000,
      classification: "on-target",
      firmwareIdentity: "stm32-emulator-dev",
      hit: { qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 },
      timingRevision: "fie-2026-epee"
    })
    expect(captured.events[0]?.record.samples).toEqual([
      { atUs: 0, packedInputs: 1 },
      { atUs: 2_000, packedInputs: 1 },
      { atUs: 27_000, packedInputs: 0 }
    ])
    expect(initial.esp32.records).toEqual([])
  })

  it("delivers completed STM32 records to the virtual ESP32", () => {
    const started = advanceEmulatedDevice(createEmulatedDeviceState(), frame(0, HIT))
    const qualified = advanceEmulatedDevice(started, frame(2_000, HIT))
    const captured = advanceEmulatedDevice(qualified, frame(27_000))

    expect(captured.stm32.scoring.hits).toEqual(captured.esp32.hits)
    expect(captured.esp32.records).toHaveLength(1)
  })

  it("rejects duplicated or out-of-order events on the ESP32", () => {
    expect(() => receiveEsp32Event(createEmulatedDeviceState().esp32, replayEvent(1))).toThrow(
      new RangeError("Scoring events must arrive exactly once and in sequence")
    )
  })

  it("models a grounded guard or piste as a rejected touch", () => {
    const started = advanceEmulatedDevice(createEmulatedDeviceState(), frame(0, GROUNDED))
    const ended = advanceEmulatedDevice(started, frame(30_000, GROUNDED))

    expect(ended.stm32.scoring.hits).toEqual([])
    expect(ended.esp32.records).toEqual([])
  })
})
