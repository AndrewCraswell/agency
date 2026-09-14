import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../../api/http.js"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const mocks = vi.hoisted(() => {
  const handler = () => vi.fn<HttpApiHandler>(async () => true)

  return {
    agendaHandler: vi.fn<HandlerFactory>(handler),
    createComposite: vi.fn<(handlers: readonly HttpApiHandler[]) => HttpApiHandler>((handlers) =>
      Object.assign(
        vi.fn<HttpApiHandler>(async (request, response) => {
          for (const routeHandler of handlers) {
            if (await routeHandler(request, response)) {
              return true
            }
          }
          return false
        }),
        { handlers }
      )
    ),
    documentHandler: vi.fn<HandlerFactory>(handler),
    eventDocumentHandler: vi.fn<HandlerFactory>(handler),
    execute: vi.fn<NextHttpApiExecutor>(),
    meetingHandler: vi.fn<HandlerFactory>(handler),
    participantListHandler: vi.fn<HandlerFactory>(handler),
    participantReadHandler: vi.fn<HandlerFactory>(handler)
  }
})

vi.mock("../../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../../api/event-document-read-routes.js", () => ({
  createEventDocumentReadApiHandler: mocks.eventDocumentHandler
}))
vi.mock("../../api/meeting-agenda-read-routes.js", () => ({ createMeetingAgendaReadApiHandler: mocks.agendaHandler }))
vi.mock("../../api/meeting-document-read-routes.js", () => ({
  createMeetingDocumentReadApiHandler: mocks.documentHandler
}))

vi.mock("../../api/meeting-participant-list-routes.js", () => ({
  createMeetingParticipantListApiHandler: mocks.participantListHandler
}))
vi.mock("../../api/meeting-participant-read-routes.js", () => ({
  createMeetingParticipantReadApiHandler: mocks.participantReadHandler
}))
vi.mock("../../api/meeting-read-routes.js", () => ({ createMeetingReadApiHandler: mocks.meetingHandler }))
vi.mock("./runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => ({
    config: { auth: { mode: "disabled" }, ingestion: {}, server: { publicApiBaseUrl: "https://api.example.test" } },
    database: {}
  }))
}))

import { createMeetingCalendarRequestHandler, handleMeetingCalendarRequest } from "./meeting-calendar-route-handler.js"

afterEach(() => {
  vi.clearAllMocks()
})

describe("meeting calendar Next composition", () => {
  it("composes exactly the eight meeting operations with one handler owner each", async () => {
    mocks.execute.mockImplementation(async (request, handler) => {
      const url = new URL(request.url)
      const handled = await Reflect.apply(handler, undefined, [
        { method: request.method, url: `${url.pathname}${url.search}` },
        {}
      ])
      return new Response(JSON.stringify({ handled }))
    })

    await handleMeetingCalendarRequest(new Request("https://api.example.test/api/meetings"))

    const options = { apiBaseUrl: "https://api.example.test" }
    for (const handler of [
      mocks.agendaHandler,
      mocks.documentHandler,
      mocks.eventDocumentHandler,
      mocks.meetingHandler,
      mocks.participantListHandler,
      mocks.participantReadHandler
    ]) {
      expect(handler).toHaveBeenCalledWith(expect.any(Object), options)
    }

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected meeting calendar routes to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(6)

    const routes = [
      ["GET", "/api/meetings"],
      ["GET", "/api/meetings/meeting-1"],
      ["GET", "/api/meetings/meeting-1/agenda"],
      ["GET", "/api/meetings/meeting-1/agenda/agenda-item-1"],
      ["GET", "/api/meetings/meeting-1/documents"],
      ["GET", "/api/meetings/meeting-1/documents/event-document-1"],
      ["GET", "/api/meetings/meeting-1/participants"],
      ["GET", "/api/meetings/meeting-1/participants/participant-1"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["GET", "/api/calendars"],
      ["GET", "/api/calendars/calendar-1"],
      ["GET", "/api/calendars/calendar-1/meetings"],
      ["GET", "/api/meetings/meeting-1/outcomes"],
      ["GET", "/api/meetings/meeting-1/outcomes/outcome-1"],
      ["POST", "/api/representative-lookups"],
      ["GET", "/api/meetings/meeting-1/documents/event-document-1/extra"],
      ["POST", "/api/meetings"],
      ["GET", "/api/meetings/meeting-1/"],
      ["GET", "/api/calendars/calendar-1/"],
      ["GET", "/api/representative-lookups"],
      ["POST", "/api/representative-lookups/"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      const response = await handleMeetingCalendarRequest(new Request(`https://api.example.test${url}`, { method }))
      await expect(response.json()).resolves.toEqual({ handled: false })
    }
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createMeetingCalendarRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/meetings")

    const first = await requestHandler(request)
    const second = await requestHandler(request)

    expect(await first.text()).toBe("handled")
    expect(await second.text()).toBe("handled")
    expect(createHandler).toHaveBeenCalledTimes(1)
    expect(executeHandler).toHaveBeenNthCalledWith(1, request, handler)
    expect(executeHandler).toHaveBeenNthCalledWith(2, request, handler)
  })
})

async function matchedHandlerCount(handlers: readonly HttpApiHandler[], method: string, url: string): Promise<number> {
  const results = await Promise.all(
    handlers.map(async (handler) => await Reflect.apply(handler, undefined, [{ method, url }, {}]))
  )
  return results.filter(Boolean).length
}
