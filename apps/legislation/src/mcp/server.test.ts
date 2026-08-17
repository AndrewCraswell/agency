import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterEach, describe, expect, it } from "vitest"
import { getRequestContext } from "../auth/request-context.js"
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
    authenticate?: () => Promise<{ userId: string }>
    logger?: Logger
    mcpHandler?: NonNullable<Parameters<typeof createLegislationServer>[0]["mcpHandler"]>
    protectedResourceMetadata?: NonNullable<Parameters<typeof createLegislationServer>[0]["protectedResourceMetadata"]>
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
      authenticate: async () => {
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
      authenticate: async () => ({ organizationId: "org_test", userId: "user_test" }),
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
      correlationId: "auth-request",
      identity: { organizationId: "org_test", userId: "user_test" }
    })
  })

  it("allows an authenticated MCP client to discover and call every authorized tool", async () => {
    const billId = "bill:us:119:hr:1234"
    const service: LegislationQueryApi = {
      compareBillVersions: async () => ({ changes: [] }),
      findRelatedBills: async () => ({ items: [] }),
      getAmendment: async () => ({ amendment: {} }),
      getBill: async () => ({ bill: { id: billId } }),
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
      authenticate: async () => {
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
      expect(tools.tools).toHaveLength(21)
      for (const call of [
        { arguments: { mode: "lexical", query: "data" }, name: "search_bills" },
        { arguments: { id: billId }, name: "get_bill" },
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
        { arguments: { id: "vote:congress:house-1" }, name: "get_vote" },
        { arguments: { billId }, name: "search_amendments" },
        { arguments: { id: "amendment:congress:119-hamdt-1" }, name: "get_amendment" },
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
