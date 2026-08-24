import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterEach, describe, expect, it } from "vitest"
import { readJsonBody, sendApiJson } from "../api/http.js"
import type { RateLimiter } from "../api/rate-limit.js"
import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import { createLogger, type Logger } from "../observability/logger.js"
import { close, createLegislationServer } from "./server.js"
import { createLegislationMcpHandler, type LegislationQueryApi } from "./tools.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "legislation-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => close(server)))
  servers.clear()
})

async function startServer(
  isReady = true,
  options: Readonly<{
    apiHandler?: NonNullable<Parameters<typeof createLegislationServer>[0]["apiHandler"]>
    apiAuthenticate?: () => Promise<{ organizationId?: string; userId: string }>
    documentFetchRelay?: NonNullable<Parameters<typeof createLegislationServer>[0]["documentFetchRelay"]>
    logger?: Logger
    mcpAuthenticate?: () => Promise<{ userId: string }>
    mcpHandler?: NonNullable<Parameters<typeof createLegislationServer>[0]["mcpHandler"]>
    protectedResourceMetadata?: NonNullable<Parameters<typeof createLegislationServer>[0]["protectedResourceMetadata"]>
    rateLimit?: NonNullable<Parameters<typeof createLegislationServer>[0]["rateLimit"]>
    rateLimiter?: RateLimiter
    readinessDetails?: () => Readonly<Record<string, unknown>>
    requestBodyBytes?: number
  }> = {}
) {
  const server = createLegislationServer({ isReady: () => isReady, logger, ...options })
  servers.add(server)

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }

  return `http://127.0.0.1:${address.port}`
}

