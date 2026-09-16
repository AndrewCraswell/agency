import assert from "node:assert/strict"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { AuthenticationError } from "@repo/legislation-core/auth/workos"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import { readJsonBody, sendApiJson } from "./api/http"
import { close, createLegislationServer } from "./test-http-server"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "api-test", write: () => undefined })
afterEach(async () => {
  await Promise.all([...servers].map(close))
  servers.clear()
})
async function start(options: Partial<Parameters<typeof createLegislationServer>[0]> = {}) {
  const server = createLegislationServer({ logger, ...options })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  return `http://127.0.0.1:${address.port}`
}

describe("API-only test HTTP server", () => {
  it("reports health and safe dependency readiness with caller correlation", async () => {
    const lines: string[] = []
    const base = await start({
      isReady: () => false,
      readinessDetails: () => ({ databasePool: { saturation: 1, waiting: 2 } }),
      logger: createLogger({ level: "warn", service: "api-test", write: (line) => lines.push(line) })
    })
    const health = await fetch(`${base}/health`, { headers: { "x-correlation-id": "request-123" } })
    expect(health.status).toBe(200)
    expect(health.headers.get("x-correlation-id")).toBe("request-123")
    expect(await health.json()).toEqual({ status: "ok" })
    const ready = await fetch(`${base}/ready`, { headers: { "x-correlation-id": "ready-test" } })
    expect(ready.status).toBe(503)
    expect(ready.headers.get("x-correlation-id")).toBe("ready-test")
    expect(await ready.json()).toEqual({ databasePool: { saturation: 1, waiting: 2 }, status: "unavailable" })
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toMatchObject({
      correlationId: "ready-test",
      databasePool: { saturation: 1, waiting: 2 },
      level: "warn",
      message: "readiness check failed"
    })
  })
  it("returns bounded not-found responses and never hosts MCP or a document relay", async () => {
    const base = await start({ apiHandler: async () => false })
    for (const path of ["/unknown", "/mcp", "/internal/document-fetch"]) {
      const response = await fetch(`${base}${path}`)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: "not_found" })
    }
    const response = await fetch(`${base}/api/missing`, { headers: { "x-correlation-id": "api-not-found" } })
    expect(response.status).toBe(404)
    expect(response.headers.get("x-correlation-id")).toBe("api-not-found")
    expect(await response.json()).toEqual({
      error: {
        category: "not_found",
        correlationId: "api-not-found",
        message: "API route was not found",
        retryable: false
      }
    })
  })
  it.each([
    { revision: undefined, expectedEtag: /^W\/"/ },
    { revision: "7ca73ae3-ef1f-47bc-998c-ef30f7c6c6ee", expectedEtag: /^7ca73ae3-ef1f-47bc-998c-ef30f7c6c6ee$/ }
  ])("honors generated and explicit revision ETags ($revision)", async ({ revision, expectedEtag }) => {
    const base = await start({
      apiHandler: async (_request, response) => {
        if (revision) {
          response.setHeader("etag", revision)
        }
        sendApiJson(response, 200, { data: { id: "bill:us:119:hr:1" }, meta: { correlationId: "volatile" } })
        return true
      }
    })
    const first = await fetch(`${base}/api/bills`)
    expect(first.status).toBe(200)
    expect(first.headers.get("cache-control")).toBe("private, no-store")
    const etag = first.headers.get("etag")
    assert.ok(etag)
    expect(etag).toMatch(expectedEtag)
    await first.text()
    const conditional = await fetch(`${base}/api/bills`, { headers: { "if-none-match": etag } })
    expect(conditional.status).toBe(304)
    expect(conditional.headers.get("etag")).toBe(etag)
    expect(await conditional.text()).toBe("")
  })
  it("returns the canonical one-MiB request rejection", async () => {
    const base = await start({
      apiHandler: async (request, response) => {
        await readJsonBody(request)
        sendApiJson(response, 200, { data: {} })
        return true
      }
    })
    const response = await fetch(`${base}/api/search/bills`, {
      method: "POST",
      body: JSON.stringify({ query: "x".repeat(1_048_576) }),
      headers: { "content-type": "application/json", "x-correlation-id": "oversized-api-body" }
    })
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: {
        category: "payload_too_large",
        correlationId: "oversized-api-body",
        message: "Request body exceeds the allowed size",
        retryable: false
      }
    })
  })
  it("adds Retry-After to retryable dependency failures", async () => {
    const base = await start({
      apiHandler: async () => {
        throw new LegislationError("dependency_unavailable", "Search dependency is unavailable")
      }
    })
    const response = await fetch(`${base}/api/search/bills`)
    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("30")
    expect(await response.json()).toMatchObject({ error: { category: "dependency_unavailable", retryable: true } })
  })
  it("returns API authentication envelopes without MCP discovery challenges", async () => {
    const base = await start({
      apiHandler: async () => true,
      apiAuthenticate: async () => {
        throw new AuthenticationError("invalid")
      }
    })
    for (const authorization of [undefined, "Bearer invalid"]) {
      const response = await fetch(`${base}/api/bills`, {
        headers: { "x-correlation-id": "api-auth", ...(authorization ? { authorization } : {}) }
      })
      expect(response.status).toBe(401)
      expect(response.headers.get("x-correlation-id")).toBe("api-auth")
      expect(response.headers.get("www-authenticate")).toContain("invalid_token")
      expect(response.headers.get("www-authenticate")).not.toContain("resource_metadata=")
      expect(await response.json()).toEqual({
        error: {
          category: "unauthorized",
          correlationId: "api-auth",
          message: "Bearer token is absent or invalid",
          retryable: false
        }
      })
    }
  })
  it("carries verified identity but never a caller bearer into the API handler", async () => {
    let context: ReturnType<typeof getRequestContext>
    const base = await start({
      apiAuthenticate: async () => ({ userId: "user", organizationId: "org" }),
      apiHandler: async (_request, response) => {
        context = getRequestContext()
        response.writeHead(204)
        response.end()
        return true
      }
    })
    const response = await fetch(`${base}/api/bills`, {
      headers: { authorization: "Bearer caller", "x-correlation-id": "identity-test" }
    })
    expect(response.status).toBe(204)
    expect(context).toEqual({ correlationId: "identity-test", identity: { userId: "user", organizationId: "org" } })
  })
})
