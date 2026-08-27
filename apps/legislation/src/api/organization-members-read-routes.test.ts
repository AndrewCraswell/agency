import { afterEach, describe, expect, it } from "vitest"
import type { OrganizationMembershipRead } from "../db/queries/civic-scoped-reads.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import {
  createOrganizationMembersReadApiHandler,
  type OrganizationMembersReadApi
} from "./organization-members-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "organization-members-read-api-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: OrganizationMembersReadApi) {
  const server = createLegislationServer({
    apiHandler: createOrganizationMembersReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/member/example",
    updatedAt: new Date("2026-08-20T15:00:00.000Z")
  } as const
}

function membership(id = "membership:us:house:1"): OrganizationMembershipRead {
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

describe("organization members read API handler", () => {
  it("returns a parent-bound canonical membership page with every documented filter", async () => {
    let received: unknown
    const baseUrl = await startServer({
      listOrganizationMembers: async (input) => {
        received = input
        return { items: [membership()], nextCursor: "member-cursor", truncated: true }
      }
    })
    const path =
      "/api/organizations/organization%3Aus%3Ahouse/members?cursor=bound-cursor&from=2025-01-01&isCurrent=true&limit=2&role=member&to=2026-12-31"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "organization-members-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: "bound-cursor",
      from: "2025-01-01",
      isCurrent: true,
      limit: 2,
      organizationId: "organization:us:house",
      role: "member",
      to: "2026-12-31"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl:
            "https://api.example.test/api/organizations/organization%3Aus%3Ahouse/memberships/membership%3Aus%3Ahouse%3A1",
          isCurrent: true,
          organization: {
            canonicalUrl: "https://api.example.test/api/organizations/organization%3Aus%3Ahouse",
            type: "organization"
          },
          person: {
            canonicalUrl: "https://api.example.test/api/people/person%3Aus%3Aexample",
            type: "person"
          },
          role: "member",
          type: "membership"
        }
      ],
      links: {
        next: expect.stringContaining("cursor=member-cursor"),
        self: path
      },
      meta: {
        correlationId: "organization-members-page",
        limit: 2,
        nextCursor: "member-cursor",
        truncated: true,
        warnings: []
      }
    })
  })

  it("returns a correlated 404 when the requested organization parent is absent", async () => {
    const baseUrl = await startServer({
      listOrganizationMembers: async () => {
        throw new LegislationError("not_found", "Organization organization:us:senate was not found")
      }
    })
    const response = await fetch(`${baseUrl}/api/organizations/organization%3Aus%3Asenate/members`, {
      headers: { "x-correlation-id": "organization-members-absent" }
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "organization-members-absent", retryable: false }
    })
  })

  it("uses the shared pagination default", async () => {
    let received: unknown
    const baseUrl = await startServer({
      listOrganizationMembers: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/organizations/organization%3Aus%3Ahouse/members`)

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ limit: 20, organizationId: "organization:us:house" })
  })

  it("fails closed for incomplete provenance and rejects noncanonical route or query input", async () => {
    const baseUrl = await startServer({
      listOrganizationMembers: async () => ({
        items: [{ ...membership(), person: { ...membership().person, provenanceComplete: false } }],
        truncated: false
      })
    })
    const path = "/api/organizations/organization%3Aus%3Ahouse/members"
    const [incomplete, unsupported, repeated, invalidBoolean, overLimit, mixedFormats, wrongMethod, oversizedId] =
      await Promise.all([
        fetch(`${baseUrl}${path}`),
        fetch(`${baseUrl}${path}?unexpected=true`),
        fetch(`${baseUrl}${path}?role=member&role=chair`),
        fetch(`${baseUrl}${path}?isCurrent=yes`),
        fetch(`${baseUrl}${path}?limit=101`),
        fetch(`${baseUrl}${path}?from=2026-01-01&to=2026-01-02T00%3A00%3A00Z`),
        fetch(`${baseUrl}${path}`, { method: "POST" }),
        fetch(`${baseUrl}/api/organizations/${"o".repeat(257)}/members`)
      ])

    expect(incomplete.status).toBe(422)
    await expect(incomplete.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
    expect([
      unsupported.status,
      repeated.status,
      invalidBoolean.status,
      overLimit.status,
      mixedFormats.status,
      wrongMethod.status,
      oversizedId.status
    ]).toEqual([400, 400, 400, 400, 400, 404, 400])
  })
})
