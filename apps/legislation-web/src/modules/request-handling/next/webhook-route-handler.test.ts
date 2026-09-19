import {
  getRequestContext,
  runWithRequestContext,
  type RequestIdentity
} from "@repo/legislation-core/auth/request-context"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../api/http"

type HandlerFactory = (...arguments_: readonly unknown[]) => HttpApiHandler
type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

const idempotencyEncryptionKey = Buffer.alloc(32, 7).toString("base64")
const webhookSecretEncryptionKey = Buffer.alloc(32, 11).toString("base64")
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

vi.mock("../api/http.js", () => ({ createCompositeHttpApiHandler: mocks.createComposite }))
vi.mock("../api/next/node-handler.js", () => ({ executeNextHttpApiHandler: mocks.execute }))
vi.mock("../api/webhook-mutation-routes.js", () => ({
  createWebhookMutationApiHandler: mocks.mutationHandler
}))
vi.mock("../api/webhook-read-routes.js", () => ({ createWebhookReadApiHandler: mocks.readHandler }))
vi.mock("../../legislation/runtime/runtime.js", () => ({
  getNextLegislationApplication: vi.fn<() => unknown>(() =>
    application(idempotencyEncryptionKey, webhookSecretEncryptionKey)
  )
}))

import { createWebhookHttpApiHandler, createWebhookRequestHandler, handleWebhookRequest } from "./webhook-route-handler"

afterEach(() => {
  observedIdentities.length = 0
  vi.clearAllMocks()
})

describe("webhook route composition", () => {
  it("composes exactly the seven webhook operations with one handler owner each", async () => {
    const handler = createWebhookHttpApiHandler(application(idempotencyEncryptionKey, webhookSecretEncryptionKey))
    const options = { apiBaseUrl: "https://api.example.test" }

    expect(mocks.readHandler).toHaveBeenCalledWith(expect.any(Object), options)
    expect(mocks.mutationHandler).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), options)

    const composition = mocks.createComposite.mock.results[0]?.value
    if (typeof composition !== "function") {
      throw new Error("Expected webhook routes to create a composite handler")
    }
    const handlers = Reflect.get(composition, "handlers")
    if (!Array.isArray(handlers)) {
      throw new Error("Expected the composite handler to receive route handlers")
    }
    expect(handlers).toHaveLength(2)

    const routes = [
      ["GET", "/api/webhooks"],
      ["POST", "/api/webhooks"],
      ["GET", "/api/webhooks/webhook%3Aone"],
      ["PATCH", "/api/webhooks/webhook%3Aone"],
      ["DELETE", "/api/webhooks/webhook%3Aone"],
      ["POST", "/api/webhooks/webhook%3Aone/rotate-secret"],
      ["POST", "/api/webhooks/webhook%3Aone/verify"]
    ] as const
    for (const [method, url] of routes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(1)
    }

    const excludedRoutes = [
      ["PUT", "/api/webhooks"],
      ["POST", "/api/webhooks/webhook%3Aone"],
      ["GET", "/api/webhooks/webhook%3Aone/verify"],
      ["PATCH", "/api/webhooks/webhook%3Aone/rotate-secret"],
      ["GET", "/api/webhooks/"],
      ["GET", "/api/webhooks/webhook%3Aone/"],
      ["GET", "/api/subscriptions"]
    ] as const
    for (const [method, url] of excludedRoutes) {
      expect(await matchedHandlerCount(handlers, method, url)).toBe(0)
      expect(await runHandler(handler, method, url)).toBe(false)
    }
  })

  it.each([
    [undefined, webhookSecretEncryptionKey],
    [idempotencyEncryptionKey, undefined],
    [undefined, undefined]
  ])("omits webhook mutations unless both encryption keys are configured", (idempotencyKey, secretKey) => {
    createWebhookHttpApiHandler(application(idempotencyKey, secretKey))

    expect(mocks.readHandler).toHaveBeenCalledOnce()
    expect(mocks.mutationHandler).not.toHaveBeenCalled()
    const composition = mocks.createComposite.mock.results[0]?.value
    expect(Reflect.get(composition!, "handlers")).toHaveLength(1)
  })

  it("injects an explicit test identity without installing a production identity", async () => {
    const identity = { organizationId: "organization:test", userId: "user:test" }
    const injected = createWebhookHttpApiHandler(application(idempotencyEncryptionKey, webhookSecretEncryptionKey), {
      resolveRequestIdentity: () => identity
    })
    const production = createWebhookHttpApiHandler(application(idempotencyEncryptionKey, webhookSecretEncryptionKey))

    await runWithRequestContext({ correlationId: "injected" }, async () => {
      expect(await invoke(injected, "GET", "/api/webhooks")).toBe(true)
    })
    await runWithRequestContext({ correlationId: "production" }, async () => {
      expect(await invoke(production, "GET", "/api/webhooks")).toBe(true)
    })

    expect(observedIdentities).toEqual([identity, undefined])
  })

  it("does not inject identity outside the managed request context", async () => {
    const handler = createWebhookHttpApiHandler(application(idempotencyEncryptionKey, webhookSecretEncryptionKey), {
      resolveRequestIdentity: () => ({ userId: "user:test" })
    })

    expect(await invoke(handler, "GET", "/api/webhooks")).toBe(true)
    expect(observedIdentities).toEqual([undefined])
  })

  it("requires the canonical public API base URL", () => {
    expect(() => createWebhookHttpApiHandler(applicationWithoutPublicApiBaseUrl())).toThrow(
      "LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes"
    )
  })

  it("lazily creates a composed handler and sends each request through the Next bridge", async () => {
    const handler = vi.fn<HttpApiHandler>()
    const executeHandler = vi.fn<NextHttpApiExecutor>(async () => new Response("handled"))
    const createHandler = vi.fn<() => HttpApiHandler>(() => handler)
    const requestHandler = createWebhookRequestHandler({ createHandler, execute: executeHandler })
    const request = new Request("https://api.example.test/api/webhooks")

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
    const request = new Request("https://api.example.test/api/webhooks")

    await expect(handleWebhookRequest(request).then(async (response) => await response.text())).resolves.toBe("handled")
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({ url: request.url, method: request.method }),
      expect.any(Function)
    )
    expect(mocks.execute.mock.calls[0]?.[0].headers).toEqual(request.headers)
  })
})

function application(idempotencyKey: string | undefined, secretKey: string | undefined) {
  return {
    config: {
      auth: { mode: "disabled" },
      security: { idempotencyEncryptionKey: idempotencyKey, webhookSecretEncryptionKey: secretKey },
      server: { publicApiBaseUrl: "https://api.example.test" }
    },
    database: {}
  } as never
}

function applicationWithoutPublicApiBaseUrl() {
  return {
    config: {
      auth: { mode: "disabled" },
      security: { idempotencyEncryptionKey, webhookSecretEncryptionKey },
      server: { publicApiBaseUrl: undefined }
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
