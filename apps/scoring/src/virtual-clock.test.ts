import { describe, expect, it } from "vitest"
import { createVirtualClock, type VirtualClockCallback } from "./virtual-clock.js"

describe("virtual scoring clock", () => {
  it("starts at zero and exposes the current time during callbacks", () => {
    const clock = createVirtualClock()
    const observed: Array<[number, number, number]> = []

    clock.scheduleAt(10, (atUs) => {
      observed.push([atUs, clock.currentAtUs, clock.nowUs()])
    })

    expect(clock.currentAtUs).toBe(0)
    expect(clock.nowUs()).toBe(0)
    expect(clock.advanceTo(20)).toBe(1)
    expect(observed).toEqual([[10, 10, 10]])
    expect(clock.currentAtUs).toBe(20)
    expect(clock.pendingCount).toBe(0)

    clock.scheduleAt(30, () => undefined)
    expect(clock.advanceTo(25)).toBe(0)
    expect(clock.currentAtUs).toBe(25)
  })

  it("runs equal deadlines in stable insertion order and replays identically", () => {
    const replay = () => {
      const clock = createVirtualClock({ startAtUs: 5 })
      const order: string[] = []

      clock.scheduleAt(10, () => order.push("first"))
      clock.scheduleAfter(5, () => order.push("second"))
      clock.scheduleAt(10, () => order.push("third"))
      clock.runUntilIdle()

      return { order, time: clock.currentAtUs }
    }

    expect(replay()).toEqual({ order: ["first", "second", "third"], time: 10 })
    expect(JSON.stringify(replay())).toBe(JSON.stringify(replay()))
  })

  it("cancels pending work and reports whether a handle was present", () => {
    const clock = createVirtualClock()
    const order: string[] = []
    const cancelled = clock.scheduleAt(10, () => order.push("cancelled"))
    clock.scheduleAt(10, () => order.push("kept"))

    expect(clock.cancel(cancelled)).toBe(true)
    expect(clock.cancel(cancelled)).toBe(false)
    expect(clock.pendingCount).toBe(1)
    expect(clock.advanceTo(10)).toBe(1)
    expect(order).toEqual(["kept"])
  })

  it("runs nested work at the current time before later work", () => {
    const clock = createVirtualClock()
    const order: string[] = []

    clock.scheduleAt(10, (atUs) => {
      order.push(`outer:${atUs}`)
      clock.scheduleAfter(0, (nestedAtUs) => order.push(`nested:${nestedAtUs}`))
    })
    clock.scheduleAt(11, () => order.push("later"))

    expect(clock.advanceTo(11)).toBe(3)
    expect(order).toEqual(["outer:10", "nested:10", "later"])
  })

  it("rejects recursive drain operations while allowing callback scheduling", () => {
    const clock = createVirtualClock()
    const order: string[] = []

    clock.scheduleAt(10, () => {
      order.push("outer")
      expect(() => clock.advanceTo(11)).toThrow(
        new TypeError("Virtual clock drain operations cannot be called from a callback")
      )
      expect(() => clock.advanceTo(0)).toThrow(
        new TypeError("Virtual clock drain operations cannot be called from a callback")
      )
      expect(() => clock.runUntilIdle()).toThrow(
        new TypeError("Virtual clock drain operations cannot be called from a callback")
      )
      clock.scheduleAfter(0, () => order.push("nested"))
    })
    clock.scheduleAt(11, () => order.push("later"))

    expect(clock.advanceTo(11)).toBe(3)
    expect(order).toEqual(["outer", "nested", "later"])
  })

  it("releases the drain guard when a callback aborts an operation", () => {
    const clock = createVirtualClock()

    clock.scheduleAt(10, () => clock.advanceTo(11))
    expect(() => clock.advanceTo(10)).toThrow(
      new TypeError("Virtual clock drain operations cannot be called from a callback")
    )

    clock.scheduleAt(11, () => undefined)
    expect(clock.advanceTo(11)).toBe(1)
    expect(clock.currentAtUs).toBe(11)
  })

  it("runs all future work without moving when already idle", () => {
    const clock = createVirtualClock({ startAtUs: 7 })

    expect(clock.runUntilIdle()).toBe(0)
    expect(clock.currentAtUs).toBe(7)

    clock.scheduleAfter(3, () => undefined)
    expect(clock.runUntilIdle()).toBe(1)
    expect(clock.currentAtUs).toBe(10)
  })

  it("rejects invalid timestamps, delays, options, handles, and callbacks", () => {
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => createVirtualClock({ startAtUs: value })).toThrow(
        new RangeError("Virtual clock startAtUs must be a non-negative safe integer")
      )
      expect(() => createVirtualClock({ maxSteps: value })).toThrow(
        new RangeError("Virtual clock maxSteps must be a non-negative safe integer")
      )
    }

    const clock = createVirtualClock()
    const callback = () => undefined

    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => clock.scheduleAt(value, callback)).toThrow(
        new RangeError("Virtual clock timestamps must be a non-negative safe integer")
      )
      expect(() => clock.scheduleAfter(value, callback)).toThrow(
        new RangeError("Virtual clock delays must be a non-negative safe integer")
      )
      expect(() => clock.advanceTo(value)).toThrow(
        new RangeError("Virtual clock timestamps must be a non-negative safe integer")
      )
      expect(() => clock.cancel(value)).toThrow(
        new RangeError("Virtual timer handles must be a non-negative safe integer")
      )
    }

    expect(() => clock.scheduleAt(0, "not a callback" as unknown as VirtualClockCallback)).toThrow(
      new TypeError("Virtual clock callbacks must be functions")
    )
    expect(() => clock.scheduleAt(0, callback)).not.toThrow()
  })

  it("rejects backward movement, past scheduling, and unsafe delay arithmetic", () => {
    const clock = createVirtualClock({ startAtUs: 10 })

    expect(() => clock.advanceTo(9)).toThrow(new RangeError("Virtual clock cannot move backward"))
    expect(() => clock.scheduleAt(9, () => undefined)).toThrow(
      new RangeError("Virtual clock cannot schedule an event in the past")
    )

    const boundary = createVirtualClock({ startAtUs: Number.MAX_SAFE_INTEGER - 1 })
    expect(() => boundary.scheduleAfter(2, () => undefined)).toThrow(
      new RangeError("Virtual clock delay exceeds the safe timestamp range")
    )
    expect(boundary.scheduleAfter(1, () => undefined)).toBe(0)
  })

  it("runs the maximum safe microsecond deadline and accepts a maximum safe callback budget", () => {
    const maxUs = Number.MAX_SAFE_INTEGER
    const clock = createVirtualClock({ startAtUs: maxUs - 2, maxSteps: maxUs })
    const observed: number[] = []

    expect(clock.scheduleAfter(2, (atUs) => observed.push(atUs))).toBe(0)
    expect(clock.advanceTo(maxUs)).toBe(1)
    expect(observed).toEqual([maxUs])
    expect(clock.currentAtUs).toBe(maxUs)

    expect(clock.scheduleAfter(0, (atUs) => observed.push(atUs))).toBe(1)
    expect(clock.runUntilIdle()).toBe(1)
    expect(observed).toEqual([maxUs, maxUs])
    expect(() => clock.scheduleAfter(1, () => undefined)).toThrow(
      new RangeError("Virtual clock delay exceeds the safe timestamp range")
    )
  })

  it("stops a same-time rescheduling loop at the explicit step budget", () => {
    const clock = createVirtualClock({ maxSteps: 3 })
    let executions = 0
    const loop = () => {
      executions += 1
      clock.scheduleAfter(0, loop)
    }

    clock.scheduleAt(0, loop)
    expect(() => clock.runUntilIdle()).toThrow(new RangeError("Virtual clock step budget exhausted after 3 callbacks"))
    expect(executions).toBe(3)
    expect(clock.currentAtUs).toBe(0)
    expect(clock.pendingCount).toBe(1)
  })

  it("rejects asynchronous callback results", () => {
    const clock = createVirtualClock()
    const thenProperty = String.fromCharCode(116, 104, 101, 110)
    const withThen = (thenValue: unknown): object => {
      const value: Record<string, unknown> = {}
      Object.defineProperty(value, thenProperty, { value: thenValue })
      return value
    }
    const asyncCallback = (() => Promise.resolve()) as VirtualClockCallback
    const thenableCallback = (() => withThen(() => undefined)) as VirtualClockCallback
    const objectCallback = (() => ({})) as VirtualClockCallback
    const functionCallback = (() => function returnedFunction() {}) as VirtualClockCallback
    const nonFunctionThenCallback = (() => withThen(1)) as VirtualClockCallback

    clock.scheduleAt(1, asyncCallback)
    expect(() => clock.advanceTo(1)).toThrow(new TypeError("Virtual clock callbacks must complete synchronously"))

    const synchronous = createVirtualClock()
    synchronous.scheduleAt(1, objectCallback)
    synchronous.scheduleAt(1, functionCallback)
    synchronous.scheduleAt(1, nonFunctionThenCallback)
    expect(synchronous.advanceTo(1)).toBe(3)

    const customThenable = createVirtualClock()
    customThenable.scheduleAt(1, thenableCallback)
    expect(() => customThenable.advanceTo(1)).toThrow(
      new TypeError("Virtual clock callbacks must complete synchronously")
    )
  })
})
