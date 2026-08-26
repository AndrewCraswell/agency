import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleMeetingCalendarRequest } = vi.hoisted(() => ({
  handleMeetingCalendarRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/meeting-calendar-route-handler", () => ({ handleMeetingCalendarRequest }))

import * as route from "./route"

type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT"

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
const unsupportedMethods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "PUT"] as const
type UnsupportedMethod = (typeof unsupportedMethods)[number]
const unsupportedHandlers: Readonly<Record<UnsupportedMethod, (request: Request) => Promise<Response>>> = {
  DELETE: route.DELETE,
  GET: route.GET,
  HEAD: route.HEAD,
  OPTIONS: route.OPTIONS,
  PATCH: route.PATCH,
  PUT: route.PUT
}

beforeEach(() => {
  handleMeetingCalendarRequest.mockReset()
  handleMeetingCalendarRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("meeting calendar representative lookup route handler", () => {
  it("delegates the supported POST with the exact Request unchanged", async () => {
    const request = new Request("https://legislation.test/api/representative-lookups", {
      body: JSON.stringify({ address: { country: "US", postalCode: "94103" } }),
      headers: { "content-type": "application/json", "x-correlation-id": "route-test" },
      method: "POST"
    })
    const response = await route.POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: request.url })
    expect(handleMeetingCalendarRequest).toHaveBeenCalledExactlyOnceWith(request)
    expect(handleMeetingCalendarRequest.mock.calls[0]?.[0]).toBe(request)
  })

  it("exports node runtime and the exact documented method surface", () => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })

  it.each(unsupportedMethods)("returns the shared not-found response for unsupported %s", async (method) => {
    const correlationId = `unsupported-${method.toLowerCase()}`
    const request = new Request("https://legislation.test/api/representative-lookups", {
      headers: { "x-correlation-id": correlationId },
      method
    })
    const response = await unsupportedHandlers[method](request)

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
    expect(handleMeetingCalendarRequest).not.toHaveBeenCalled()
  })

  it("passes the trailing slash unchanged to the shared POST boundary", async () => {
    const request = new Request("https://legislation.test/api/representative-lookups/", {
      body: JSON.stringify({ address: { country: "US", postalCode: "94103" } }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const response = await route.POST(request)

    expect(response.status).toBe(200)
    expect(handleMeetingCalendarRequest).toHaveBeenCalledExactlyOnceWith(request)
    expect(handleMeetingCalendarRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleMeetingCalendarRequest.mock.calls[0]?.[0].url).toBe(request.url)
  })
})
