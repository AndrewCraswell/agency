import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../api/http.js"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const mocks = vi.hoisted(() => {
  return {
    coreHandler: vi.fn<HandlerFactory>(() => vi.fn<HttpApiHandler>(async () => true)),
    createComposite: vi.fn<(handlers: readonly HttpApiHandler[]) => HttpApiHandler>((handlers) =>
      Object.assign(
        vi.fn<HttpApiHandler>(async () => false),
        { handlers }
      )
    ),
    execute: vi.fn<NextHttpApiExecutor>(async () => new Response("handled")),
    jurisdictionCollectionHandler: vi.fn<HandlerFactory>(),
    jurisdictionHandler: vi.fn<HandlerFactory>(),
    jurisdictionOrganizationHandler: vi.fn<HandlerFactory>(),
    meetingHandler: vi.fn<HandlerFactory>(() => vi.fn<HttpApiHandler>(async () => true)),
    sessionHandler: vi.fn<HandlerFactory>()
  }
})

vi.mock("../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../api/core-read.js", () => ({ createCoreReadApiHandler: mocks.coreHandler }))
vi.mock("../api/jurisdiction-collection-read-repository.js", () => ({
  createJurisdictionCollectionReadRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(
    () => "jurisdiction-collection-repository"
  )
}))
vi.mock("../api/jurisdiction-collection-read-routes.js", () => ({
  createJurisdictionCollectionReadApiHandler: mocks.jurisdictionCollectionHandler
}))
vi.mock("../api/jurisdiction-organization-read-repository.js", () => ({
  createJurisdictionOrganizationRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(
    () => "jurisdiction-organization-repository"
  )
}))
vi.mock("../api/jurisdiction-organization-read-routes.js", () => ({
  createJurisdictionOrganizationReadApiHandler: mocks.jurisdictionOrganizationHandler
}))
vi.mock("../api/jurisdiction-read-repository.js", () => ({
  createJurisdictionReadRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(
    () => "jurisdiction-repository"
  )
}))
vi.mock("../api/jurisdiction-read-routes.js", () => ({
  createJurisdictionReadApiHandler: mocks.jurisdictionHandler
}))
vi.mock("../api/meeting-read-repository.js", () => ({
  createMeetingReadRepository: vi.fn<(...arguments_: readonly unknown[]) => Readonly<{ meetingRepository: boolean }>>(
    () => ({ meetingRepository: true })
  )
}))
vi.mock("../api/meeting-read-routes.js", () => ({ createMeetingReadApiHandler: mocks.meetingHandler }))
vi.mock("../api/session-read-repository.js", () => ({
  createSessionRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(() => "session-repository")
}))
vi.mock("../api/session-read-routes.js", () => ({ createSessionReadApiHandler: mocks.sessionHandler }))
vi.mock("../../legislation/runtime/runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => ({
    config: { auth: { mode: "disabled" }, server: { publicApiBaseUrl: "https://api.example.test" } },
    database: {},
    queryService: {}
  }))
}))

import { createJurisdictionRequestHandler, handleJurisdictionRequest } from "./jurisdiction-route-handler.js"

afterEach(() => {
  vi.clearAllMocks()
})

describe("jurisdiction route composition", () => {
  it("composes only the six handler families needed by the eleven routes", async () => {
    mocks.execute.mockImplementation(async (request, handler) => {
      const url = new URL(request.url)
      const handled = await Reflect.apply(handler, undefined, [
        { method: request.method, url: `${url.pathname}${url.search}` },
        {}
      ])
      return new Response(JSON.stringify({ handled }))
    })
    await handleJurisdictionRequest(new Request("https://api.example.test/api/jurisdictions"))

    expect(mocks.jurisdictionCollectionHandler).toHaveBeenCalledWith("jurisdiction-collection-repository", {
      apiBaseUrl: "https://api.example.test"
    })
    expect(mocks.jurisdictionHandler).toHaveBeenCalledWith("jurisdiction-repository", {
      apiBaseUrl: "https://api.example.test"
    })
    expect(mocks.sessionHandler).toHaveBeenCalledWith("session-repository", { apiBaseUrl: "https://api.example.test" })
    expect(mocks.jurisdictionOrganizationHandler).toHaveBeenCalledWith("jurisdiction-organization-repository", {
      apiBaseUrl: "https://api.example.test"
    })
    expect(mocks.coreHandler).toHaveBeenCalledWith({}, { apiBaseUrl: "https://api.example.test" })
    expect(mocks.meetingHandler).toHaveBeenCalledWith(expect.objectContaining({ meetingRepository: true }), {
      apiBaseUrl: "https://api.example.test"
    })
    expect(mocks.createComposite).toHaveBeenCalledWith([
      mocks.jurisdictionCollectionHandler.mock.results[0]?.value,
      mocks.jurisdictionHandler.mock.results[0]?.value,
      mocks.sessionHandler.mock.results[0]?.value,
      mocks.jurisdictionOrganizationHandler.mock.results[0]?.value,
      expect.any(Function),
      expect.any(Function)
    ])
    expect(mocks.execute).toHaveBeenCalledWith(expect.any(Request), expect.any(Function))

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected jurisdiction routes to create a composite handler")
    }
    const composedHandlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(composedHandlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    const scopedBillHandler = composedHandlers[4]
    const scopedMeetingHandler = composedHandlers[5]
    if (typeof scopedBillHandler !== "function" || typeof scopedMeetingHandler !== "function") {
      throw new Error("Expected scoped bill and meeting handler slots")
    }
    expect(await scopedBillHandler({ method: "GET", url: "/api/bills" }, {})).toBe(false)
    expect(await scopedBillHandler({ method: "GET", url: "/api/jurisdictions/ak/bills" }, {})).toBe(true)
    expect(await scopedMeetingHandler({ method: "GET", url: "/api/meetings" }, {})).toBe(false)
    expect(await scopedMeetingHandler({ method: "GET", url: "/api/sessions/ak-30/meetings" }, {})).toBe(true)

    const trailingSlashPaths = [
      "/api/jurisdictions/",
      "/api/jurisdictions/ak/",
      "/api/jurisdictions/ak/sessions/",
      "/api/jurisdictions/ak/organizations/",
      "/api/jurisdictions/ak/commissions/",
      "/api/jurisdictions/ak/committees/",
      "/api/jurisdictions/ak/bills/",
      "/api/jurisdictions/ak/meetings/",
      "/api/sessions/ak-30/",
      "/api/sessions/ak-30/bills/",
      "/api/sessions/ak-30/meetings/"
    ]
    for (const pathname of trailingSlashPaths) {
      const response = await handleJurisdictionRequest(new Request(`https://api.example.test${pathname}`))
      await expect(response.json()).resolves.toEqual({ handled: false })
    }
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createJurisdictionRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/jurisdictions")

    const first = await requestHandler(request)
    const second = await requestHandler(request)

    expect(await first.text()).toBe("handled")
    expect(await second.text()).toBe("handled")
    expect(createHandler).toHaveBeenCalledTimes(1)
    expect(executeHandler).toHaveBeenNthCalledWith(1, request, handler)
    expect(executeHandler).toHaveBeenNthCalledWith(2, request, handler)
  })
})
