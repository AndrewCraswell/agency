import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx03aRequest } = vi.hoisted(() => ({
  handleNx03aRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/nx03a", () => ({ handleNx03aRequest }))

import * as bills from "./[organizationId]/bills/route"
import * as calendars from "./[organizationId]/calendars/route"
import * as meetings from "./[organizationId]/meetings/route"
import * as members from "./[organizationId]/members/route"
import * as membership from "./[organizationId]/memberships/[membershipId]/route"
import * as detail from "./[organizationId]/route"
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

const organizationId = "organization%3Aak%3Ahouse"
const routes: readonly [string, RouteModule, string][] = [
  ["collection", collection, "https://legislation.test/api/organizations?limit=1"],
  ["detail", detail, `https://legislation.test/api/organizations/${organizationId}`],
  ["members", members, `https://legislation.test/api/organizations/${organizationId}/members?limit=1`],
  [
    "membership",
    membership,
    `https://legislation.test/api/organizations/${organizationId}/memberships/membership%3Afixture`
  ],
  ["meetings", meetings, `https://legislation.test/api/organizations/${organizationId}/meetings?limit=1`],
  ["bills", bills, `https://legislation.test/api/organizations/${organizationId}/bills?limit=1`],
  ["calendars", calendars, `https://legislation.test/api/organizations/${organizationId}/calendars?limit=1`]
]

beforeEach(() => {
  handleNx03aRequest.mockReset()
  handleNx03aRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-03A organization route handlers", () => {
  it.each(routes)("delegates the exact %s Request unchanged", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleNx03aRequest).toHaveBeenCalledOnce()
    expect(handleNx03aRequest).toHaveBeenCalledWith(request)
    expect(handleNx03aRequest.mock.calls[0]?.[0]).toBe(request)
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
      expect(handleNx03aRequest).not.toHaveBeenCalled()
    }
  )

  it.each(routes)("passes a trailing slash unchanged to the shared boundary for %s", async (_name, route, url) => {
    const queryStart = url.indexOf("?")
    const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleNx03aRequest).toHaveBeenCalledWith(request)
    expect(handleNx03aRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleNx03aRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })

  it("delegates the membership static-child path only through its explicit nested route", async () => {
    const request = new Request(
      `https://legislation.test/api/organizations/${organizationId}/memberships/membership%3Afixture`
    )
    const response = await membership.GET(request)

    expect(response.status).toBe(200)
    expect(handleNx03aRequest).toHaveBeenCalledExactlyOnceWith(request)
  })
})
