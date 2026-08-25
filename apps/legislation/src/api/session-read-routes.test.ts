import { afterEach, describe, expect, it } from "vitest"
import type { SessionRead } from "../db/queries/session-read.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createSessionReadApiHandler, type SessionReadApi } from "./session-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "session-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: SessionReadApi) {
  const server = createLegislationServer({
    apiHandler: createSessionReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
    logger
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function session(overrides: Partial<SessionRead> = {}): SessionRead {
  return {
    classification: "regular",
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    endDate: null,
    id: "session:wa:2025",
    identifier: "2025-2026",
    isActive: true,
    jurisdictionId: "jurisdiction:wa",
    name: "Regular Session",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "official-legislature",
    sourceRetrievedAt: new Date("2026-08-20T00:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://legislature.example.test/sessions/2025",
    startDate: "2025-01-01",
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    ...overrides
  }
}

describe("session read API handler", () => {
  it("returns a parent-bound canonical session page with interval filters", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      getSession: async () => session(),
      listJurisdictionSessions: async (input) => {
        received = input
        return { items: [session()], nextCursor: "next-session", truncated: true }
      }
    })
    const path = "/api/jurisdictions/jurisdiction%3Awa/sessions?from=2025-01-01&isActive=true&limit=1&to=2025-12-31"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "session-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      from: "2025-01-01",
      isActive: true,
      jurisdictionId: "jurisdiction:wa",
      limit: 1,
      to: "2025-12-31"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/sessions/session%3Awa%3A2025",
          classification: "regular",
          jurisdictionId: "jurisdiction:wa",
          name: "Regular Session",
          type: "session"
        }
      ],
      links: {
        next: `${path}&cursor=next-session`,
        self: path
      },
      meta: { correlationId: "session-page", limit: 1, nextCursor: "next-session", truncated: true, warnings: [] }
    })
  })

  it("returns a canonical session resource", async () => {
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      getSession: async () => session(),
      listJurisdictionSessions: async () => ({ items: [], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/sessions/session%3Awa%3A2025`, {
      headers: { "x-correlation-id": "session-detail" }
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/sessions/session%3Awa%3A2025",
        endDate: null,
        isActive: true,
        startDate: "2025-01-01",
        type: "session"
      },
      links: { self: "/api/sessions/session%3Awa%3A2025" },
      meta: { correlationId: "session-detail", warnings: [] }
    })
  })

  it("fails closed when a row lacks canonical foundation facts", async () => {
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      getSession: async () => session({ classification: null, sourceUrl: null }),
      listJurisdictionSessions: async () => ({ items: [session({ isActive: null })], truncated: false })
    })
    const [detail, page] = await Promise.all([
      fetch(`${baseUrl}/api/sessions/session%3Awa%3A2025`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Awa/sessions`)
    ])

    expect(detail.status).toBe(422)
    expect(page.status).toBe(422)
    await expect(detail.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })

  it("checks the parent and rejects unsupported or malformed requests", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => {
        throw new LegislationError("not_found", "Jurisdiction was not found")
      },
      getSession: async () => session(),
      listJurisdictionSessions: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const [missingParent, unsupported, duplicate, wrongMethod, extraPath] = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Amissing/sessions`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Awa/sessions?unknown=value`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Awa/sessions?from=2025-01-01&from=2025-02-01`),
      fetch(`${baseUrl}/api/sessions/session%3Awa%3A2025`, { method: "POST" }),
      fetch(`${baseUrl}/api/sessions/session%3Awa%3A2025/extra`)
    ])

    expect([missingParent.status, unsupported.status, duplicate.status, wrongMethod.status, extraPath.status]).toEqual([
      404, 400, 400, 404, 404
    ])
    expect(listed).toBe(false)
  })
})
