import { describe, expect, it } from "vitest"
import { ApiAccessTokenError, createApiAccessTokenProvider } from "./api-access-token.js"

const issuer = "https://authkit.example"
const clientId = "client_test"
const clientSecret = "m2m-secret-value"

function tokenResponse(accessToken = "token-1", expiresIn = 120): Response {
  return new Response(JSON.stringify({ access_token: accessToken, expires_in: expiresIn, token_type: "Bearer" }), {
    headers: { "content-type": "application/json" },
    status: 200
  })
}

describe("API access token provider", () => {
  it("exchanges only configured client credentials, caches the token, and refreshes early", async () => {
    let currentTime = 0
    const calls: Array<Readonly<{ input: RequestInfo | URL; init?: RequestInit }>> = []
    const provider = createApiAccessTokenProvider(
      { clientId, clientSecret, issuer },
      {
        fetch: async (input, init) => {
          calls.push({ init, input })
          return tokenResponse(`token-${calls.length}`)
        },
        now: () => currentTime
      }
    )

    await expect(provider()).resolves.toBe("token-1")
    await expect(provider()).resolves.toBe("token-1")
    currentTime = 60_001
    await expect(provider()).resolves.toBe("token-2")

    expect(calls).toHaveLength(2)
    const first = calls[0]
    expect(String(first?.input)).toBe("https://authkit.example/oauth2/token")
    expect(first?.init).toMatchObject({
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      redirect: "error"
    })
    expect(first?.init?.headers).not.toHaveProperty("authorization")
    expect(first?.init?.body?.toString()).toBe(
      "client_id=client_test&client_secret=m2m-secret-value&grant_type=client_credentials"
    )
  })

  it("coalesces concurrent refreshes", async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    let calls = 0
    const provider = createApiAccessTokenProvider(
      { clientId, clientSecret, issuer },
      {
        fetch: async () => {
          calls += 1
          return await new Promise<Response>((resolve) => {
            resolveFetch = resolve
          })
        }
      }
    )

    const first = provider()
    const second = provider()
    expect(calls).toBe(1)
    resolveFetch?.(tokenResponse("shared-token"))
    await expect(Promise.all([first, second])).resolves.toEqual(["shared-token", "shared-token"])
  })

  it("accounts for token lifetime from the request start when the exchange is slow", async () => {
    let currentTime = 0
    let calls = 0
    const provider = createApiAccessTokenProvider(
      { clientId, clientSecret, issuer },
      {
        fetch: async () => {
          calls += 1
          currentTime = 100_000
          return tokenResponse("short-lived", 120)
        },
        now: () => currentTime
      }
    )

    await expect(provider()).resolves.toBe("short-lived")
    await expect(provider()).resolves.toBe("short-lived")

    expect(calls).toBe(2)
  })

  it.each([
    ["non-HTTPS issuer", { issuer: "http://authkit.example" }],
    ["issuer with a query", { issuer: "https://authkit.example?redirect=https://other.example" }],
    ["blank client secret", { clientSecret: " " }]
  ])("rejects %s without attempting an exchange", (_label, overrides) => {
    let calls = 0
    const create = () =>
      createApiAccessTokenProvider(
        { clientId, clientSecret, issuer, ...overrides },
        {
          fetch: async () => {
            calls += 1
            return tokenResponse()
          }
        }
      )
    let error: unknown
    try {
      create()
    } catch (caught) {
      error = caught
    }
    expect(error).toMatchObject({ category: "configuration", message: "API access token could not be obtained" })
    expect(calls).toBe(0)
  })

  it.each([
    ["missing token", {}],
    ["wrong token type", { access_token: "token", expires_in: 120, token_type: "mac" }],
    ["expired response", { access_token: "token", expires_in: 0, token_type: "Bearer" }],
    ["unsafe token", { access_token: "token\r\nAuthorization: injected", expires_in: 120, token_type: "Bearer" }]
  ])("rejects an invalid %s without leaking response contents", async (_label, body) => {
    const provider = createApiAccessTokenProvider(
      { clientId, clientSecret, issuer },
      { fetch: async () => new Response(JSON.stringify(body), { status: 200 }) }
    )

    await expect(provider()).rejects.toMatchObject({
      category: "invalid_response",
      message: "API access token could not be obtained"
    })
  })

  it("cancels a chunked response that exceeds the response limit", async () => {
    let cancelled = false
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true
        },
        start(controller) {
          controller.enqueue(new TextEncoder().encode("x".repeat(65_537)))
        }
      }),
      { status: 200 }
    )
    const provider = createApiAccessTokenProvider({ clientId, clientSecret, issuer }, { fetch: async () => response })

    await expect(provider()).rejects.toMatchObject({ category: "invalid_response" })
    expect(cancelled).toBe(true)
  })

  it("returns a safe dependency error when a request is rejected or redirected", async () => {
    const provider = createApiAccessTokenProvider(
      { clientId, clientSecret, issuer },
      {
        fetch: async () => {
          throw new TypeError("redirect to https://untrusted.example with client_secret=m2m-secret-value")
        }
      }
    )

    await expect(provider()).rejects.toMatchObject(new ApiAccessTokenError("dependency_unavailable"))
  })
})
