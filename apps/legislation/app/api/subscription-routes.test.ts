import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx05aRequest } = vi.hoisted(() => ({
  handleNx05aRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../src/server/next/nx05a", () => ({ handleNx05aRequest }))

import * as deliveries from "./subscriptions/[subscriptionId]/deliveries/route"
import * as events from "./subscriptions/[subscriptionId]/events/route"
import * as detail from "./subscriptions/[subscriptionId]/route"
import * as collection from "./subscriptions/route"

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
  documentedMethods: readonly Method[]
  name: string
  route: RouteModule
  url: string
}>

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
const subscriptionId = "subscription%3Atenant-1%3Abills"

const routes: readonly RouteCase[] = [
  {
    documentedMethods: ["GET", "POST"],
    name: "collection",
    route: collection,
    url: "https://legislation.test/api/subscriptions?limit=1"
  },
  {
    documentedMethods: ["DELETE", "GET", "PATCH"],
    name: "detail",
    route: detail,
    url: `https://legislation.test/api/subscriptions/${subscriptionId}`
  },
  {
    documentedMethods: ["GET"],
    name: "events",
    route: events,
    url: `https://legislation.test/api/subscriptions/${subscriptionId}/events?limit=1`
  },
  {
    documentedMethods: ["GET"],
    name: "deliveries",
    route: deliveries,
    url: `https://legislation.test/api/subscriptions/${subscriptionId}/deliveries?limit=1`
  }
]

beforeEach(() => {
  handleNx05aRequest.mockReset()
  handleNx05aRequest.mockImplementation(
    async (request) =>
      new Response(JSON.stringify({ delegatedMethod: request.method, delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-05A subscription route handlers", () => {
  for (const routeCase of routes) {
    it.each(routeCase.documentedMethods)(
      `delegates the exact ${routeCase.name} %s Request unchanged`,
      async (method) => {
        const request = new Request(routeCase.url, {
          headers: { "x-correlation-id": "route-test" },
          method
        })
        const response = await routeCase.route[method](request)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
          delegatedMethod: method,
          delegatedUrl: routeCase.url
        })
        expect(handleNx05aRequest).toHaveBeenCalledExactlyOnceWith(request)
        expect(handleNx05aRequest.mock.calls[0]?.[0]).toBe(request)
      }
    )
  }

  it.each(routes)("exports node runtime and the exact standard method surface for $name", ({ route }) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })

  for (const routeCase of routes) {
    const unsupportedMethods = methods.filter((method) => !routeCase.documentedMethods.includes(method))

    it.each(unsupportedMethods)(
      `returns the shared not-found response for unsupported ${routeCase.name} %s`,
      async (method) => {
        const correlationId = `unsupported-${routeCase.name}-${method.toLowerCase()}`
        const request = new Request(routeCase.url, {
          headers: { "x-correlation-id": correlationId },
          method
        })
        const response = await routeCase.route[method](request)

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
        expect(handleNx05aRequest).not.toHaveBeenCalled()
      }
    )
  }

  it.each(routes)("passes a trailing slash unchanged for $name", async ({ route, url }) => {
    const queryStart = url.indexOf("?")
    const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleNx05aRequest).toHaveBeenCalledExactlyOnceWith(request)
    expect(handleNx05aRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleNx05aRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })

  it("keeps the collection, detail, events, and deliveries paths distinct", async () => {
    const routeRequests = routes.map((routeCase) => ({ request: new Request(routeCase.url), routeCase }))

    for (const { request, routeCase } of routeRequests) {
      await routeCase.route.GET(request)
    }

    expect(handleNx05aRequest).toHaveBeenCalledTimes(routes.length)
    for (const [index, { request }] of routeRequests.entries()) {
      expect(handleNx05aRequest.mock.calls[index]?.[0]).toBe(request)
      expect(handleNx05aRequest.mock.calls[index]?.[0].url).toBe(request.url)
    }
  })
})
