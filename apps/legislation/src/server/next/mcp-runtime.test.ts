import assert from "node:assert/strict"
import { generateKeyPair, SignJWT } from "jose"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createNextMcpApplication } from "./mcp-runtime.js"

const keys = await generateKeyPair("RS256")
const environment = {
  AUTH_MODE: "workos",
  WORKOS_ISSUER: "https://auth.example.test",
  WORKOS_JWKS_URL: "https://auth.example.test/jwks",
  WORKOS_API_AUDIENCE: "client_api_environment",
  WORKOS_MCP_AUDIENCE: "https://mcp.example.test/mcp",
  MCP_API_BASE_URL: "https://mcp.example.test",
  WORKOS_API_M2M_CLIENT_ID: "dedicated-api-client",
  WORKOS_API_M2M_CLIENT_SECRET: "dedicated-api-secret"
}
const applications: NonNullable<ReturnType<typeof createNextMcpApplication>>[] = []
afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()))
})
function create(fetch = vi.fn<typeof globalThis.fetch>()) {
  const app = createNextMcpApplication(environment, { keys: { m2m: async () => keys.publicKey }, fetch })
  assert.ok(app)
  applications.push(app)
  return app
}
async function token(audience: string) {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(environment.WORKOS_ISSUER)
    .setSubject("test-client")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey)
}
function request(bearer?: string, body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list" }) {
  return new Request(environment.WORKOS_MCP_AUDIENCE, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "x-correlation-id": "mcp-test",
      ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` })
    },
    body: JSON.stringify(body)
  })
}
describe("Next MCP composition", () => {
  it("stays unavailable without dedicated credentials or with auth disabled", () => {
    expect(createNextMcpApplication({ ...environment, WORKOS_API_M2M_CLIENT_SECRET: undefined })).toBeUndefined()
    expect(createNextMcpApplication({ ...environment, AUTH_MODE: "disabled" })).toBeUndefined()
    expect(createNextMcpApplication({ ...environment, MCP_API_BASE_URL: "https://other.example.test" })).toBeUndefined()
    expect(
      createNextMcpApplication({ ...environment, WORKOS_API_AUDIENCE: environment.WORKOS_MCP_AUDIENCE })
    ).toBeUndefined()
  })
  it("advertises only configured public resource and authorization server", async () => {
    const response = create().metadata(new Request("https://untrusted.example.test/metadata"))
    expect(await response.json()).toEqual({
      resource: environment.WORKOS_MCP_AUDIENCE,
      authorization_servers: [environment.WORKOS_ISSUER],
      bearer_methods_supported: ["header"]
    })
  })
  it("rejects missing credentials and API-audience tokens with resource discovery", async () => {
    const app = create()
    for (const bearer of [undefined, await token(environment.WORKOS_API_AUDIENCE)]) {
      const response = await app.handle(request(bearer))
      expect(response.status).toBe(401)
      expect(response.headers.get("www-authenticate")).toContain(
        "https://mcp.example.test/.well-known/oauth-protected-resource/mcp"
      )
    }
  })
  it("accepts MCP-audience tokens through the native HTTP transport", async () => {
    const response = await create().handle(request(await token(environment.WORKOS_MCP_AUDIENCE)))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("search_bills")
    expect(response.headers.get("x-correlation-id")).toBe("mcp-test")
  })
  it("does not forward incoming credentials to the API or token issuer", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: "dedicated-api-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            data: { id: "bill:us:119:hr:1" },
            links: { self: "/api/bills/bill" },
            meta: { correlationId: "mcp-test", warnings: [] }
          },
          { headers: { "x-correlation-id": "mcp-test" } }
        )
      )
    const incoming = await token(environment.WORKOS_MCP_AUDIENCE)
    const response = await create(fetch).handle(
      request(incoming, {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_bill", arguments: { id: "bill:us:119:hr:1" } }
      })
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("bill:us:119:hr:1")
    expect(fetch).toHaveBeenCalledTimes(2)
    const [issuer, issuerInit] = fetch.mock.calls[0] ?? []
    const [api, apiInit] = fetch.mock.calls[1] ?? []
    expect(String(issuer)).toBe("https://auth.example.test/oauth2/token")
    expect(String(issuerInit?.body)).not.toContain(incoming)
    expect(String(api)).toContain("https://mcp.example.test/api/bills/")
    expect(new Headers(apiInit?.headers).get("authorization")).toBe("Bearer dedicated-api-token")
    expect(apiInit?.redirect).toBe("error")
  })
  it("rejects hostile hosts and origins and does not open GET streams", async () => {
    const app = create()
    expect((await app.handle(new Request("https://attacker.test/mcp", { method: "POST" }))).status).toBe(403)
    expect(
      (
        await app.handle(
          new Request(environment.WORKOS_MCP_AUDIENCE, {
            method: "POST",
            headers: { origin: "https://attacker.test" }
          })
        )
      ).status
    ).toBe(403)
    expect((await app.handle(new Request(environment.WORKOS_MCP_AUDIENCE))).status).toBe(405)
  })
  it("rejects oversized authenticated requests before executing tools", async () => {
    const response = await create().handle(request(await token(environment.WORKOS_MCP_AUDIENCE), "x".repeat(1_048_577)))
    expect(response.status).toBe(413)
  })
  it("bounds body reading by a ten-second deadline", async () => {
    const incoming = request(await token(environment.WORKOS_MCP_AUDIENCE))
    const deadline = vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new Error("deadline")))
    try {
      expect((await create().handle(incoming)).status).toBe(408)
      expect(deadline).toHaveBeenCalledWith(10_000)
    } finally {
      deadline.mockRestore()
    }
  })
})
