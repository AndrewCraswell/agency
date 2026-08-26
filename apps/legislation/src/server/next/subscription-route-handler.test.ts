import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../../api/http.js"
import { getRequestContext, runWithRequestContext, type RequestIdentity } from "../../auth/request-context.js"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const encryptionKey = Buffer.alloc(32, 7).toString("base64")
const observedIdentities: (RequestIdentity | undefined)[] = []

const mocks = vi.hoisted(() => {
  const handler = () =>
    vi.fn<HttpApiHandler>(async () => {
      observedIdentities.push(getRequestContext()?.identity)
      return true
    })

  return {
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
    mutationHandler: vi.fn<HandlerFactory>(handler),
    readHandler: vi.fn<HandlerFactory>(handler)
  }
})

vi.mock("../../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../../api/subscription-routes.js", () => ({
  createSubscriptionMutationApiHandler: mocks.mutationHandler,
  createSubscriptionReadApiHandler: mocks.readHandler
}))
vi.mock("./runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() => application(encryptionKey))
}))

import {
  createSubscriptionHttpApiHandler,
  createSubscriptionRequestHandler,
  handleSubscriptionRequest
} from "./subscription-route-handler.js"

afterEach(() => {
  observedIdentities.length = 0
  vi.clearAllMocks()
})

describe("subscription route composition", () => {
  it("composes exactly the seven subscription operations with one handler owner each", async () => {
    const handler = createSubscriptionHttpApiHandler(application(encryptionKey))
    const options = { apiBaseUrl: "https://api.example.test" }

    expect(mocks.readHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.mutationHandler).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), options)

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected subscription routes to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(2)

    const routes = [
      ["GET", "/api/subscriptions"],
      ["POST", "/api/subscriptions"],
      ["GET", "/api/subscriptions/subscription%3Aone"],
      ["PATCH", "/api/subscriptions/subscription%3Aone"],
      ["DELETE", "/api/subscriptions/subscription%3Aone"],
      ["GET", "/api/subscriptions/subscription%3Aone/events"],
      ["GET", "/api/subscriptions/subscription%3Aone/deliveries"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["PUT", "/api/subscriptions"],
      ["POST", "/api/subscriptions/subscription%3Aone"],
      ["GET", "/api/subscriptions/subscription%3Aone/unknown"],
      ["PATCH", "/api/subscriptions/subscription%3Aone/events"],
      ["GET", "/api/subscriptions/"],
      ["GET", "/api/subscriptions/subscription%3Aone/"],
      ["GET", "/api/webhooks"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      const handled = await runHandler(handler, method, url)
      expect(handled).toBe(false)
    }
  })

  it("omits subscription mutations when encrypted idempotency replay is not configured", () => {
    createSubscriptionHttpApiHandler(application(undefined))

    expect(mocks.readHandler).toHaveBeenCalledOnce()
    expect(mocks.mutationHandler).not.toHaveBeenCalled()
    const composition = mocks.createComposite.mock.results[0]?.value
    expect(Reflect.get(composition!, "handlers")).toHaveLength(1)
  })

  it("injects an explicit test identity without installing a production identity", async () => {
    const identity = { organizationId: "organization:test", userId: "user:test" }
    const injected = createSubscriptionHttpApiHandler(application(encryptionKey), {
      resolveRequestIdentity: () => identity
    })
    const production = createSubscriptionHttpApiHandler(application(encryptionKey))

    await runWithRequestContext({ correlationId: "injected" }, async () => {
      expect(await invoke(injected, "GET", "/api/subscriptions")).toBe(true)
    })
    await runWithRequestContext({ correlationId: "production" }, async () => {
      expect(await invoke(production, "GET", "/api/subscriptions")).toBe(true)
    })

    expect(observedIdentities).toEqual([identity, undefined])
  })

  it("does not inject identity outside the managed request context", async () => {
    const handler = createSubscriptionHttpApiHandler(application(encryptionKey), {
      resolveRequestIdentity: () => ({ userId: "user:test" })
    })

    expect(await invoke(handler, "GET", "/api/subscriptions")).toBe(true)
    expect(observedIdentities).toEqual([undefined])
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createSubscriptionRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/subscriptions")

    const first = await requestHandler(request)
    const second = await requestHandler(request)

    expect(await first.text()).toBe("handled")
    expect(await second.text()).toBe("handled")
    expect(createHandler).toHaveBeenCalledTimes(1)
    expect(executeHandler).toHaveBeenNthCalledWith(1, request, handler)
    expect(executeHandler).toHaveBeenNthCalledWith(2, request, handler)
  })

  it("uses the shared API bridge when authentication is disabled", async () => {
    mocks.execute.mockResolvedValueOnce(new Response("handled"))
    const request = new Request("https://api.example.test/api/subscriptions")

    await expect(handleSubscriptionRequest(request).then(async (response) => await response.text())).resolves.toBe(
      "handled"
    )
    expect(mocks.execute).toHaveBeenCalledWith(request, expect.any(Function))
  })
})

function application(idempotencyEncryptionKey: string | undefined) {
  return {
    config: {
      auth: { mode: "disabled" },
      security: { idempotencyEncryptionKey },
      server: { publicApiBaseUrl: "https://api.example.test" }
    },
    database: {}
  } as never
}

async function matchedHandlerCount(handlers: readonly HttpApiHandler[], method: string, url: string): Promise<number> {
  const results = await Promise.all(handlers.map(async (handler) => await invoke(handler, method, url)))
  return results.filter(Boolean).length
}

async function runHandler(handler: HttpApiHandler, method: string, url: string): Promise<boolean> {
  return await runWithRequestContext({ correlationId: "route-test" }, async () => await invoke(handler, method, url))
}

async function invoke(handler: HttpApiHandler, method: string, url: string): Promise<boolean> {
  return await Reflect.apply(handler, undefined, [{ method, url }, {}])
}
