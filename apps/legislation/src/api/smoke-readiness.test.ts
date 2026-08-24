import { describe, expect, it } from "vitest"
import { fetchWithTimeout } from "./smoke-readiness.js"

describe("smoke readiness fetch", () => {
  it("passes through a completed readiness response", async () => {
    const response = await fetchWithTimeout(
      async (_input, init) => {
        expect(init?.signal).toBeDefined()
        return new Response(null, { status: 204 })
      },
      "http://localhost/health",
      100
    )

    expect(response.status).toBe(204)
  })

  it("aborts a hung readiness fetch at the configured bound", async () => {
    let observedAbort = false
    const hangingFetch = async (_input: string | URL, init?: RequestInit): Promise<Response> => {
      const signal = init?.signal
      if (signal === undefined || signal === null) {
        throw new Error("expected an abort signal")
      }
      return await new Promise<Response>((_resolve, reject) => {
        const onAbort = () => {
          observedAbort = true
          reject(signal.reason)
        }
        signal.addEventListener("abort", onAbort, { once: true })
      })
    }

    await expect(fetchWithTimeout(hangingFetch, "http://localhost/ready", 5)).rejects.toBeDefined()
    expect(observedAbort).toBe(true)
  })
})
