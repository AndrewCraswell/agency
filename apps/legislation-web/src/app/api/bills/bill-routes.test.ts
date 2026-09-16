import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleBillAmendmentVoteRequest } = vi.hoisted(() => ({
  handleBillAmendmentVoteRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../modules/request-handling/next/bill-amendment-vote-route-handler", () => ({
  handleBillAmendmentVoteRequest
}))

import * as amendments from "./[billId]/amendments/route"
import * as changes from "./[billId]/changes/route"
import * as documents from "./[billId]/documents/route"
import * as related from "./[billId]/related/route"
import * as detail from "./[billId]/route"
import * as sections from "./[billId]/sections/route"
import * as timeline from "./[billId]/timeline/route"
import * as votes from "./[billId]/votes/route"
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
  ["collection", collection, "https://legislation.test/api/bills?limit=1"],
  ["detail", detail, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1"],
  ["timeline", timeline, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/timeline"],
  ["related", related, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/related"],
  ["sections", sections, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/sections"],
  ["amendments", amendments, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/amendments"],
  ["votes", votes, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/votes"],
  ["documents", documents, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/documents"],
  ["changes", changes, "https://legislation.test/api/bills/bill%3Aak%3A30%3Ahb1/changes"]
]

beforeEach(() => {
  handleBillAmendmentVoteRequest.mockReset()
  handleBillAmendmentVoteRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("bill, amendment, and vote bill route handlers", () => {
  it.each(routes)("delegates the %s URL unchanged", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleBillAmendmentVoteRequest).toHaveBeenCalledOnce()
    expect(handleBillAmendmentVoteRequest).toHaveBeenCalledWith(request)
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
      expect(handleBillAmendmentVoteRequest).not.toHaveBeenCalled()
    }
  )

  it.each(routes)("passes a trailing slash unchanged to the shared boundary for %s", async (_name, route, url) => {
    const queryStart = url.indexOf("?")
    const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleBillAmendmentVoteRequest).toHaveBeenCalledWith(request)
    expect(handleBillAmendmentVoteRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })
})
