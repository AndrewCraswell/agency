import { afterEach, describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "./http-client.js"

afterEach(() => {
  vi.useRealTimers()
})

describe("RetryingHttpClient shared cooldown", () => {
  it("extends the wait of a caller already queued when Retry-After arrives", async () => {
    vi.useFakeTimers()
    const requests: string[] = []
    const firstResponse = Promise.withResolvers<Response>()
    let limitedAttempts = 0
    const request = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname
      requests.push(path)
      if (path === "/limited" && limitedAttempts++ === 0) {
        return firstResponse.promise
      }
      return new Response("ok")
    })
    const client = new RetryingHttpClient({
      fetch: request,
      maxAttempts: 2,
      minimumIntervalMs: 100,
      requestTimeoutMs: 2000
    })

    const limited = client.get(new URL("https://provider.example/limited"))
    await vi.advanceTimersByTimeAsync(0)
    expect(requests).toEqual(["/limited"])

    const concurrent = client.get(new URL("https://provider.example/concurrent"))
    await vi.advanceTimersByTimeAsync(0)
    firstResponse.resolve(new Response("limited", { headers: { "retry-after": "1" }, status: 429 }))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(999)
    expect(requests).toEqual(["/limited"])

    await vi.advanceTimersByTimeAsync(1)
    expect(requests).toEqual(["/limited", "/concurrent"])
    await vi.advanceTimersByTimeAsync(100)
    await expect(Promise.all([limited, concurrent])).resolves.toHaveLength(2)
    expect(requests).toEqual(["/limited", "/concurrent", "/limited"])
  })
})
