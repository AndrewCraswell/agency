import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../../api/http.js"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const mocks = vi.hoisted(() => {
  const handler = () => vi.fn<HttpApiHandler>(async () => true)

  return {
    amendmentHandler: vi.fn<HandlerFactory>(handler),
    civicHandler: vi.fn<HandlerFactory>(handler),
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
    diffHandler: vi.fn<HandlerFactory>(handler),
    execute: vi.fn<NextHttpApiExecutor>(),
    passageHandler: vi.fn<HandlerFactory>(handler),
    researchHandler: vi.fn<HandlerFactory>(handler),
    unavailableResearch: vi.fn<() => object>(() => ({ unavailable: true })),
    universalHandler: vi.fn<HandlerFactory>(handler),
    universalService: vi.fn<() => object>(() => ({ search: async () => ({ items: [] }) }))
  }
})

vi.mock("../../api/amendment-search.js", () => ({ createAmendmentSearchApiHandler: mocks.amendmentHandler }))
vi.mock("../../api/civic-search.js", () => ({ createCivicSearchApiHandler: mocks.civicHandler }))
vi.mock("../../api/document-diff-routes.js", () => ({ createDocumentDiffApiHandler: mocks.diffHandler }))
vi.mock("../../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../../api/passage-search.js", () => ({ createPassageSearchApiHandler: mocks.passageHandler }))
vi.mock("../../api/research-answers.js", () => ({
  createCanonicalResearchEvidenceRetriever: vi.fn<(...arguments_: readonly unknown[]) => unknown>(),
  createOpenRouterResearchAnswerGenerator: vi.fn<(...arguments_: readonly unknown[]) => unknown>(),
  createResearchAnswerApiHandler: mocks.researchHandler,
  createResearchAnswerService: vi.fn<(...arguments_: readonly unknown[]) => unknown>(),
  createUnavailableResearchAnswerApi: mocks.unavailableResearch
}))
vi.mock("../../api/universal-search-adapter.js", () => ({ createProductionUniversalSearchApi: mocks.universalService }))
vi.mock("../../api/universal-search.js", () => ({ createUniversalSearchApiHandler: mocks.universalHandler }))
vi.mock("./runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => ({
    config: { model: {}, server: { publicApiBaseUrl: "https://api.example.test" } },
    database: {},
    queryService: {},
    retrievalClient: undefined
  }))
}))

import { createSearchResearchRequestHandler, handleSearchResearchRequest } from "./search-research-route-handler.js"

afterEach(() => {
  vi.clearAllMocks()
})

describe("search research Next composition", () => {
  it("composes exactly the seven search and research operations with one handler owner each", async () => {
    mocks.execute.mockImplementation(async (request, handler) => {
      const url = new URL(request.url)
      const handled = await Reflect.apply(handler, undefined, [
        { method: request.method, url: `${url.pathname}${url.search}` },
        {}
      ])
      return new Response(JSON.stringify({ handled }))
    })

    await handleSearchResearchRequest(new Request("https://api.example.test/api/search/bills", { method: "POST" }))

    const options = { apiBaseUrl: "https://api.example.test" }
    expect(mocks.civicHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.amendmentHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.passageHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.diffHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.universalService).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), options.apiBaseUrl)
    expect(mocks.universalHandler).toHaveBeenCalledWith(expect.any(Object))
    expect(mocks.unavailableResearch).toHaveBeenCalledTimes(1)
    expect(mocks.researchHandler).toHaveBeenCalledWith({ unavailable: true })

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected search and research routes to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(6)

    const routes = [
      ["POST", "/api/search/bills"],
      ["POST", "/api/search/amendments"],
      ["POST", "/api/search/passages"],
      ["POST", "/api/search/supporting-materials"],
      ["POST", "/api/search/all"],
      ["POST", "/api/document-diffs"],
      ["POST", "/api/research/answers"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["GET", "/api/search/bills"],
      ["POST", "/api/search/bills/"],
      ["POST", "/api/search/unknown"],
      ["POST", "/api/document-diffs/"],
      ["POST", "/api/research/answers/"],
      ["POST", "/api/research/answers/extra"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      const response = await handleSearchResearchRequest(new Request(`https://api.example.test${url}`, { method }))
      await expect(response.json()).resolves.toEqual({ handled: false })
    }
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createSearchResearchRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/search/bills", { method: "POST" })

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
