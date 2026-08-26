import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleBillAmendmentVoteRequest } = vi.hoisted(() => ({
  handleBillAmendmentVoteRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/bill-amendment-vote-route-handler", () => ({ handleBillAmendmentVoteRequest }))

import * as amendmentBatch from "./amendments/batch/route"
import * as billBatch from "./batch/route"

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
  ["bills", billBatch, "https://legislation.test/api/bills/batch"],
  ["amendments", amendmentBatch, "https://legislation.test/api/bills/amendments/batch"]
]

const unsupportedBodyMethods = ["DELETE", "GET", "OPTIONS", "PATCH", "PUT"] as const

beforeEach(() => {
  handleBillAmendmentVoteRequest.mockReset()
  handleBillAmendmentVoteRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("bill, amendment, and vote batch route handlers", () => {
  it.each(routes)("delegates the %s POST URL unchanged", async (_name, route, url) => {
    const request = new Request(url, {
      body: JSON.stringify({ ids: ["bill:us:119:hr:1"] }),
      headers: { "content-type": "application/json", "x-correlation-id": "batch-route-test" },
      method: "POST"
    })
    const response = await route.POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleBillAmendmentVoteRequest).toHaveBeenCalledOnce()
    expect(handleBillAmendmentVoteRequest).toHaveBeenCalledWith(request)
  })

  it.each(routes)("exports node runtime and the exact documented method surface for %s", (_name, route) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "runtime"])
  })

  it.each(routes)("returns the shared not-found response for unsupported methods on %s", async (_name, route, url) => {
    for (const method of unsupportedBodyMethods) {
      const request = new Request(url, { headers: { "x-correlation-id": "unsupported-batch-route" }, method })
      const response = await route[method](request)

      expect(response.status).toBe(404)
      expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      expect(response.headers.get("x-correlation-id")).toBe("unsupported-batch-route")
      await expect(response.json()).resolves.toEqual({
        error: {
          category: "not_found",
          correlationId: "unsupported-batch-route",
          message: "API route was not found",
          retryable: false
        }
      })
    }

    expect(handleBillAmendmentVoteRequest).not.toHaveBeenCalled()
  })

  it.each(routes)("returns the shared not-found response without a body for HEAD on %s", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "unsupported-batch-head" }, method: "HEAD" })
    const response = await route.HEAD(request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe("unsupported-batch-head")
    await expect(response.text()).resolves.toBe("")
    expect(handleBillAmendmentVoteRequest).not.toHaveBeenCalled()
  })
})
