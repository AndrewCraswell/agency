import { describe, expect, it, vi } from "vitest"
import { ProviderHttpError, readBounded, RetryingHttpClient } from "./http-client.js"

describe("RetryingHttpClient", () => {
  it("retries transient failures and returns the eventual response", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    const client = new RetryingHttpClient({ fetch: request, maxAttempts: 2, requestTimeoutMs: 1000 })

    const response = await client.get(new URL("https://provider.example/data"))

    expect(response.status).toBe(200)
    expect(request).toHaveBeenCalledTimes(2)
    expect(client.metrics).toEqual({
      attempts: 2,
      failedRequests: 0,
      rateLimited: 0,
      retries: 1,
      successfulRequests: 1
    })
  })

  it("reports safe per-attempt latency, status, and provider rate-limit telemetry", async () => {
    const telemetry: unknown[] = []
    const client = new RetryingHttpClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response("ok", {
          headers: { "retry-after": "2", "x-ratelimit-limit": "20000", "x-ratelimit-remaining": "19999" }
        })
      ),
      maxAttempts: 1,
      onAttemptComplete: (event) => telemetry.push(event),
      requestTimeoutMs: 1000
    })

    await client.get(new URL("https://provider.example/data?api_key=do-not-log"))

    expect(telemetry).toEqual([
      expect.objectContaining({
        attempt: 1,
        durationMs: expect.any(Number),
        method: "GET",
        rateLimitLimit: 20_000,
        rateLimitRemaining: 19_999,
        retryAfterMs: 2000,
        status: 200,
        url: "https://provider.example/data"
      })
    ])
  })

  it("does not retry invalid credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("unauthorized", { status: 401 }))
    const client = new RetryingHttpClient({ fetch: request, maxAttempts: 3, requestTimeoutMs: 1000 })

    await expect(client.get(new URL("https://provider.example/data"))).rejects.toMatchObject({
      retryable: false,
      status: 401
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(client.metrics.failedRequests).toBe(1)
  })

  it("fails fast when a provider reports an exhausted daily quota", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"detail":"exceeded limit of 250/day: 948"}', { status: 429 }))
    const client = new RetryingHttpClient({ fetch: request, maxAttempts: 4, requestTimeoutMs: 1000 })

    await expect(client.get(new URL("https://provider.example/data"))).rejects.toMatchObject({
      message: expect.stringContaining("250/day"),
      retryable: false,
      status: 429
    })
    expect(request).toHaveBeenCalledOnce()
  })

  it("retains a bounded provider error detail for terminal server errors", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(`{"error":"'NoneType' object has no attribute 'date'"}`, { status: 500 }))
    const client = new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })

    await expect(client.get(new URL("https://provider.example/data"))).rejects.toMatchObject({
      message: expect.stringContaining("NoneType"),
      retryable: true,
      status: 500
    })
  })

  it("rejects oversized responses", async () => {
    await expect(readBounded(new Response("12345"), 4)).rejects.toBeInstanceOf(ProviderHttpError)
  })

  it("serializes request starts when provider pacing is configured", async () => {
    const requestTimes: number[] = []
    const request = vi.fn<typeof fetch>().mockImplementation(() => {
      requestTimes.push(Date.now())
      return Promise.resolve(new Response("ok"))
    })
    const client = new RetryingHttpClient({
      fetch: request,
      maxAttempts: 1,
      minimumIntervalMs: 20,
      requestTimeoutMs: 1000
    })

    await Promise.all([
      client.get(new URL("https://provider.example/first")),
      client.get(new URL("https://provider.example/second"))
    ])

    expect((requestTimes[1] ?? 0) - (requestTimes[0] ?? 0)).toBeGreaterThanOrEqual(15)
  })

  it("honors an HTTP-date Retry-After value", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-17T18:00:00.000Z"))
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("limited", {
          headers: { "retry-after": "Mon, 17 Aug 2026 18:00:01 GMT" },
          status: 429
        })
      )
      .mockResolvedValueOnce(new Response("ok"))
    const client = new RetryingHttpClient({ fetch: request, maxAttempts: 2, requestTimeoutMs: 1000 })

    const response = client.get(new URL("https://provider.example/data"))
    await vi.advanceTimersByTimeAsync(999)
    expect(request).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    await expect(response).resolves.toMatchObject({ status: 200 })
    vi.useRealTimers()
  })

  it("resumes a bounded streaming download after a partial transport failure", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementationOnce((_input, init) => {
        expect(new Headers(init?.headers).get("range")).toBeNull()
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("abc"))
                setTimeout(() => controller.error(new Error("controlled disconnect")), 10)
              }
            }),
            { status: 200 }
          )
        )
      })
      .mockImplementationOnce((_input, init) => {
        expect(new Headers(init?.headers).get("range")).toBe("bytes=3-")
        return Promise.resolve(new Response("def", { status: 206 }))
      })
    const client = new RetryingHttpClient({ fetch: request, maxAttempts: 2, requestTimeoutMs: 1000 })

    const bytes = await client.getBytes(new URL("https://provider.example/archive"), 10)

    expect(new TextDecoder().decode(bytes)).toBe("abcdef")
    expect(client.metrics).toMatchObject({ attempts: 2, retries: 1, successfulRequests: 1 })
  })
})
