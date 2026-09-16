import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleSearchResearchRequest } = vi.hoisted(() => ({
  handleSearchResearchRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../modules/request-handling/next/search-research-route-handler", () => ({ handleSearchResearchRequest }))

import * as documentDiffs from "./document-diffs/route"
import * as researchAnswers from "./research/answers/route"
import * as allSearch from "./search/all/route"
import * as amendmentSearch from "./search/amendments/route"
import * as billSearch from "./search/bills/route"
import * as passageSearch from "./search/passages/route"
import * as supportingMaterialSearch from "./search/supporting-materials/route"

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

const unsupportedMethods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "PUT"] as const
type UnsupportedMethod = (typeof unsupportedMethods)[number]

const routes: readonly [string, RouteModule, string][] = [
  ["bill search", billSearch, "https://legislation.test/api/search/bills"],
  ["amendment search", amendmentSearch, "https://legislation.test/api/search/amendments"],
  ["passage search", passageSearch, "https://legislation.test/api/search/passages"],
  ["supporting-material search", supportingMaterialSearch, "https://legislation.test/api/search/supporting-materials"],
  ["all search", allSearch, "https://legislation.test/api/search/all"],
  ["document diffs", documentDiffs, "https://legislation.test/api/document-diffs"],
  ["research answers", researchAnswers, "https://legislation.test/api/research/answers"]
]

beforeEach(() => {
  handleSearchResearchRequest.mockReset()
  handleSearchResearchRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("search and research route handlers", () => {
  it.each(routes)("delegates the exact %s Request unchanged to POST", async (_name, route, url) => {
    const request = new Request(url, {
      body: JSON.stringify({ query: "fixture" }),
      headers: { "content-type": "application/json", "x-correlation-id": "route-test" },
      method: "POST"
    })
    const response = await route.POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleSearchResearchRequest).toHaveBeenCalledOnce()
    expect(handleSearchResearchRequest).toHaveBeenCalledWith(request)
    expect(handleSearchResearchRequest.mock.calls[0]?.[0]).toBe(request)
  })

  it.each(routes)("exports node runtime and exact documented method surface for %s", (_name, route) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "runtime"])
  })

  it.each(routes)("returns the shared not-found response for unsupported methods on %s", async (_name, route, url) => {
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
    expect(handleSearchResearchRequest).not.toHaveBeenCalled()
  })

  it.each(routes)("passes a trailing slash unchanged to the shared boundary for %s", async (_name, route, url) => {
    const request = new Request(`${url}/`, {
      body: JSON.stringify({ query: "fixture" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const response = await route.POST(request)

    expect(response.status).toBe(200)
    expect(handleSearchResearchRequest).toHaveBeenCalledWith(request)
    expect(handleSearchResearchRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleSearchResearchRequest.mock.calls[0]?.[0].url).toBe(`${url}/`)
  })
})
