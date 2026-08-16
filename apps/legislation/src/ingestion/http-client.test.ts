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

  it("rejects oversized responses", async () => {
    await expect(readBounded(new Response("12345"), 4)).rejects.toBeInstanceOf(ProviderHttpError)
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
