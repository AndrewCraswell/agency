import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleMeetingCalendarRequest } = vi.hoisted(() => ({
  handleMeetingCalendarRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/meeting-calendar-route-handler", () => ({ handleMeetingCalendarRequest }))

import * as meetings from "./[calendarId]/meetings/route"
import * as detail from "./[calendarId]/route"
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

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
const unsupportedMethods = ["DELETE", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const
type UnsupportedMethod = (typeof unsupportedMethods)[number]
const calendarId = "calendar%3Aus%3Acommittee-schedule"

const routes: readonly [string, RouteModule, string][] = [
  ["collection", collection, "https://legislation.test/api/calendars?limit=1"],
  ["detail", detail, `https://legislation.test/api/calendars/${calendarId}`],
  ["meetings", meetings, `https://legislation.test/api/calendars/${calendarId}/meetings?limit=1`]
]

beforeEach(() => {
  handleMeetingCalendarRequest.mockReset()
  handleMeetingCalendarRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("meeting calendar route handlers", () => {
  it.each(routes)("delegates the exact %s Request unchanged", async (_name, route, url) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleMeetingCalendarRequest).toHaveBeenCalledExactlyOnceWith(request)
    expect(handleMeetingCalendarRequest.mock.calls[0]?.[0]).toBe(request)
  })

  it.each(routes)("exports node runtime and the exact documented method surface for %s", (_name, route) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
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
      expect(handleMeetingCalendarRequest).not.toHaveBeenCalled()
    }
  )

  it.each(routes)("passes a trailing slash unchanged to the shared boundary for %s", async (_name, route, url) => {
    const queryStart = url.indexOf("?")
    const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleMeetingCalendarRequest).toHaveBeenCalledExactlyOnceWith(request)
    expect(handleMeetingCalendarRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleMeetingCalendarRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })

  it("keeps the static collection distinct from the calendar detail and meetings paths", async () => {
    const requests = [
      new Request("https://legislation.test/api/calendars"),
      new Request(`https://legislation.test/api/calendars/${calendarId}`),
      new Request(`https://legislation.test/api/calendars/${calendarId}/meetings`)
    ] as const

    await collection.GET(requests[0])
    await detail.GET(requests[1])
    await meetings.GET(requests[2])

    expect(handleMeetingCalendarRequest).toHaveBeenCalledTimes(3)
    for (const [index, request] of requests.entries()) {
      expect(handleMeetingCalendarRequest.mock.calls[index]?.[0]).toBe(request)
      expect(handleMeetingCalendarRequest.mock.calls[index]?.[0].url).toBe(request.url)
    }
  })
})
