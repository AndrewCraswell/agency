import { describe, expect, it } from "vitest"
import { isTransientHttpStatus, isTransientRequestFailure, waitForRequestRetry } from "./request-retry"

describe("dependency retry policy", () => {
  it.each([408, 429, 500, 502, 503, 504])("allows transient HTTP %s", (status) => {
    expect(isTransientHttpStatus(status)).toBe(true)
  })

  it.each([400, 401, 402, 403, 404, 413, 422, 501, 505])("rejects permanent HTTP %s", (status) => {
    expect(isTransientHttpStatus(status)).toBe(false)
  })

  it.each(["EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "UND_ERR_SOCKET"])(
    "recognizes wrapped transient connection code %s",
    (code) => {
      expect(
        isTransientRequestFailure(new TypeError("fetch failed", { cause: Object.assign(new Error(), { code }) }))
      ).toBe(true)
    }
  )

  it("rejects arbitrary errors, non-transient DNS errors and aborts regardless of their message", () => {
    expect(isTransientRequestFailure(new TypeError("ECONNRESET"))).toBe(false)
    expect(isTransientRequestFailure(Object.assign(new Error(), { code: "ENOTFOUND" }))).toBe(false)
    expect(isTransientRequestFailure(new DOMException("ETIMEDOUT", "AbortError"))).toBe(false)
    expect(isTransientRequestFailure(new DOMException("deadline", "TimeoutError"))).toBe(true)
    expect(isTransientRequestFailure("ECONNRESET")).toBe(false)
  })

  it("interrupts an active retry delay without waiting for the next attempt", async () => {
    const controller = new AbortController()
    const result = waitForRequestRetry(5, controller.signal)
    const failure = expect(result).rejects.toMatchObject({ name: "AbortError" })
    controller.abort()
    await failure
  })

  it("rejects an already-aborted retry without starting a delay", async () => {
    const reason = new Error("Cancelled by caller")
    await expect(waitForRequestRetry(1, AbortSignal.abort(reason))).rejects.toBe(reason)
  })
})
