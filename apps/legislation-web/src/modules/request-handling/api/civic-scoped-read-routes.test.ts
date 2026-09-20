import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type {
  OrganizationMembershipRead,
  PersonTermRead
} from "../../legislation/persistence/queries/civic-scoped-reads"
import { close, createLegislationServer } from "../test-http-server"
import { createCivicScopedReadApiHandler, type CivicScopedReadApi } from "./civic-scoped-read-routes"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({
  level: "error",
  service: "legislation-civic-scoped-read-api-test",
  write: () => undefined
})

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: CivicScopedReadApi) {
  const server = createLegislationServer({
    apiHandler: createCivicScopedReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function sourceFields() {
  return {
    createdAt: new Date("2026-08-20T15:00:00Z"),
    provenanceComplete: true,
    sourceIsOfficial: false,
    sourceProvider: "published-civic-register",
    sourceRetrievedAt: new Date("2026-08-23T15:00:00Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00Z"),
    sourceUrl: "https://api.congress.gov/v3/member/example",
    updatedAt: new Date("2026-08-20T15:00:00Z")
  } as const
}

function term(id = "term:us:119:1"): PersonTermRead {
  return {
    term: {
      ...sourceFields(),
      district: "1",
      endDate: null,
      id,
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      officeTitle: "Representative",
      organizationId: "organization:us:house",
      personId: "person:us:example",
      startDate: "2025-01-03"
    }
  }
}

function membership(id = "membership:us:1"): OrganizationMembershipRead {
  return {
    membership: {
      ...sourceFields(),
      detectedEndDate: null,
      detectedStartDate: "2025-01-03",
      effectiveEndDate: null,
      effectiveStartDate: null,
      endedReason: null,
      id,
      isActive: true,
      label: "Member",
      lastObservedDate: "2026-02-20",
      legislativeSessionId: "session:us:119",
      organizationId: "organization:us:house",
      personId: "person:us:example",
      role: "member"
    },
    organization: {
      ...sourceFields(),
      chamber: "lower",
      classification: "chamber",
      id: "organization:us:house",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "House of Representatives",
      parentOrganizationId: null
    },
    person: {
      ...sourceFields(),
      familyName: "Example",
      givenName: "Alex",
      id: "person:us:example",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "Alex Example",
      party: null
    }
  }
}

function service(): CivicScopedReadApi {
  return {
    getOrganizationMembership: async () => membership(),
    getPersonTerm: async () => term()
  }
}

describe("civic scoped read API handler", () => {
  it("returns a canonical term only through its requested person path", async () => {
    const inputs: unknown[] = []
    const baseUrl = await startServer({
      ...service(),
      getPersonTerm: async (input) => {
        inputs.push(input)
        if (input.personId !== "person:us:example") {
          throw new LegislationError("not_found", "Term was not found")
        }
        return term(input.termId)
      }
    })
    const path = "/api/people/person%3Aus%3Aexample/terms/term%3Aus%3A119%3A1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "term-read-1" } })
    const mismatch = await fetch(`${baseUrl}/api/people/person%3Aus%3Aother/terms/term%3Aus%3A119%3A1`)

    expect(inputs).toEqual([
      { personId: "person:us:example", termId: "term:us:119:1" },
      { personId: "person:us:other", termId: "term:us:119:1" }
    ])
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/people/person%3Aus%3Aexample/terms/term%3Aus%3A119%3A1",
        officeTitle: "Representative",
        sources: [
          {
            isOfficial: false,
            provider: "published-civic-register",
            retrievedAt: "2026-08-23T15:00:00.000Z",
            sourceUpdatedAt: "2026-08-20T14:00:00.000Z",
            sourceUrl: "https://api.congress.gov/v3/member/example"
          }
        ],
        type: "legislative-term"
      },
      links: { self: path },
      meta: { correlationId: "term-read-1", warnings: [] }
    })
    expect(mismatch.status).toBe(404)
  })

  it("returns a canonical membership only through its requested organization path", async () => {
    const inputs: unknown[] = []
    const baseUrl = await startServer({
      ...service(),
      getOrganizationMembership: async (input) => {
        inputs.push(input)
        if (input.organizationId !== "organization:us:house") {
          throw new LegislationError("not_found", "Membership was not found")
        }
        return membership(input.membershipId)
      }
    })
    const path = "/api/organizations/organization%3Aus%3Ahouse/memberships/membership%3Aus%3A1"
    const response = await fetch(`${baseUrl}${path}`)
    const mismatch = await fetch(
      `${baseUrl}/api/organizations/organization%3Aus%3Asenate/memberships/membership%3Aus%3A1`
    )

    expect(inputs).toEqual([
      { membershipId: "membership:us:1", organizationId: "organization:us:house" },
      { membershipId: "membership:us:1", organizationId: "organization:us:senate" }
    ])
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl:
          "https://api.example.test/api/organizations/organization%3Aus%3Ahouse/memberships/membership%3Aus%3A1",
        person: { type: "person" },
        role: "member",
        sources: [
          {
            isOfficial: false,
            provider: "published-civic-register",
            retrievedAt: "2026-08-23T15:00:00.000Z",
            sourceUpdatedAt: "2026-08-20T14:00:00.000Z",
            sourceUrl: "https://api.congress.gov/v3/member/example"
          }
        ],
        type: "membership"
      },
      links: { self: path }
    })
    expect(mismatch.status).toBe(404)
  })

  it("fails closed for incomplete canonical provenance and rejects undocumented query input", async () => {
    const baseUrl = await startServer({
      ...service(),
      getPersonTerm: async () => ({ term: { ...term().term, provenanceComplete: false } })
    })

    const incomplete = await fetch(`${baseUrl}/api/people/person%3Aus%3Aexample/terms/term%3Aus%3A119%3A1`)
    const unsupported = await fetch(
      `${baseUrl}/api/organizations/organization%3Aus%3Ahouse/memberships/membership%3Aus%3A1?limit=1`
    )

    expect(incomplete.status).toBe(422)
    await expect(incomplete.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
    expect(unsupported.status).toBe(400)
    await expect(unsupported.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })
})
