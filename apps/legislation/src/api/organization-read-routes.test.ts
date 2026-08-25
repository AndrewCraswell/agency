import { afterEach, describe, expect, it } from "vitest"
import type { OrganizationListInput, OrganizationRow } from "../db/queries/organization-relationships.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import { createOrganizationReadApiHandler, type OrganizationReadApi } from "./organization-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "organization-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: OrganizationReadApi) {
  const server = createLegislationServer({
    apiHandler: createOrganizationReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function organization(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    chamber: "lower",
    childRelationsComplete: false,
    classification: "committee",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    description: null,
    detailFactsComplete: false,
    id: "organization:ca:house:rules",
    isActive: true,
    jurisdictionId: "jurisdiction:ca",
    membershipRelationsComplete: false,
    name: "Rules Committee",
    parentOrganizationId: "organization:ca:house",
    provenanceComplete: true,
    publicContactAddress: null,
    publicContactEmail: null,
    publicContactPhone: null,
    sourceId: "ca-rules",
    sourceIsOfficial: true,
    sourceProvider: "openstates",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://openstates.org/ca/organizations/rules",
    termsOfReference: null,
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    upstreamIds: { openstates: "ca-rules" },
    websiteUrl: null,
    ...overrides
  }
}

describe("organization collection API handler", () => {
  it("returns a canonical Page<OrganizationSummary> for the complete filter and sort contract", async () => {
    let received: OrganizationListInput | undefined
    const baseUrl = await startServer({
      listOrganizations: async (input) => {
        received = input
        return { items: [organization()], nextCursor: "organization-next", truncated: true }
      }
    })
    const path =
      "/api/organizations?chamber=lower&classification=committee&cursor=bound&isActive=true&jurisdictionId=jurisdiction%3Aca&limit=2&parentOrganizationId=organization%3Aca%3Ahouse&q=rules&sort=updated-desc"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "organization-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      chamber: "lower",
      classification: "committee",
      cursor: "bound",
      isActive: true,
      jurisdictionId: "jurisdiction:ca",
      limit: 2,
      parentOrganizationId: "organization:ca:house",
      query: "rules",
      sort: "updated-desc"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/organizations/organization%3Aca%3Ahouse%3Arules",
          chamber: "lower",
          classification: "committee",
          isActive: true,
          jurisdictionId: "jurisdiction:ca",
          name: "Rules Committee",
          parentOrganizationId: "organization:ca:house",
          sources: [{ isOfficial: false, provider: "openstates" }],
          type: "organization"
        }
      ],
      links: {
        next: "/api/organizations?chamber=lower&classification=committee&cursor=organization-next&isActive=true&jurisdictionId=jurisdiction%3Aca&limit=2&parentOrganizationId=organization%3Aca%3Ahouse&q=rules&sort=updated-desc",
        self: path
      },
      meta: {
        correlationId: "organization-page",
        limit: 2,
        nextCursor: "organization-next",
        truncated: true,
        warnings: []
      }
    })
  })

  it("uses the documented default sort when sort is absent", async () => {
    let received: OrganizationListInput | undefined
    const baseUrl = await startServer({
      listOrganizations: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/organizations`)

    expect(response.status).toBe(200)
    expect(received).toEqual({
      chamber: undefined,
      classification: undefined,
      cursor: undefined,
      isActive: undefined,
      jurisdictionId: undefined,
      limit: 25,
      parentOrganizationId: undefined,
      query: undefined,
      sort: "name-asc"
    })
  })

  it("rejects unsupported route shapes and query controls", async () => {
    const baseUrl = await startServer({ listOrganizations: async () => ({ items: [], truncated: false }) })
    const [extraPath, wrongMethod, unsupported, duplicate, invalidBoolean, invalidSort, invalidClassification, limit] =
      await Promise.all([
        fetch(`${baseUrl}/api/organizations/organization%3Aca%3Ahouse`),
        fetch(`${baseUrl}/api/organizations`, { method: "POST" }),
        fetch(`${baseUrl}/api/organizations?unknown=value`),
        fetch(`${baseUrl}/api/organizations?q=rules&q=committee`),
        fetch(`${baseUrl}/api/organizations?isActive=yes`),
        fetch(`${baseUrl}/api/organizations?sort=name-desc`),
        fetch(`${baseUrl}/api/organizations?classification=invalid`),
        fetch(`${baseUrl}/api/organizations?limit=101`)
      ])

    expect([
      extraPath.status,
      wrongMethod.status,
      unsupported.status,
      duplicate.status,
      invalidBoolean.status,
      invalidSort.status,
      invalidClassification.status,
      limit.status
    ]).toEqual([404, 404, 400, 400, 400, 400, 400, 400])
    await expect(unsupported.json()).resolves.toMatchObject({
      error: { category: "invalid_request", retryable: false }
    })
  })

  it.each([
    ["incomplete provenance", { provenanceComplete: false }],
    ["unknown activity", { isActive: null }],
    ["unknown chamber", { chamber: "senate" }],
    ["unknown classification", { classification: "district" }]
  ])("fails closed for %s without requiring all stored rows to be complete", async (_name, overrides) => {
    const baseUrl = await startServer({
      listOrganizations: async () => ({ items: [organization(overrides)], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/organizations`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("passes repository errors through the canonical error envelope", async () => {
    const baseUrl = await startServer({
      listOrganizations: async () => {
        throw new LegislationError("dependency_unavailable", "Organization store unavailable")
      }
    })
    const response = await fetch(`${baseUrl}/api/organizations`, {
      headers: { "x-correlation-id": "organization-error" }
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "dependency_unavailable", correlationId: "organization-error", retryable: true }
    })
  })
})
