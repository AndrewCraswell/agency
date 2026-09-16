import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type {
  PersonBillActivity,
  PersonBillActivityPage
} from "../../legislation/persistence/queries/person-bill-activity.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createPersonBillActivityApiHandler, type PersonBillActivityApi } from "./person-bill-activity-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "person-bill-activity-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: PersonBillActivityApi) {
  const server = createLegislationServer({
    apiHandler: createPersonBillActivityApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function activity(overrides: Partial<PersonBillActivity> = {}): PersonBillActivity {
  return {
    bill: {
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
      upstreamIds: { congress: "119/hr/1" }
    },
    firstObservedAt: new Date("2026-08-01T12:00:00.000Z"),
    latestObservedAt: new Date("2026-08-22T12:00:00.000Z"),
    roles: ["sponsor", "author"],
    ...overrides
  }
}

describe("person bill activity API handler", () => {
  it("keeps complete BillActivity roles when filtering by one role", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonBillActivity: async (input) => {
        received = input
        return { items: [activity()], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path =
      "/api/people/person%3Aus%3Aexample/bills?role=sponsor&sessionId=session%3Aus%3A119&status=pending&from=2026-01-01&to=2026-12-31&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "person-bill-activity" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      from: "2026-01-01",
      limit: 1,
      personId: "person:us:example",
      role: "sponsor",
      sessionId: "session:us:119",
      status: "pending",
      to: "2026-12-31"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          bill: {
            canonicalUrl: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahouse%3Ahr-1",
            id: "bill:us:119:house:hr-1",
            type: "bill"
          },
          firstObservedAt: "2026-08-01T12:00:00.000Z",
          latestObservedAt: "2026-08-22T12:00:00.000Z",
          roles: ["sponsor", "author"]
        }
      ],
      links: {
        next: `${path}&cursor=next-cursor`,
        self: path
      },
      meta: {
        correlationId: "person-bill-activity",
        limit: 1,
        nextCursor: "next-cursor",
        truncated: true,
        warnings: []
      }
    })
  })

  it("accepts the stored subject role and equal RFC3339 observation bounds", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonBillActivity: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })
    const timestamp = "2026-08-22T12:00:00.000Z"
    const response = await fetch(
      `${baseUrl}/api/people/person%3Aus%3Aexample/bills?role=subject&from=${encodeURIComponent(timestamp)}&to=${encodeURIComponent(timestamp)}`
    )

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      from: timestamp,
      limit: 20,
      personId: "person:us:example",
      role: "subject",
      sessionId: undefined,
      status: undefined,
      to: timestamp
    })
  })

  it("returns a correlated parent 404 before listing activity", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertPersonExists: async () => {
        throw new LegislationError("not_found", "Person was not found")
      },
      listPersonBillActivity: async () => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/people/person%3Amissing/bills`, {
      headers: { "x-correlation-id": "missing-person" }
    })

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-person", retryable: false }
    })
  })

  it("rejects undocumented, duplicate, and unsupported filter values", async () => {
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonBillActivity: async () => ({ items: [], truncated: false })
    })
    const [
      extraPath,
      wrongMethod,
      unsupported,
      duplicate,
      invalidRole,
      invalidDate,
      invertedRange,
      mixedFormats,
      limit
    ] = await Promise.all([
      fetch(`${baseUrl}/api/people/person%3A1/bills/extra`),
      fetch(`${baseUrl}/api/people/person%3A1/bills`, { method: "POST" }),
      fetch(`${baseUrl}/api/people/person%3A1/bills?unknown=value`),
      fetch(`${baseUrl}/api/people/person%3A1/bills?status=pending&status=passed`),
      fetch(`${baseUrl}/api/people/person%3A1/bills?role=primary`),
      fetch(`${baseUrl}/api/people/person%3A1/bills?from=2026-02-30`),
      fetch(`${baseUrl}/api/people/person%3A1/bills?from=2026-02-02&to=2026-02-01`),
      fetch(`${baseUrl}/api/people/person%3A1/bills?from=2026-02-01&to=2026-02-02T00%3A00%3A00Z`),
      fetch(`${baseUrl}/api/people/person%3A1/bills?limit=101`)
    ])

    expect([
      extraPath.status,
      wrongMethod.status,
      unsupported.status,
      duplicate.status,
      invalidRole.status,
      invalidDate.status,
      invertedRange.status,
      mixedFormats.status,
      limit.status
    ]).toEqual([404, 404, 400, 400, 400, 400, 400, 400, 400])
  })

  it("fails closed when activity bounds, roles, or bill provenance are incomplete", async () => {
    const incomplete = structuredClone(activity())
    const invalidBounds = structuredClone(activity({ firstObservedAt: new Date("2026-08-23T12:00:00.000Z") }))
    const invalidRoles = structuredClone(activity({ roles: ["subject", "subject"] }))
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonBillActivity: async (): Promise<PersonBillActivityPage> => ({
        items: [incomplete, invalidBounds, invalidRoles],
        truncated: false
      })
    })
    Reflect.deleteProperty(incomplete.bill, "classification")
    const response = await fetch(`${baseUrl}/api/people/person%3A1/bills`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
