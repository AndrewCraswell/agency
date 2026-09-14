import { describe, expect, it, vi } from "vitest"
import type { HttpApiHandler } from "../../api/http.js"
import type { NodeHttpApiHandlerOptions } from "../../api/next/node-handler.js"
import { getRequestContext } from "../../auth/request-context.js"
import { AuthenticationError, type WorkosIdentity } from "../../auth/workos.js"
import {
  executeAuthenticatedApiRequest,
  type AuthenticatedApiRequestDependencies
} from "./authenticated-api-request.js"

const handler: HttpApiHandler = async () => true
type Executor = (request: Request, handler: HttpApiHandler, options?: NodeHttpApiHandlerOptions) => Promise<Response>
type AuthenticatorFactory = NonNullable<AuthenticatedApiRequestDependencies["createAuthenticator"]>
type Authenticator = ReturnType<AuthenticatorFactory>

describe("authenticated Next API request boundary", () => {
  it("leaves isolated development requests unauthenticated when auth is disabled", async () => {
    const execute = vi.fn<Executor>(async () => new Response("handled"))
    const createAuthenticator = vi.fn<AuthenticatorFactory>()

    const response = await executeAuthenticatedApiRequest(new Request("http://127.0.0.1/api/bills"), handler, {
      createAuthenticator,
      execute,
      getApplication: () => ({ config: { auth: { mode: "disabled" } } })
    })

    expect(await response.text()).toBe("handled")
    expect(createAuthenticator).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith(expect.any(Request), handler)
  })

  it("verifies the bearer token and passes only the derived identity into request context", async () => {
    const identity = {
      credentialType: "machine",
      organizationId: "organization:test",
      userId: "user:test"
    } satisfies WorkosIdentity
    const requestIdentity = { organizationId: identity.organizationId, userId: identity.userId }
    const authenticate = vi.fn<Authenticator>(async () => identity)
    const execute = vi.fn<Executor>(async (_request, apiHandler, options) => {
      expect(options).toEqual({ requestContext: { identity: requestIdentity } })
      return new Response(String(await apiHandler({} as never, {} as never)))
    })
    const request = new Request("https://api.example.test/api/subscriptions", {
      headers: { authorization: "Bearer signed-token" }
    })

    const response = await executeAuthenticatedApiRequest(request, handler, {
      createAuthenticator: () => authenticate,
      execute,
      getApplication: () => workosApplication()
    })

    expect(await response.text()).toBe("true")
    expect(authenticate).toHaveBeenCalledWith("Bearer signed-token")
  })

  it("returns the canonical challenge without executing a protected handler", async () => {
    const execute = vi.fn<Executor>()
    const request = new Request("https://api.example.test/api/subscriptions", {
      headers: { "x-correlation-id": "authentication-test" }
    })

    const response = await executeAuthenticatedApiRequest(request, handler, {
      createAuthenticator: () => async () => {
        throw new AuthenticationError("missing")
      },
      execute,
      getApplication: () => workosApplication()
    })

    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="legislation", error="invalid_token"')
    expect(response.headers.get("x-correlation-id")).toBe("authentication-test")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "unauthorized",
        correlationId: "authentication-test",
        message: "Bearer token is absent or invalid",
        retryable: false
      }
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it("does not convert unexpected authentication failures into token errors", async () => {
    await expect(
      executeAuthenticatedApiRequest(new Request("https://api.example.test/api/bills"), handler, {
        createAuthenticator: () => async () => {
          throw new Error("unexpected verifier defect")
        },
        getApplication: () => workosApplication()
      })
    ).rejects.toThrow("unexpected verifier defect")
  })

  it("makes verified identity available to the adapted Node handler", async () => {
    const identity = { credentialType: "machine", userId: "user:verified" } satisfies WorkosIdentity
    const response = await executeAuthenticatedApiRequest(
      new Request("https://api.example.test/api/bills", { headers: { authorization: "Bearer signed-token" } }),
      async (_request, nodeResponse) => {
        nodeResponse.end(JSON.stringify(getRequestContext()?.identity))
        return true
      },
      {
        createAuthenticator: () => async () => identity,
        getApplication: () => workosApplication()
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ userId: identity.userId })
  })
})

function workosApplication() {
  return {
    config: {
      auth: {
        apiAudience: "https://api.example.test",
        clientId: "client_test",
        issuer: "https://authkit.example",
        jwksUrl: "https://authkit.example/oauth2/jwks",
        mcpAudience: "https://api.example.test/mcp",
        mode: "workos" as const,
        userSession: {
          clientId: "client_test",
          issuer: "https://authkit.example",
          jwksUrl: "https://authkit.example/oauth2/jwks"
        }
      }
    }
  }
}
