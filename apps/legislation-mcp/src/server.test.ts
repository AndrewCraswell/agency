import assert from "node:assert/strict"
import { request as httpRequest, type Server } from "node:http"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { generateKeyPair, SignJWT } from "jose"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMcpApplication } from "./application.js"
import { close, createMcpServer, listen } from "./server.js"

const keys = await generateKeyPair("RS256")
const environment = {
  AUTH_MODE: "workos",
  WORKOS_ISSUER: "https://auth.example.test",
  WORKOS_JWKS_URL: "https://auth.example.test/jwks",
  WORKOS_MCP_AUDIENCE: "https://mcp.example.test/mcp",
  WORKOS_API_AUDIENCE: "api-client",
  MCP_API_BASE_URL: "https://api.example.test",
  WORKOS_API_M2M_CLIENT_ID: "api-client",
  WORKOS_API_M2M_CLIENT_SECRET: "fixture-secret"
}
const fetch: typeof globalThis.fetch = async (input, init) => {
  const incoming = new Request(input, init)
  const body = Buffer.from(await incoming.arrayBuffer())
  return await new Promise<Response>((resolve, reject) => {
    const request = httpRequest(
      new URL(incoming.url),
      {
        method: incoming.method,
        headers: Object.fromEntries(incoming.headers),
        signal: incoming.signal
      },
      (response) => {
        const chunks: Uint8Array[] = []
        response.on("data", (chunk: Buffer) => chunks.push(chunk))
        response.on("error", reject)
        response.on("end", () => {
          const headers = new Headers()
          for (const [name, value] of Object.entries(response.headers)) {
            for (const item of Array.isArray(value) ? value : [value]) {
              if (item !== undefined) headers.append(name, item)
            }
          }
          resolve(
            new Response(chunks.length > 0 ? Buffer.concat(chunks) : null, {
              status: response.statusCode,
              headers
            })
          )
        })
      }
    )
    request.on("error", reject)
    request.end(body)
  })
}
const running: { server: Server; application: ReturnType<typeof createMcpApplication> }[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(running.splice(0).map(({ server, application }) => close(server, application)))
})
async function token(audience = environment.WORKOS_MCP_AUDIENCE) {
  return new SignJWT({ org_id: "org-reader" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(environment.WORKOS_ISSUER)
    .setAudience(audience)
    .setSubject("reader")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey)
}
async function start() {
  const upstream = vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith("/oauth2/token"))
      return Response.json({ access_token: "api-token", token_type: "Bearer", expires_in: 3600 })
    return Response.json(
      {
        data: { id: "bill:us:119:hr:1" },
        links: { self: "/api/bills/bill" },
        meta: { correlationId: "socket-test", warnings: [] }
      },
      { headers: { "x-correlation-id": "socket-test" } }
    )
  })
  const application = createMcpApplication(environment, { keys: { m2m: async () => keys.publicKey }, fetch: upstream })
  const server = createMcpServer(application)
  running.push({ server, application })
  await listen(server, 0, "127.0.0.1")
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  return { server, application, upstream, origin: `http://127.0.0.1:${address.port}` }
}

