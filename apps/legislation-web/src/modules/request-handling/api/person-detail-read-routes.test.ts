import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { PersonDetailRead } from "../../legislation/persistence/queries/person-detail-read"
import { close, createLegislationServer } from "../test-http-server"
import { createPersonDetailReadApiHandler, type PersonDetailReadApi } from "./person-detail-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "person-detail-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: PersonDetailReadApi) {
  const server = createLegislationServer({
    apiHandler: createPersonDetailReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function detail(): PersonDetailRead {
  const createdAt = new Date("2026-08-20T15:00:00.000Z")
  const updatedAt = new Date("2026-08-21T15:00:00.000Z")
  const sourceRetrievedAt = new Date("2026-08-20T15:00:00.000Z")
  const sourceUpdatedAt = new Date("2026-08-19T15:00:00.000Z")
  return {
    aliases: [
      {
        createdAt,
        name: "A. Example",
        personId: "person:us:alex-example",
        provenanceComplete: true,
        sourceIdentity: "congress:alias:a-example",
        sourceIsOfficial: true,
        sourceProvider: "congress",
        sourceRetrievedAt,
        sourceUpdatedAt,
        sourceUrl: "https://api.congress.gov/member/A000001",
        updatedAt
      }
    ],
    externalIdentifiers: [
      {
        createdAt,
        personId: "person:us:alex-example",
        provenanceComplete: true,
        scheme: "bioguide",
        sourceIdentity: "congress:identifier:bioguide:A000001",
        sourceIsOfficial: true,
        sourceProvider: "congress",
        sourceRetrievedAt,
        sourceUpdatedAt,
        sourceUrl: "https://api.congress.gov/member/A000001",
        updatedAt,
        value: "A000001"
      }
    ],
    jurisdictions: [
      {
        createdAt,
        jurisdictionId: "jurisdiction:us",
        personId: "person:us:alex-example",
        provenanceComplete: true,
        sourceIdentity: "congress:jurisdiction:us",
        sourceIsOfficial: true,
        sourceProvider: "congress",
        sourceRetrievedAt,
        sourceUpdatedAt,
        sourceUrl: "https://api.congress.gov/member/A000001",
        updatedAt
      }
    ],
    memberships: { items: [], truncated: false },
    person: {
      createdAt,
      familyName: "Example",
      givenName: "Alex",
      inOfficeSinceYear: null,
      id: "person:us:alex-example",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "Alex Example",
      party: "Independent",
      provenanceComplete: true,
      sourceId: "A000001",
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt,
      sourceUpdatedAt,
      sourceUrl: "https://api.congress.gov/member/A000001",
      updatedAt,
      upstreamIds: { bioguide: "A000001" }
    },
    profile: {
      createdAt,
      imageUrl: "https://images.example.test/a000001.jpg",
      officialUrl: "https://example.test/representative/alex",
      personId: "person:us:alex-example",
      provenanceComplete: true,
      publicEmail: "alex@example.test",
      sourceIsOfficial: true,
      sourceProvider: "official-biography",
      sourceRetrievedAt: new Date("2026-08-22T09:00:00.000Z"),
      sourceUpdatedAt: new Date("2026-08-18T09:00:00.000Z"),
      sourceUrl: "https://representative.example.test/profile/alex",
      updatedAt
    },
    terms: [
      {
        chamber: "lower",
        createdAt,
        district: "1",
        endDate: null,
        startYear: null,
        endYear: null,
        id: "term:person:us:alex-example:119",
        isActive: true,
        jurisdictionId: "jurisdiction:us",
        officeTitle: "Representative",
        organizationId: null,
        party: "Independent",
        personId: "person:us:alex-example",
        provenanceComplete: true,
        role: "Representative",
        sourceId: "119",
        sourceIsOfficial: true,
        sourceProvider: "official-term-register",
        sourceRetrievedAt: new Date("2026-08-23T11:00:00.000Z"),
        sourceUpdatedAt: new Date("2026-08-17T11:00:00.000Z"),
        sourceUrl: "https://house.example.test/members/alex/term/119",
        startDate: "2025-01-03",
        updatedAt
      }
    ]
  }
}

describe("person detail read API handler", () => {
  it("returns the documented source-complete resource and rejects queries", async () => {
    let received: string | undefined
    const baseUrl = await startServer({
      getPersonDetail: async (personId) => {
        received = personId
        return detail()
      }
    })

    const response = await fetch(`${baseUrl}/api/people/person%3Aus%3Aalex-example`, {
      headers: { "x-correlation-id": "person-detail" }
    })

    expect(response.status).toBe(200)
    expect(received).toBe("person:us:alex-example")
    const sourceResponse = response.clone()
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/people/person%3Aus%3Aalex-example",
        email: "alex@example.test",
        externalIdentifiers: [{ scheme: "bioguide", value: "A000001" }],
        memberships: [],
        membershipsPageInfo: { limit: 25, nextCursor: null, truncated: false },
        otherNames: ["A. Example"],
        terms: [{ officeTitle: "Representative", type: "legislative-term" }],
        type: "person"
      },
      links: { self: "/api/people/person%3Aus%3Aalex-example" },
      meta: { correlationId: "person-detail", warnings: [] }
    })

    await expect(
      sourceResponse.json().then((body) => (body as { data: { sources: unknown } }).data.sources)
    ).resolves.toEqual([
      {
        isOfficial: true,
        provider: "congress",
        retrievedAt: "2026-08-20T15:00:00.000Z",
        sourceUpdatedAt: "2026-08-19T15:00:00.000Z",
        sourceUrl: "https://api.congress.gov/member/A000001"
      },
      {
        isOfficial: true,
        provider: "official-biography",
        retrievedAt: "2026-08-22T09:00:00.000Z",
        sourceUpdatedAt: "2026-08-18T09:00:00.000Z",
        sourceUrl: "https://representative.example.test/profile/alex"
      }
    ])

    const replay = await fetch(`${baseUrl}/api/people/person%3Aus%3Aalex-example`)
    await expect(
      replay.json().then((body) => (body as { data: { terms: [{ sources: unknown }] } }).data.terms[0].sources)
    ).resolves.toEqual([
      {
        isOfficial: true,
        provider: "official-term-register",
        retrievedAt: "2026-08-23T11:00:00.000Z",
        sourceUpdatedAt: "2026-08-17T11:00:00.000Z",
        sourceUrl: "https://house.example.test/members/alex/term/119"
      }
    ])

    const [queried, encodedApi, encodedPeople, malformedId] = await Promise.all([
      fetch(`${baseUrl}/api/people/person%3Aus%3Aalex-example?limit=1`),
      fetch(`${baseUrl}/%61pi/people/person%3Aus%3Aalex-example`),
      fetch(`${baseUrl}/api/%70eople/person%3Aus%3Aalex-example`),
      fetch(`${baseUrl}/api/people/person%ZZ`)
    ])
    expect([queried.status, encodedApi.status, encodedPeople.status, malformedId.status]).toEqual([400, 404, 404, 400])
  })

  it("does not expose a profile email without official provenance", async () => {
    const incomplete = detail()
    incomplete.profile.sourceIsOfficial = false
    const baseUrl = await startServer({ getPersonDetail: async () => incomplete })

    const response = await fetch(`${baseUrl}/api/people/person%3Aus%3Aalex-example`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { email: null } })
  })

  it("fails closed when the service reports incomplete legacy person detail", async () => {
    const baseUrl = await startServer({
      getPersonDetail: async () => {
        throw new LegislationError("unprocessable", "incomplete legacy detail")
      }
    })

    const response = await fetch(`${baseUrl}/api/people/person%3Aus%3Aalex-example`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
