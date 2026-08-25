import { afterEach, describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { projectCalendarDetail, projectJurisdiction } from "./canonical-projection.js"
import type { ResourceBatchReadRepository, ResourceBatchRequestItem } from "./resource-batch-read-repository.js"
import { createResourceBatchReadApiHandler } from "./resource-batch-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({
  level: "error",
  service: "legislation-resource-batch-read-api-test",
  write: () => undefined
})

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

const source = {
  isOfficial: true,
  provider: "test",
  retrievedAt: "2026-08-24T12:00:00.000Z",
  sourceUpdatedAt: "2026-08-24T11:00:00.000Z",
  sourceUrl: "https://source.example.test/jurisdiction/us"
} as const

const jurisdiction = projectJurisdiction(
  {
    classification: "country",
    id: "jurisdiction:us",
    isActive: true,
    name: "United States",
    sourceUrl: source.sourceUrl,
    timezone: "UTC"
  },
  { apiBaseUrl: "https://api.example.test", sources: [source], updatedAt: "2026-08-24T12:00:00.000Z" }
)

const calendar = projectCalendarDetail(
  {
    calendar: {
      classification: "legislative",
      id: "calendar:us",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "United States legislative calendar",
      organizationId: null,
      sourceUrl: source.sourceUrl,
      timezone: "UTC"
    },
    coverageFrom: null,
    coverageTo: null,
    description: null
  },
  { apiBaseUrl: "https://api.example.test", sources: [source], updatedAt: "2026-08-24T12:00:00.000Z" }
)

async function start(repository: ResourceBatchReadRepository): Promise<string> {
  const server = createLegislationServer({
    apiHandler: createResourceBatchReadApiHandler(repository),
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

function repository(overrides: Partial<ResourceBatchReadRepository> = {}): ResourceBatchReadRepository {
  return {
    getResource: async () => jurisdiction,
    ...overrides
  }
}

describe("resource batch read API handler", () => {
  it("deduplicates repeated resources in first-occurrence order and isolates item errors", async () => {
    const received: ResourceBatchRequestItem[] = []
    const baseUrl = await start(
      repository({
        getResource: async (input) => {
          received.push(input)
          if (input.type === "person") {
            throw new LegislationError("not_found", "Person was not found")
          }
          return jurisdiction
        }
      })
    )

    const response = await fetch(`${baseUrl}/api/resources/batch`, {
      body: JSON.stringify({
        items: [
          { id: "jurisdiction:us", type: "jurisdiction" },
          { id: "person:missing", type: "person" },
          { id: "jurisdiction:us", type: "jurisdiction" }
        ]
      }),
      headers: { "content-type": "application/json", "x-correlation-id": "batch-read-1" },
      method: "POST"
    })

    expect(received).toEqual([
      { id: "jurisdiction:us", type: "jurisdiction" },
      { id: "person:missing", type: "person" }
    ])
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        { data: jurisdiction, id: "jurisdiction:us", status: "ok" },
        {
          error: { category: "not_found", message: "Person was not found", retryable: false },
          id: "person:missing",
          status: "error"
        }
      ],
      links: { self: "/api/resources/batch" },
      meta: { correlationId: "batch-read-1", requested: 2, returned: 2, warnings: [] }
    })
  })

  it("maps unexpected item failures to dependency_unavailable without aborting the batch", async () => {
    const baseUrl = await start(
      repository({
        getResource: async (input) => {
          if (input.id === "jurisdiction:broken") {
            throw new Error("database details must not leak")
          }
          return jurisdiction
        }
      })
    )

    const response = await fetch(`${baseUrl}/api/resources/batch`, {
      body: JSON.stringify({
        items: [
          { id: "jurisdiction:broken", type: "jurisdiction" },
          { id: "jurisdiction:us", type: "jurisdiction" }
        ]
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          error: {
            category: "dependency_unavailable",
            message: "The canonical resource is currently unavailable",
            retryable: true
          },
          id: "jurisdiction:broken",
          status: "error"
        },
        { id: "jurisdiction:us", status: "ok" }
      ]
    })
  })

  it("accepts calendar resources and rejects invalid outer requests", async () => {
    const baseUrl = await start(
      repository({ getResource: async (input) => (input.type === "calendar" ? calendar : jurisdiction) })
    )
    const calendarResponse = await fetch(`${baseUrl}/api/resources/batch`, {
      body: JSON.stringify({ items: [{ id: "calendar:us", type: "calendar" }] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    expect(calendarResponse.status).toBe(200)
    await expect(calendarResponse.json()).resolves.toEqual({
      data: [
        {
          data: calendar,
          id: "calendar:us",
          status: "ok"
        }
      ],
      links: { self: "/api/resources/batch" },
      meta: { correlationId: expect.any(String), requested: 1, returned: 1, warnings: [] }
    })

    for (const body of [
      {},
      { extra: true, items: [{ id: "jurisdiction:us", type: "jurisdiction" }] },
      { items: [] },
      { items: [{ id: "jurisdiction:us", type: "unknown" }] },
      { items: [{ id: "jurisdiction:us", extra: true, type: "jurisdiction" }] },
      { items: [{ id: "   ", type: "jurisdiction" }] },
      { items: Array.from({ length: 26 }, () => ({ id: "jurisdiction:us", type: "jurisdiction" })) }
    ]) {
      const response = await fetch(`${baseUrl}/api/resources/batch`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ error: { category: "invalid_request" } })
    }

    expect((await fetch(`${baseUrl}/api/resources/batch?limit=1`, { method: "POST" })).status).toBe(400)
    expect((await fetch(`${baseUrl}/api/resources/batch`, { method: "GET" })).status).toBe(404)
    expect((await fetch(`${baseUrl}/api/resources/batch/`, { method: "POST" })).status).toBe(404)
  })

  it("normalizes bounded IDs before dispatch and rejects oversized IDs", async () => {
    const received: ResourceBatchRequestItem[] = []
    const baseUrl = await start(
      repository({
        getResource: async (input) => {
          received.push(input)
          return jurisdiction
        }
      })
    )

    const normalized = await fetch(`${baseUrl}/api/resources/batch`, {
      body: JSON.stringify({ items: [{ id: " jurisdiction:us ", type: "jurisdiction" }] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
    const oversized = await fetch(`${baseUrl}/api/resources/batch`, {
      body: JSON.stringify({ items: [{ id: "x".repeat(257), type: "jurisdiction" }] }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })

    expect(normalized.status).toBe(200)
    expect(received).toEqual([{ id: "jurisdiction:us", type: "jurisdiction" }])
    expect(oversized.status).toBe(400)
  })
})
