import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx02cRequest } = vi.hoisted(() => ({
  handleNx02cRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/nx02c", () => ({ handleNx02cRequest }))

import * as detail from "./[materialId]/route"
import * as section from "./[materialId]/sections/[sectionId]/route"
import * as sections from "./[materialId]/sections/route"
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

const unsupportedMethods = ["DELETE", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const
type UnsupportedMethod = (typeof unsupportedMethods)[number]

const routes: readonly [string, RouteModule, string][] = [
  ["collection", collection, "https://legislation.test/api/supporting-materials?limit=1"],
  ["detail", detail, "https://legislation.test/api/supporting-materials/material%3Afixture"],
  ["sections", sections, "https://legislation.test/api/supporting-materials/material%3Afixture/sections?limit=1"],
  [
    "section",
    section,
    "https://legislation.test/api/supporting-materials/material%3Afixture/sections/section%3Afixture"
  ]
]

beforeEach(() => {
  handleNx02cRequest.mockReset()
  handleNx02cRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-02C supporting-material route handlers", () => {
  it.each(routes)("delegates the %s URL unchanged", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleNx02cRequest).toHaveBeenCalledOnce()
    expect(handleNx02cRequest).toHaveBeenCalledWith(request)
  })

  it.each(routes)("exports node runtime and the exact documented method surface for %s", (_name, route) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "runtime"])
  })

  it.each(routes)(
    "returns the shared not-found response for every unsupported method on %s",
    async (_name, route, url) => {
      for (const method of unsupportedMethods) {
        const correlationId = `unsupported-${method.toLowerCase()}`
        const request = new Request(url, { headers: { "x-correlation-id": correlationId }, method })
        const response = await route[method as UnsupportedMethod](request)

        expect(response.status).toBe(404)
        expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
        expect(response.headers.get("cache-control")).toBe("private, no-store")
        expect(response.headers.get("x-correlation-id")).toBe(correlationId)
        const expectedBody =
          method === "HEAD"
            ? ""
            : JSON.stringify({
                error: {
                  category: "not_found",
                  correlationId,
                  message: "API route was not found",
                  retryable: false
                }
              })
        await expect(response.text()).resolves.toBe(expectedBody)
      }
      expect(handleNx02cRequest).not.toHaveBeenCalled()
    }
  )

  it.each(routes)("passes a trailing slash unchanged to the shared boundary for %s", async (_name, route, url) => {
    const queryStart = url.indexOf("?")
    const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleNx02cRequest).toHaveBeenCalledWith(request)
    expect(handleNx02cRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })
})
