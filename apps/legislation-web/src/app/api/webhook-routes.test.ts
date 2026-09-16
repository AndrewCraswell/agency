import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleWebhookRequest } = vi.hoisted(() => ({
  handleWebhookRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../modules/request-handling/next/webhook-route-handler", () => ({ handleWebhookRequest }))

import * as rotateSecret from "./webhooks/[webhookId]/rotate-secret/route"
import * as detail from "./webhooks/[webhookId]/route"
import * as verify from "./webhooks/[webhookId]/verify/route"
import * as collection from "./webhooks/route"

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
const webhookId = "webhook%3Atenant-1%3Aupdates"

const routes: readonly RouteCase[] = [
  {
    documentedMethods: ["GET", "POST"],
    name: "collection",
    route: collection,
    url: "https://legislation.test/api/webhooks?limit=1"
  },
  {
    documentedMethods: ["DELETE", "GET", "PATCH"],
    name: "detail",
    route: detail,
    url: `https://legislation.test/api/webhooks/${webhookId}`
  },
  {
    documentedMethods: ["POST"],
    name: "rotate-secret",
    route: rotateSecret,
    url: `https://legislation.test/api/webhooks/${webhookId}/rotate-secret`
  },
  {
    documentedMethods: ["POST"],
    name: "verify",
    route: verify,
    url: `https://legislation.test/api/webhooks/${webhookId}/verify`
  }
]

function requestMethod(routeCase: RouteCase): Method {
  return routeCase.documentedMethods.includes("GET") ? "GET" : "POST"
}

beforeEach(() => {
  handleWebhookRequest.mockReset()
  handleWebhookRequest.mockImplementation(
    async (request) =>
      new Response(JSON.stringify({ delegatedMethod: request.method, delegatedUrl: request.url }), { status: 200 })
  )
})

describe("webhook Route Handlers", () => {
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
        expect(handleWebhookRequest).toHaveBeenCalledExactlyOnceWith(request)
        expect(handleWebhookRequest.mock.calls[0]?.[0]).toBe(request)
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
        expect(handleWebhookRequest).not.toHaveBeenCalled()
      }
    )
  }

  it.each(routes)("passes a trailing slash unchanged for $name", async (routeCase) => {
    const queryStart = routeCase.url.indexOf("?")
    const trailingSlashUrl =
      queryStart === -1
        ? `${routeCase.url}/`
        : `${routeCase.url.slice(0, queryStart)}/${routeCase.url.slice(queryStart)}`
    const method = requestMethod(routeCase)
    const request = new Request(trailingSlashUrl, { method })
    const response = await routeCase.route[method](request)

    expect(response.status).toBe(200)
    expect(handleWebhookRequest).toHaveBeenCalledExactlyOnceWith(request)
    expect(handleWebhookRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleWebhookRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })

  it("keeps the collection, detail, rotate-secret, and verify paths distinct", async () => {
    const routeRequests = routes.map((routeCase) => ({
      method: requestMethod(routeCase),
      request: new Request(routeCase.url, {
        method: requestMethod(routeCase)
      }),
      routeCase
    }))

    for (const { method, request, routeCase } of routeRequests) {
      await routeCase.route[method](request)
    }

    expect(handleWebhookRequest).toHaveBeenCalledTimes(routes.length)
    for (const [index, { request }] of routeRequests.entries()) {
      expect(handleWebhookRequest.mock.calls[index]?.[0]).toBe(request)
      expect(handleWebhookRequest.mock.calls[index]?.[0].url).toBe(request.url)
    }
  })
})