describe("standalone Node MCP host", () => {
  it("serves no-store liveness, readiness and fixed metadata without upstream access", async () => {
    const { origin, upstream, application } = await start()
    for (const path of [
      "/health",
      "/ready",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp"
    ]) {
      const response = await fetch(`${origin}${path}`, {
        headers: { "x-correlation-id": "socket-test", "x-forwarded-host": "attacker.test" }
      })
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toContain("no-store")
      expect(response.headers.get("x-correlation-id")).toBe("socket-test")
      const body = await response.json()
      if (path.startsWith("/.well-known")) expect(body.resource).toBe(environment.WORKOS_MCP_AUDIENCE)
    }
    expect(upstream).not.toHaveBeenCalled()
    await application.close()
    expect((await fetch(`${origin}/ready`)).status).toBe(503)
    expect((await fetch(`${origin}/health`)).status).toBe(200)
  })
  it("rejects anonymous and wrong-audience callers and never accepts forwarded Host", async () => {
    const { origin, upstream } = await start()
    const hostile = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: { "x-forwarded-host": "mcp.example.test" },
      body: "{}"
    })
    expect(hostile.status).toBe(403)
    for (const bearer of [undefined, await token(environment.WORKOS_API_AUDIENCE)]) {
      const response = await fetch(`${origin}/mcp`, {
        method: "POST",
        headers: { host: "mcp.example.test", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
        body: "{}"
      })
      expect(response.status).toBe(401)
      expect(response.headers.get("www-authenticate")).toContain(
        "https://mcp.example.test/.well-known/oauth-protected-resource/mcp"
      )
    }
    const originRejected = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: { host: "mcp.example.test", origin: "https://api.example.test" },
      body: "{}"
    })
    expect(originRejected.status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
  it("keeps MCP POST-only and excludes API and relay routes", async () => {
    const { origin } = await start()
    for (const method of ["GET", "DELETE", "PUT", "OPTIONS"]) {
      const response = await fetch(`${origin}/mcp`, { method, headers: { host: "mcp.example.test" } })
      expect(response.status).toBe(405)
      expect(response.headers.get("allow")).toBe("POST")
    }
    for (const path of ["/api/bills", "/internal/document-fetch"])
      expect((await fetch(`${origin}${path}`)).status).toBe(404)
    expect((await fetch(`${origin}/ready`, { method: "POST" })).status).toBe(405)
  })
  it("serves SDK clients over sockets using independent API credentials", async () => {
    const { origin, upstream } = await start()
    const incoming = await token()
    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      fetch,
      requestInit: {
        headers: { host: "mcp.example.test", authorization: `Bearer ${incoming}`, "x-correlation-id": "socket-test" }
      }
    })
    const client = new Client({ name: "socket-test", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } })
    try {
      await client.connect(transport)
      expect((await client.listTools()).tools).toHaveLength(25)
      const result = await client.callTool({ name: "get_bill", arguments: { id: "bill:us:119:hr:1" } })
      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual({ data: { id: "bill:us:119:hr:1" } })
      const [url, init] = upstream.mock.calls[1] ?? []
      expect(String(url)).toContain("https://api.example.test/api/bills/")
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer api-token")
      expect(JSON.stringify(upstream.mock.calls)).not.toContain(incoming)
    } finally {
      await transport.close()
    }
  })
  it("bounds chunked bodies before the SDK adapter can buffer them", async () => {
    const { origin, upstream } = await start()
    const bearer = await token()
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        `${origin}/mcp`,
        {
          method: "POST",
          headers: { host: "mcp.example.test", authorization: `Bearer ${bearer}`, "content-type": "application/json" }
        },
        (response) => {
          response.resume()
          response.on("end", () => resolve(response.statusCode))
        }
      )
      request.on("error", reject)
      request.write('"')
      request.write("x".repeat(1_048_577))
      request.end('"')
    })
    expect(status).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })
  it("enforces the body deadline even when the Node caller never completes its upload", async () => {
    const { origin, upstream } = await start()
    const bearer = await token()
    const timeout = AbortSignal.timeout.bind(AbortSignal)
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) =>
      milliseconds === 10_000 ? AbortSignal.abort() : timeout(milliseconds)
    )
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        `${origin}/mcp`,
        {
          method: "POST",
          headers: { host: "mcp.example.test", authorization: `Bearer ${bearer}`, "content-type": "application/json" }
        },
        (response) => {
          response.resume()
          response.on("end", () => {
            resolve(response.statusCode)
            request.destroy()
          })
        }
      )
      request.on("error", reject)
      request.write("{")
    })
    expect(status).toBe(408)
    expect(upstream).not.toHaveBeenCalled()
  })
  it("closes the listener and SDK lifecycle idempotently", async () => {
    const { server, application } = await start()
    await close(server, application)
    expect(server.listening).toBe(false)
    expect(application.isReady()).toBe(false)
    await close(server, application)
  })
  it("interrupts an unfinished upload when the service shuts down", async () => {
    const { server, application, origin, upstream } = await start()
    const bearer = await token()
    const received = new Promise<void>((resolve) => server.once("request", () => resolve()))
    const responseStatus = new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        `${origin}/mcp`,
        { method: "POST", headers: { host: "mcp.example.test", authorization: `Bearer ${bearer}` } },
        (response) => {
          response.resume()
          response.on("end", () => {
            resolve(response.statusCode)
            request.destroy()
          })
        }
      )
      request.on("error", reject)
      request.write("{")
    })
    await received
    await close(server, application)
    expect([408, 503]).toContain(await responseStatus)
    expect(server.listening).toBe(false)
    expect(upstream).not.toHaveBeenCalled()
  })
})
