import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import { close, createLegislationServer } from "../test-http-server"
import type { JurisdictionRead } from "./jurisdiction-read-repository"
import { createJurisdictionReadApiHandler, type JurisdictionReadApi } from "./jurisdiction-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "jurisdiction-read-route-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: JurisdictionReadApi) {
  const server = createLegislationServer({
    apiHandler: createJurisdictionReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function jurisdiction(overrides: Partial<JurisdictionRead> = {}): JurisdictionRead {
  return {
    classification: "state",
    countryCode: "US",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: "jurisdiction:ca",
    isActive: true,
    name: "California",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "canonical-foundation",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://source.example.test/jurisdictions/ca",
    subdivisionCode: "CA",
    timezone: "America/Los_Angeles",
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    ...overrides
  }
}

describe("jurisdiction detail API handler", () => {
  it("returns the exact canonical detail resource from a complete persisted row", async () => {
    let received: string | undefined
    const baseUrl = await startServer({
      getJurisdiction: async (jurisdictionId) => {
        received = jurisdictionId
        return jurisdiction()
      }
    })
    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca`, {
      headers: { "x-correlation-id": "jurisdiction-detail" }
    })

    expect(response.status).toBe(200)
    expect(received).toBe("jurisdiction:ca")
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/jurisdictions/jurisdiction%3Aca",
        classification: "state",
        isActive: true,
        name: "California",
        sources: [
          {
            isOfficial: true,
            provider: "canonical-foundation",
            retrievedAt: "2026-08-20T15:00:00.000Z",
            sourceUpdatedAt: "2026-08-20T14:00:00.000Z",
            sourceUrl: "https://source.example.test/jurisdictions/ca"
          }
        ],
        timezone: "America/Los_Angeles",
        type: "jurisdiction"
      },
      links: { self: "/api/jurisdictions/jurisdiction%3Aca" },
      meta: { correlationId: "jurisdiction-detail", warnings: [] }
    })
  })

  it("returns a correlated 404 only when the bound jurisdiction is absent", async () => {
    const baseUrl = await startServer({
      getJurisdiction: async () => {
        throw new LegislationError("not_found", "Jurisdiction was not found")
      }
    })
    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Amissing`, {
      headers: { "x-correlation-id": "jurisdiction-missing" }
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "jurisdiction-missing", retryable: false }
    })
  })

  it.each([
    ["incomplete provenance", { provenanceComplete: false }],
    ["unknown activity", { isActive: null }],
    ["missing source provider", { sourceProvider: null }],
    ["noncanonical classification", { classification: "region" }]
  ])("fails closed with 422 for a present row with %s", async (_name, overrides) => {
    const baseUrl = await startServer({ getJurisdiction: async () => jurisdiction(overrides) })
    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("accepts only the exact GET path with no query parameters", async () => {
    const baseUrl = await startServer({ getJurisdiction: async () => jurisdiction() })
    const [collection, nested, query, post, oversized] = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/sessions`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca?limit=1`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca`, { method: "POST" }),
      fetch(`${baseUrl}/api/jurisdictions/${"j".repeat(257)}`)
    ])

    expect([collection.status, nested.status, query.status, post.status, oversized.status]).toEqual([
      404, 404, 400, 404, 400
    ])
  })
})
