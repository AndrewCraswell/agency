import { afterEach, describe, expect, it } from "vitest"
import type { OrganizationRow } from "../db/queries/organization-relationships.js"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import {
  createJurisdictionOrganizationReadApiHandler,
  type JurisdictionOrganizationReadApi
} from "./jurisdiction-organization-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "jurisdiction-organization-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: JurisdictionOrganizationReadApi) {
  const server = createLegislationServer({
    apiHandler: createJurisdictionOrganizationReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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
    classification: "committee",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: "organization:ca:house:rules",
    isActive: true,
    jurisdictionId: "jurisdiction:ca",
    name: "Rules Committee",
    parentOrganizationId: "organization:ca:house",
    provenanceComplete: true,
    sourceId: "ca-rules",
    sourceIsOfficial: true,
    sourceProvider: "openstates",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://openstates.org/ca/organizations/rules",
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    upstreamIds: { openstates: "ca-rules" },
    ...overrides
  }
}

function pageOrganization(input: { collection: "organizations" | "commissions" | "committees" }): OrganizationRow {
  switch (input.collection) {
    case "commissions":
      return organization({
        classification: "commission",
        id: "organization:ca:commission:1",
        name: "Public Utilities Commission",
        parentOrganizationId: null
      })
    case "committees":
      return organization({ classification: "committee" })
    case "organizations":
      return organization({ classification: "committee" })
  }
}

describe("jurisdiction organization collection API handler", () => {
  it("returns a canonical organization page for the general jurisdiction view", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      listOrganizations: async (input) => {
        received = input
        return { items: [pageOrganization(input)], nextCursor: "organization-next", truncated: true }
      }
    })
    const path =
      "/api/jurisdictions/jurisdiction%3Aca/organizations?classification=committee&cursor=bound&isActive=true&limit=2&parentOrganizationId=organization%3Aca%3Ahouse&q=rules"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "organization-page" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      classification: "committee",
      collection: "organizations",
      cursor: "bound",
      isActive: true,
      jurisdictionId: "jurisdiction:ca",
      limit: 2,
      parentOrganizationId: "organization:ca:house",
      query: "rules"
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
        next: "/api/jurisdictions/jurisdiction%3Aca/organizations?classification=committee&cursor=organization-next&isActive=true&limit=2&parentOrganizationId=organization%3Aca%3Ahouse&q=rules",
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

  it("uses fixed classification views with their exact documented controls", async () => {
    const received: unknown[] = []
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      listOrganizations: async (input) => {
        received.push(input)
        return { items: [pageOrganization(input)], truncated: false }
      }
    })
    const committeeResponse = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Aca/committees?chamber=lower&isActive=false&parentOrganizationId=organization%3Aca%3Ahouse&q=rules`
    )

    const commission = await fetch(
      `${baseUrl}/api/jurisdictions/jurisdiction%3Aca/commissions?isActive=true&q=utilities&limit=1`
    )

    expect(commission.status).toBe(200)
    expect(committeeResponse.status).toBe(200)
    expect(received).toEqual([
      {
        collection: "committees",
        chamber: "lower",
        isActive: false,
        jurisdictionId: "jurisdiction:ca",
        limit: 25,
        parentOrganizationId: "organization:ca:house",
        query: "rules",
        cursor: undefined
      },
      {
        collection: "commissions",
        isActive: true,
        jurisdictionId: "jurisdiction:ca",
        limit: 1,
        query: "utilities",
        cursor: undefined
      }
    ])
  })

  it("checks the jurisdiction parent before listing and returns a correlated 404", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => {
        throw new LegislationError("not_found", "Jurisdiction was not found")
      },
      listOrganizations: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Amissing/organizations`, {
      headers: { "x-correlation-id": "missing-jurisdiction" }
    })

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-jurisdiction", retryable: false }
    })
  })

  it("rejects incompatible controls, invalid values, duplicates, and oversized inputs", async () => {
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      listOrganizations: async () => ({ items: [], truncated: false })
    })
    const [
      organizationChamber,
      commissionClass,
      committeeClass,
      duplicate,
      invalidClass,
      invalidChamber,
      overLimit,
      oversizedId
    ] = await Promise.all([
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/organizations?chamber=lower`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/commissions?classification=commission`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/committees?classification=committee`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/organizations?q=a&q=b`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/organizations?classification=invalid`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/committees?chamber=senate`),
      fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/committees?limit=101`),
      fetch(`${baseUrl}/api/jurisdictions/${"j".repeat(257)}/organizations`)
    ])

    expect([
      organizationChamber.status,
      commissionClass.status,
      committeeClass.status,
      duplicate.status,
      invalidClass.status,
      invalidChamber.status,
      overLimit.status,
      oversizedId.status
    ]).toEqual([400, 400, 400, 400, 400, 400, 400, 400])
  })

  it.each([
    ["incomplete provenance", { provenanceComplete: false }],
    ["unknown activity", { isActive: null }],
    ["unknown chamber", { chamber: "senate" }],
    ["unknown classification", { classification: "district" }]
  ])("fails closed for %s", async (_name, overrides) => {
    const baseUrl = await startServer({
      assertJurisdictionExists: async () => undefined,
      listOrganizations: async () => ({ items: [organization(overrides)], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/jurisdictions/jurisdiction%3Aca/organizations`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
