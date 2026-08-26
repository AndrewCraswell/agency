import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx02Request } = vi.hoisted(() => ({
  handleNx02Request: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/nx02", () => ({ handleNx02Request }))

import * as bills from "./[sessionId]/bills/route"
import * as meetings from "./[sessionId]/meetings/route"
import * as detail from "./[sessionId]/route"

type RouteModule = Readonly<{
  DELETE: (request: Request) => Promise<Response>
  GET: (request: Request) => Promise<Response>
  HEAD: (request: Request) => Promise<Response>
  OPTIONS: (request: Request) => Promise<Response>
  PATCH: (request: Request) => Promise<Response>
  POST: (request: Request) => Promise<Response>
  PUT: (request: Request) => Promise<Response>
  runtime: "nodejs"
}>

const routes: readonly [string, RouteModule, string][] = [
  ["detail", detail, "https://legislation.test/api/sessions/session%3Aak%3A30"],
  ["bills", bills, "https://legislation.test/api/sessions/session%3Aak%3A30/bills"],
  ["meetings", meetings, "https://legislation.test/api/sessions/session%3Aak%3A30/meetings"]
]

beforeEach(() => {
  handleNx02Request.mockReset()
  handleNx02Request.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-02A session route handlers", () => {
  it.each(routes)("delegates the %s URL unchanged", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleNx02Request).toHaveBeenCalledOnce()
    expect(handleNx02Request).toHaveBeenCalledWith(request)
  })

  it.each(routes)("exports node runtime and the exact documented method surface for %s", (_name, route) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "runtime"])
  })

  it.each(routes)("returns the shared not-found response for unsupported methods on %s", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "unsupported-route" }, method: "POST" })
    const response = await route.POST(request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("x-correlation-id")).toBe("unsupported-route")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "not_found",
        correlationId: "unsupported-route",
        message: "API route was not found",
        retryable: false
      }
    })
    expect(handleNx02Request).not.toHaveBeenCalled()
  })

  it.each(routes)("passes a trailing slash unchanged to the shared boundary for %s", async (_name, route, url) => {
    const trailingSlashUrl = `${url}/`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleNx02Request).toHaveBeenCalledWith(request)
    expect(handleNx02Request.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })
})
