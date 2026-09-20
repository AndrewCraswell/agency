import { describe, expect, it, vi } from "vitest"
import { ConnectionQueue } from "./connection-queue"

describe("research connection queue", () => {
  it("honors capacity, waits without a deadline, and grants capacity in arrival order", async () => {
    vi.useFakeTimers()
    try {
      const queue = new ConnectionQueue(2)
      const first = await queue.acquire()
      const second = await queue.acquire()
      const admitted = vi.fn<(release: () => void) => () => void>((release) => release)
      const third = queue.acquire().then(admitted)
      const fourth = queue.acquire().then(admitted)
      await vi.advanceTimersByTimeAsync(60_000)
      expect(admitted).not.toHaveBeenCalled()
      expect(queue.waitingCount).toBe(2)
      first()
      const releaseThird = await third
      expect(admitted).toHaveBeenCalledOnce()
      second()
      const releaseFourth = await fourth
      expect(admitted).toHaveBeenCalledTimes(2)
      expect(queue.waitingCount).toBe(0)
      releaseThird()
      releaseFourth()
      const reused = await queue.acquire()
      reused()
    } finally {
      vi.useRealTimers()
    }
  })

  it("removes cancelled waiters without taking capacity or delaying subsequent work", async () => {
    const queue = new ConnectionQueue(1)
    const first = await queue.acquire()
    const caller = new AbortController()
    const cancellation = new Error("Stopped while waiting")
    const abandoned = queue.acquire(caller.signal)
    const rejection = expect(abandoned).rejects.toBe(cancellation)
    const next = queue.acquire()
    caller.abort(cancellation)
    await rejection
    expect(queue.waitingCount).toBe(1)
    first()
    const releaseNext = await next
    releaseNext()
    await expect(queue.acquire(caller.signal)).rejects.toBe(cancellation)
    const reused = await queue.acquire()
    reused()
  })

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])("rejects invalid capacity %s", (capacity) => {
    expect(() => new ConnectionQueue(capacity)).toThrow(RangeError)
  })
})
