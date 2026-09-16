import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type {
  OrganizationBillRead,
  OrganizationBillReadPage
} from "../../legislation/persistence/queries/organization-bill-read.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createOrganizationBillReadApiHandler, type OrganizationBillReadApi } from "./organization-bill-read-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "organization-bill-read-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: OrganizationBillReadApi) {
  const server = createLegislationServer({
    apiHandler: createOrganizationBillReadApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function bill(overrides: Partial<OrganizationBillRead> = {}): OrganizationBillRead {
  return {
    classification: ["bill"],
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: "bill:us:119:house:hr-1",
    identifier: "H.R. 1",
    introducedAt: new Date("2026-01-03T00:00:00.000Z"),
    jurisdictionId: "jurisdiction:us",
    latestActionAt: new Date("2026-08-21T15:00:00.000Z"),
    sessionId: "session:us:119",
    sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1",
    status: "pending",
    subjects: ["Budget"],
    title: "Budget Act",
    updatedAt: new Date("2026-08-22T15:00:00.000Z"),
    upstreamIds: { congress: "119/hr/1" },
    ...overrides
  }
}

describe("organization bill read API handler", () => {
  it("uses the shared pagination default", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertOrganizationExists: async () => undefined,
      listOrganizationBillReads: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/organizations/organization%3Aus%3Ahouse/bills`)

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ limit: 20, organizationId: "organization:us:house" })
  })

  it("returns a canonical BillSummary page with the documented filter contract", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertOrganizationExists: async () => undefined,
      listOrganizationBillReads: async (input) => {
        received = input
        return { items: [bill()], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path =
      "/api/organizations/organization%3Aus%3Ahouse%3Aways-and-means/bills?sessionId=session%3Aus%3A119&status=pending&relationship=referred-to&from=2026-01-01&to=2026-12-31&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "organization-bills" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      from: "2026-01-01",
      limit: 1,
      organizationId: "organization:us:house:ways-and-means",
      relationship: "referred-to",
      sessionId: "session:us:119",
      status: "pending",
      to: "2026-12-31"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahouse%3Ahr-1",
          id: "bill:us:119:house:hr-1",
          latestActionAt: "2026-08-21T15:00:00.000Z",
          type: "bill"
        }
      ],
      links: {
        next: "/api/organizations/organization%3Aus%3Ahouse%3Aways-and-means/bills?sessionId=session%3Aus%3A119&status=pending&relationship=referred-to&from=2026-01-01&to=2026-12-31&limit=1&cursor=next-cursor",
        self: path
      },
      meta: { correlationId: "organization-bills", limit: 1, nextCursor: "next-cursor", truncated: true, warnings: [] }
    })
  })

  it("returns a correlated parent 404 before listing bills", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertOrganizationExists: async () => {
        throw new LegislationError("not_found", "Organization was not found")
      },
      listOrganizationBillReads: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/organizations/organization%3Amissing/bills`, {
      headers: { "x-correlation-id": "missing-organization" }
    })

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-organization", retryable: false }
    })
  })

  it("rejects undocumented, unbounded, duplicate, and unsupported filter values", async () => {
    const baseUrl = await startServer({
      assertOrganizationExists: async () => undefined,
      listOrganizationBillReads: async () => ({ items: [], truncated: false })
    })
    const oversizedStatus = "a".repeat(257)
    const [
      extraPath,
      wrongMethod,
      unsupported,
      duplicate,
      invalidRelationship,
      invalidDate,
      invertedRange,
      mixedFormats,
      limit
    ] = await Promise.all([
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills/extra`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills`, { method: "POST" }),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?unknown=value`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?status=pending&status=passed`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?relationship=sponsor`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?from=2026-02-30`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?from=2026-02-02&to=2026-02-01`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?from=2026-02-01&to=2026-02-02T00%3A00%3A00Z`),
      fetch(`${baseUrl}/api/organizations/organization%3A1/bills?status=${oversizedStatus}&limit=101`)
    ])

    expect([
      extraPath.status,
      wrongMethod.status,
      unsupported.status,
      duplicate.status,
      invalidRelationship.status,
      invalidDate.status,
      invertedRange.status,
      mixedFormats.status,
      limit.status
    ]).toEqual([404, 404, 400, 400, 400, 400, 400, 400, 400])
  })

  it("fails closed when a listed bill lacks canonical source provenance", async () => {
    const baseUrl = await startServer({
      assertOrganizationExists: async () => undefined,
      listOrganizationBillReads: async () => ({ items: [bill({ sourceUrl: "not-a-url" })], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/organizations/organization%3A1/bills`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })

  it("fails closed with a 422 rather than an internal error for an incomplete bill payload", async () => {
    const incomplete = structuredClone(bill())
    Reflect.deleteProperty(incomplete, "classification")
    const baseUrl = await startServer({
      assertOrganizationExists: async () => undefined,
      listOrganizationBillReads: async (): Promise<OrganizationBillReadPage> => ({
        items: [incomplete],
        truncated: false
      })
    })
    const response = await fetch(`${baseUrl}/api/organizations/organization%3A1/bills`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
