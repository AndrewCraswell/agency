import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleBillAmendmentVoteRequest } = vi.hoisted(() => ({
  handleBillAmendmentVoteRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../modules/request-handling/next/bill-amendment-vote-route-handler", () => ({
  handleBillAmendmentVoteRequest
}))

import * as detail from "./[amendmentId]/route"
import * as batch from "./batch/route"
import * as collection from "./route"

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
  supportedMethod: "GET" | "POST"
  url: string
}>

const routes: readonly RouteCase[] = [
  {
    name: "collection",
    route: collection,
    supportedMethod: "GET",
    url: "https://legislation.test/api/amendments?limit=1"
  },
  {
    name: "batch",
    route: batch,
    supportedMethod: "POST",
    url: "https://legislation.test/api/amendments/batch"
  },
  {
    name: "detail",
    route: detail,
    supportedMethod: "GET",
    url: "https://legislation.test/api/amendments/amendment%3Aak%3A1"
  }
]

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]

beforeEach(() => {
  handleBillAmendmentVoteRequest.mockReset()
  handleBillAmendmentVoteRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("bill, amendment, and vote amendment route handlers", () => {
  it.each(routes)(
    "delegates the supported method for the $name route unchanged",
    async ({ route, supportedMethod, url }) => {
      const request = new Request(url, { headers: { "x-correlation-id": "route-test" }, method: supportedMethod })
      const response = await route[supportedMethod](request)

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
      expect(handleBillAmendmentVoteRequest).toHaveBeenCalledOnce()
      expect(handleBillAmendmentVoteRequest).toHaveBeenCalledWith(request)
    }
  )

  it.each(routes)("exports node runtime and the exact method surface for the $name route", ({ route }) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })

  it.each(
    routes.flatMap(({ name, route, supportedMethod, url }) =>
      methods.filter((method) => method !== supportedMethod).map((method) => ({ method, name, route, url }))
    )
  )("returns the canonical not-found response for the $method $name route", async ({ method, name, route, url }) => {
    const request = new Request(url, { headers: { "x-correlation-id": `${name}-unsupported` }, method })
    const response = await route[method](request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe(`${name}-unsupported`)
    const expectedBody =
      method === "HEAD"
        ? ""
        : JSON.stringify({
            error: {
              category: "not_found",
              correlationId: `${name}-unsupported`,
              message: "API route was not found",
              retryable: false
            }
          })
    await expect(response.text()).resolves.toBe(expectedBody)
    expect(handleBillAmendmentVoteRequest).not.toHaveBeenCalled()
  })
})
