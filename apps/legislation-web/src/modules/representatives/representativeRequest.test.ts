import { LegislationError } from "@repo/legislation-core/domain/errors"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { createRepresentativeLookup } from "./representativeLookup"
import { createRepresentativeRequestHandler } from "./representativeRequest"

vi.mock("@sentry/core", () => ({ captureException: vi.fn<typeof import("@sentry/core").captureException>() }))
afterEach(() => vi.clearAllMocks())

function request(body: unknown = { latitude: 38.889, longitude: -77.009 }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/dev/representatives", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}
const result = { status: "no_match", jurisdictions: [], representatives: [], warnings: ["No match."] } as const
function setup(environment = "development") {
  const lookup = vi.fn<ReturnType<typeof createRepresentativeLookup>>().mockResolvedValue({
    ...result,
    jurisdictions: [],
    representatives: [],
    warnings: [...result.warnings]
  })
  const getLookup = vi.fn<() => ReturnType<typeof createRepresentativeLookup>>(() => lookup)
  return {
    lookup,
    getLookup,
    handle: createRepresentativeRequestHandler({ environment: () => environment, getLookup })
  }
}

describe("development representative endpoint", () => {
  it.each(["production", "test"])(
    "is unavailable in %s before loading credentials or dependencies",
    async (environment) => {
      const { handle, getLookup } = setup(environment)
      expect((await handle(request())).status).toBe(404)
      expect(getLookup).not.toHaveBeenCalled()
    }
  )

  it("returns a no-store envelope without reflecting the location", async () => {
    const { handle, lookup } = setup()
    const response = await handle(request())
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(await response.json()).toMatchObject({ data: result, links: { self: "/api/dev/representatives" } })
    expect(lookup).toHaveBeenCalledWith({ latitude: 38.889, longitude: -77.009 }, expect.any(AbortSignal))
  })

  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000"])(
    "accepts the browser-facing host %s when the server URL uses localhost",
    async (host) => {
      const { handle, lookup } = setup()
      const input = request(undefined, `http://${host}`)
      input.headers.set("host", host)
      input.headers.set("sec-fetch-site", "same-origin")
      expect((await handle(input)).status).toBe(200)
      expect(lookup).toHaveBeenCalledOnce()
    }
  )

  it.each([
    { origin: "http://localhost:3000", site: "same-origin" },
    { origin: "http://127.0.0.1:3001", site: "same-origin" },
    { origin: "http://127.0.0.1:3000", site: "cross-site" }
  ])("rejects a mismatched origin or cross-site request: $origin / $site", async ({ origin, site }) => {
    const { handle, getLookup } = setup()
    const input = request(undefined, origin)
    input.headers.set("host", "127.0.0.1:3000")
    input.headers.set("sec-fetch-site", site)
    expect((await handle(input)).status).toBe(403)
    expect(getLookup).not.toHaveBeenCalled()
  })

  it("rejects cross-origin requests and invalid input before a billable lookup", async () => {
    const { handle, getLookup } = setup()
    expect((await handle(request({}, "https://attacker.example"))).status).toBe(403)
    expect((await handle(request({ latitude: 91, longitude: 0 }))).status).toBe(400)
    expect((await handle(request({ address: "x".repeat(3000) }))).status).toBe(413)
    expect(getLookup).not.toHaveBeenCalled()
  })

  it("rejects query strings and unsupported content types", async () => {
    const { handle, getLookup } = setup()
    const queryRequest = new Request("http://localhost:3000/api/dev/representatives?latitude=1", request())
    expect((await handle(queryRequest)).status).toBe(400)
    const input = request()
    input.headers.set("content-type", "text/plain")
    expect((await handle(input)).status).toBe(400)
    expect(getLookup).not.toHaveBeenCalled()
  })

  it("preserves safe configuration errors but drops raw failure payloads and causes", async () => {
    const { handle, lookup } = setup()
    lookup.mockRejectedValueOnce(new LegislationError("dependency_unavailable", "Configure GEOCODIO_API_KEY."))
    const configured = await handle(request())
    expect(configured.status).toBe(503)
    expect(await configured.text()).toContain("Configure GEOCODIO_API_KEY.")
    lookup.mockRejectedValueOnce(new Error("private address and secret key"))
    const failed = await handle(request())
    expect(failed.status).toBe(500)
    expect(await failed.text()).not.toContain("private address")
  })

  it("bounds paid development calls and releases the in-flight slot after failures", async () => {
    let time = 100_000
    const { lookup } = setup()
    const handle = createRepresentativeRequestHandler({
      environment: () => "development",
      getLookup: () => lookup,
      now: () => time
    })
    for (let index = 0; index < 30; index += 1) {
      expect((await handle(request())).status).toBe(200)
    }
    expect((await handle(request())).status).toBe(503)
    expect(lookup).toHaveBeenCalledTimes(30)
    time += 60_001
    expect((await handle(request())).status).toBe(200)
  })

  it("prevents concurrent calls without releasing another request's slot", async () => {
    const { handle, lookup } = setup()
    const pending = Promise.withResolvers<Awaited<ReturnType<ReturnType<typeof createRepresentativeLookup>>>>()
    lookup.mockReturnValueOnce(pending.promise)
    const first = handle(request())
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledTimes(1))
    expect((await handle(request())).status).toBe(503)
    expect((await handle(request())).status).toBe(503)
    pending.resolve({ ...result, jurisdictions: [], representatives: [], warnings: [...result.warnings] })
    expect((await first).status).toBe(200)
    expect((await handle(request())).status).toBe(200)
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it("does not call the provider after cancellation", async () => {
    const { handle, getLookup } = setup()
    const controller = new AbortController()
    controller.abort()
    const response = await handle(new Request(request(), { signal: controller.signal }))
    expect(response.status).toBe(503)
    expect(getLookup).not.toHaveBeenCalled()
  })
})
