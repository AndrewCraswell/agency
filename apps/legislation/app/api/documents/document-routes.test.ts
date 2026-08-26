import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleDocumentResourceRequest } = vi.hoisted(() => ({
  handleDocumentResourceRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/document-resource-route-handler", () => ({ handleDocumentResourceRequest }))

import * as detail from "./[documentId]/route"
import * as sectionDetail from "./[documentId]/sections/[sectionId]/route"
import * as sections from "./[documentId]/sections/route"

type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT"

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

type RouteCase = Readonly<{
  name: string
  route: RouteModule
  url: string
}>

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]

const routes: readonly RouteCase[] = [
  {
    name: "detail",
    route: detail,
    url: "https://legislation.test/api/documents/document%3Aak%3A1"
  },
  {
    name: "sections",
    route: sections,
    url: "https://legislation.test/api/documents/document%3Aak%3A1/sections?limit=1"
  },
  {
    name: "section detail",
    route: sectionDetail,
    url: "https://legislation.test/api/documents/document%3Aak%3A1/sections/section%3A1"
  }
]

beforeEach(() => {
  handleDocumentResourceRequest.mockReset()
  handleDocumentResourceRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("document resource document route handlers", () => {
  it.each(routes)("delegates the $name URL and Request unchanged", async ({ route, url }) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleDocumentResourceRequest).toHaveBeenCalledOnce()
    expect(handleDocumentResourceRequest).toHaveBeenCalledWith(request)
    expect(handleDocumentResourceRequest.mock.calls[0]?.[0]).toBe(request)
  })

  it.each(routes)("exports node runtime and the exact method surface for $name", ({ route }) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })

  it.each(
    routes.flatMap(({ name, route, url }) =>
      methods.filter((method) => method !== "GET").map((method) => ({ method, name, route, url }))
    )
  )("returns the canonical not-found response for $method $name", async ({ method, route, url }) => {
    const correlationId = `${method.toLowerCase()}-${url.split("/api/")[1]}`
    const request = new Request(url, { headers: { "x-correlation-id": correlationId }, method })
    const response = await route[method](request)

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
    expect(handleDocumentResourceRequest).not.toHaveBeenCalled()
  })

  it.each(routes)(
    "passes a trailing slash unchanged to the document resource handler for $name",
    async ({ route, url }) => {
      const queryStart = url.indexOf("?")
      const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
      const request = new Request(trailingSlashUrl)
      const response = await route.GET(request)

      expect(response.status).toBe(200)
      expect(handleDocumentResourceRequest).toHaveBeenCalledOnce()
      expect(handleDocumentResourceRequest).toHaveBeenCalledWith(request)
      expect(handleDocumentResourceRequest.mock.calls[0]?.[0]).toBe(request)
      expect(handleDocumentResourceRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
    }
  )
})
