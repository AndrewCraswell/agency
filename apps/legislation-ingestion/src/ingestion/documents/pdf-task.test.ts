import { afterEach, expect, it, vi } from "vitest"
import { runPdfTask } from "./pdf-task.js"

afterEach(() => vi.useRealTimers())

it("disposes a successful loading task exactly once", async () => {
  const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  await expect(runPdfTask(async () => "text", destroy, new Error("deadline"))).resolves.toBe("text")
  expect(destroy).toHaveBeenCalledTimes(1)
})

it("disposes a failed loading task exactly once", async () => {
  const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const result = runPdfTask(
    async () => {
      throw new Error("loading failed")
    },
    destroy,
    new Error("deadline")
  )
  await expect(result).rejects.toThrow("loading failed")
  expect(destroy).toHaveBeenCalledTimes(1)
})

it("aborts stalled decoding but waits for disposal before returning the timeout", async () => {
  vi.useFakeTimers()
  const disposal = Promise.withResolvers<void>()
  const decoding = Promise.withResolvers<string>()
  let signal: AbortSignal | undefined
  const destroy = vi.fn<() => Promise<void>>(() => disposal.promise)
  const result = runPdfTask(
    (value) => {
      signal = value
      return decoding.promise
    },
    destroy,
    new Error("deadline"),
    100
  )
  let settled = false
  const observed = result.catch((error: unknown) => {
    settled = true
    return error
  })
  await vi.advanceTimersByTimeAsync(100)
  expect(signal?.aborted).toBe(true)
  expect(destroy).toHaveBeenCalledTimes(1)
  expect(settled).toBe(false)
  disposal.resolve()
  expect(await observed).toEqual(new Error("deadline"))
  expect(vi.getTimerCount()).toBe(0)
  decoding.reject(new Error("decoder destroyed"))
})
