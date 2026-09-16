import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleDocumentResourceRequest } = vi.hoisted(() => ({
  handleDocumentResourceRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../../modules/request-handling/next/document-resource-route-handler", () => ({
  handleDocumentResourceRequest
}))

import * as route from "./route"

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

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
const staticUrl = "https://legislation.test/api/resources/batch"

beforeEach(() => {
  handleDocumentResourceRequest.mockReset()
  handleDocumentResourceRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("document resource resource batch route handler", () => {
  it("delegates the documented static POST path and Request unchanged", async () => {
    const request = new Request(staticUrl, {
      body: JSON.stringify({ items: [{ id: "bill:ak:30:hb1", type: "bill" }] }),
      headers: { "content-type": "application/json", "x-correlation-id": "route-test" },
      method: "POST"
    })
    const response = await (route as RouteModule).POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: staticUrl })
    expect(handleDocumentResourceRequest).toHaveBeenCalledOnce()
    expect(handleDocumentResourceRequest).toHaveBeenCalledWith(request)
  })

  it("exports node runtime and the exact documented method surface", () => {
    const routeModule = route as RouteModule
    expect(routeModule.runtime).toBe("nodejs")
    expect(Object.keys(routeModule).sort()).toEqual([...methods, "runtime"].sort())
  })

  it.each(methods.filter((method) => method !== "POST"))(
    "returns the canonical not-found response for %s",
    async (method) => {
      const correlationId = `unsupported-${method.toLowerCase()}`
      const request = new Request(staticUrl, { headers: { "x-correlation-id": correlationId }, method })
      const response = await (route as RouteModule)[method](request)

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
    }
  )

  it("passes a trailing slash on the static path unchanged to the document resource handler", async () => {
    const trailingSlashUrl = `${staticUrl}/?limit=25`
    const request = new Request(trailingSlashUrl, { method: "POST" })
    const response = await (route as RouteModule).POST(request)

    expect(response.status).toBe(200)
    expect(handleDocumentResourceRequest).toHaveBeenCalledOnce()
    expect(handleDocumentResourceRequest).toHaveBeenCalledWith(request)
    expect(handleDocumentResourceRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })
})
