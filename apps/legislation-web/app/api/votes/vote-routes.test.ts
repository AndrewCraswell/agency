import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx02bRequest } = vi.hoisted(() => ({
  handleNx02bRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("legislation/server/next/nx02b", () => ({ handleNx02bRequest }))

import * as positions from "./[voteId]/positions/route"
import * as detail from "./[voteId]/route"
import * as batch from "./batch/route"
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

const methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const

const routes: readonly {
  method: "GET" | "POST"
  name: string
  route: RouteModule
  trailingSlashUrl: string
  url: string
}[] = [
  {
    method: "GET",
    name: "collection",
    route: collection,
    trailingSlashUrl: "https://legislation.test/api/votes/?limit=1",
    url: "https://legislation.test/api/votes?limit=1"
  },
  {
    method: "POST",
    name: "batch",
    route: batch,
    trailingSlashUrl: "https://legislation.test/api/votes/batch/",
    url: "https://legislation.test/api/votes/batch"
  },
  {
    method: "GET",
    name: "detail",
    route: detail,
    trailingSlashUrl: "https://legislation.test/api/votes/vote%3Aus%3A119%3Ahouse%3A1/",
    url: "https://legislation.test/api/votes/vote%3Aus%3A119%3Ahouse%3A1"
  },
  {
    method: "GET",
    name: "positions",
    route: positions,
    trailingSlashUrl: "https://legislation.test/api/votes/vote%3Aus%3A119%3Ahouse%3A1/positions/",
    url: "https://legislation.test/api/votes/vote%3Aus%3A119%3Ahouse%3A1/positions"
  }
]

beforeEach(() => {
  handleNx02bRequest.mockReset()
  handleNx02bRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-02B vote route handlers", () => {
  it.each(routes)("delegates the %s URL unchanged", async ({ method, route, url }) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" }, method })
    const response = await route[method](request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleNx02bRequest).toHaveBeenCalledOnce()
    expect(handleNx02bRequest).toHaveBeenCalledWith(request)
  })

  it.each(routes)("exports node runtime and the exact documented method surface for %s", ({ route }) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "runtime"])
  })

  it("returns the canonical not-found response for every unsupported method", async () => {
    for (const { method: supportedMethod, route, url } of routes) {
      for (const method of methods) {
        if (method === supportedMethod) {
          continue
        }

        const request = new Request(url, { headers: { "x-correlation-id": "unsupported-route" }, method })
        const response = await route[method](request)

        expect(response.status).toBe(404)
        expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
        expect(response.headers.get("x-correlation-id")).toBe("unsupported-route")
        expect(response.headers.get("cache-control")).toBe("private, no-store")
        const body = method === "HEAD" ? await response.text() : await response.json()
        expect(body).toEqual(
          method === "HEAD"
            ? ""
            : {
                error: {
                  category: "not_found",
                  correlationId: "unsupported-route",
                  message: "API route was not found",
                  retryable: false
                }
              }
        )
      }
    }

    expect(handleNx02bRequest).not.toHaveBeenCalled()
  })

  it.each(routes)(
    "passes a trailing slash unchanged to the shared boundary for %s",
    async ({ method, route, trailingSlashUrl }) => {
      const request = new Request(trailingSlashUrl, { method })
      const response = await route[method](request)

      expect(response.status).toBe(200)
      expect(handleNx02bRequest).toHaveBeenCalledWith(request)
      expect(handleNx02bRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
    }
  )
})
