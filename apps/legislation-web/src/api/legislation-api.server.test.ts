import { describe, expect, it, vi } from "vitest"
import {
  LegislationApiUnavailableError,
  createLegislationApiClient,
  createLegislationApiClientFromEnvironment
} from "./legislation-api.server"

describe("createLegislationApiClient", () => {
  it("reads the configured API readiness endpoint without caching", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "ready" }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    )
    const client = createLegislationApiClient({ baseUrl: "https://api.example.test", fetch: request })

    await expect(client.getReadiness()).resolves.toEqual({ status: "ready" })
    expect(request).toHaveBeenCalledWith(new URL("https://api.example.test/ready"), {
      cache: "no-store",
      signal: expect.any(AbortSignal)
    })
  })

  it("rejects a malformed readiness response", async () => {
    const client = createLegislationApiClient({
      baseUrl: "https://api.example.test",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
          headers: { "content-type": "application/json" },
          status: 200
        })
      )
    })

    await expect(client.getReadiness()).rejects.toBeInstanceOf(LegislationApiUnavailableError)
  })

  it("rejects a non-JSON readiness response", async () => {
    const client = createLegislationApiClient({
      baseUrl: "https://api.example.test",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("ready", { status: 200 }))
    })

    await expect(client.getReadiness()).rejects.toBeInstanceOf(LegislationApiUnavailableError)
  })

  it("does not create a client until an API origin is configured", () => {
    expect(createLegislationApiClientFromEnvironment({})).toBeUndefined()
  })

  it("rejects an API base URL that contains a path", () => {
    expect(() => createLegislationApiClient({ baseUrl: "https://api.example.test/not-an-origin" })).toThrow(TypeError)
  })
})
