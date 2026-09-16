import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { PersonCollectionRead } from "../../legislation/persistence/queries/people-read"
import { close, createLegislationServer } from "../test-http-server"
import { createPeopleReadApiHandler, type PeopleReadApi } from "./people-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "people-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: PeopleReadApi) {
  const server = createLegislationServer({
    apiHandler: createPeopleReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function person(overrides: Partial<PersonCollectionRead> = {}): PersonCollectionRead {
  return {
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    familyName: "Example",
    givenName: "Alex",
    id: "person:us:alex-example",
    isActive: true,
    jurisdictionId: "jurisdiction:us",
    name: "Alex Example",
    party: "Independent",
    provenanceComplete: true,
    sourceId: "A000001",
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-19T15:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/member/A000001",
    updatedAt: new Date("2026-08-21T15:00:00.000Z"),
    upstreamIds: { congress: "A000001" },
    ...overrides
  }
}

describe("people read API handler", () => {
  it("returns the documented canonical page and forwards all filters", async () => {
    let received: unknown
    const baseUrl = await startServer({
      listPeople: async (input) => {
        received = input
        return { items: [person()], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path =
      "/api/people?q=Alex&jurisdictionId=jurisdiction%3Aus&organizationId=organization%3Aus%3Ahouse%3Arules&party=Independent&isActive=true&sort=updated-desc&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "people-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      limit: 1,
      organizationId: "organization:us:house:rules",
      party: "Independent",
      q: "Alex",
      sort: "updated-desc"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/people/person%3Aus%3Aalex-example",
          id: "person:us:alex-example",
          isActive: true,
          jurisdictionIds: ["jurisdiction:us"],
          type: "person"
        }
      ],
      links: {
        next: "/api/people?q=Alex&jurisdictionId=jurisdiction%3Aus&organizationId=organization%3Aus%3Ahouse%3Arules&party=Independent&isActive=true&sort=updated-desc&limit=1&cursor=next-cursor",
        self: path
      },
      meta: { correlationId: "people-page", limit: 1, nextCursor: "next-cursor", truncated: true, warnings: [] }
    })
  })

  it("accepts only the exact GET route and its bounded documented query values", async () => {
    let received: unknown
    const baseUrl = await startServer({
      listPeople: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })
    const acceptedQuery = "a".repeat(500)
    const accepted = await fetch(`${baseUrl}/api/people?q=${acceptedQuery}`)
    expect(accepted.status).toBe(200)
    expect(received).toMatchObject({ limit: 20, q: acceptedQuery })

    const oversizedQuery = "a".repeat(501)
    const [extraPath, wrongMethod, unsupported, duplicate, invalidBoolean, invalidSort, oversized, limit] =
      await Promise.all([
        fetch(`${baseUrl}/api/people/extra`),
        fetch(`${baseUrl}/api/people`, { method: "POST" }),
        fetch(`${baseUrl}/api/people?unknown=value`),
        fetch(`${baseUrl}/api/people?q=Alex&q=Pat`),
        fetch(`${baseUrl}/api/people?isActive=yes`),
        fetch(`${baseUrl}/api/people?sort=party-desc`),
        fetch(`${baseUrl}/api/people?q=${oversizedQuery}`),
        fetch(`${baseUrl}/api/people?limit=101`)
      ])

    expect([
      extraPath.status,
      wrongMethod.status,
      unsupported.status,
      duplicate.status,
      invalidBoolean.status,
      invalidSort.status,
      oversized.status,
      limit.status
    ]).toEqual([404, 404, 400, 400, 400, 400, 400, 400])
  })

  it("fails closed when a persistence row lacks required canonical provenance or activity", async () => {
    const incomplete = structuredClone(person())
    Reflect.deleteProperty(incomplete, "sourceUrl")
    const baseUrl = await startServer({ listPeople: async () => ({ items: [incomplete], truncated: false }) })
    const response = await fetch(`${baseUrl}/api/people`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
