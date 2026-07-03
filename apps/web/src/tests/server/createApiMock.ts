import { http, HttpResponse, type HttpResponseResolver, type RequestHandler } from "msw"
import type { SetupServer } from "msw/node"
import { type Mock, vi } from "vitest"

type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

type MockRequest = {
  method: string
  url: string
  pathname: string
}

class MockEndpoint {
  private _requests: MockRequest[] = []

  /** Spy called with the parsed body of each matching request. */
  readonly spy: Mock = vi.fn<(body: unknown) => void>()

  get hits(): number {
    return this._requests.length
  }

  get requests(): readonly MockRequest[] {
    return this._requests
  }

  clear() {
    this._requests.length = 0
    this.spy.mockClear()
  }

  /** @internal Called by the MSW resolver on each matching request. */
  async _record(request: Request) {
    const url = new URL(request.url)
    this._requests.push({
      method: request.method.toUpperCase(),
      url: request.url,
      pathname: url.pathname + url.search
    })
    this.spy(await readBody(request))
  }
}

async function readBody(request: Request): Promise<unknown> {
  const clone = request.clone()
  try {
    const text = await clone.text()
    if (!text) {
      return undefined
    }
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch {
    return undefined
  }
}

export type MockOptions<T = unknown> = {
  status?: number
  data?: T
  headers?: Record<string, string>
}

function isResolver(value: unknown): value is HttpResponseResolver {
  return typeof value === "function"
}

function resolveOptions(options: MockOptions): Response {
  const { status, data, headers } = options
  if (data === null || data === undefined) {
    return new HttpResponse(null, { status: status ?? 204, headers })
  }
  return HttpResponse.json(data, { status: status ?? 200, headers })
}

function createHandler(
  method: HttpMethod,
  path: string,
  input: MockOptions | HttpResponseResolver | MockOptions[] | undefined,
  endpoint: MockEndpoint
): RequestHandler {
  if (Array.isArray(input)) {
    const sequence = [...input]
    const resolver: HttpResponseResolver = async (info) => {
      await endpoint._record(info.request)
      const next = sequence.length > 1 ? sequence.shift()! : sequence[0]
      return resolveOptions(next)
    }
    return http[method](path, resolver)
  }

  const resolver: HttpResponseResolver = async (info) => {
    await endpoint._record(info.request)
    if (isResolver(input)) {
      return input(info)
    }
    return resolveOptions(input ?? {})
  }

  return http[method](path, resolver)
}

type ApiMockMethod = {
  (path: string, resolver: HttpResponseResolver): MockEndpoint
  (path: string, sequence: MockOptions[]): MockEndpoint
  (path: string, options?: MockOptions): MockEndpoint
}

export type ApiMockInstance = {
  get: ApiMockMethod
  post: ApiMockMethod
  put: ApiMockMethod
  patch: ApiMockMethod
  delete: ApiMockMethod
  handler: (...handlers: RequestHandler[]) => void
  reset: () => void
}

/**
 * Create an ApiMock instance bound to an MSW server. Register mock endpoints
 * with a static response, a sequence of responses (one per call), or a custom
 * resolver. `reset()` clears hit counters and restores the server's initial
 * handlers.
 *
 * @example
 * ApiMock.get("/api/welcome", { data: { message: "Hi" } });
 */
export function createApiMock(server: SetupServer): ApiMockInstance {
  const endpointRegistry = new Map<string, MockEndpoint>()

  function escapePath(path: string): string {
    return path.replace(/(?<!\\)\(/g, "\\(").replace(/(?<!\\)\)/g, "\\)")
  }

  function mock(method: HttpMethod): ApiMockMethod {
    return function (path: string, input?: MockOptions | HttpResponseResolver | MockOptions[]): MockEndpoint {
      const escapedPath = escapePath(path)
      const key = `${method}:${path}`
      const existing = endpointRegistry.get(key)

      if (existing) {
        existing.clear()
        server.use(createHandler(method, escapedPath, input, existing))
        return existing
      }

      const endpoint = new MockEndpoint()
      endpointRegistry.set(key, endpoint)
      server.use(createHandler(method, escapedPath, input, endpoint))
      return endpoint
    }
  }

  return {
    get: mock("get"),
    post: mock("post"),
    put: mock("put"),
    patch: mock("patch"),
    delete: mock("delete"),
    handler(...handlers: RequestHandler[]) {
      server.use(...handlers)
    },
    reset() {
      endpointRegistry.forEach((e) => e.clear())
      endpointRegistry.clear()
      server.resetHandlers()
    }
  }
}
