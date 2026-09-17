import { APICallError, StreamProviderError } from "ai"
import { describe, expect, it, vi } from "vitest"
import { providerFailure, recoverProviderCall, type ProviderAttempt } from "./providerRecovery"

function rejection(status: number, reason?: string) {
  return new APICallError({
    message: "Provider rejection",
    url: "https://example.org",
    requestBodyValues: {},
    statusCode: status,
    responseBody: JSON.stringify({ error: { metadata: { reason } } }),
    responseHeaders: { "retry-after": "120" },
    isRetryable: false
  })
}

describe("provider recovery", () => {
  it("classifies streaming rate limits as infrastructure without exporting provider data", () => {
    const failure = providerFailure(
      new StreamProviderError({ message: "Rate limited", statusCode: 429, data: { privateValue: "hidden" } })
    )
    expect(failure).toMatchObject({ httpStatus: 429, infrastructure: true, temporary: true, stopRun: true })
    expect(JSON.stringify(failure)).not.toContain("hidden")
  })
  it("honors temporary reservation backoff and counts every attempt", async () => {
    const attempts: ProviderAttempt[] = []
    const claim = vi.fn<() => void>()
    const delay = vi.fn<(milliseconds: number, signal: AbortSignal) => Promise<void>>().mockResolvedValue()
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(rejection(402, "in_flight_budget_exhausted"))
      .mockResolvedValue("scored")
    const signal = new AbortController().signal
    await expect(recoverProviderCall({ operation, claim, signal, attempts, delay })).resolves.toBe("scored")
    expect(claim).toHaveBeenCalledTimes(2)
    expect(delay).toHaveBeenCalledWith(120000, signal)
    expect(attempts[0]?.temporary).toBe(true)
  })

  it.each([401, 402, 403])("does not retry permanent or ambiguous HTTP %s", async (status) => {
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(rejection(status))
    const delay = vi.fn<(milliseconds: number, signal: AbortSignal) => Promise<void>>()
    await expect(
      recoverProviderCall({
        operation,
        claim: () => undefined,
        signal: new AbortController().signal,
        attempts: [],
        delay
      })
    ).rejects.toThrow("Provider rejection")
    expect(operation).toHaveBeenCalledTimes(1)
    expect(delay).not.toHaveBeenCalled()
  })

  it("bounds transient retries at three attempts", async () => {
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(rejection(429))
    const delay = vi.fn<(milliseconds: number, signal: AbortSignal) => Promise<void>>().mockResolvedValue()
    await expect(
      recoverProviderCall({
        operation,
        claim: () => undefined,
        signal: new AbortController().signal,
        attempts: [],
        delay
      })
    ).rejects.toThrow("Provider rejection")
    expect(operation).toHaveBeenCalledTimes(3)
    expect(delay).toHaveBeenCalledTimes(2)
  })

  it("classifies DNS failures as infrastructure without leaking request data", () => {
    const error = new APICallError({
      message: "secret diagnostic",
      url: "https://example.org",
      requestBodyValues: { secret: "private" },
      cause: Object.assign(new Error("DNS failed"), { code: "ENOTFOUND" }),
      isRetryable: true
    })
    const failure = providerFailure(error)
    expect(failure).toMatchObject({ infrastructure: true, temporary: true, networkCode: "ENOTFOUND" })
    expect(JSON.stringify(failure)).not.toContain("private")
    expect(JSON.stringify(failure)).not.toContain("secret")
  })

  it("does not replay an ambiguous connection reset or retry after cancellation", async () => {
    expect(
      providerFailure(
        new APICallError({
          message: "reset",
          url: "https://example.org",
          requestBodyValues: {},
          cause: Object.assign(new Error(), { code: "ECONNRESET" }),
          isRetryable: true
        })
      ).temporary
    ).toBe(false)
    const controller = new AbortController()
    controller.abort()
    const operation = vi.fn<() => Promise<void>>()
    await expect(
      recoverProviderCall({ operation, claim: () => undefined, signal: controller.signal, attempts: [] })
    ).rejects.toThrow(/abort/i)
    expect(operation).not.toHaveBeenCalled()
  })
})
