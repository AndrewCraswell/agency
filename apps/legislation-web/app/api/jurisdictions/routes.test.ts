import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx02Request } = vi.hoisted(() => ({
  handleNx02Request: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("legislation/server/next/nx02", () => ({ handleNx02Request }))

import * as bills from "./[jurisdictionId]/bills/route"
import * as commissions from "./[jurisdictionId]/commissions/route"
import * as committees from "./[jurisdictionId]/committees/route"
import * as meetings from "./[jurisdictionId]/meetings/route"
import * as organizations from "./[jurisdictionId]/organizations/route"
import * as detail from "./[jurisdictionId]/route"
import * as sessions from "./[jurisdictionId]/sessions/route"
import * as collection from "./route"

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
  ["collection", collection, "https://legislation.test/api/jurisdictions?limit=1"],
  ["detail", detail, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak"],
  ["sessions", sessions, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak/sessions"],
  ["bills", bills, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak/bills"],
  ["organizations", organizations, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak/organizations"],
  ["commissions", commissions, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak/commissions"],
  ["committees", committees, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak/committees"],
  ["meetings", meetings, "https://legislation.test/api/jurisdictions/jurisdiction%3Aak/meetings"]
]

beforeEach(() => {
  handleNx02Request.mockReset()
  handleNx02Request.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-02A jurisdiction route handlers", () => {
  it.each(routes)("delegates the %s dynamic URL unchanged", async (_name, route, url) => {
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
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe("unsupported-route")
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
})
