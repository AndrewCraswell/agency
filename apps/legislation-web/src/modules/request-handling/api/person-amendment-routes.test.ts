import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type {
  PersonAmendmentRead,
  PersonAmendmentsPage
} from "../../legislation/persistence/queries/person-amendments.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createPersonAmendmentApiHandler, type PersonAmendmentsApi } from "./person-amendment-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "person-amendment-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: PersonAmendmentsApi) {
  const server = createLegislationServer({
    apiHandler: createPersonAmendmentApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function amendment(overrides: Partial<PersonAmendmentRead["amendment"]> = {}): PersonAmendmentRead {
  return {
    amendment: {
      amendmentNumber: "1",
      amendmentType: "amendment",
      billId: "bill:us:119:house:hr-1",
      chamber: "house",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      description: "A test amendment",
      id: "amendment:us:119:house:hr:1",
      jurisdictionId: "jurisdiction:us",
      printedIdentifier: "H.Amdt. 1",
      purpose: "Test amendment",
      sessionId: "session:us:119",
      sourceId: "source:amendment:1",
      sourceUrl: "https://api.congress.gov/v3/amendment/119/house/1",
      sourceUpdatedAt: new Date("2026-01-03T00:00:00.000Z"),
      sponsorName: "Representative Example",
      sponsorPersonId: "person:us:example",
      sponsorSourceId: "member-1",
      status: "pending",
      submittedDate: "2026-01-03",
      upstreamIds: { congress: "119/house/1" },
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      ...overrides
    }
  }
}

describe("person amendment API handler", () => {
  it("returns canonical sponsor-linked amendment summaries and preserves filters", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonAmendments: async (input) => {
        received = input
        return { items: [amendment()], nextCursor: "next-cursor", truncated: true }
      }
    })
    const path =
      "/api/people/person%3Aus%3Aexample/amendments?sessionId=session%3Aus%3A119&status=pending&from=2026-01-01&to=2026-12-31&limit=1"
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "person-amendment" } })

    expect(response.status).toBe(200)
    expect(received).toEqual({
      cursor: undefined,
      from: "2026-01-01",
      limit: 1,
      personId: "person:us:example",
      sessionId: "session:us:119",
      status: "pending",
      to: "2026-12-31"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          billId: "bill:us:119:house:hr-1",
          canonicalUrl: "https://api.example.test/api/amendments/amendment%3Aus%3A119%3Ahouse%3Ahr%3A1",
          id: "amendment:us:119:house:hr:1",
          recordType: "structured",
          type: "amendment"
        }
      ],
      links: { next: `${path}&cursor=next-cursor`, self: path },
      meta: { correlationId: "person-amendment", limit: 1, nextCursor: "next-cursor", truncated: true }
    })
  })

  it("returns parent 404 before querying amendments", async () => {
    let listed = false
    const baseUrl = await startServer({
      assertPersonExists: async () => {
        throw new LegislationError("not_found", "Person was not found")
      },
      listPersonAmendments: async (): Promise<PersonAmendmentsPage> => {
        listed = true
        return { items: [], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/people/person%3Amissing/amendments`, {
      headers: { "x-correlation-id": "missing-person" }
    })

    expect(response.status).toBe(404)
    expect(listed).toBe(false)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "not_found", correlationId: "missing-person", retryable: false }
    })
  })

  it("uses the shared pagination default", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonAmendments: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })

    const response = await fetch(`${baseUrl}/api/people/person%3Aus%3Aexample/amendments`)

    expect(response.status).toBe(200)
    expect(received).toMatchObject({ limit: 20, personId: "person:us:example" })
  })

  it("rejects unsupported, duplicate, malformed, and inverted filters", async () => {
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonAmendments: async () => ({ items: [], truncated: false })
    })
    const [extra, method, unknown, duplicate, invalidDate, inverted, mixedFormats, limit, encodedAlias] =
      await Promise.all([
        fetch(`${baseUrl}/api/people/person%3A1/amendments/extra`),
        fetch(`${baseUrl}/api/people/person%3A1/amendments`, { method: "POST" }),
        fetch(`${baseUrl}/api/people/person%3A1/amendments?role=sponsor`),
        fetch(`${baseUrl}/api/people/person%3A1/amendments?status=pending&status=passed`),
        fetch(`${baseUrl}/api/people/person%3A1/amendments?from=2026-02-30`),
        fetch(`${baseUrl}/api/people/person%3A1/amendments?from=2026-02-02&to=2026-02-01`),
        fetch(`${baseUrl}/api/people/person%3A1/amendments?from=2026-02-01&to=2026-02-02T00%3A00%3A00Z`),
        fetch(`${baseUrl}/api/people/person%3A1/amendments?limit=101`),
        fetch(`${baseUrl}/%61pi/people/person%3A1/amendments`)
      ])

    expect([
      extra.status,
      method.status,
      unknown.status,
      duplicate.status,
      invalidDate.status,
      inverted.status,
      mixedFormats.status,
      limit.status,
      encodedAlias.status
    ]).toEqual([404, 404, 400, 400, 400, 400, 400, 400, 404])
  })

  it("fails closed when the persisted amendment is detached from its bill", async () => {
    const detached = amendment({ billId: null })
    const baseUrl = await startServer({
      assertPersonExists: async () => undefined,
      listPersonAmendments: async () => ({ items: [detached], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/people/person%3A1/amendments`)

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable", retryable: false } })
  })
})
