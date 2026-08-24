import { describe, expect, it } from "vitest"
import { encodeTransportFrame } from "./transport-frame.js"
import { createVirtualClock } from "./virtual-clock.js"
import {
  createVirtualProcessorLink,
  MAX_VIRTUAL_LINK_DUPLICATE_COPIES,
  MAX_VIRTUAL_LINK_FAULT_SCRIPT_ENTRIES,
  MAX_VIRTUAL_LINK_QUEUE_CAPACITY,
  MIN_VIRTUAL_LINK_FRAME_BYTES,
  type VirtualLinkAttempt,
  type VirtualLinkFault
} from "./virtual-processor-link.js"

function frame(sender: "esp32" | "stm32", sequence: number, payload = [0xa5]): Uint8Array {
  return encodeTransportFrame({
    flags: 0,
    messageType: sender === "stm32" ? "decision-record" : "request",
    payload: new Uint8Array(payload),
    sequence
  })
}

function outcomes(attempts: readonly VirtualLinkAttempt[]): readonly string[] {
  return attempts.map((attempt) => attempt.outcome)
}

describe("virtual processor link", () => {
  it("delivers bounded immutable frames after virtual delay and preserves direction and sequence", () => {
    const clock = createVirtualClock()
    const received: VirtualLinkAttempt[] = []
    const link = createVirtualProcessorLink({
      clock,
      faultScript: [{ kind: "delay", delayUs: 20 }],
      onDelivery: (attempt) => received.push(attempt)
    })
    const source = frame("stm32", 0x0102_0304)
    const original = source.slice()

    const receipt = link.send("stm32", source)
    source.fill(0)

    expect(receipt).toMatchObject({
      attemptIds: [0],
      connectionEpoch: 0,
      copiesRequested: 1,
      outcome: "queued",
      submittedAtUs: 0
    })
    expect(link.connected).toBe(true)
    expect(link.clock).toBe(clock)
    expect(link.pendingCount).toBe(1)
    expect(link.attempts[0]).toMatchObject({
      attemptId: 0,
      connectionEpoch: 0,
      direction: "stm32-to-esp32",
      frameBytes: original,
      outcome: "queued",
      receiver: "esp32",
      scheduledAtUs: 20,
      sender: "stm32",
      sequence: 0x0102_0304,
      submittedAtUs: 0,
      wireBytes: original,
      wireSequence: 0x0102_0304
    })
    expect(clock.advanceTo(19)).toBe(0)
    expect(received).toEqual([])
    expect(clock.advanceTo(20)).toBe(1)
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ completedAtUs: 20, outcome: "delivered" })
    expect(received[0]?.frameBytes).toEqual(original)
    expect(received[0]?.wireBytes).toEqual(original)
    expect(link.pendingCount).toBe(0)
    expect(link.attempts[0]?.outcome).toBe("delivered")

    const snapshot = link.attempts
    snapshot[0]!.frameBytes[0] = 0
    snapshot[0]!.wireBytes[0] = 0
    expect(link.attempts[0]?.frameBytes).toEqual(original)
    expect(link.attempts[0]?.wireBytes).toEqual(original)
  })

  it("records loss and deterministic duplication without replaying payload meaning", () => {
    const clock = createVirtualClock()
    const link = createVirtualProcessorLink({
      clock,
      faultScript: [{ kind: "loss" }, { kind: "duplication", copies: 3 }]
    })

    const lost = link.send("stm32", frame("stm32", 0))
    const duplicated = link.send("stm32", frame("stm32", 1))
    expect(lost.copiesRequested).toBe(1)
    expect(duplicated).toMatchObject({ attemptIds: [1, 2, 3], copiesRequested: 3, outcome: "queued" })
    expect(link.pendingCount).toBe(4)

    clock.runUntilIdle()
    expect(outcomes(link.attempts)).toEqual(["lost", "delivered", "delivered", "delivered"])
    expect(link.attempts.slice(1).map((attempt) => [attempt.copyIndex, attempt.copyCount])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3]
    ])
    expect(link.attempts.slice(1).every((attempt) => attempt.frameBytes[9] === link.attempts[1]?.frameBytes[9])).toBe(
      true
    )
  })

  it("reorders by a scripted virtual delay and keeps equal-time ordering stable", () => {
    const replay = () => {
      const clock = createVirtualClock()
      const delivered: number[] = []
      const link = createVirtualProcessorLink({
        clock,
        faultScript: [
          { kind: "reordering", delayUs: 10 },
          { kind: "duplication", copies: 2 }
        ],
        onDelivery: (attempt) => delivered.push(attempt.sequence)
      })

      link.send("stm32", frame("stm32", 0))
      link.send("stm32", frame("stm32", 1))
      clock.runUntilIdle()
      return { attempts: link.attempts, delivered }
    }

    const first = replay()
    const second = replay()
    expect(first.delivered).toEqual([1, 1, 0])
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.attempts.map((attempt) => attempt.scheduledAtUs)).toEqual([10, 0, 0])
    expect(first.attempts.map((attempt) => attempt.copyIndex)).toEqual([0, 0, 1])
  })

  it("corrupts only the transmitted copy and leaves the original bytes intact", () => {
    const clock = createVirtualClock()
    const received: VirtualLinkAttempt[] = []
    const link = createVirtualProcessorLink({
      clock,
      faultScript: [{ kind: "corruption", offset: 14, xor: 0xff }],
      onAttempt: (attempt) => received.push(attempt)
    })
    const source = frame("stm32", 7, [0x12])
    const original = source.slice()

    link.send("stm32", source)
    clock.runUntilIdle()

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ outcome: "delivered", sequence: 7, wireSequence: 7 })
    expect(received[0]?.frameBytes).toEqual(original)
    expect(received[0]?.wireBytes).not.toEqual(original)
    expect(received[0]?.wireBytes[14]).toBe(0xed)
    expect(link.attempts[0]?.frameBytes).toEqual(original)
  })

  it("isolates the fault script and callback snapshots from caller mutation", () => {
    const clock = createVirtualClock()
    const faultScript: VirtualLinkFault[] = [{ kind: "delay", delayUs: 10 }]
    const callbacks: VirtualLinkAttempt[] = []
    const link = createVirtualProcessorLink({
      clock,
      faultScript,
      onAttempt: (attempt) => {
        callbacks.push(attempt)
        attempt.frameBytes.fill(0)
        attempt.wireBytes.fill(0)
      },
      onDelivery: (attempt) => {
        attempt.frameBytes.fill(0)
        attempt.wireBytes.fill(0)
      }
    })
    faultScript[0] = { kind: "loss" }

    const original = frame("stm32", 23)
    link.send("stm32", original)
    original.fill(0)
    clock.runUntilIdle()

    expect(callbacks).toHaveLength(1)
    expect(callbacks[0]?.outcome).toBe("delivered")
    expect(link.attempts[0]).toMatchObject({ outcome: "delivered", scheduledAtUs: 10 })
    expect(link.attempts[0]?.frameBytes).toEqual(frame("stm32", 23))
    expect(link.attempts[0]?.wireBytes).toEqual(frame("stm32", 23))
  })

  it("disconnects by dropping queued work, and reconnect starts an empty epoch", () => {
    const clock = createVirtualClock()
    const link = createVirtualProcessorLink({ clock, faultScript: [{ kind: "delay", delayUs: 100 }] })

    link.send("stm32", frame("stm32", 1))
    expect(link.disconnect()).toBe(1)
    expect(link.connected).toBe(false)
    expect(link.pendingCount).toBe(0)
    expect(link.attempts[0]?.outcome).toBe("disconnected")
    expect(link.disconnect()).toBe(0)
    expect(clock.runUntilIdle()).toBe(0)

    expect(link.send("stm32", frame("stm32", 2))).toMatchObject({
      attemptIds: [1],
      connectionEpoch: 0,
      outcome: "disconnected"
    })
    expect(link.reconnect()).toBe(true)
    expect(link.reconnect()).toBe(false)
    expect(link.connectionEpoch).toBe(1)
    expect(link.send("stm32", frame("stm32", 3))).toMatchObject({ connectionEpoch: 1, outcome: "queued" })
    clock.runUntilIdle()
    expect(link.attempts.map((attempt) => [attempt.sequence, attempt.outcome, attempt.connectionEpoch])).toEqual([
      [1, "disconnected", 0],
      [2, "disconnected", 0],
      [3, "delivered", 1]
    ])
  })

  it("disconnect fault drops prior work and records the current send explicitly", () => {
    const clock = createVirtualClock()
    const link = createVirtualProcessorLink({
      clock,
      faultScript: [{ kind: "delay", delayUs: 50 }, { kind: "disconnect" }]
    })

    link.send("stm32", frame("stm32", 10))
    expect(link.send("esp32", frame("esp32", 11))).toMatchObject({ outcome: "disconnected" })
    expect(link.attempts.map((attempt) => [attempt.sequence, attempt.outcome, attempt.sender])).toEqual([
      [10, "disconnected", "stm32"],
      [11, "disconnected", "esp32"]
    ])
  })

  it("cancels pending work without invoking a receiver and reports cancellation", () => {
    const clock = createVirtualClock()
    const received: VirtualLinkAttempt[] = []
    const link = createVirtualProcessorLink({
      clock,
      faultScript: [{ kind: "delay", delayUs: 50 }],
      onDelivery: (attempt) => received.push(attempt)
    })
    const receipt = link.send("esp32", frame("esp32", 22))

    expect(link.cancel(receipt.attemptIds[0]!)).toBe(true)
    expect(link.cancel(receipt.attemptIds[0]!)).toBe(false)
    expect(link.pendingCount).toBe(0)
    expect(link.attempts[0]?.outcome).toBe("cancelled")
    expect(received).toEqual([])
    expect(clock.runUntilIdle()).toBe(0)
  })

  it("applies bounded backpressure atomically, including duplicate capacity", () => {
    const clock = createVirtualClock()
    const link = createVirtualProcessorLink({
      clock,
      faultScript: [{ kind: "duplication", copies: 2 }],
      queueCapacity: 1
    })

    expect(link.send("stm32", frame("stm32", 30))).toMatchObject({
      attemptIds: [0],
      copiesRequested: 2,
      outcome: "backpressured"
    })
    expect(link.pendingCount).toBe(0)
    expect(link.attempts[0]?.outcome).toBe("backpressured")

    const queued = link.send("stm32", frame("stm32", 31))
    expect(queued.outcome).toBe("queued")
    expect(link.send("stm32", frame("stm32", 32)).outcome).toBe("backpressured")
    expect(link.cancel(queued.attemptIds[0]!)).toBe(true)
    expect(link.send("stm32", frame("stm32", 33)).outcome).toBe("queued")
    clock.runUntilIdle()
    expect(outcomes(link.attempts)).toEqual(["backpressured", "cancelled", "backpressured", "delivered"])

    const dropped = createVirtualProcessorLink({ queueCapacity: 1 })
    dropped.send("stm32", frame("stm32", 34))
    dropped.send("stm32", frame("stm32", 35))
    expect(dropped.disconnect()).toBe(1)
    expect(outcomes(dropped.attempts)).toEqual(["disconnected", "backpressured"])
  })

  it("rejects invalid frames, endpoints, options, faults, and unsafe boundaries", () => {
    const valid = frame("stm32", 0)
    const invalidValues: unknown[] = [null, {}, new Uint8Array(MIN_VIRTUAL_LINK_FRAME_BYTES - 1), new Uint8Array(4_115)]
    const link = createVirtualProcessorLink()

    for (const invalid of invalidValues) {
      expect(() => link.send("stm32", invalid as Uint8Array)).toThrow()
    }
    expect(() => link.send("other" as "stm32", valid)).toThrow(
      new TypeError("Virtual processor link endpoint must be stm32 or esp32")
    )
    expect(() => createVirtualProcessorLink(null as never)).toThrow(
      new TypeError("Virtual processor link options must be an object")
    )
    expect(() => createVirtualProcessorLink({ clock: {} as never })).toThrow(
      new TypeError("Virtual processor link clock must be a virtual clock")
    )
    expect(() => createVirtualProcessorLink({ queueCapacity: -1 })).toThrow()
    expect(() => createVirtualProcessorLink({ queueCapacity: MAX_VIRTUAL_LINK_QUEUE_CAPACITY + 1 })).toThrow()
    expect(() => createVirtualProcessorLink({ faultScript: "bad" as never })).toThrow()
    expect(() =>
      createVirtualProcessorLink({
        faultScript: Array.from({ length: MAX_VIRTUAL_LINK_FAULT_SCRIPT_ENTRIES + 1 }, () => ({ kind: "loss" }))
      })
    ).toThrow()
    expect(() => createVirtualProcessorLink({ onAttempt: "bad" as never })).toThrow()
    expect(() => createVirtualProcessorLink({ onDelivery: "bad" as never })).toThrow()

    const invalidFaults: unknown[] = [
      null,
      { kind: "unknown" },
      { kind: "delay", delayUs: -1 },
      { kind: "reordering", delayUs: 0.5 },
      { kind: "duplication", copies: 1 },
      { kind: "duplication", copies: MAX_VIRTUAL_LINK_DUPLICATE_COPIES + 1 },
      { kind: "corruption", offset: 0, xor: 0 },
      { kind: "corruption", offset: 0, xor: 256 }
    ]
    for (const fault of invalidFaults) {
      expect(() => createVirtualProcessorLink({ faultScript: [fault as VirtualLinkFault] })).toThrow()
    }

    const invalidOffset = createVirtualProcessorLink({
      faultScript: [{ kind: "corruption", offset: valid.length, xor: 1 }]
    })
    expect(() => invalidOffset.send("stm32", valid)).toThrow(
      new RangeError("Virtual link corruption offset must be inside the frame")
    )
    expect(invalidOffset.faultScriptPosition).toBe(1)

    const overflowing = createVirtualProcessorLink({
      clock: createVirtualClock({ startAtUs: Number.MAX_SAFE_INTEGER - 1 }),
      faultScript: [{ kind: "delay", delayUs: 2 }]
    })
    expect(() => overflowing.send("stm32", valid)).toThrow(
      new RangeError("Virtual processor link delay exceeds the safe timestamp range")
    )
    expect(() => link.cancel(-1)).toThrow(
      new RangeError("Virtual processor link attempt ID must be a non-negative safe integer")
    )
    expect(link.cancel(999)).toBe(false)
  })

  it("accepts a zero-capacity link and advances the scripted fault cursor only per send", () => {
    const link = createVirtualProcessorLink({ queueCapacity: 0, faultScript: [{ kind: "loss" }] })
    expect(link.faultScriptPosition).toBe(0)
    expect(link.send("stm32", frame("stm32", 40))).toMatchObject({ outcome: "backpressured" })
    expect(link.faultScriptPosition).toBe(1)
    expect(link.send("stm32", frame("stm32", 41))).toMatchObject({ outcome: "backpressured", copiesRequested: 1 })
    expect(link.faultScriptPosition).toBe(1)
  })
})
