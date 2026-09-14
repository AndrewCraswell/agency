import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../../api/http.js"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const mocks = vi.hoisted(() => {
  const handler = () => vi.fn<HttpApiHandler>(async () => true)

  return {
    changeHandler: vi.fn<HandlerFactory>(handler),
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
    resourceBatchHandler: vi.fn<HandlerFactory>(handler),
    resourceBatchRepository: vi.fn<(...arguments_: readonly unknown[]) => string>(() => "resource-batch-repository"),
    supportingMaterialSectionHandler: vi.fn<HandlerFactory>(handler)
  }
})

vi.mock("../../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../../api/change-feed-routes.js", () => ({ createChangeFeedApiHandler: mocks.changeHandler }))
vi.mock("../../api/core-read.js", () => ({ createCoreReadApiHandler: mocks.coreHandler }))
vi.mock("../../api/document-read-routes.js", () => ({ createDocumentReadApiHandler: mocks.documentHandler }))
vi.mock("../../api/resource-batch-read-routes.js", () => ({
  createResourceBatchReadApiHandler: mocks.resourceBatchHandler
}))
vi.mock("../../api/resource-batch-read-repository.js", () => ({
  createResourceBatchReadRepositoryFromCanonicalReads: mocks.resourceBatchRepository
}))
vi.mock("../../api/supporting-material-section-read-routes.js", () => ({
  createSupportingMaterialSectionReadApiHandler: mocks.supportingMaterialSectionHandler
}))
vi.mock("./runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => ({
    config: { auth: { mode: "disabled" }, server: { publicApiBaseUrl: "https://api.example.test" } },
    database: {},
    queryService: {}
  }))
}))

import {
  createDocumentResourceRequestHandler,
  handleDocumentResourceRequest
} from "./document-resource-route-handler.js"

afterEach(() => {
  vi.clearAllMocks()
})

describe("document resource route handler", () => {
  it("composes exactly the ten operations with one handler owner each", async () => {
    mocks.execute.mockImplementation(async (request, handler) => {
      const url = new URL(request.url)
      const handled = await Reflect.apply(handler, undefined, [
        { method: request.method, url: `${url.pathname}${url.search}` },
        {}
      ])
      return new Response(JSON.stringify({ handled }))
    })

    await handleDocumentResourceRequest(new Request("https://api.example.test/api/documents/document-1"))

    const options = { apiBaseUrl: "https://api.example.test" }
    expect(mocks.documentHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.coreHandler).toHaveBeenCalledWith({}, options)
    expect(mocks.supportingMaterialSectionHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.changeHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.resourceBatchRepository).toHaveBeenCalledWith({
      amendmentReadRepository: expect.any(Object),
      apiBaseUrl: options.apiBaseUrl,
      billDetailReadRepository: expect.any(Object),
      coreReadApi: {},
      documentReadApi: expect.any(Object),
      jurisdictionReadRepository: expect.any(Object),
      meetingReadApi: expect.any(Object),
      organizationDetailReadRepository: expect.any(Object),
      personDetailReadRepository: expect.any(Object),
      sessionReadRepository: expect.any(Object),
      voteReadApi: expect.any(Object)
    })
    expect(mocks.resourceBatchHandler).toHaveBeenCalledWith("resource-batch-repository")

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected the handler to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(5)

    const routes = [
      ["GET", "/api/documents/document-1"],
      ["GET", "/api/documents/document-1/sections"],
      ["GET", "/api/documents/document-1/sections/section-1"],
      ["GET", "/api/supporting-materials"],
      ["GET", "/api/supporting-materials/material-1"],
      ["GET", "/api/supporting-materials/material-1/sections"],
      ["GET", "/api/supporting-materials/material-1/sections/section-1"],
      ["GET", "/api/changes"],
      ["GET", "/api/changes/change-1"],
      ["POST", "/api/resources/batch"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["GET", "/api/bills/bill-1/documents"],
      ["GET", "/api/documents"],
      ["GET", "/api/bills/bill-1/changes"],
      ["GET", "/api/resources/batch"],
      ["POST", "/api/resources/batch/extra"],
      ["GET", "/api/documents/document-1/"],
      ["GET", "/api/supporting-materials/material-1/sections/"],
      ["GET", "/api/changes/"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      const response = await handleDocumentResourceRequest(new Request(`https://api.example.test${url}`, { method }))
      await expect(response.json()).resolves.toEqual({ handled: false })
    }

    const malformedEncodedRoutes = [
      ["GET", "/api/documents/%ZZ"],
      ["GET", "/api/supporting-materials/%ZZ"],
      ["GET", "/api/supporting-materials/%ZZ/sections/%ZZ"]
    ] as const
    for (const [method, url] of malformedEncodedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createDocumentResourceRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/documents/document-1")

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
