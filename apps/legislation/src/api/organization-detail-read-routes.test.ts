import { afterEach, describe, expect, it } from "vitest"
import { LegislationError } from "../legislation/errors.js"
import { close, createLegislationServer } from "../mcp/server.js"
import { createLogger } from "../observability/logger.js"
import type { OrganizationDetail } from "./canonical-projection.js"
import {
  createOrganizationDetailReadApiHandler,
  type OrganizationDetailReadApi
} from "./organization-detail-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "organization-detail-read-api-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: OrganizationDetailReadApi) {
  const server = createLegislationServer({ apiHandler: createOrganizationDetailReadApiHandler(service), logger })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

function organizationDetail(): OrganizationDetail {
  return {
    canonicalUrl: "https://api.example.test/api/organizations/organization%3Aus%3Arules",
    chamber: "lower",
    childPageInfo: { memberships: { limit: 25, nextCursor: "member-cursor", truncated: true } },
    children: [],
    classification: "committee",
    contact: { address: null, email: "rules@example.test", phone: null },
    description: "Sets House rules.",
    id: "organization:us:rules",
    isActive: true,
    jurisdictionId: "jurisdiction:us",
    memberships: [],
    name: "Rules Committee",
    parentOrganizationId: "organization:congress:house",
    sources: [
      {
        isOfficial: true,
        provider: "congress",
        retrievedAt: "2026-08-20T15:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/committee/house-rules/HSRU00"
      }
    ],
    termsOfReference: "House Rule X.",
    type: "organization",
    updatedAt: "2026-08-20T15:00:00.000Z",
    websiteUrl: "https://rules.house.gov/"
  }
}

describe("organization detail read API handler", () => {
  it("returns the exact canonical detail resource with its fixed child limit", async () => {
    let received: unknown
    const baseUrl = await startServer({
      getOrganizationDetail: async (input) => {
        received = input
        return organizationDetail()
      }
    })
    const response = await fetch(`${baseUrl}/api/organizations/organization%3Aus%3Arules`, {
      headers: { "x-correlation-id": "organization-detail" }
    })

    expect(response.status).toBe(200)
    expect(received).toEqual({ childLimit: 25, organizationId: "organization:us:rules" })
    await expect(response.json()).resolves.toMatchObject({
      data: {
        childPageInfo: { memberships: { limit: 25, nextCursor: "member-cursor", truncated: true } },
        id: "organization:us:rules",
        type: "organization"
      },
      meta: { correlationId: "organization-detail", warnings: [] }
    })
  })

  it("uses the fixed internal child limit and converts an incomplete profile to a correlated 422", async () => {
    let received: unknown
    const baseUrl = await startServer({
      getOrganizationDetail: async (input) => {
        received = input
        throw new LegislationError("unprocessable", "Organization profile was incomplete")
      }
    })
    const response = await fetch(`${baseUrl}/api/organizations/organization%3Aus%3Arules`, {
      headers: { "x-correlation-id": "organization-detail-incomplete" }
    })

    expect(response.status).toBe(422)
    expect(received).toEqual({ childLimit: 25, organizationId: "organization:us:rules" })
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "unprocessable", correlationId: "organization-detail-incomplete", retryable: false }
    })
  })

  it("rejects undocumented childLimit and noncanonical route input", async () => {
    const baseUrl = await startServer({ getOrganizationDetail: async () => organizationDetail() })
    const path = "/api/organizations/organization%3Aus%3Arules"
    const [unsupported, repeated, fractional, tooLarge, wrongMethod, extraPath, doubledSlash, blankId, malformed] =
      await Promise.all([
        fetch(`${baseUrl}${path}?q=rules`),
        fetch(`${baseUrl}${path}?childLimit=1&childLimit=2`),
        fetch(`${baseUrl}${path}?childLimit=1.5`),
        fetch(`${baseUrl}${path}?childLimit=26`),
        fetch(`${baseUrl}${path}`, { method: "POST" }),
        fetch(`${baseUrl}${path}/members`),
        fetch(`${baseUrl}/api//organizations/organization%3Aus%3Arules`),
        fetch(`${baseUrl}/api/organizations/%20`),
        fetch(`${baseUrl}/api/organizations/%E0%A4%A`)
      ])

    expect([
      unsupported.status,
      repeated.status,
      fractional.status,
      tooLarge.status,
      wrongMethod.status,
      extraPath.status,
      doubledSlash.status,
      blankId.status,
      malformed.status
    ]).toEqual([400, 400, 400, 400, 404, 404, 404, 400, 400])
  })
})
