import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../api/http"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const mocks = vi.hoisted(() => {
  const handler = () => vi.fn<HttpApiHandler>(async () => true)

  return {
    amendmentHandler: vi.fn<HandlerFactory>(handler),
    amendmentRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(() => "amendment-repository"),
    billDetailHandler: vi.fn<HandlerFactory>(handler),
    billDetailRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(() => "bill-detail-repository"),
    billRelatedHandler: vi.fn<HandlerFactory>(handler),
    billTextHandler: vi.fn<HandlerFactory>(handler),
    billTimelineHandler: vi.fn<HandlerFactory>(handler),
    changeFeedHandler: vi.fn<HandlerFactory>(handler),
    coreHandler: vi.fn<HandlerFactory>(handler),
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
    execute: vi.fn<NextHttpApiExecutor>(),
    voteHandler: vi.fn<HandlerFactory>(handler),
    voteRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(() => "vote-repository")
  }
})

vi.mock("../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../api/core-read.js", () => ({ createCoreReadApiHandler: mocks.coreHandler }))
vi.mock("../api/amendment-read-repository.js", () => ({ createAmendmentReadRepository: mocks.amendmentRepository }))
vi.mock("../api/amendment-read-routes.js", () => ({ createAmendmentReadApiHandler: mocks.amendmentHandler }))
vi.mock("../api/bill-detail-read-repository.js", () => ({
  createBillDetailReadRepository: mocks.billDetailRepository
}))
vi.mock("../api/bill-detail-read-routes.js", () => ({ createBillDetailReadApiHandler: mocks.billDetailHandler }))
vi.mock("../api/bill-related-read-routes.js", () => ({ createBillRelatedReadApiHandler: mocks.billRelatedHandler }))
vi.mock("../api/bill-text-read-routes.js", () => ({ createBillTextReadApiHandler: mocks.billTextHandler }))
vi.mock("../api/bill-timeline-read-routes.js", () => ({
  createBillTimelineReadApiHandler: mocks.billTimelineHandler
}))
vi.mock("../api/change-feed-routes.js", () => ({ createChangeFeedApiHandler: mocks.changeFeedHandler }))
vi.mock("../api/document-read-routes.js", () => ({ createDocumentReadApiHandler: mocks.documentHandler }))
vi.mock("../api/vote-read-repository.js", () => ({ createVoteReadRepository: mocks.voteRepository }))
vi.mock("../api/vote-read-routes.js", () => ({ createVoteReadApiHandler: mocks.voteHandler }))
vi.mock("../../legislation/runtime/runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => ({
    config: { auth: { mode: "disabled" }, server: { publicApiBaseUrl: "https://api.example.test" } },
    database: {},
    queryService: {}
  }))
}))

import {
  createBillAmendmentVoteRequestHandler,
  handleBillAmendmentVoteRequest
} from "./bill-amendment-vote-route-handler"

afterEach(() => {
  vi.clearAllMocks()
})

describe("bill, amendment, and vote route handler", () => {
  it("composes only the nine handler families needed by the eighteen routes", async () => {
    mocks.execute.mockImplementation(async (request, handler) => {
      const url = new URL(request.url)
      const handled = await Reflect.apply(handler, undefined, [
        { method: request.method, url: `${url.pathname}${url.search}` },
        {}
      ])
      return new Response(JSON.stringify({ handled }))
    })

    await handleBillAmendmentVoteRequest(new Request("https://api.example.test/api/bills"))

    const options = { apiBaseUrl: "https://api.example.test" }
    expect(mocks.coreHandler).toHaveBeenCalledWith({}, options)
    expect(mocks.billDetailRepository).toHaveBeenCalledWith({}, options.apiBaseUrl)
    expect(mocks.billDetailHandler).toHaveBeenCalledWith("bill-detail-repository")
    expect(mocks.amendmentRepository).toHaveBeenCalledWith({}, options.apiBaseUrl)
    expect(mocks.amendmentHandler).toHaveBeenCalledWith("amendment-repository")
    expect(mocks.voteRepository).toHaveBeenCalledWith({})
    expect(mocks.voteHandler).toHaveBeenCalledWith("vote-repository", options)
    expect(mocks.documentHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.changeFeedHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.billTextHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.billRelatedHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.billTimelineHandler).toHaveBeenCalledWith(expect.any(Object), options)

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected the handler to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(9)

    const routes = [
      ["GET", "/api/bills"],
      ["POST", "/api/bills/batch"],
      ["POST", "/api/bills/amendments/batch"],
      ["GET", "/api/bills/bill-1"],
      ["GET", "/api/bills/bill-1/timeline"],
      ["GET", "/api/bills/bill-1/related"],
      ["GET", "/api/bills/bill-1/sections"],
      ["GET", "/api/bills/bill-1/amendments"],
      ["GET", "/api/bills/bill-1/votes"],
      ["GET", "/api/bills/bill-1/documents"],
      ["GET", "/api/bills/bill-1/changes"],
      ["GET", "/api/amendments"],
      ["POST", "/api/amendments/batch"],
      ["GET", "/api/amendments/amendment-1"],
      ["GET", "/api/votes"],
      ["POST", "/api/votes/batch"],
      ["GET", "/api/votes/vote-1"],
      ["GET", "/api/votes/vote-1/positions"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["GET", "/api/amendments/batch"],
      ["GET", "/api/bills/amendments/batch"],
      ["GET", "/api/bills/batch"],
      ["GET", "/api/bills/batch/votes"],
      ["GET", "/api/bills/%62atch"],
      ["GET", "/api/bills/%62atch/votes"],
      ["GET", "/api/changes"],
      ["GET", "/api/documents/document-1"],
      ["GET", "/api/people/person-1/votes"],
      ["GET", "/api/bills/bill-1/"],
      ["GET", "/api/votes/batch"],
      ["GET", "/api/votes/batch/positions"],
      ["GET", "/api/votes/%62atch"],
      ["GET", "/api/votes/%62atch/positions"],
      ["GET", "/api/amendments/%62atch"],
      ["DELETE", "/api/bills/bill-1"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      const response = await handleBillAmendmentVoteRequest(new Request(`https://api.example.test${url}`, { method }))
      await expect(response.json()).resolves.toEqual({ handled: false })
    }

    const malformedEncodedRoutes = [
      ["GET", "/api/amendments/%ZZ"],
      ["GET", "/api/bills/%ZZ"],
      ["GET", "/api/votes/%ZZ"]
    ] as const
    for (const [method, url] of malformedEncodedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createBillAmendmentVoteRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/bills")

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
