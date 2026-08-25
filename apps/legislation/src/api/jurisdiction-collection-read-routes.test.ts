import { afterEach, describe, expect, it } from "vitest"
import type { JurisdictionCollectionRead } from "../db/queries/jurisdictions-read.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import {
  createJurisdictionCollectionReadApiHandler,
  type JurisdictionCollectionReadApi
} from "./jurisdiction-collection-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "jurisdiction-collection-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: JurisdictionCollectionReadApi) {
  const server = createLegislationServer({
    apiHandler: createJurisdictionCollectionReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function jurisdiction(overrides: Partial<JurisdictionCollectionRead> = {}): JurisdictionCollectionRead {
  return {
    classification: "state",
    countryCode: "US",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: "jurisdiction:ca",
    isActive: true,
    name: "California",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "official-legislature",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://legislature.example.test/jurisdictions/ca",
    subdivisionCode: "CA",
    timezone: "America/Los_Angeles",
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    ...overrides
  }
}

describe("jurisdiction collection API handler", () => {
  it("returns a canonical Page and forwards every documented filter", async () => {
    let received: unknown
    const baseUrl = await startServer({
      listJurisdictions: async (input) => {
        received = input
        return { items: [jurisdiction()], nextCursor: "next-jurisdiction", truncated: true }
      }
    })
    const path = "/api/jurisdictions?classification=state&classification=territory&isActive=true&q=ca&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "jurisdiction-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      classification: ["state", "territory"],
      cursor: undefined,
      isActive: true,
      limit: 1,
      q: "ca"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/jurisdictions/jurisdiction%3Aca",
          classification: "state",
          isActive: true,
          name: "California",
          sources: [
            {
              isOfficial: true,
              provider: "official-legislature",
              retrievedAt: "2026-08-20T15:00:00.000Z",
              sourceUpdatedAt: "2026-08-20T14:00:00.000Z",
              sourceUrl: "https://legislature.example.test/jurisdictions/ca"
            }
          ],
          type: "jurisdiction"
        }
      ],
      links: {
        next: `${path}&cursor=next-jurisdiction`,
        self: path
      },
      meta: { correlationId: "jurisdiction-page", limit: 1, nextCursor: "next-jurisdiction", truncated: true }
    })
  })

  it("fails closed when a collection row lacks authoritative activity or provenance", async () => {
    const baseUrl = await startServer({
      listJurisdictions: async () => ({ items: [jurisdiction({ isActive: null })], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/jurisdictions`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("preserves not-found errors and rejects unsupported collection requests", async () => {
    const baseUrl = await startServer({
      listJurisdictions: async () => {
        throw new LegislationError("not_found", "Jurisdiction foundation was not found")
      }
    })
    const responses = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions`),
      fetch(`${baseUrl}/api/jurisdictions/`),
      fetch(`${baseUrl}/api/jurisdictions/extra`),
      fetch(`${baseUrl}/api/jurisdictions`, { method: "POST" }),
      fetch(`${baseUrl}/api/jurisdictions?unknown=value`),
      fetch(`${baseUrl}/api/jurisdictions?classification=state&classification=state`),
      fetch(`${baseUrl}/api/jurisdictions?classification=province`),
      fetch(`${baseUrl}/api/jurisdictions?isActive=yes`),
      fetch(`${baseUrl}/api/jurisdictions?q=a&q=b`),
      fetch(`${baseUrl}/api/jurisdictions?limit=101`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404, 400, 400, 400, 400, 400, 400])
  })
})
