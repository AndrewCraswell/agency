import { describe, expect, it } from "vitest"
import {
  advanceEmulatedDevice,
  advanceVirtualStm32,
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

describe("two-processor device emulator", () => {
  it("round-trips an STM32 event over the virtual processor link", () => {
    const event: ScoringEvent = {
      hit: { qualifiedAtUs: 12_000, side: "left", startedAtUs: 10_000 },
      protocolVersion: 1,
      sequence: 0,
      type: "hit"
    }

    expect(decodeScoringEvent(encodeScoringEvent(event))).toEqual(event)
    expect(
      decodeScoringEvent(
        encodeScoringEvent({
          ...event,
          hit: { qualifiedAtUs: 12_000, side: "right", startedAtUs: 10_000 }
        })
      )
    ).toEqual({
      ...event,
      hit: { qualifiedAtUs: 12_000, side: "right", startedAtUs: 10_000 }
    })
  })

  it("rejects malformed events at the ESP32 boundary", () => {
    expect(() => decodeScoringEvent('{"protocolVersion":1,"sequence":0,"type":"hit"}')).toThrow(
      new TypeError("Invalid STM32 scoring event")
    )
    expect(() =>
      decodeScoringEvent(
        '{"hit":{"qualifiedAtUs":1,"side":"left","startedAtUs":2},"protocolVersion":1,"sequence":0,"type":"hit"}'
      )
    ).toThrow(new TypeError("Invalid STM32 scoring event"))
  })

  it("keeps scoring authority in the virtual STM32", () => {
    const initial = createEmulatedDeviceState()
    const started = advanceVirtualStm32(initial.stm32, frame(0, HIT))
    const qualified = advanceVirtualStm32(started.state, frame(2_000, HIT))

    expect(qualified.events).toEqual([
      {
        hit: { qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 },
        protocolVersion: 1,
        sequence: 0,
        type: "hit"
      }
    ])
    expect(initial.esp32.hits).toEqual([])
  })

  it("delivers qualified STM32 hits to the virtual ESP32", () => {
    const started = advanceEmulatedDevice(createEmulatedDeviceState(), frame(0, HIT))
    const qualified = advanceEmulatedDevice(started, frame(2_000, HIT))

    expect(qualified.stm32.scoring.hits).toEqual(qualified.esp32.hits)
  })

  it("rejects duplicated or out-of-order events on the ESP32", () => {
    const event: ScoringEvent = {
      hit: { qualifiedAtUs: 2_000, side: "left", startedAtUs: 0 },
      protocolVersion: 1,
      sequence: 1,
      type: "hit"
    }

    expect(() => receiveEsp32Event(createEmulatedDeviceState().esp32, event)).toThrow(
      new RangeError("Scoring events must arrive exactly once and in sequence")
    )
  })

  it("models a grounded guard or piste as a rejected touch", () => {
    const started = advanceEmulatedDevice(createEmulatedDeviceState(), frame(0, GROUNDED))
    const ended = advanceEmulatedDevice(started, frame(10_000, GROUNDED))

    expect(ended.stm32.scoring.hits).toEqual([])
    expect(ended.esp32.hits).toEqual([])
  })
})