describe("createLegislationServer", () => {
  it("reports process health", async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "ok" })
  })

  it("reports dependency readiness", async () => {
    const baseUrl = await startServer(false, {
      readinessDetails: () => ({ databasePool: { saturation: 1, waiting: 2 } })
    })
    const response = await fetch(`${baseUrl}/ready`)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      databasePool: { saturation: 1, waiting: 2 },
      status: "unavailable"
    })
  })

  it("serves only authenticated, approved document relay requests", async () => {
    const relay = {
      fetch: async (sourceUrl: string) => ({
        bytes: new TextEncoder().encode("%PDF-relayed"),
        contentType: "application/pdf",
        sourceUrl
      }),
      token: "relay-secret"
    }
    const baseUrl = await startServer(true, { documentFetchRelay: relay })
    const artifactUrl = "https://www.palegis.us/legislation/bills/text/PDF/2021/0/HB0209/PN0175"

    const anonymous = await fetch(`${baseUrl}/internal/document-fetch`, {
      body: JSON.stringify({ sourceUrl: artifactUrl }),
      method: "POST"
    })
    expect(anonymous.status).toBe(401)

    const unsupported = await fetch(`${baseUrl}/internal/document-fetch`, {
      body: JSON.stringify({ sourceUrl: "https://example.gov/document.pdf" }),
      headers: { authorization: "Bearer relay-secret", "content-type": "application/json" },
      method: "POST"
    })
    expect(unsupported.status).toBe(400)

    const fiscalNote = await fetch(`${baseUrl}/internal/document-fetch`, {
      body: JSON.stringify({
        sourceUrl: "https://www.legis.state.pa.us/WU01/LI/BI/FN/2021/0/HB1013P1052.pdf"
      }),
      headers: { authorization: "Bearer relay-secret", "content-type": "application/json" },
      method: "POST"
    })
    expect(fiscalNote.status).toBe(200)

    const senateFiscalNote = await fetch(`${baseUrl}/internal/document-fetch`, {
      body: JSON.stringify({
        sourceUrl: "https://www.legis.state.pa.us/WU01/LI/BI/SFN/2021/0/HB0326P0388.pdf"
      }),
      headers: { authorization: "Bearer relay-secret", "content-type": "application/json" },
      method: "POST"
    })
    expect(senateFiscalNote.status).toBe(200)

    const response = await fetch(`${baseUrl}/internal/document-fetch`, {
      body: JSON.stringify({ sourceUrl: artifactUrl }),
      headers: { authorization: "Bearer relay-secret", "content-type": "application/json" },
      method: "POST"
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("x-legislation-relayed-source")).toBe(artifactUrl)
    await expect(response.text()).resolves.toBe("%PDF-relayed")
  })

  it("logs safe readiness diagnostics when a dependency is unavailable", async () => {
    const lines: string[] = []
    const diagnosticLogger = createLogger({
      level: "warn",
      service: "legislation-test",
      write: (line) => lines.push(line)
    })
    const baseUrl = await startServer(false, {
      logger: diagnosticLogger,
      readinessDetails: () => ({ databasePool: { saturation: 1, waiting: 2 } })
    })

    const response = await fetch(`${baseUrl}/ready`, { headers: { "x-correlation-id": "ready-test" } })

    expect(response.status).toBe(503)
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({
      correlationId: "ready-test",
      databasePool: { saturation: 1, waiting: 2 },
      level: "warn",
      message: "readiness check failed"
    })
  })

  it("returns a bounded not-found response", async () => {
    const baseUrl = await startServer()
    const response = await fetch(`${baseUrl}/unknown`)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "not_found" })
  })

  it("returns the API error envelope for an unclaimed API route", async () => {
    const baseUrl = await startServer(true, { apiHandler: async () => false })
    const response = await fetch(`${baseUrl}/api/not-implemented`, {
      headers: { "x-correlation-id": "api-not-found" }
    })

    expect(response.status).toBe(404)
    expect(response.headers.get("x-correlation-id")).toBe("api-not-found")
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "not_found",
        correlationId: "api-not-found",
        message: "API route was not found",
        retryable: false
      }
    })
  })

  it("returns a weak ETag for API retrievals and honors a matching If-None-Match without a body", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: { id: "bill:us:119:hr:1" }, meta: { correlationId: "volatile" } })
        return true
      }
    })

    const initial = await fetch(`${baseUrl}/api/bills`)
    const etag = initial.headers.get("etag")
    expect(initial.status).toBe(200)
    expect(etag).toMatch(/^W\/"/)
    if (etag === null) {
      throw new Error("Expected API retrieval to include an ETag")
    }
    expect(initial.headers.get("cache-control")).toBe("private, no-store")
    await initial.text()

    const conditional = await fetch(`${baseUrl}/api/bills`, { headers: { "if-none-match": etag } })
    expect(conditional.status).toBe(304)
    expect(conditional.headers.get("etag")).toBe(etag)
    await expect(conditional.text()).resolves.toBe("")
  })

  it("preserves a resource revision ETag and honors it for conditional retrievals", async () => {
    const revision = "7ca73ae3-ef1f-47bc-998c-ef30f7c6c6ee"
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        response.setHeader("etag", revision)
        sendApiJson(response, 200, { data: { id: "subscription:test" } })
        return true
      }
    })

    const initial = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`)
    expect(initial.status).toBe(200)
    expect(initial.headers.get("etag")).toBe(revision)
    await initial.text()

    const conditional = await fetch(`${baseUrl}/api/subscriptions/subscription%3Atest`, {
      headers: { "if-none-match": revision }
    })
    expect(conditional.status).toBe(304)
    expect(conditional.headers.get("etag")).toBe(revision)
    await expect(conditional.text()).resolves.toBe("")
  })

  it("returns the canonical 413 envelope when an API request body exceeds one MiB", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (request, response) => {
        await readJsonBody(request)
        sendApiJson(response, 200, { data: {} })
        return true
      }
    })
    const response = await fetch(`${baseUrl}/api/search/bills`, {
      body: JSON.stringify({ query: "x".repeat(1_048_576) }),
      headers: { "content-type": "application/json", "x-correlation-id": "oversized-api-body" },
      method: "POST"
    })

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: {
        category: "payload_too_large",
        correlationId: "oversized-api-body",
        message: "Request body exceeds the allowed size",
        retryable: false
      }
    })
  })

  it("adds Retry-After to retryable dependency failures", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async () => {
        throw new LegislationError("dependency_unavailable", "Search dependency is unavailable")
      }
    })
    const response = await fetch(`${baseUrl}/api/search/bills`)

    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("30")
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "dependency_unavailable", retryable: true }
    })
  })

  it("rate limits API requests by authenticated identity with standard headers and a safe envelope", async () => {
    const secret = "must-not-leak"
    const baseUrl = await startServer(true, {
      apiAuthenticate: async () => ({ userId: "user_test" }),
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: { id: "bill:us:119:hr:1" } })
        return true
      },
      rateLimit: { enabled: true, limit: 2, maximumKeys: 10, trustedProxyHops: 0, windowMs: 60_000 }
    })

    const headers = { authorization: `Bearer ${secret}` }
    const first = await fetch(`${baseUrl}/api/bills`, { headers })
    const second = await fetch(`${baseUrl}/api/bills`, { headers })
    const third = await fetch(`${baseUrl}/api/bills`, { headers })

    expect([first.status, second.status]).toEqual([200, 200])
    await first.text()
    await second.text()
    expect(third.status).toBe(429)
    expect(third.headers.get("ratelimit-limit")).toBe("2")
    expect(third.headers.get("ratelimit-remaining")).toBe("0")
    expect(third.headers.get("ratelimit-reset")).toMatch(/^\d+$/)
    expect(third.headers.get("retry-after")).toBe(third.headers.get("ratelimit-reset"))
    expect(third.headers.get("cache-control")).toBe("private, no-store")
    const body = await third.text()
    expect(body).not.toContain(secret)
    expect(JSON.parse(body)).toMatchObject({
      error: { category: "rate_limited", message: "Request rate limit exceeded", retryable: true }
    })
  })

  it("uses a verified identity instead of caller-controlled forwarded addresses", async () => {
    const baseUrl = await startServer(true, {
      apiAuthenticate: async () => ({ userId: "user_test" }),
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 1, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, {
      headers: { authorization: "Bearer test", "x-forwarded-for": "198.51.100.10" }
    })
    const second = await fetch(`${baseUrl}/api/bills`, {
      headers: { authorization: "Bearer test", "x-forwarded-for": "203.0.113.10" }
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    await first.text()
    await second.text()
  })

  it("ignores caller-controlled forwarded addresses when no trusted proxy is configured", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 0, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, { headers: { "x-forwarded-for": "198.51.100.10" } })
    const second = await fetch(`${baseUrl}/api/bills`, { headers: { "x-forwarded-for": "203.0.113.10" } })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    await first.text()
    await second.text()
  })

  it("uses forwarded addresses only after an explicit trusted proxy opt-in", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 1, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, { headers: { "x-forwarded-for": "198.51.100.10" } })
    const second = await fetch(`${baseUrl}/api/bills`, { headers: { "x-forwarded-for": "203.0.113.10" } })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await first.text()
    await second.text()
  })

  it("uses Railway's real client address after an explicit single-proxy opt-in", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 1, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, {
      headers: { "x-forwarded-for": "192.0.2.1", "x-real-ip": "198.51.100.10" }
    })
    const second = await fetch(`${baseUrl}/api/bills`, {
      headers: { "x-forwarded-for": "192.0.2.1", "x-real-ip": "203.0.113.10" }
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await first.text()
    await second.text()
  })

  it("rejects malformed real-client headers and safely falls back to the direct socket", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 1, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, { headers: { "x-real-ip": "not-an-ip" } })
    const second = await fetch(`${baseUrl}/api/bills`, { headers: { "x-real-ip": "also-not-an-ip" } })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    await first.text()
    await second.text()
  })

  it("falls back to the direct socket when any forwarded hop is malformed", async () => {
    const baseUrl = await startServer(true, {
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 1, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, {
      headers: { "x-forwarded-for": "198.51.100.10, malformed-hop" }
    })
    const second = await fetch(`${baseUrl}/api/bills`, {
      headers: { "x-forwarded-for": "203.0.113.10, malformed-hop" }
    })

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    await first.text()
    await second.text()
  })

  it("keeps structured identity components collision-free", async () => {
    const identities = [
      { organizationId: "org", userId: "user:part" },
      { organizationId: "org:user", userId: "part" }
    ]
    let identityIndex = 0
    const baseUrl = await startServer(true, {
      apiAuthenticate: async () => identities[identityIndex++] ?? identities.at(-1)!,
      apiHandler: async (_request, response) => {
        sendApiJson(response, 200, { data: {} })
        return true
      },
      rateLimit: { enabled: true, limit: 1, maximumKeys: 10, trustedProxyHops: 0, windowMs: 60_000 }
    })

    const first = await fetch(`${baseUrl}/api/bills`, { headers: { authorization: "Bearer first" } })
    const second = await fetch(`${baseUrl}/api/bills`, { headers: { authorization: "Bearer second" } })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await first.text()
    await second.text()
  })

  it("returns API authentication failures in the API error envelope", async () => {
    const resource = "https://legislation.example/mcp"
    const baseUrl = await startServer(true, {
      apiHandler: async () => true,
      apiAuthenticate: async () => {
        const { AuthenticationError } = await import("../auth/workos.js")
        throw new AuthenticationError("invalid")
      },
      protectedResourceMetadata: {
        authorizationServer: "https://api.workos.com",
        resource
      }
    })
    const [absent, invalid] = await Promise.all([
      fetch(`${baseUrl}/api/bills`, { headers: { "x-correlation-id": "api-auth-absent" } }),
      fetch(`${baseUrl}/api/bills`, {
        headers: { authorization: "Bearer invalid", "x-correlation-id": "api-auth-invalid" }
      })
    ])

    for (const [response, correlationId] of [
      [absent, "api-auth-absent"],
      [invalid, "api-auth-invalid"]
    ] as const) {
      expect(response.status).toBe(401)
      expect(response.headers.get("x-correlation-id")).toBe(correlationId)
      expect(response.headers.get("www-authenticate")).toContain("invalid_token")
      expect(response.headers.get("www-authenticate")).not.toContain("resource_metadata=")
      await expect(response.json()).resolves.toEqual({
        error: {
          category: "unauthorized",
          correlationId,
          message: "Bearer token is absent or invalid",
          retryable: false
        }
      })
    }
  })

  it("accepts and returns a caller correlation identifier", async () => {
    const baseUrl = await startServer()

    const response = await fetch(`${baseUrl}/health`, { headers: { "x-correlation-id": "request-123" } })

    expect(response.headers.get("x-correlation-id")).toBe("request-123")
  })

  it("rejects oversized MCP requests before invoking a handler", async () => {
    let invoked = false
    const baseUrl = await startServer(true, {
      mcpHandler: async () => {
        invoked = true
      },
      requestBodyBytes: 1024
    })

    const response = await fetch(`${baseUrl}/mcp`, { body: "x".repeat(1025), method: "POST" })

    expect(response.status).toBe(413)
    expect(invoked).toBe(false)
  })

  it("rejects anonymous MCP requests while leaving health public", async () => {
    const resource = "https://legislation.example/mcp"
    const baseUrl = await startServer(true, {
      mcpAuthenticate: async () => {
        const { AuthenticationError } = await import("../auth/workos.js")
        throw new AuthenticationError("missing")
      },
      mcpHandler: async () => undefined,
      protectedResourceMetadata: {
        authorizationServer: "https://api.workos.com",
        resource
      }
    })

    const [health, mcp] = await Promise.all([
      fetch(`${baseUrl}/health`),
      fetch(`${baseUrl}/mcp`, { body: "{}", method: "POST" })
    ])

    expect(health.status).toBe(200)
    expect(mcp.status).toBe(401)
    expect(mcp.headers.get("www-authenticate")).toContain("invalid_token")
    expect(mcp.headers.get("www-authenticate")).toContain(
      `resource_metadata="https://legislation.example/.well-known/oauth-protected-resource/mcp"`
    )

    const metadata = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`)
    expect(metadata.status).toBe(200)
    await expect(metadata.json()).resolves.toEqual({
      authorization_servers: ["https://api.workos.com"],
      resource
    })
  })

  it("carries authenticated user and organization identity into MCP handling", async () => {
    let capturedContext: ReturnType<typeof getRequestContext>
    const baseUrl = await startServer(true, {
      mcpAuthenticate: async () => ({ organizationId: "org_test", userId: "user_test" }),
      mcpHandler: async (_request, response) => {
        capturedContext = getRequestContext()
        response.writeHead(204)
        response.end()
      }
    })

    const response = await fetch(`${baseUrl}/mcp`, {
      body: "{}",
      headers: { authorization: "Bearer test", "x-correlation-id": "auth-request" },
      method: "POST"
    })

    expect(response.status).toBe(204)
    expect(capturedContext).toEqual({
      bearerToken: "test",
      correlationId: "auth-request",
      identity: { organizationId: "org_test", userId: "user_test" }
    })
  })

  it("does not forward an unverified bearer token when MCP authentication is disabled", async () => {
    let capturedContext: ReturnType<typeof getRequestContext>
    const baseUrl = await startServer(true, {
      mcpHandler: async (_request, response) => {
        capturedContext = getRequestContext()
        response.writeHead(204)
        response.end()
      }
    })

    const response = await fetch(`${baseUrl}/mcp`, {
      body: "{}",
      headers: { authorization: "Bearer unverified", "x-correlation-id": "anonymous-request" },
      method: "POST"
    })

    expect(response.status).toBe(204)
    expect(capturedContext).toEqual({ correlationId: "anonymous-request" })
  })

  it("allows an authenticated MCP client to discover and call every authorized tool", async () => {
    const billId = "bill:us:119:hr:1234"
    const service: LegislationQueryApi = {
      compareBillVersions: async () => ({ changes: [] }),
      findRelatedBills: async () => ({ items: [] }),
      getAmendment: async () => ({ amendment: {} }),
      getBill: async () => ({ bill: { id: billId } }),
      getBillVotes: async () => ({ billId, items: [] }),
      getBillText: async () => ({ sections: [] }),
      getBillTimeline: async () => ({ events: [] }),
      getCalendar: async () => ({ items: [] }),
      getEvent: async () => ({ event: {} }),
      getOrganization: async () => ({ organization: {} }),
      getPerson: async () => ({ person: {} }),
      getSupportingMaterial: async () => ({ material: {} }),
      getVote: async () => ({ vote: {} }),
      searchAmendments: async () => ({ items: [] }),
      searchBills: async () => ({ items: [] }),
      searchBillText: async () => ({ items: [] }),
      searchChanges: async () => ({ items: [] }),
      searchEvents: async () => ({ items: [] }),
      searchOrganizations: async () => ({ items: [] }),
      searchPeople: async () => ({ items: [] }),
      searchSupportingMaterials: async () => ({ items: [] }),
      searchVotes: async () => ({ items: [] })
    }
    const mcp = createLegislationMcpHandler(service, logger)
    let authenticationCalls = 0
    const baseUrl = await startServer(true, {
      mcpAuthenticate: async () => {
        authenticationCalls += 1
        return { userId: "user_test" }
      },
      mcpHandler: mcp.nodeHandler
    })
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      authProvider: { token: async () => "test-access-token" }
    })
    const client = new Client({ name: "authenticated-legislation-test", version: "1.0.0" })
    try {
      await client.connect(transport)
      const tools = await client.listTools()
      expect(tools.tools).toHaveLength(26)
      for (const call of [
        { arguments: { mode: "lexical", query: "data" }, name: "search_bills" },
        { arguments: { id: billId }, name: "get_bill" },
        { arguments: { ids: [billId] }, name: "get_bills" },
        { arguments: { id: billId }, name: "get_bill_timeline" },
        { arguments: { mode: "lexical", query: "data" }, name: "search_bill_text" },
        { arguments: { id: billId, versionCode: "ih" }, name: "get_bill_text" },
        { arguments: { billId, documentIds: ["document:a", "document:b"] }, name: "compare_bill_versions" },
        { arguments: { id: billId }, name: "find_related_bills" },
        { arguments: { id: "person:congress:a000001" }, name: "get_person" },
        { arguments: { jurisdictionId: "jurisdiction:us", query: "Smith" }, name: "search_people" },
        { arguments: { id: "organization:congress:house" }, name: "get_organization" },
        { arguments: { classification: "committee", jurisdictionId: "jurisdiction:us" }, name: "search_organizations" },
        { arguments: { jurisdictionId: "jurisdiction:us" }, name: "search_events" },
        { arguments: { id: "event:congress:meeting-1" }, name: "get_event" },
        { arguments: { jurisdictionId: "jurisdiction:us" }, name: "get_calendar" },
        { arguments: { billId }, name: "search_votes" },
        { arguments: { billId }, name: "get_bill_votes" },
        { arguments: { id: "vote:congress:house-1" }, name: "get_vote" },
        { arguments: { ids: ["vote:congress:house-1"] }, name: "get_votes" },
        { arguments: { billId }, name: "search_amendments" },
        { arguments: { id: "amendment:congress:119-hamdt-1" }, name: "get_amendment" },
        { arguments: { ids: ["amendment:congress:119-hamdt-1"] }, name: "get_amendments" },
        { arguments: { billIds: [billId] }, name: "search_amendments_for_bills" },
        { arguments: { billId }, name: "search_supporting_materials" },
        { arguments: { id: "material:govinfo:crpt-1" }, name: "get_supporting_material" },
        { arguments: { jurisdictionId: "jurisdiction:us" }, name: "search_changes" }
      ] as const) {
        await expect(client.callTool(call)).resolves.not.toMatchObject({ isError: true })
      }
      expect(authenticationCalls).toBeGreaterThan(0)
    } finally {
      await transport.close()
      await mcp.close()
    }
  })
})
