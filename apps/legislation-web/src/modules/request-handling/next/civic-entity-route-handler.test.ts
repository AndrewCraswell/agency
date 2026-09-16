import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../api/http"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const mocks = vi.hoisted(() => {
  const handler = () => vi.fn<HttpApiHandler>(async () => true)

  return {
    calendarHandler: vi.fn<HandlerFactory>(handler),
    civicScopedHandler: vi.fn<HandlerFactory>(handler),
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
    execute: vi.fn<NextHttpApiExecutor>(),
    meetingHandler: vi.fn<HandlerFactory>(handler),
    organizationBillHandler: vi.fn<HandlerFactory>(handler),
    organizationDetailHandler: vi.fn<HandlerFactory>(handler),
    organizationMembersHandler: vi.fn<HandlerFactory>(handler),
    organizationHandler: vi.fn<HandlerFactory>(handler),
    peopleHandler: vi.fn<HandlerFactory>(handler),
    personAmendmentHandler: vi.fn<HandlerFactory>(handler),
    personBillHandler: vi.fn<HandlerFactory>(handler),
    personDetailHandler: vi.fn<HandlerFactory>(handler),
    personMembershipHandler: vi.fn<HandlerFactory>(handler),
    voteHandler: vi.fn<HandlerFactory>(handler)
  }
})

vi.mock("../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../api/civic-scoped-read-routes.js", () => ({ createCivicScopedReadApiHandler: mocks.civicScopedHandler }))
vi.mock("../api/meeting-read-routes.js", () => ({ createMeetingReadApiHandler: mocks.meetingHandler }))
vi.mock("../api/organization-bill-read-routes.js", () => ({
  createOrganizationBillReadApiHandler: mocks.organizationBillHandler
}))
vi.mock("../api/organization-detail-read-routes.js", () => ({
  createOrganizationDetailReadApiHandler: mocks.organizationDetailHandler
}))
vi.mock("../api/organization-members-read-routes.js", () => ({
  createOrganizationMembersReadApiHandler: mocks.organizationMembersHandler
}))
vi.mock("../api/organization-read-routes.js", () => ({
  createOrganizationReadApiHandler: mocks.organizationHandler
}))
vi.mock("../api/people-read-routes.js", () => ({ createPeopleReadApiHandler: mocks.peopleHandler }))
vi.mock("../api/person-amendment-routes.js", () => ({
  createPersonAmendmentApiHandler: mocks.personAmendmentHandler
}))
vi.mock("../api/person-bill-activity-routes.js", () => ({
  createPersonBillActivityApiHandler: mocks.personBillHandler
}))
vi.mock("../api/person-detail-read-routes.js", () => ({
  createPersonDetailReadApiHandler: mocks.personDetailHandler
}))
vi.mock("../api/person-membership-read-routes.js", () => ({
  createPersonMembershipReadApiHandler: mocks.personMembershipHandler
}))
vi.mock("../api/vote-read-routes.js", () => ({ createVoteReadApiHandler: mocks.voteHandler }))
vi.mock("../../legislation/runtime/runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => ({
    config: { auth: { mode: "disabled" }, server: { publicApiBaseUrl: "https://api.example.test" } },
    database: {}
  }))
}))

import { createCivicEntityRequestHandler, handleCivicEntityRequest } from "./civic-entity-route-handler"

afterEach(() => {
  vi.clearAllMocks()
})

describe("civic entity Next composition", () => {
  it("composes exactly the fourteen civic entity operations with one handler owner each", async () => {
    mocks.execute.mockImplementation(async (request, handler) => {
      const url = new URL(request.url)
      const handled = await Reflect.apply(handler, undefined, [
        { method: request.method, url: `${url.pathname}${url.search}` },
        {}
      ])
      return new Response(JSON.stringify({ handled }))
    })

    await handleCivicEntityRequest(new Request("https://api.example.test/api/people"))

    const options = { apiBaseUrl: "https://api.example.test" }
    for (const handler of [
      mocks.civicScopedHandler,
      mocks.meetingHandler,
      mocks.organizationBillHandler,
      mocks.organizationMembersHandler,
      mocks.organizationHandler,
      mocks.peopleHandler,
      mocks.personAmendmentHandler,
      mocks.personBillHandler,
      mocks.personDetailHandler,
      mocks.personMembershipHandler,
      mocks.voteHandler
    ]) {
      expect(handler).toHaveBeenCalledWith(expect.any(Object), options)
    }
    expect(mocks.organizationDetailHandler).toHaveBeenCalledWith(expect.any(Object))

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected civic entity routes to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(12)

    const routes = [
      ["GET", "/api/people"],
      ["GET", "/api/people/person-1"],
      ["GET", "/api/people/person-1/bills"],
      ["GET", "/api/people/person-1/amendments"],
      ["GET", "/api/people/person-1/votes"],
      ["GET", "/api/people/person-1/memberships"],
      ["GET", "/api/people/person-1/terms/term-1"],
      ["GET", "/api/organizations"],
      ["GET", "/api/organizations/organization-1"],
      ["GET", "/api/organizations/organization-1/members"],
      ["GET", "/api/organizations/organization-1/memberships/membership-1"],
      ["GET", "/api/organizations/organization-1/meetings"],
      ["GET", "/api/organizations/organization-1/bills"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["GET", "/api/organizations/organization-1/calendars"],
      ["GET", "/api/people/person-1/terms"],
      ["GET", "/api/people/person-1/meetings"],
      ["GET", "/api/organizations/organization-1/memberships"],
      ["GET", "/api/organizations/organization-1/votes"],
      ["POST", "/api/people"],
      ["GET", "/api/people/"],
      ["GET", "/api/organizations/organization-1/"],
      ["GET", "/api/organizations/organization-1/calendars/"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      const response = await handleCivicEntityRequest(new Request(`https://api.example.test${url}`, { method }))
      await expect(response.json()).resolves.toEqual({ handled: false })
    }
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createCivicEntityRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/people")

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
