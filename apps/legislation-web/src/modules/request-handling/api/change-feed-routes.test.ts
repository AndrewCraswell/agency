import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { afterEach, describe, expect, it } from "vitest"
import type { ChangeEventRead, ChangeFeedPage } from "../../legislation/persistence/queries/change-feed-reads.js"
import { projectChangeEventRead } from "../../legislation/persistence/queries/change-feed-reads.js"
import { close, createLegislationServer } from "../test-http-server.js"
import { createChangeFeedApiHandler, type ChangeFeedApi } from "./change-feed-routes.js"

const servers = new Set<ReturnType<typeof createLegislationServer>>()
const logger = createLogger({ level: "error", service: "change-feed-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...servers].map(async (server) => await close(server)))
  servers.clear()
})

async function startServer(service: ChangeFeedApi) {
  const server = createLegislationServer({
    apiHandler: createChangeFeedApiHandler(service, { apiBaseUrl: "https://api.example.test" }),
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

function event(overrides: Partial<ChangeEventRead["event"]> = {}): ChangeEventRead {
  return {
    event: {
      after: { status: "passed" },
      before: { status: "pending" },
      changedFields: ["status"],
      changeType: "update",
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      id: "change:1",
      ingestionRunId: "00000000-0000-4000-8000-000000000001",
      jurisdictionId: "jurisdiction:us",
      organizationId: null,
      personId: null,
      observedAt: new Date("2026-08-01T12:00:00.000Z"),
      recordId: "bill:us:119:house:hr-1",
      recordType: "bill",
      sourceUpdatedAt: new Date("2026-08-01T10:00:00.000Z"),
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: new Date("2026-08-01T12:00:00.000Z"),
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1",
      ...overrides
    }
  }
}

describe("change feed API handler", () => {
  it("keeps the source and payload captured at observation time after the record changes", () => {
    const observed = event()
    const laterRecord = {
      ...observed.event,
      after: { status: "withdrawn" },
      sourceProvider: "openstates",
      sourceRetrievedAt: new Date("2026-08-03T12:00:00.000Z"),
      sourceUrl: "https://api.openstates.org/v3/bills/changed"
    }

    const projected = projectChangeEventRead(observed, "https://api.example.test")

    expect(projected.after).toEqual({ status: "passed" })
    expect(projected.sources[0]).toMatchObject({
      provider: "congress",
      retrievedAt: "2026-08-01T12:00:00.000Z",
      sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1"
    })
    expect(laterRecord.after).not.toEqual(projected.after)
  })

  it("serves global changes with canonical provenance and filter-bound pagination", async () => {
    let received: unknown
    const path =
      "/api/changes?recordType=bill&recordId=bill%3Aus%3A119%3Ahouse%3Ahr-1&jurisdictionId=jurisdiction%3Aus&organizationId=organization%3Aus%3Ahouse&personId=person%3Aus%3A1&classification=update&observedFrom=2026-01-01T00%3A00%3A00.000Z&observedTo=2026-12-31T23%3A59%3A59.000Z&limit=1"
    const baseUrl = await startServer({
      assertBillExists: async () => undefined,
      getChange: async () => event(),
      listChanges: async (input) => {
        received = input
        return { items: [event()], nextCursor: "next-cursor", truncated: true }
      }
    })
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-correlation-id": "change-feed" } })

    expect(response.status).toBe(200)
    expect(received).toMatchObject({
      classification: "update",
      jurisdictionId: "jurisdiction:us",
      limit: 1,
      organizationId: "organization:us:house",
      personId: "person:us:1",
      recordId: "bill:us:119:house:hr-1",
      recordType: "bill"
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          canonicalUrl: "https://api.example.test/api/changes/change%3A1",
          id: "change:1",
          sources: [{ provider: "congress", sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1" }],
          type: "change"
        }
      ],
      links: { next: `${path}&cursor=next-cursor`, self: path },
      meta: { correlationId: "change-feed", limit: 1, nextCursor: "next-cursor", truncated: true }
    })
  })

  it("scopes bill changes and checks the bill parent before listing", async () => {
    let received: unknown
    const baseUrl = await startServer({
      assertBillExists: async (billId) => {
        if (billId === "bill:missing") {
          throw new LegislationError("not_found", "Bill was not found")
        }
      },
      getChange: async () => event(),
      listChanges: async (input) => {
        received = input
        return { items: [event()], truncated: false }
      }
    })
    const response = await fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahouse%3Ahr-1/changes?classification=create`)
    expect(response.status).toBe(200)
    expect(received).toMatchObject({ billId: "bill:us:119:house:hr-1", classification: "create", limit: 20 })

    const missing = await fetch(`${baseUrl}/api/bills/bill%3Amissing/changes`)
    expect(missing.status).toBe(404)
  })

  it("rejects encoded route aliases, unsupported or duplicate filters, and inverted bounds", async () => {
    const baseUrl = await startServer({
      assertBillExists: async () => undefined,
      getChange: async () => event(),
      listChanges: async (): Promise<ChangeFeedPage> => ({ items: [], truncated: false })
    })
    const responses = await Promise.all([
      fetch(`${baseUrl}/%61pi/changes`),
      fetch(`${baseUrl}/api/changes?changeType=update`),
      fetch(`${baseUrl}/api/changes?classification=update&classification=create`),
      fetch(`${baseUrl}/api/changes?observedFrom=2026-02-02T00%3A00%3A00Z&observedTo=2026-02-01T00%3A00%3A00Z`),
      fetch(`${baseUrl}/api/changes/%ZZ`),
      fetch(`${baseUrl}/api/changes/change%3A1/`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahouse%3Ahr-1/changes?classification=invalid`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahouse%3Ahr-1//changes`),
      fetch(`${baseUrl}/api/bills/bill%3Aus%3A119%3Ahouse%3Ahr-1/changes/`)
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 400, 400, 400, 400, 404, 400, 404, 404])
  })

  it("fails closed through HTTP when a legacy change has no captured source snapshot", async () => {
    const missingSource = event()
    missingSource.event.sourceIsOfficial = null
    missingSource.event.sourceProvider = null
    missingSource.event.sourceRetrievedAt = null
    missingSource.event.sourceUrl = null
    const baseUrl = await startServer({
      assertBillExists: async () => undefined,
      getChange: async () => event(),
      listChanges: async () => ({ items: [missingSource], truncated: false })
    })
    const response = await fetch(`${baseUrl}/api/changes`)

    expect(response.status).toBe(422)
  })

  it("serves the canonical change detail URL and rejects query parameters", async () => {
    let received: string | undefined
    const baseUrl = await startServer({
      assertBillExists: async () => undefined,
      getChange: async (changeId) => {
        received = changeId
        return event({ id: changeId })
      },
      listChanges: async () => ({ items: [], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/changes/change%3A1`, {
      headers: { "x-correlation-id": "change-detail" }
    })
    expect(response.status).toBe(200)
    expect(received).toBe("change:1")
    await expect(response.json()).resolves.toMatchObject({
      data: {
        canonicalUrl: "https://api.example.test/api/changes/change%3A1",
        id: "change:1",
        type: "change"
      },
      links: { self: "/api/changes/change%3A1" },
      meta: { correlationId: "change-detail" }
    })

    const withQuery = await fetch(`${baseUrl}/api/changes/change%3A1?limit=1`)
    expect(withQuery.status).toBe(400)
  })

  it("returns not found for absent or provenance-incomplete change details", async () => {
    const baseUrl = await startServer({
      assertBillExists: async () => undefined,
      getChange: async () => {
        throw new LegislationError("not_found", "Change was not found")
      },
      listChanges: async () => ({ items: [], truncated: false })
    })

    const response = await fetch(`${baseUrl}/api/changes/change%3Amissing`)
    expect(response.status).toBe(404)
  })
})
